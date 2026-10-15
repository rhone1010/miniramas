// The cron poller under each flag state: off does nothing at all; on-but-not-ready does nothing; on-and-ready works.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const s = vi.hoisted(() => ({
  listWork: vi.fn(), runJob: vi.fn(), complete: vi.fn(), orders: [] as any[], dbReads: [] as string[], ready: true, fetchCalls: 0,
}))
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: { from: (t: string) => {
    s.dbReads.push(t)
    const q: any = { select: () => q, eq: () => q, in: () => q, order: () => q, limit: async () => ({ data: s.orders, error: null }), maybeSingle: async () => ({ data: s.ready ? { provider: 'replicate', qa_enabled: true } : null, error: s.ready ? null : { message: 'x' } }) }
    return t === 'print_orders' ? q : q
  }, rpc: async () => ({ data: null, error: s.ready ? null : { message: 'x' } }) },
}))
vi.mock('@/lib/v1/print/upscale/runtime', () => ({ productionDeps: () => ({ tag: 'deps' }), assetRuntime: () => ({ store: { listWork: s.listWork } }) }))
vi.mock('@/lib/v1/print/upscale/process', () => ({ runJob: s.runJob }))
vi.mock('@/lib/v1/print/complete', () => ({ completePrintOrder: s.complete }))
import { GET, POST } from '../../../../app/api/v1/print/assets/poll/route'
import { resetPipelineCache } from './pipeline'

const call = (headers: Record<string, string> = { authorization: 'Bearer secret' }) => GET(new Request('http://x/api/v1/print/assets/poll', { headers }))
beforeEach(() => {
  resetPipelineCache()
  s.listWork.mockReset().mockResolvedValue([{ id: 'j1' }, { id: 'j2' }]); s.runJob.mockReset().mockResolvedValue({ outcome: 'terminal', job: { status: 'approved' } })
  s.complete.mockReset().mockResolvedValue({ status: 'skipped' }); s.orders = [{ id: 'o1' }]; s.dbReads = []; s.ready = true; s.fetchCalls = 0
  vi.stubEnv('CRON_SECRET', 'secret'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k'); vi.stubEnv('REPLICATE_API_TOKEN', 'r'); vi.stubEnv('OPENAI_API_KEY', 'o')
  vi.stubGlobal('fetch', vi.fn(async () => { s.fetchCalls++; return new Response('{}') }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('authorization is unchanged by the flag', () => {
  it('refuses without the cron secret whether the flag is on or off', async () => {
    for (const flag of ['', 'true']) { vi.stubEnv('PRINT_UPSCALE_PIPELINE_ENABLED', flag); expect((await call({})).status).toBe(401); expect((await call({ authorization: 'Bearer wrong' })).status).toBe(401) }
    expect(s.listWork).not.toHaveBeenCalled(); expect(s.runJob).not.toHaveBeenCalled()
  })
})

describe('flag OFF (the default)', () => {
  it.each([['unset', undefined], ['false', 'false'], ['empty', ''], ['yes (not exactly true)', 'yes']])('%s: exits safely and does nothing', async (_n, v) => {
    if (v !== undefined) vi.stubEnv('PRINT_UPSCALE_PIPELINE_ENABLED', v)
    const res = await call()
    expect(res.status).toBe(200); expect(await res.json()).toMatchObject({ skipped: true, reason: 'disabled' })
    expect(s.listWork).not.toHaveBeenCalled(); expect(s.runJob).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.dbReads).toEqual([]); expect(s.fetchCalls).toBe(0)                    // not even a read, and no API call
  })
})

describe('flag ON', () => {
  beforeEach(() => vi.stubEnv('PRINT_UPSCALE_PIPELINE_ENABLED', 'true'))
  it('but not ready (migration missing): exits safely, names the problem, runs nothing', async () => {
    s.ready = false
    const body = await (await call()).json()
    expect(body).toMatchObject({ skipped: true, reason: 'not_ready' }); expect(body.problems.join()).toContain('migration_046_not_applied')
    expect(s.listWork).not.toHaveBeenCalled(); expect(s.runJob).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.fetchCalls).toBe(0)
  })
  it('and ready: advances the waiting jobs and then tries the waiting orders', async () => {
    const body = await (await call()).json()
    expect(s.runJob).toHaveBeenCalledTimes(2); expect(s.runJob.mock.calls.map(c => c[1])).toEqual(['j1', 'j2'])
    expect(s.complete).toHaveBeenCalledWith('o1'); expect(body.jobs).toHaveLength(2)
  })
  it('reports orders it placed', async () => {
    s.complete.mockResolvedValue({ status: 'placed', prodigiOrderId: 'p' })
    expect((await (await call()).json()).placed).toEqual(['o1'])
  })
  it('one job throwing does not stop the others or the order pass', async () => {
    s.runJob.mockRejectedValueOnce(new Error('boom'))
    const body = await (await call()).json()
    expect(body.jobs.map((j: any) => j.outcome)).toEqual(['threw', 'terminal']); expect(s.complete).toHaveBeenCalled()
  })
  it('POST behaves like GET', async () => {
    expect((await POST(new Request('http://x', { method: 'POST', headers: { authorization: 'Bearer secret' } }))).status).toBe(200)
  })
})
