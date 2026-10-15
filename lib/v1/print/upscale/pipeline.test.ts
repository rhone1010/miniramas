import { describe, it, expect, vi, beforeEach } from 'vitest'

const s = vi.hoisted(() => ({ reads: 0 }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => { s.reads++; return chain({ data: { provider: 'replicate', qa_enabled: true }, error: null }) }, rpc: async () => ({ data: null, error: null }) } }))
import { FLAG_NAME, isPipelineFlagOn, pipelineState, resetPipelineCache, pipelineHoldReason, isPipelineHold, sourceOfHold, PipelineInactiveError, type ProbeDb } from './pipeline'

function chain(result: any): any { const c: any = { select: () => c, eq: () => c, maybeSingle: async () => result, limit: async () => result }; return c }
const READY_ENV = { [FLAG_NAME]: 'true', CRON_SECRET: 'c', SUPABASE_SERVICE_ROLE_KEY: 's', REPLICATE_API_TOKEN: 'r', OPENAI_API_KEY: 'o' }
const mkDb = (o: { global?: any; jobsErr?: boolean; rpcErr?: boolean; throws?: boolean } = {}): ProbeDb => ({
  from: (t: string) => {
    if (o.throws) throw new Error('down')
    return t === 'print_upscale_settings'
      ? chain(o.global === undefined ? { data: { provider: 'replicate', qa_enabled: true }, error: null } : { data: o.global, error: o.global ? null : { message: 'x' } })
      : chain({ data: [], error: o.jobsErr ? { message: 'no table' } : null })
  },
  rpc: async () => ({ data: null, error: o.rpcErr ? { code: 'PGRST202', message: 'no function' } : null }),
})

beforeEach(() => { resetPipelineCache(); s.reads = 0 })

describe('the flag', () => {
  it('is OFF unless it is exactly true or 1', () => {
    expect(isPipelineFlagOn({})).toBe(false)
    for (const v of ['', 'false', '0', 'no', 'yes', 'on', 'enabled', 'tru', 'null', ' ']) expect(isPipelineFlagOn({ [FLAG_NAME]: v }), v).toBe(false)
    for (const v of ['true', 'TRUE', ' True ', '1']) expect(isPipelineFlagOn({ [FLAG_NAME]: v }), v).toBe(true)
  })
  it('off answers at once and touches no database and no network', async () => {
    const fetchSpy = vi.fn(); vi.stubGlobal('fetch', fetchSpy)
    const db: ProbeDb = { from: () => { throw new Error('must not be read') }, rpc: () => { throw new Error('must not be called') } }
    expect(await pipelineState({ env: {}, db })).toEqual({ flag: false, active: false, reason: 'disabled', problems: [] })
    expect(await pipelineState({ env: { [FLAG_NAME]: 'false' }, db })).toMatchObject({ active: false, reason: 'disabled' })
    expect(fetchSpy).not.toHaveBeenCalled(); vi.unstubAllGlobals()
  })
})

describe('readiness when the flag is on', () => {
  it('is active only when migration 046 and every needed key are present', async () => {
    expect(await pipelineState({ env: READY_ENV, db: mkDb() })).toEqual({ flag: true, active: true, reason: null, problems: [] })
  })
  it('refuses, naming the reason, for each thing that can be missing', async () => {
    const cases: Array<[string, any, any]> = [
      ['migration_046_not_applied:settings', READY_ENV, mkDb({ global: null })],
      ['migration_046_not_applied:jobs', READY_ENV, mkDb({ jobsErr: true })],
      ['migration_046_not_applied:functions', READY_ENV, mkDb({ rpcErr: true })],
      ['database_unreachable', READY_ENV, mkDb({ throws: true })],
      ['missing_CRON_SECRET', { ...READY_ENV, CRON_SECRET: '' }, mkDb()],
      ['missing_SUPABASE_SERVICE_ROLE_KEY', { ...READY_ENV, SUPABASE_SERVICE_ROLE_KEY: '' }, mkDb()],
      ['missing_REPLICATE_API_TOKEN', { ...READY_ENV, REPLICATE_API_TOKEN: '' }, mkDb()],
      ['missing_OPENAI_API_KEY', { ...READY_ENV, OPENAI_API_KEY: '' }, mkDb()],
      ['prodigi_live_blocked_in_preview', { ...READY_ENV, VERCEL_ENV: 'preview', PRODIGI_ENV: 'live' }, mkDb()],
    ]
    for (const [problem, env, db] of cases) {
      const st = await pipelineState({ env, db })
      expect(st, problem).toMatchObject({ flag: true, active: false, reason: 'not_ready' }); expect(st.problems).toContain(problem)
    }
  })
  it('asks for the key of the provider that is actually selected, and for OpenAI only if inspection is on', async () => {
    const pruna = mkDb({ global: { provider: 'pruna', qa_enabled: false } })
    expect((await pipelineState({ env: { ...READY_ENV, REPLICATE_API_TOKEN: '', OPENAI_API_KEY: '' }, db: pruna })).problems).toEqual(['missing_PRUNA_API_KEY'])
    expect(await pipelineState({ env: { ...READY_ENV, PRUNA_API_KEY: 'p', REPLICATE_API_TOKEN: '', OPENAI_API_KEY: '' }, db: pruna })).toMatchObject({ active: true })
  })
  it('lists every problem at once, not just the first', async () => {
    const st = await pipelineState({ env: { [FLAG_NAME]: 'true' }, db: mkDb({ global: null }) })
    expect(st.problems.length).toBeGreaterThanOrEqual(4)
  })
  it('the migration probe changes nothing: only reads and a nil-id lease', async () => {
    const calls: string[] = []; const db: ProbeDb = { from: t => { calls.push('read:' + t); return mkDb().from(t) }, rpc: async (fn, args) => { calls.push('rpc:' + fn + ':' + args.p_id); return { data: null, error: null } } }
    await pipelineState({ env: READY_ENV, db })
    expect(calls).toEqual(['read:print_upscale_settings', 'read:print_asset_jobs', 'rpc:lease_print_asset_job:00000000-0000-0000-0000-000000000000'])
  })
  it('caches a ready answer briefly so a busy webhook does not probe every call', async () => {
    vi.stubEnv(FLAG_NAME, 'true'); for (const [k, v] of Object.entries(READY_ENV)) if (k !== FLAG_NAME) vi.stubEnv(k, v)
    const t = { now: 1_000_000 }
    await pipelineState({ now: () => t.now }); const first = s.reads
    await pipelineState({ now: () => t.now + 10_000 }); expect(s.reads).toBe(first)
    await pipelineState({ now: () => t.now + 31_000 }); expect(s.reads).toBeGreaterThan(first)
    vi.unstubAllEnvs()
  })
})

describe('the note that records a hold', () => {
  it('round-trips the reason and the picture source, so activation can resume the order', () => {
    const off = pipelineHoldReason({ flag: false, active: false, reason: 'disabled', problems: [] }, 'owned')
    expect(off).toBe('print_pipeline_disabled;source=owned'); expect(isPipelineHold(off)).toBe(true); expect(sourceOfHold(off)).toBe('owned')
    const nr = pipelineHoldReason({ flag: true, active: false, reason: 'not_ready', problems: ['a', 'b'] }, 'url')
    expect(nr).toBe('print_pipeline_not_ready:a,b;source=url'); expect(sourceOfHold(nr)).toBe('url')
    for (const other of [null, undefined, '', 'asset_review:qa_uncertain', 'account x is not cleared for fulfilment']) expect(isPipelineHold(other)).toBe(false)
    expect(sourceOfHold('anything else')).toBe('url')
  })
  it('PipelineInactiveError says why', () => {
    expect(new PipelineInactiveError({ flag: true, active: false, reason: 'not_ready', problems: ['x'] }).message).toBe('print_pipeline_inactive:not_ready:x')
  })
})
