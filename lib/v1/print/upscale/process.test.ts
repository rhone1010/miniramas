import { describe, it, expect, vi, beforeEach } from 'vitest'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'

const mocks = vi.hoisted(() => ({ outpaint: vi.fn() }))
vi.mock('../../shared/outpaint', () => ({ outpaint: mocks.outpaint }))

import { runJob, resumeStatusFor, MAX_LEASES, type ProcessDeps } from './process'
import { memoryJobStore, memoryStorage, type AssetJob } from './store'
import { DEFAULT_SETTINGS, type UpscaleSettings } from './settings'
import { ProviderError, type UpscaleProvider } from './providers'
import type { UpscaleQa } from './qa'

const noise = async (w: number, h: number) => sharp(randomBytes(w * h * 3), { raw: { width: w, height: h, channels: 3 } }).blur(1.2).png().toBuffer()
const PASS: UpscaleQa = { verdict: 'pass', confidence: 0.92, checks: {} as any, defects: [], summary: 'ok', meta: { model: 'm', latency_ms: 1, images: 4 } }

interface Rig {
  deps: ProcessDeps; store: ReturnType<typeof memoryJobStore>; storage: ReturnType<typeof memoryStorage>
  provider: UpscaleProvider & { starts: number; polls: number; findRecent?: any; outputs: Map<string, Buffer> }
  inspect: ReturnType<typeof vi.fn>; settings: { current: UpscaleSettings }; clock: { t: number }; source: { buf: Buffer }
}

async function rig(opts: { source?: Buffer; settings?: Partial<UpscaleSettings>; listable?: boolean; sourceSize?: [number, number] } = {}): Promise<Rig> {
  const clock = { t: Date.parse('2026-10-14T10:00:00Z') }
  const store = memoryJobStore(() => clock.t), storage = memoryStorage()
  const settings = { current: { ...DEFAULT_SETTINGS, ...opts.settings } as UpscaleSettings }
  const [sw, sh] = opts.sourceSize ?? [1228, 1228]
  const source = { buf: opts.source ?? await noise(sw, sh) }
  let n = 0
  const provider: any = {
    name: 'replicate', starts: 0, polls: 0, outputs: new Map<string, Buffer>(),
    async start({ imageUrl, targetMp }: any) {
      provider.starts++
      const prepared = [...storage.files.entries()].find(([k]) => imageUrl.includes(k))![1]
      const md = await sharp(prepared).metadata()
      const s = Math.sqrt(targetMp * 1e6 / (md.width! * md.height!))
      const id = `pred${++n}`
      provider.outputs.set(id, await sharp(prepared).resize(Math.round(md.width! * s), Math.round(md.height! * s)).png().toBuffer())
      return { id }
    },
    async poll(id: string) { provider.polls++; return { status: 'succeeded', outputUrl: `https://out/${id}`, predictMs: 4000 } },
    async download(url: string) { return provider.outputs.get(url.split('/').pop()!)! },
  }
  if (opts.listable !== false) provider.findRecent = vi.fn(async () => null)
  const inspect = vi.fn(async () => PASS)
  const deps: ProcessDeps = {
    store, storage, now: () => clock.t, sleep: async () => { clock.t += 1000 }, pollMs: 1, budgetMs: 60_000,
    loadSource: async () => source.buf,
    loadSettings: async () => ({ settings: settings.current, version: 7, sources: ['global'] }),
    provider: () => provider, inspect: inspect as any, context: () => ({ series: 'portraits', effect: 'bronze' }),
    onAttention: vi.fn(async () => {}),
  }
  return { deps, store, storage, provider, inspect, settings, clock, source }
}
const enqueue = (r: Rig, over: Partial<{ size: string; finish: string }> = {}) =>
  r.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'render1', sku: 'GLOBAL-FAP-8X8', size: over.size ?? '8x8', finish: over.finish ?? 'fine_art', source_kind: 'owned' })

// Each run encodes real multi-megapixel images with sharp; several runs per test need more than the 5 s default.
vi.setConfig({ testTimeout: 90_000 })
beforeEach(() => { mocks.outpaint.mockReset() })

describe('happy path', () => {
  it('prepares, upscales once, finishes, inspects and approves, recording everything', async () => {
    const r = await rig(); const j = await enqueue(r)
    const { job, outcome } = await runJob(r.deps, j.id)
    expect(outcome).toBe('terminal'); expect(job!.status).toBe('approved')
    expect(r.provider.starts).toBe(1)
    expect(job).toMatchObject({ provider: 'replicate', prediction_id: 'pred1', submit_state: 'submitted', target_mp: 6, qa_verdict: 'pass', review_reason: null, settings_version: 7 })
    expect(job!.settings_snapshot).toMatchObject({ provider: 'replicate', target_ppi: 300, enhance_details: false, enhance_realism: false, output_quality: 95, resolved_from: ['global'] })
    expect(job!.settings_hash).toMatch(/^[0-9a-f]{24}$/)
    expect([job!.final_w, job!.final_h]).toEqual([2400, 2400]); expect(job!.final_sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(job!.output_w).toBeGreaterThanOrEqual(2400); expect(job!.cost_usd_est).toBe(0.01); expect(job!.cost_basis).toMatch(/unverified/)
    expect(job!.upscale_ms).toBe(4000); expect(job!.events.map(e => e.step)).toEqual(expect.arrayContaining(['settings_frozen', 'prepared', 'submitting', 'submitted', 'upscaled', 'finished', 'approved']))
    expect(r.storage.files.has(`${j.id}/final.jpg`)).toBe(true)
    expect(r.deps.onAttention).not.toHaveBeenCalled()
  })
  it('QA compares the enlargement against the aspect-corrected artwork, not the original', async () => {
    // 4:3 source, 8x12 print: the artwork is extended before upscaling.
    mocks.outpaint.mockImplementation(async (i: any) => ({ outpainted: true, image: await sharp(i.image).extend({ left: i.padding.left, right: i.padding.right, top: i.padding.up, bottom: i.padding.down, background: 'blue' }).png().toBuffer() }))
    const r = await rig({ sourceSize: [1200, 900] }); const j = await enqueue(r, { size: '8x12' })
    const { job } = await runJob(r.deps, j.id)
    expect(mocks.outpaint).toHaveBeenCalledTimes(1)
    const call = r.inspect.mock.calls[0][0] as any
    const ref = await sharp(call.reference).metadata(), res = await sharp(call.result).metadata()
    expect([ref.width, ref.height]).toEqual([job!.input_w, job!.input_h])
    expect([ref.width, ref.height]).not.toEqual([1200, 900])
    expect(ref.width! / ref.height!).toBeCloseTo(res.width! / res.height!, 3)       // same picture, same shape
    expect([res.width, res.height]).toEqual([3600, 2400])
    expect(job!.warnings.map(w => w.code)).toContain('extended_by_outpaint')
  })
  it('canvas: inspects the picture area only, never the mirrored wrap', async () => {
    const r = await rig(); const j = await enqueue(r, { finish: 'canvas' })
    const { job } = await runJob(r.deps, j.id)
    expect([job!.final_w, job!.final_h]).toEqual([2454, 2454])
    const res = await sharp((r.inspect.mock.calls[0][0] as any).result).metadata()
    expect([res.width, res.height]).toEqual([2400, 2400])
  })
  it('skips the paid call when the artwork is already large enough', async () => {
    const r = await rig({ sourceSize: [2400, 2400] }); const j = await enqueue(r)
    const { job } = await runJob(r.deps, j.id)
    expect(r.provider.starts).toBe(0); expect(job).toMatchObject({ status: 'approved', cost_usd_est: 0, prediction_id: null, target_mp: null })
  })
})

describe('what sends a job to a person', () => {
  it('low native source PPI alone never holds an otherwise approved print; the PPI stays on the job as a diagnostic', async () => {
    const r = await rig({ sourceSize: [600, 600] }); const j = await enqueue(r)
    const { job } = await runJob(r.deps, j.id)
    expect(job!.status).toBe('approved'); expect(job!.review_reason).toBeNull()
    expect(job!.warnings.find(w => w.code === 'source_quality_below_floor')?.detail).toMatch(/75 PPI/)
    expect(r.deps.onAttention).not.toHaveBeenCalled()
  })
  it('low native source PPI does not override genuine problems: defect, uncertain and QA outage still hold, without naming the PPI', async () => {
    for (const [verdict, reason] of [['uncertain', 'qa_uncertain'], ['defect', 'qa_defect'], ['error', 'qa_unavailable']] as const) {
      const r = await rig({ sourceSize: [600, 600] }); r.inspect.mockResolvedValue({ ...PASS, verdict }); const j = await enqueue(r)
      const { job } = await runJob(r.deps, j.id)
      expect(job!.status).toBe('review'); expect(job!.review_reason).toBe(reason)
    }
  })
  it('low native source PPI does not hide an invalid output: a too-small result is still held', async () => {
    const r = await rig({ sourceSize: [600, 600] })
    r.provider.start = async () => { r.provider.starts++; r.provider.outputs.set('small', await sharp(await noise(1000, 1000)).png().toBuffer()); return { id: 'small' } }
    const { job } = await runJob(r.deps, (await enqueue(r)).id)
    expect(job!.status).toBe('review'); expect(job!.review_reason).toContain('output_below_required_resolution'); expect(job!.review_reason).not.toContain('source_quality')
  })
  it('uncertain and defective inspections, and inspection outages, are never auto-approved', async () => {
    for (const [verdict, reason] of [['uncertain', 'qa_uncertain'], ['defect', 'qa_defect'], ['error', 'qa_unavailable']] as const) {
      const r = await rig(); r.inspect.mockResolvedValue({ ...PASS, verdict }); const j = await enqueue(r)
      const { job } = await runJob(r.deps, j.id)
      expect(job!.status).toBe('review'); expect(job!.review_reason).toContain(reason)
      if (verdict === 'error') expect(r.inspect).toHaveBeenCalledTimes(3)           // retried before giving up
    }
  })
  it('human_approval=all holds every job; qa disabled can never auto-approve', async () => {
    const a = await rig({ settings: { human_approval: 'all' } })
    expect((await runJob(a.deps, (await enqueue(a)).id)).job!.review_reason).toContain('human_approval_required')
    const b = await rig({ settings: { qa_enabled: false } })
    const { job } = await runJob(b.deps, (await enqueue(b)).id)
    expect(job).toMatchObject({ status: 'review', qa_verdict: 'skipped' }); expect(job!.review_reason).toContain('qa_disabled'); expect(b.inspect).not.toHaveBeenCalled()
  })
  it('a provider result that is too small goes to review, not to print', async () => {
    const r = await rig()
    r.provider.start = async () => { r.provider.starts++; r.provider.outputs.set('small', await sharp(await noise(1000, 1000)).png().toBuffer()); return { id: 'small' } }
    const { job } = await runJob(r.deps, (await enqueue(r)).id)
    expect(job).toMatchObject({ status: 'review' }); expect(job!.review_reason).toContain('output_below_required_resolution'); expect(job!.final_path).toBeNull()
  })
  it('an aspect-extension refusal fails the job without a provider call or a repeat outpaint', async () => {
    mocks.outpaint.mockResolvedValue({ outpainted: false, reason: 'timeout' })
    const r = await rig({ sourceSize: [1200, 900] }); const j = await enqueue(r, { size: '8x12' })
    const { job } = await runJob(r.deps, j.id)
    expect(job).toMatchObject({ status: 'failed' }); expect(job!.error).toContain('print_outpaint_failed'); expect(r.provider.starts).toBe(0)
    expect(r.deps.onAttention).toHaveBeenCalledTimes(1)
    await runJob(r.deps, j.id); expect(mocks.outpaint).toHaveBeenCalledTimes(1)            // terminal: not retried
  })
})

describe('the crash window between creating a prediction and saving its id', () => {
  /** Dies exactly as the id would be saved, once. */
  const dieOnce = (r: Rig) => {
    const real = r.store.update.bind(r.store); let died = false
    r.store.update = async (id, token, patch) => { if (patch.prediction_id && !died) { died = true; throw new Error('process died') } return real(id, token, patch) }
  }
  it('replicate: the next run adopts the existing prediction and never submits again', async () => {
    const r = await rig(); dieOnce(r); const j = await enqueue(r)
    const first = await runJob(r.deps, j.id)
    expect(first.outcome).toBe('waiting'); expect(first.job!.submit_state).toBe('submitting'); expect(first.job!.prediction_id).toBeNull(); expect(r.provider.starts).toBe(1)
    r.provider.findRecent.mockResolvedValue('pred1')                                        // the provider still has it
    const second = await runJob(r.deps, j.id)
    expect(r.provider.starts).toBe(1); expect(second.job!.status).toBe('approved'); expect(second.job!.prediction_id).toBe('pred1')
    expect(second.job!.possible_duplicate).toBe(false); expect(second.job!.events.map(e => e.step)).toContain('adopted_prediction')
    expect(r.provider.findRecent.mock.calls[0][0].pathMarker).toBe(`print-assets/${j.id}/`)
  })
  it('replicate: waits out listing lag before concluding nothing was created, then submits once', async () => {
    const r = await rig(); dieOnce(r); const j = await enqueue(r)
    await runJob(r.deps, j.id)
    const early = await runJob(r.deps, j.id)                                                 // listing still empty, under 60 s
    expect(early.outcome).toBe('waiting'); expect(r.provider.starts).toBe(1)
    r.clock.t += 61_000
    const later = await runJob(r.deps, j.id)
    expect(r.provider.starts).toBe(2); expect(later.job!.possible_duplicate).toBe(false)
  })
  it('pruna direct (cannot list): one blind re-submission, flagged for reconciliation and held for a person', async () => {
    const r = await rig({ listable: false }); delete (r.provider as any).findRecent; dieOnce(r); const j = await enqueue(r)
    await runJob(r.deps, j.id)
    const second = await runJob(r.deps, j.id)
    expect(r.provider.starts).toBe(2); expect(second.job!.possible_duplicate).toBe(true)
    expect(second.job!.status).toBe('review'); expect(second.job!.review_reason).toContain('possible_duplicate_charge')
  })
  it('pruna direct: a second unconfirmed submission stops and asks a person instead of paying a third time', async () => {
    const r = await rig({ listable: false }); delete (r.provider as any).findRecent; const j = await enqueue(r)
    const real = r.store.update.bind(r.store)
    r.store.update = async (id, t, p) => { if (p.prediction_id) throw new Error('process died'); return real(id, t, p) }       // dies every time
    await runJob(r.deps, j.id); await runJob(r.deps, j.id)
    const third = await runJob(r.deps, j.id)
    expect(r.provider.starts).toBe(2); expect(third.job).toMatchObject({ status: 'review', review_reason: 'submit_state_unresolved' })
  })
  it('an ambiguous provider timeout is treated as possibly created; a definite refusal is not', async () => {
    const r = await rig(); const j = await enqueue(r)
    r.provider.start = async () => { r.provider.starts++; throw new ProviderError('unavailable', 'timed out', true, true) }
    const a = await runJob(r.deps, j.id)
    expect(a.outcome).toBe('waiting'); expect(a.job!.submit_state).toBe('submitting')
    const r2 = await rig(); const j2 = await enqueue(r2)
    r2.provider.start = async () => { r2.provider.starts++; throw new ProviderError('unavailable', 'HTTP 429', true, false) }
    const b = await runJob(r2.deps, j2.id)
    expect(b.job).toMatchObject({ status: 'ready_to_submit', submit_state: 'none' })
  })
  it('a permanent provider refusal fails the job', async () => {
    const r = await rig(); r.provider.start = async () => { throw new ProviderError('rejected', 'HTTP 422', false, false) }
    expect((await runJob(r.deps, (await enqueue(r)).id)).job!.status).toBe('failed')
  })
})

describe('resumption, single flight, snapshots', () => {
  it('a failed prediction is re-submitted, within a cap', async () => {
    const r = await rig(); let failures = 2
    const poll = r.provider.poll.bind(r.provider)
    r.provider.poll = async (id: string) => failures-- > 0 ? { status: 'failed', error: 'oom' } : poll(id)
    const { job } = await runJob(r.deps, (await enqueue(r)).id)
    expect(r.provider.starts).toBe(3); expect(job!.status).toBe('approved')
    const r2 = await rig(); r2.provider.poll = async () => ({ status: 'failed', error: 'oom' })
    const dead = await runJob(r2.deps, (await enqueue(r2)).id)
    expect(r2.provider.starts).toBe(3); expect(dead.job).toMatchObject({ status: 'failed', error: 'provider_submit_attempts_exhausted' })
  })
  it('a prediction that succeeds with no image fails at once instead of polling until the budget runs out', async () => {
    const r = await rig(); r.provider.poll = async () => ({ status: 'succeeded' as const }); let polls = 0; const real = r.provider.poll; r.provider.poll = async (id: string) => { polls++; return real(id) }
    const { job } = await runJob(r.deps, (await enqueue(r)).id)
    expect(job).toMatchObject({ status: 'failed' }); expect(job!.error).toMatch(/^prediction_succeeded_without_output:pred1/)
    expect(polls).toBe(1); expect(r.provider.starts).toBe(1)                       // one paid call, never repeated by itself
    expect(r.deps.onAttention).toHaveBeenCalledTimes(1)
  })
  it('only one worker runs a job at a time', async () => {
    const r = await rig(); const j = await enqueue(r)
    const [a, b] = await Promise.all([runJob(r.deps, j.id), runJob(r.deps, j.id)])
    expect([a.outcome, b.outcome].sort()).toEqual(['busy', 'terminal']); expect(r.provider.starts).toBe(1)
  })
  it('settings are frozen when the job starts: a later change does not reach it', async () => {
    const r = await rig({ settings: { human_approval: 'flagged' } }); const j = await enqueue(r)
    // Die after preparing, before submitting.
    const real = r.provider.start; r.provider.start = async () => { throw new ProviderError('unavailable', 'HTTP 503', true, false) }
    const first = await runJob(r.deps, j.id); const hash = first.job!.settings_hash
    r.settings.current = { ...r.settings.current, enhance_realism: true, provider: 'pruna', human_approval: 'all' }
    r.provider.start = real
    const second = await runJob(r.deps, j.id)
    expect(second.job!.settings_hash).toBe(hash); expect(second.job!.settings_snapshot).toMatchObject({ provider: 'replicate', enhance_realism: false, human_approval: 'flagged' })
    expect(second.job!.status).toBe('approved')
  })
  it('stops a job that keeps coming back', async () => {
    const r = await rig(); const j = await enqueue(r); r.store.jobs.get(j.id)!.attempts = MAX_LEASES + 1
    expect((await runJob(r.deps, j.id)).job).toMatchObject({ status: 'failed', error: 'too_many_attempts' })
    expect(r.provider.starts).toBe(0)
  })
  it('a lost lease writes nothing', async () => {
    const r = await rig(); const j = await enqueue(r)
    r.store.update = async () => null
    expect((await runJob(r.deps, j.id)).outcome).toBe('lost')
  })
  it('chooses a sensible resume point for an admin reset', () => {
    const base = { final_path: null, output_path: null, input_path: null, target_mp: null } as any
    expect(resumeStatusFor({ ...base })).toBe('queued')
    expect(resumeStatusFor({ ...base, input_path: 'a', target_mp: 6 })).toBe('ready_to_submit')
    expect(resumeStatusFor({ ...base, input_path: 'a', output_path: 'b', target_mp: 6 })).toBe('finishing')
    expect(resumeStatusFor({ ...base, input_path: 'a', output_path: 'b', final_path: 'c' })).toBe('qa')
  })
})
