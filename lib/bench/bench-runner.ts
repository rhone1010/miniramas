// lib/bench/bench-runner.ts
//
// Test Bench worker. Designed to run as a long-lived Node process
// (npm run bench -- --run <run_id>), NOT inside a Next.js route —
// route timeouts and a thousand-image batch don't mix. The admin UI
// talks to the same Supabase tables; the worker is headless.
//
// Control model — everything flows through the database:
//   START   UI sets run.status='running'; worker (already watching or
//           freshly launched) begins claiming pending items.
//   PAUSE   UI sets status='paused'; worker finishes in-flight items,
//           claims nothing new.
//   STOP    UI sets status='stopped'; same drain, run is terminal.
//   TWEAK   UI updates run.config (thresholds, concurrency, path);
//           worker re-reads config before each claim. Sensitivity
//           changes apply to the next item, not retroactively.
//   CEILING run.spent_cents >= cost_ceiling_cents → worker flips the
//           run to 'paused' and logs why. A human decision resumes it.
//
// Crash safety: items are claimed with status='running' + worker_id +
// started_at. On boot, the worker reclaims any 'running' item older
// than STALE_RUNNING_MS back to 'pending'.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as crypto from 'crypto'
import sharp from 'sharp'

import {
  DEFAULT_RUN_CONFIG, STALE_RUNNING_MS, COST_CENTS,
  type BenchRunConfig, type SeriesAdapter, type SeriesId,
} from './bench-shared'
import { scoreIntake, scoreAesthetic, MIN_LONG_EDGE_PX } from './bench-gates'
import { triageFailure } from './bench-triage'
import { ADAPTERS } from './bench-adapters'
import {
  classifySubject, decideRedirect, type RedirectSeriesId,
} from '../shared/subject-redirect'

// ─── ENV ─────────────────────────────────────────────────────────

interface BenchKeys {
  supabaseUrl:        string
  supabaseServiceKey: string
  replicateApiToken:  string
  openaiApiKey:       string
  stabilityApiKey?:   string
}

const RENDER_BUCKET = 'bench-renders'

// ─── RUN CREATION ────────────────────────────────────────────────
// Expands sourceDir × matrix into batch_items up front. Idempotent
// per (run, source_path, matrix_key).

export async function createRun(input: {
  keys:   BenchKeys
  label:  string
  config: Partial<BenchRunConfig> & Pick<BenchRunConfig, 'series' | 'sourceDir' | 'matrix'>
}): Promise<{ runId: string; totalItems: number }> {
  const sb = supa(input.keys)
  const config: BenchRunConfig = { ...DEFAULT_RUN_CONFIG, ...input.config }

  // Enumerate sources
  const files = (await fs.readdir(config.sourceDir))
    .filter(f => /\.(jpe?g|png|webp)$/i.test(f))
    .map(f => path.join(config.sourceDir, f))

  let sources = config.shuffle ? shuffleArray(files) : files
  if (config.sourceLimit) sources = sources.slice(0, config.sourceLimit)

  if (sources.length === 0) throw new Error(`no images found in ${config.sourceDir}`)

  // Matrix cells
  const cells: Array<{ presetId: string; styleId?: string; locationId: string; scale: string }> = []
  const styleIds = config.matrix.styleIds?.length ? config.matrix.styleIds : [undefined]
  for (const presetId of config.matrix.presetIds)
    for (const styleId of styleIds)
      for (const locationId of config.matrix.locationIds)
        for (const scale of config.matrix.scales)
          cells.push({ presetId, styleId, locationId, scale })

  const { data: run, error: runErr } = await sb.from('batch_runs').insert({
    label:  input.label,
    series: config.series,
    status: 'draft',
    config,
    total_items: sources.length * cells.length,
    cost_ceiling_cents: config.costCeilingCents,
  }).select('id').single()
  if (runErr || !run) throw new Error(`run insert failed: ${runErr?.message}`)

  const rows = sources.flatMap(sourcePath =>
    cells.map(cell => ({
      run_id:      run.id,
      source_path: sourcePath,
      series:      config.series,
      preset_id:   cell.presetId,
      style_id:    cell.styleId ?? null,
      location_id: cell.locationId,
      scale:       cell.scale,
      matrix_key:  [cell.presetId, cell.styleId, cell.locationId, cell.scale].filter(Boolean).join('|'),
      status:      'pending',
    })),
  )

  // Chunked insert — Supabase caps payload size
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('batch_items').insert(rows.slice(i, i + 500))
    if (error) throw new Error(`items insert failed at chunk ${i}: ${error.message}`)
  }

  console.log(`[bench] run ${run.id} created: ${sources.length} sources × ${cells.length} cells = ${rows.length} items`)
  return { runId: run.id, totalItems: rows.length }
}

// ─── WORKER LOOP ─────────────────────────────────────────────────

export async function runWorker(input: { keys: BenchKeys; runId: string }): Promise<void> {
  const sb = supa(input.keys)
  const workerId = `bench-${process.pid}-${Date.now().toString(36)}`
  console.log(`[bench] worker ${workerId} attached to run ${input.runId}`)

  await reclaimStale(sb, input.runId)

  const inFlight = new Set<Promise<void>>()

  for (;;) {
    // Re-read run between claims — this is what makes live tweaks work.
    const { data: run } = await sb.from('batch_runs')
      .select('status, config, spent_cents, cost_ceiling_cents')
      .eq('id', input.runId).single()
    if (!run) { console.error('[bench] run vanished'); break }

    if (run.status === 'stopped' || run.status === 'complete') break
    if (run.status !== 'running') { await sleep(3000); continue }

    // Cost ceiling check
    if (run.spent_cents >= run.cost_ceiling_cents) {
      console.warn(`[bench] cost ceiling hit ($${(run.spent_cents / 100).toFixed(2)}) — pausing run`)
      await sb.from('batch_runs').update({ status: 'paused' }).eq('id', input.runId)
      continue
    }

    const config: BenchRunConfig = run.config

    // Respect concurrency
    if (inFlight.size >= config.concurrency) {
      await Promise.race(inFlight)
      continue
    }

    // Claim next pending item
    const item = await claimItem(sb, input.runId, workerId)
    if (!item) {
      if (inFlight.size > 0) { await Promise.race(inFlight); continue }
      // Nothing pending, nothing in flight → run complete
      await sb.from('batch_runs').update({ status: 'complete' }).eq('id', input.runId)
      console.log('[bench] run complete')
      break
    }

    const p = processItem(sb, input.keys, config, item)
      .catch(async (e: unknown) => {
        const msg = e instanceof Error ? e.message : 'unknown'
        console.error(`[bench] item ${item.id} errored: ${msg}`)
        await finishItem(sb, item, { status: 'errored', triage_note: msg.slice(0, 500) })
      })
      .finally(() => { inFlight.delete(p) })
    inFlight.add(p)

    await sleep(config.itemDelayMs)
  }

  await Promise.allSettled(inFlight)
  console.log(`[bench] worker ${workerId} done`)
}

// ─── ITEM PIPELINE ───────────────────────────────────────────────

async function processItem(
  sb: SupabaseClient, keys: BenchKeys, config: BenchRunConfig, item: any,
): Promise<void> {
  const t0 = Date.now()
  let costCents = 0
  const adapter = requireAdapter(item.series)

  // Load source + local resolution check (free, before any model call)
  const sourceBytes = await fs.readFile(item.source_path)
  const sourceHash  = crypto.createHash('sha256').update(sourceBytes).digest('hex')
  const meta        = await sharp(sourceBytes).metadata()
  const longEdge    = Math.max(meta.width ?? 0, meta.height ?? 0)
  const sourceB64   = sourceBytes.toString('base64')

  // ── Gate 0: subject classification + Series redirect ───────────
  // Same classifier production ships (lib/shared/subject-redirect).
  // 'redirect' behavior mirrors the live flow: tag, capture the exact
  // user-facing copy, skip generation. 'tag_and_render' measures what
  // a wrong-Series render looks like.
  let classifyPatch: Record<string, unknown> = {}
  if (config.classifyEnabled) {
    const classification = await classifySubject({
      sourceImageB64: sourceB64,
      openaiApiKey:   keys.openaiApiKey,
    })
    costCents += COST_CENTS.gpt4o_mini_score

    const decision = decideRedirect({
      classification,
      currentSeries: item.series as RedirectSeriesId,
    })

    classifyPatch = {
      detected_subject:    classification.subjectType,
      subject_confidence:  classification.confidence,
      subject_description: classification.description,
      activity_detected:   classification.activityDetected,
      series_match:        decision.match,
      redirect_series:     decision.redirectSeries,
      redirect_message:    decision.userMessage,
    }

    if (!decision.match && config.mismatchBehavior === 'redirect') {
      await finishItem(sb, item, {
        ...classifyPatch,
        status: 'redirected',
        source_hash: sourceHash,
        cost_cents: costCents,
        duration_ms: Date.now() - t0,
      })
      return
    }
  }

  // ── Gate 1: intake ─────────────────────────────────────────────
  let intake: Awaited<ReturnType<typeof scoreIntake>> | null = null
  if (config.intakeEnabled) {
    intake = await scoreIntake({
      sourceImageB64: sourceB64,
      mode:           adapter.intakeMode,
      threshold:      config.intakeThreshold,
      openaiApiKey:   keys.openaiApiKey,
      resolutionOk:   longEdge >= MIN_LONG_EDGE_PX,
    })
    costCents += intake.costCents

    if (!intake.passed) {
      await finishItem(sb, item, {
        ...classifyPatch,
        status: 'intake_rejected',
        source_hash: sourceHash,
        intake_score: intake.score,
        intake_reasons: intake.reasons,
        intake_passed: false,
        cost_cents: costCents,
        duration_ms: Date.now() - t0,
      })
      return
    }
  }

  // ── Generate via series adapter ────────────────────────────────
  const gen = await adapter.generate({
    sourceImageB64:    sourceB64,
    presetId:          item.preset_id,
    styleId:           item.style_id ?? undefined,
    locationId:        item.location_id ?? undefined,
    scale:             item.scale ?? undefined,
    maxAttempts:       config.maxAttempts,
    fidelityThreshold: config.fidelityThreshold,
    keys,
  })
  costCents += gen.costCents

  // ── Gate 2: aesthetic ──────────────────────────────────────────
  const aesthetic = await scoreAesthetic({
    renderedImageB64: gen.imageB64,
    openaiApiKey:     keys.openaiApiKey,
  })
  costCents += aesthetic.costCents

  const fidelityOk  = gen.fidelityScore == null || gen.fidelityScore >= config.fidelityThreshold
  const aestheticOk = aesthetic.score >= config.aestheticThreshold
                   && aesthetic.score >= config.aestheticFloor
  const passed = fidelityOk && aestheticOk

  // ── Persist render to Storage ──────────────────────────────────
  const storageKey = `${item.run_id}/${item.id}.png`
  const { error: upErr } = await sb.storage.from(RENDER_BUCKET)
    .upload(storageKey, Buffer.from(gen.imageB64, 'base64'), { contentType: 'image/png', upsert: true })
  if (upErr) console.warn(`[bench] storage upload failed: ${upErr.message}`)

  // ── Triage on fail ─────────────────────────────────────────────
  let failCategory: string | null = null
  let triageNote: string | null = null
  let promptSuggestion: string | null = null
  if (!passed && config.triageEnabled) {
    try {
      const triage = await triageFailure({
        sourceImageB64:   sourceB64,
        renderedImageB64: gen.imageB64,
        fidelityScore:    gen.fidelityScore,
        fidelityReason:   gen.fidelityReason,
        aestheticScore:   aesthetic.score,
        aestheticReason:  aesthetic.reason,
        openaiApiKey:     keys.openaiApiKey,
      })
      failCategory     = triage.category
      triageNote       = triage.diagnosis
      promptSuggestion = triage.suggestion
      costCents       += triage.costCents
    } catch (e: unknown) {
      triageNote = `triage failed: ${e instanceof Error ? e.message : 'unknown'}`
    }
  }

  await finishItem(sb, item, {
    ...classifyPatch,
    status: passed ? 'passed' : 'failed',
    source_hash: sourceHash,
    intake_score: intake?.score ?? null,
    intake_reasons: intake?.reasons ?? null,
    intake_passed: intake ? true : null,
    attempts: gen.attempts,
    first_pass: gen.firstPass,
    render_storage_key: upErr ? null : storageKey,
    attempt_log: gen.attemptLog,
    fidelity_score: gen.fidelityScore,
    fidelity_reason: gen.fidelityReason,
    aesthetic_score: aesthetic.score,
    aesthetic_reason: aesthetic.reason,
    output_passed: passed,
    fail_category: failCategory,
    triage_note: triageNote,
    prompt_suggestion: promptSuggestion,
    cost_cents: costCents,
    duration_ms: Date.now() - t0,
  })
}

// ─── PERSISTENCE HELPERS ─────────────────────────────────────────

async function claimItem(sb: SupabaseClient, runId: string, workerId: string): Promise<any | null> {
  // Optimistic claim — select then conditional update. Single-worker
  // default makes contention moot; the worker_id guard keeps it safe
  // if a second worker is ever attached.
  const { data: candidates } = await sb.from('batch_items')
    .select('*').eq('run_id', runId).eq('status', 'pending')
    .order('created_at', { ascending: true }).limit(1)
  const candidate = candidates?.[0]
  if (!candidate) return null

  const { data: claimed } = await sb.from('batch_items')
    .update({ status: 'running', worker_id: workerId, started_at: new Date().toISOString() })
    .eq('id', candidate.id).eq('status', 'pending')
    .select('*').single()
  return claimed ?? null
}

async function finishItem(sb: SupabaseClient, item: any, patch: Record<string, unknown>): Promise<void> {
  await sb.from('batch_items').update({
    ...patch,
    finished_at: new Date().toISOString(),
    updated_at:  new Date().toISOString(),
  }).eq('id', item.id)

  // Roll-up counters on the run row (read-modify-write is fine at
  // single-worker concurrency; move to an RPC increment if multiple
  // workers ever attach to one run).
  const status = String(patch.status)
  const { data: run } = await sb.from('batch_runs')
    .select('done_items, intake_rejected, redirected, passed, failed, errored, spent_cents')
    .eq('id', item.run_id).single()
  if (!run) return
  await sb.from('batch_runs').update({
    done_items:      run.done_items + 1,
    intake_rejected: run.intake_rejected + (status === 'intake_rejected' ? 1 : 0),
    redirected:      run.redirected      + (status === 'redirected' ? 1 : 0),
    passed:          run.passed          + (status === 'passed' ? 1 : 0),
    failed:          run.failed          + (status === 'failed' ? 1 : 0),
    errored:         run.errored         + (status === 'errored' ? 1 : 0),
    spent_cents:     run.spent_cents     + (Number(patch.cost_cents) || 0),
    updated_at:      new Date().toISOString(),
  }).eq('id', item.run_id)
}

async function reclaimStale(sb: SupabaseClient, runId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString()
  const { data } = await sb.from('batch_items')
    .update({ status: 'pending', worker_id: null, started_at: null })
    .eq('run_id', runId).eq('status', 'running').lt('started_at', cutoff)
    .select('id')
  if (data?.length) console.log(`[bench] reclaimed ${data.length} stale items`)
}

// ─── UTIL ────────────────────────────────────────────────────────

function supa(keys: BenchKeys): SupabaseClient {
  return createClient(keys.supabaseUrl, keys.supabaseServiceKey, { auth: { persistSession: false } })
}

function requireAdapter(series: string): SeriesAdapter {
  const adapter = ADAPTERS[series as SeriesId]
  if (!adapter) throw new Error(`no adapter registered for series '${series}'`)
  return adapter
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function sleep(ms: number): Promise<void> {
  return new Promise(res => setTimeout(res, ms))
}

// ─── CLI ─────────────────────────────────────────────────────────
// npm run bench -- --run <run_id>
// Reads keys from env. createRun is exposed for a sibling CLI or the
// admin API route to call.

if (require.main === module) {
  const runIdx = process.argv.indexOf('--run')
  const runId  = runIdx >= 0 ? process.argv[runIdx + 1] : null
  if (!runId) { console.error('usage: bench --run <run_id>'); process.exit(1) }

  const keys: BenchKeys = {
    supabaseUrl:        process.env.SUPABASE_URL!,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    replicateApiToken:  process.env.REPLICATE_API_TOKEN!,
    openaiApiKey:       process.env.OPENAI_API_KEY!,
    stabilityApiKey:    process.env.STABILITY_API_KEY,
  }
  runWorker({ keys, runId }).catch(e => { console.error(e); process.exit(1) })
}
