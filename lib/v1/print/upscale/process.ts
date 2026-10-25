// lib/v1/print/upscale/process.ts
//
// The resumable job processor. One job = one order line. Each step SAVES its result before the next
// begins, so a crash, a timeout or a cold start resumes from the last saved step.
//
//   queued ─▶ preparing ─▶ ready_to_submit ─▶ submitting ─▶ upscaling ─▶ finishing ─▶ qa ─▶ approved
//                              │                                                      └──▶ review ─▶ approved | rejected
//                              └─ (no upscale needed) ──────────────────────────────▶ finishing
//                                                                      any step ───▶ failed (admin can reset)
//
// WHAT THE STEPS GUARANTEE
//  - Settings are frozen into the job at 'preparing'. A later config change never reaches an in-flight job.
//  - Nothing reaches Prodigi unless the job is 'approved' (fulfillment.ts checks, and re-verifies the file hash).
//  - The customer's artwork is never regenerated. The only inputs are the stored original and, where needed,
//    the existing aspect extension.
//  - QA compares the enlargement against the ASPECT-CORRECTED artwork (after any outpaint or reflection), not
//    against the pre-extension original.
//
// THE PAID-CALL CRASH WINDOW (see providers.ts for the full statement)
//  A provider call can succeed and the process die before its prediction id is saved. Mitigations, in order:
//   1. The attempt is recorded BEFORE the call (submit_state='submitting', submit_started_at, submit_attempts).
//   2. The id is saved the instant start() returns; that window is a single database write.
//   3. A resumed job in that state first asks the provider whether it already has a prediction for this job
//      (Replicate: list by the job's unique input path). If found, it adopts it and never submits again.
//   4. If the provider cannot be asked (Pruna direct), the job re-submits once, flagged possible_duplicate
//      so the extra charge can be reconciled; a second ambiguity sends the job to a person instead.
//  REMAINING RISK: on Pruna direct, a crash inside that window costs at most one extra upscale (max $0.12),
//  recorded and visible. On Replicate the residual risk is the provider's list lagging behind a new prediction;
//  the processor waits 60 s before concluding nothing was created.

import sharp from 'sharp'
import { encodeForUpscale } from '../asset-pipeline'
import { NoProfileError, profileFor } from './profiles'
import { computeTarget, sourceQuality, validateOutput, TargetError, type Dim } from './target'
import { settingsHash, SETTING_KEYS, type ResolvedSettings, type UpscaleSettings } from './settings'
import { estimateCostUsd, ProviderError, type UpscaleProvider } from './providers'
import { checkFinalAsset, sha256 } from './checks'
import type { UpscaleQa } from './qa'
import { newToken, type AssetJob, type AssetStorage, type JobEvent, type JobPatch, type JobStore } from './store'

export const MAX_SUBMITS = 3
export const MAX_LEASES = 25
const RECOVERY_WAIT_MS = 60_000

export interface ProcessDeps {
  store: JobStore
  storage: AssetStorage
  /** The customer's stored original, as base64. */
  loadSource(job: AssetJob): Promise<Buffer>
  loadSettings(job: AssetJob): Promise<ResolvedSettings>
  /** The layout the approved picture was sold in (gift mugs: 'mug_single_panel'); frozen with the settings so every later step of the job uses the same one. Absent = the layout that existed before layouts were recorded. */
  layoutOf?(job: AssetJob): Promise<string | null>
  provider(name: 'replicate' | 'pruna'): UpscaleProvider
  inspect(input: { reference: Buffer; result: Buffer; context: { series?: string; effect?: string } }): Promise<UpscaleQa>
  context?(job: AssetJob): { series?: string; effect?: string } | Promise<{ series?: string; effect?: string }>
  /** Called once when a job needs a person (review or failed). */
  onAttention?(job: AssetJob): Promise<void>
  now?(): number
  sleep?(ms: number): Promise<void>
  leaseSeconds?: number
  budgetMs?: number
  pollMs?: number
}

export type RunOutcome = 'terminal' | 'waiting' | 'busy' | 'lost'

const TERMINAL = ['approved', 'review', 'rejected', 'failed']
const frozen = (j: AssetJob) => (j.settings_snapshot ?? {}) as unknown as UpscaleSettings

export async function runJob(deps: ProcessDeps, jobId: string): Promise<{ job: AssetJob | null; outcome: RunOutcome }> {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)))
  const token = newToken()
  const started = now()
  const budget = deps.budgetMs ?? 240_000
  const poll = deps.pollMs ?? 3_000

  let job = await deps.store.lease(jobId, deps.leaseSeconds ?? 300, token)
  if (!job) return { job: await deps.store.get(jobId), outcome: 'busy' }
  // A job that keeps coming back without finishing is stuck on something no retry will fix.
  if (job.attempts > MAX_LEASES) {
    const stuck = await deps.store.update(jobId, token, { status: 'failed', error: 'too_many_attempts', lease_token: null, lease_until: null })
    return { job: stuck ?? await deps.store.get(jobId), outcome: 'terminal' }
  }

  const save = async (patch: JobPatch, step?: string, note?: string): Promise<AssetJob> => {
    const events: JobEvent[] = step ? [...(job!.events ?? []), { at: new Date(now()).toISOString(), step, note }].slice(-60) : job!.events
    const next = await deps.store.update(jobId, token, { ...patch, events })
    if (!next) throw new LeaseLost()
    job = next
    return job
  }
  const release = async () => { if (job) await deps.store.update(jobId, token, { lease_token: null, lease_until: null }).catch(() => null) }

  try {
    for (let guard = 0; guard < 24; guard++) {
      const status = job.status
      if (TERMINAL.includes(status)) break
      const outcome = await step(deps, job, save, { now, sleep, poll, started, budget })
      if (outcome === 'waiting') { await release(); return { job, outcome: 'waiting' } }
    }
    const done = job
    if (done && ['review', 'failed'].includes(done.status) && !done.notified_at && deps.onAttention) {
      try { await deps.onAttention(done); await save({ notified_at: new Date(now()).toISOString() }) } catch (e) { /* notification failure never changes the job */ }
    }
    await release()
    return { job, outcome: 'terminal' }
  } catch (e) {
    if (e instanceof LeaseLost) return { job: await deps.store.get(jobId), outcome: 'lost' }
    // An unexpected error: record it, keep the job resumable, never swallow it silently.
    const msg = e instanceof Error ? e.message : String(e)
    try { await save({ error: msg.slice(0, 500) }, 'error', msg.slice(0, 200)) } catch { /* lease lost */ }
    await release()
    return { job, outcome: 'waiting' }
  }
}

class LeaseLost extends Error {}
type Save = (patch: JobPatch, step?: string, note?: string) => Promise<AssetJob>
interface Clock { now: () => number; sleep: (ms: number) => Promise<void>; poll: number; started: number; budget: number }
type StepResult = 'advanced' | 'waiting'

const compPath = (j: AssetJob) => `${j.id}/composition.png`
const preparedPath = (j: AssetJob) => `${j.id}/prepared.jpg`

async function step(deps: ProcessDeps, job: AssetJob, save: Save, clock: Clock): Promise<StepResult> {
  switch (job.status) {
    case 'queued':
    case 'preparing': return prepare(deps, job, save)
    case 'ready_to_submit':
    case 'submitting': return submit(deps, job, save, clock)
    case 'upscaling': return awaitUpscale(deps, job, save, clock)
    case 'finishing': return finish(deps, job, save)
    case 'qa': return inspect(deps, job, save)
    default: return 'advanced'
  }
}

// ── 1. PREPARE: freeze settings, build the aspect-corrected artwork, work out the target ──────────────
async function prepare(deps: ProcessDeps, job: AssetJob, save: Save): Promise<StepResult> {
  let j = job
  if (!j.settings_snapshot) {
    const resolved = await deps.loadSettings(j)
    const s = resolved.settings, layout = deps.layoutOf ? await deps.layoutOf(j) : null
    j = await save({
      status: 'preparing', provider: s.provider, settings_hash: settingsHash(s), settings_version: resolved.version,
      settings_snapshot: { ...Object.fromEntries(SETTING_KEYS.map(k => [k, s[k]])), resolved_from: resolved.sources, ...(layout ? { layout } : {}) } as Record<string, unknown>,
    }, 'settings_frozen', `${resolved.sources.join('>')} v${resolved.version}`)
  }
  const s = frozen(j)
  const source = await deps.loadSource(j)
  let profile: ReturnType<typeof profileFor>
  try { profile = profileFor(j) } catch (e) { return fail(save, e instanceof NoProfileError ? e.message : 'no_artwork_profile') }
  let comp: Awaited<ReturnType<typeof profile.prepare>>
  try { comp = await profile.prepare({ job: j, source, ppi: s.target_ppi }) }
  catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    // Geometry and outpaint refusals are definitive: retrying would repeat a paid outpaint for the same answer.
    if (/^(print_|incompatible_print|invalid_print)/.test(msg)) return fail(save, msg)
    throw e
  }

  const warnings = [] as AssetJob['warnings']
  const q = sourceQuality({ w: comp.width, h: comp.height }, comp.targetPlan.front, s.min_source_ppi)
  if (q.belowFloor) warnings.push({ code: 'source_quality_below_floor', detail: `${q.sourcePpi} PPI of real detail at this size; floor ${q.floor}` })
  if (comp.outpainted) warnings.push({ code: 'extended_by_outpaint', detail: 'The artwork was extended by AI outpaint to fit this print shape.' })

  let target: ReturnType<typeof computeTarget> | null = null
  if (comp.scale > 0) {
    try { target = computeTarget(comp.targetPlan, s.target_ppi, s.max_megapixels) }
    catch (e) {
      const code = e instanceof TargetError ? e.code : 'print_target_invalid'
      return fail(save, `${code}:${e instanceof Error ? e.message : ''}`)
    }
  }
  const composition = await sharp(comp.working).png().toBuffer()
  await deps.storage.put(compPath(j), composition, 'image/png')
  if (target) await deps.storage.put(preparedPath(j), await encodeForUpscale(comp.working), 'image/jpeg')
  const base: JobPatch = {
    source_sha256: sha256(source), input_path: compPath(j), input_sha256: sha256(composition), input_w: comp.width, input_h: comp.height,
    source_ppi: q.sourcePpi, warnings, required_front_w: comp.requiredFront.w, required_front_h: comp.requiredFront.h,
    required_final_w: comp.targetPlan.final.w, required_final_h: comp.targetPlan.final.h, error: null,
  }
  if (!target) {
    // Already big enough: no paid call, straight to the print file.
    await save({ ...base, target_mp: null, cost_usd_est: 0, cost_basis: 'no upscale needed', status: 'finishing' }, 'prepared', 'no upscale needed')
  } else {
    await save({ ...base, target_mp: target.targetMp, status: 'ready_to_submit' }, 'prepared', `target ${target.targetMp} MP (+${target.overshootPct.toFixed(1)}%)`)
  }
  return 'advanced'
}

const fail = async (save: Save, reason: string): Promise<StepResult> => { await save({ status: 'failed', error: reason.slice(0, 500) }, 'failed', reason.slice(0, 200)); return 'advanced' }

// ── 2. SUBMIT: the paid call, with the crash window handled ─────────────────────────────────────────
async function submit(deps: ProcessDeps, job: AssetJob, save: Save, clock: Clock): Promise<StepResult> {
  const s = frozen(job)
  const provider = deps.provider(s.provider)
  let j = job

  if (j.prediction_id) { await save({ status: 'upscaling', submit_state: 'submitted' }, 'resume', 'prediction already recorded'); return 'advanced' }

  // A previous attempt began and never recorded an id: it may or may not have created a prediction.
  if (j.submit_state === 'submitting') {
    const since = new Date(j.submit_started_at ?? clock.now())
    if (provider.findRecent) {
      const found = await provider.findRecent({ pathMarker: `print-assets/${j.id}/`, since }).catch(() => null)
      if (found) {
        await save({ prediction_id: found, submit_state: 'submitted', status: 'upscaling', provider: provider.name, ...cost(provider.name, j.target_mp!) }, 'adopted_prediction', found)
        return 'advanced'
      }
      // Nothing listed yet. Listings can lag; do not conclude "none" too soon.
      if (clock.now() - Date.parse(j.submit_started_at ?? '') < RECOVERY_WAIT_MS) return 'waiting'
    } else {
      // This provider cannot be asked. Allow ONE blind re-submission, flagged for reconciliation.
      if (j.submit_attempts >= 2) { await save({ status: 'review', possible_duplicate: true, review_reason: 'submit_state_unresolved' }, 'needs_review', 'could not confirm whether a prediction exists'); return 'advanced' }
      j = await save({ possible_duplicate: true }, 'possible_duplicate', 'prior submit unconfirmed; re-submitting once')
    }
  }
  if (j.submit_attempts >= MAX_SUBMITS) return fail(save, 'provider_submit_attempts_exhausted')

  // Record the attempt BEFORE the call. If we die now, the next run knows a call may be in flight.
  j = await save({ status: 'submitting', submit_state: 'submitting', submit_started_at: new Date(clock.now()).toISOString(), submit_attempts: j.submit_attempts + 1 }, 'submitting', provider.name)
  try {
    const url = await deps.storage.signedUrl(preparedPath(j), 3600)
    const { id } = await provider.start({ imageUrl: url, targetMp: j.target_mp!, settings: s })
    // ── the crash window is the gap between the line above returning and the write below ──
    await save({ prediction_id: id, submit_state: 'submitted', status: 'upscaling', provider: provider.name, ...cost(provider.name, j.target_mp!) }, 'submitted', id)
    return 'advanced'
  } catch (e) {
    if (e instanceof LeaseLost) throw e
    const pe = e instanceof ProviderError ? e : null
    const note = (pe?.code ?? 'error') + ':' + (e instanceof Error ? e.message : '')
    if (pe && !pe.ambiguous) {
      // A definite refusal: nothing was created. Safe to try again later, or stop if it can never work.
      if (!pe.retryable) return fail(save, note)
      await save({ status: 'ready_to_submit', submit_state: 'none', error: note.slice(0, 300) }, 'submit_refused', note.slice(0, 200))
      return 'waiting'
    }
    // Ambiguous (timeout, dropped connection, 5xx): a prediction may exist. Leave submit_state='submitting'.
    await save({ error: note.slice(0, 300) }, 'submit_ambiguous', note.slice(0, 200))
    return 'waiting'
  }
}

const cost = (provider: string, mp: number) => {
  const c = estimateCostUsd(mp, provider as 'replicate' | 'pruna')
  return { cost_usd_est: c.usd, cost_basis: c.basis }
}

// ── 3. WAIT for the prediction ────────────────────────────────────────────────────────────────────
async function awaitUpscale(deps: ProcessDeps, job: AssetJob, save: Save, clock: Clock): Promise<StepResult> {
  const s = frozen(job)
  const provider = deps.provider(s.provider)
  for (;;) {
    let st
    try { st = await provider.poll(job.prediction_id!) }
    catch (e) {
      if (e instanceof ProviderError && e.retryable) { if (clock.now() - clock.started > clock.budget) return 'waiting'; await clock.sleep(clock.poll); continue }
      return fail(save, 'poll_failed:' + (e instanceof Error ? e.message : ''))
    }
    // The provider says it finished but returned no image (seen on Replicate: a succeeded prediction with a null output).
    // Polling on would spin until the time budget, run after run. It is paid and over: stop and let a person decide.
    if (st.status === 'succeeded' && !st.outputUrl) return fail(save, 'prediction_succeeded_without_output:' + job.prediction_id)
    if (st.status === 'succeeded' && st.outputUrl) {
      const bytes = await provider.download(st.outputUrl)
      const md = await sharp(bytes).metadata()
      const out: Dim = { w: md.width ?? 0, h: md.height ?? 0 }
      const ext = md.format === 'jpeg' ? 'jpg' : (md.format ?? 'bin')
      const path = `${job.id}/upscaled.${ext}`
      await deps.storage.put(path, bytes, `image/${md.format ?? 'octet-stream'}`)
      const check = validateOutput(out, { w: job.input_w!, h: job.input_h! }, { w: job.required_front_w!, h: job.required_front_h! }, job.target_mp!)
      const ms = st.predictMs ?? Math.max(0, clock.now() - Date.parse(job.submit_started_at ?? '') || 0)
      const patch: JobPatch = { output_path: path, output_w: out.w, output_h: out.h, upscale_ms: ms, error: null }
      if (!check.ok) { await save({ ...patch, status: 'review', review_reason: 'upscale_output_invalid:' + check.errors.join(',') }, 'output_invalid', check.errors.join(',')); return 'advanced' }
      await save({ ...patch, status: 'finishing' }, 'upscaled', `${out.w}x${out.h} (${check.actualMp.toFixed(1)} MP)`)
      return 'advanced'
    }
    if (st.status === 'failed' || st.status === 'canceled') {
      // The provider did not produce an image. Try again, within the cap.
      await save({ status: 'ready_to_submit', prediction_id: null, submit_state: 'none', error: `prediction_${st.status}:${st.error ?? ''}`.slice(0, 300) }, 'prediction_failed', `${job.prediction_id}:${st.error ?? ''}`.slice(0, 200))
      return 'advanced'
    }
    if (clock.now() - clock.started > clock.budget) return 'waiting'
    await clock.sleep(clock.poll)
  }
}

// ── 4. FINISH: exact print file + deterministic checks ───────────────────────────────────────────
async function finish(deps: ProcessDeps, job: AssetJob, save: Save): Promise<StepResult> {
  try {
    const profile = profileFor(job)
    const upscaled = !!job.output_path
    const image = await deps.storage.get(upscaled ? job.output_path! : job.input_path!)
    const finished = await profile.finish({ job, image, upscaled, targetMp: job.target_mp ?? undefined })
    const check = await checkFinalAsset(finished.jpeg, finished.expected)
    if (!check.ok) return fail(save, 'invalid_file:' + check.errors.join(','))
    const path = `${job.id}/final.jpg`
    await deps.storage.put(path, finished.jpeg, 'image/jpeg')
    await save({ final_path: path, final_sha256: check.facts.sha256, final_w: check.facts.width, final_h: check.facts.height, status: 'qa' }, 'finished', `${check.facts.width}x${check.facts.height}`)
    return 'advanced'
  } catch (e) {
    if (e instanceof LeaseLost) throw e
    return fail(save, 'finish_failed:' + (e instanceof Error ? e.message : String(e)))
  }
}

// ── 5. INSPECT, then decide: approved only if nothing needs a person ────────────────────────────────
async function inspect(deps: ProcessDeps, job: AssetJob, save: Save): Promise<StepResult> {
  const s = frozen(job)
  const profile = profileFor(job)
  const reasons: string[] = []
  let qa: UpscaleQa | null = null
  let verdict: AssetJob['qa_verdict'] = 'skipped'
  if (s.qa_enabled) {
    const final = await deps.storage.get(job.final_path!)
    const front = await profile.qaRegion({ job, final })
    const reference = await deps.storage.get(job.input_path!)
    // Small side-by-side copies for the review screen (the full files can be tens of megabytes).
    for (const [name, buf] of [['review-reference', reference], ['review-result', front]] as const) {
      await deps.storage.put(`${job.id}/${name}.jpg`, await sharp(buf).resize({ width: 1400, withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(), 'image/jpeg')
    }
    for (let i = 0; i < 3; i++) {
      qa = await deps.inspect({ reference, result: front, context: (await deps.context?.(job)) ?? {} })
      if (qa.verdict !== 'error') break
    }
    verdict = qa!.verdict
    if (verdict === 'error') reasons.push('qa_unavailable')
    else if (verdict === 'uncertain') reasons.push('qa_uncertain')
    else if (verdict === 'defect') reasons.push('qa_defect')
  } else {
    reasons.push('qa_disabled')       // never auto-approve without an inspection
  }
  // Native source PPI is diagnostic only (job.warnings keeps it). The approval judges the FINISHED file: deterministic
  // validation already passed to reach this stage, and the inspection verdict above decides the rest.
  if (s.human_approval === 'all') reasons.push('human_approval_required')
  if (job.possible_duplicate) reasons.push('possible_duplicate_charge')
  await save({ qa, qa_verdict: verdict, status: reasons.length ? 'review' : 'approved', review_reason: reasons.length ? reasons.join(',') : null },
    reasons.length ? 'needs_review' : 'approved', reasons.join(','))
  return 'advanced'
}

/** The state an admin-reset failed job should resume from, based on what was already saved. */
export function resumeStatusFor(job: AssetJob): AssetJob['status'] {
  if (job.final_path) return 'qa'
  if (job.output_path) return 'finishing'
  if (job.input_path && job.target_mp) return 'ready_to_submit'
  if (job.input_path) return 'finishing'
  return 'queued'
}
