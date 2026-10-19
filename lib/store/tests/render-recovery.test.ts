// Automatic render recovery: the sweep (flag, accounting, candidates, limits, the arguments it sends the database), the cron route, what the status route tells a
// customer, the operator script's arguments and dry-run explainer, and the tolerant failure write. The database function itself is proven in migration-053.test.ts.
// Nothing here generates anything: the render and the network are fakes.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'
import { RECOVERY, claimRecovery, cycleCostUsd, dailyCeilingUsd, explainRecovery, isTransientError, recoverFailedRenders, recoveryEnabled, recoveryStateFor } from '../render-recovery'
import { MAX_ITEMS_PER_RUN, parseRecoveryArgs } from '../render-recovery-args'

const h = vi.hoisted(() => ({ fake: null as any, user: { id: 'u1' } as any }))
vi.mock('@/lib/supabase', () => ({ get supabaseAdmin() { return h.fake.sb }, supabase: {} }))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => h.user }))
vi.mock('@/lib/store/portfolio-render', () => ({ renderOnePortfolioItem: vi.fn(async () => {}) }))
vi.mock('@/lib/store/preview', () => ({ PREVIEW_BUCKET: 'previews' }))

const ENV = { RENDER_RECOVERY_ENABLED: '1', RENDER_RECOVERY_COST_USD: '0.5' }
const HOURS = (n: number) => new Date(Date.now() - n * 3600_000).toISOString()
const ITEM = (id: string, over: Record<string, unknown> = {}) => ({ id, portfolio_id: 'pf1', slot: 0, status: 'failed', error: 'generate_failed', preview_id: null, recovery_count: 0, failed_at: HOURS(3), ...over })

describe('what counts as transient, and the money', () => {
  it('the allow-list and the provider-condition pattern are transient; refusals, unknown effects, age checks and anything unrecognised are not', () => {
    for (const e of [...RECOVERY.transient, 'fetch failed', 'Request timeout', 'timed out after 60s', 'Rate limit exceeded', 'HTTP 503', 'ECONNRESET', 'upstream overloaded']) expect(isTransientError(e), e).toBe(true)
    for (const e of ['age_restricted', 'unknown_groups_effect', 'unknown_pets_effect', 'intake_rejected', 'redirected', 'storage exploded', 'HTTP 5030', '', null, undefined]) expect(isTransientError(e as any), String(e)).toBe(false)
  })
  it('a cycle reserves the worst case (the first render and every retry) and the day is capped at $5, which the environment may only lower', () => {
    expect(cycleCostUsd({ RENDER_RECOVERY_COST_USD: '0.5' })).toBe(2); expect(cycleCostUsd({})).toBeNull(); expect(cycleCostUsd({ RENDER_RECOVERY_COST_USD: '0' })).toBeNull(); expect(cycleCostUsd({ RENDER_RECOVERY_COST_USD: 'abc' })).toBeNull()
    expect(dailyCeilingUsd({})).toBe(5); expect(dailyCeilingUsd({ RENDER_RECOVERY_DAILY_CEILING_USD: '2' })).toBe(2); expect(dailyCeilingUsd({ RENDER_RECOVERY_DAILY_CEILING_USD: '50' })).toBe(5)
    expect(RECOVERY.backoffSeconds).toBe(7200); expect(RECOVERY.maxRecoveries).toBe(1)
  })
  it('is off unless explicitly enabled', () => { expect(recoveryEnabled({})).toBe(false); expect(recoveryEnabled({ RENDER_RECOVERY_ENABLED: 'true' })).toBe(false); expect(recoveryEnabled(ENV)).toBe(true) })
})

describe('claimRecovery sends the database exactly the rules', () => {
  it('cost, ceiling, two-hour backoff, one cycle, the allow-list and the pattern; and nothing at all when the cost of a render is not configured', async () => {
    const f = fakeSupabase(); let seen: any = null; f.onRpc('claim_render_recovery', a => { seen = a; return { data: [{ claimed: true, reason: 'claimed' }], error: null } })
    expect(await claimRecovery(f.sb, 'i1', ENV)).toEqual({ claimed: true, reason: 'claimed' })
    expect(seen).toMatchObject({ p_item: 'i1', p_cost_usd: 2, p_daily_cap_usd: 5, p_backoff_seconds: 7200, p_max_recoveries: 1, p_transient: [...RECOVERY.transient], p_transient_pattern: RECOVERY.transientPattern })
    seen = null; expect(await claimRecovery(f.sb, 'i1', { RENDER_RECOVERY_ENABLED: '1' })).toEqual({ claimed: false, reason: 'accounting_not_configured' }); expect(seen).toBeNull()
  })
  it('a database error is a refusal, never a throw and never a claim', async () => {
    const f = fakeSupabase(); expect((await claimRecovery(f.sb, 'i1', ENV)).claimed).toBe(false)         // no such rpc: migration 053 not applied
    expect((await claimRecovery(f.sb, 'i1', ENV)).reason).toMatch(/^rpc_failed/)
  })
})

describe('the sweep', () => {
  it('does nothing while disabled: no query, no claim', async () => {
    const f = fakeSupabase({ tables: { portfolio_items: [ITEM('i1')] } }); const rpc = vi.fn(); f.onRpc('claim_render_recovery', rpc)
    expect(await recoverFailedRenders(f.sb, { env: { RENDER_RECOVERY_COST_USD: '0.5' } })).toMatchObject({ enabled: false, candidates: 0, claimed: 0 }); expect(rpc).not.toHaveBeenCalled()
  })
  it('only asks about failed items with no artwork, never recovered, that failed at least two hours ago and have a recorded failure time (none of the earlier failures)', async () => {
    const f = fakeSupabase({ tables: { portfolio_items: [
      ITEM('ok-old'), ITEM('recent', { failed_at: HOURS(1) }), ITEM('has-art', { preview_id: 'p1' }), ITEM('used', { recovery_count: 1 }), ITEM('historical', { failed_at: null }),
      ITEM('still-working', { status: 'rendering', failed_at: HOURS(5) }), ITEM('done', { status: 'done', failed_at: HOURS(5) }),
    ] } })
    const asked: string[] = []; f.onRpc('claim_render_recovery', a => { asked.push(a.p_item); return { data: [{ claimed: true, reason: 'claimed' }], error: null } })
    expect(await recoverFailedRenders(f.sb, { env: ENV })).toMatchObject({ enabled: true, candidates: 1, claimed: 1 }); expect(asked).toEqual(['ok-old'])
  })
  it('claims at most `limit` per tick, counts the database\'s refusals by reason, and stops at the daily ceiling', async () => {
    const f = fakeSupabase({ tables: { portfolio_items: [ITEM('a'), ITEM('b'), ITEM('c'), ITEM('d')] } })
    const answers: Record<string, string> = { a: 'claimed', b: 'not_paid', c: 'claimed', d: 'claimed' }; const asked: string[] = []
    f.onRpc('claim_render_recovery', a => { asked.push(a.p_item); return { data: [{ claimed: answers[a.p_item] === 'claimed', reason: answers[a.p_item] }], error: null } })
    expect(await recoverFailedRenders(f.sb, { env: ENV, limit: 2 })).toMatchObject({ claimed: 2, refused: { not_paid: 1 } }); expect(asked).toEqual(['a', 'b', 'c'])
    const g = fakeSupabase({ tables: { portfolio_items: [ITEM('a'), ITEM('b'), ITEM('c')] } }); const n: string[] = []
    g.onRpc('claim_render_recovery', a => { n.push(a.p_item); return { data: [{ claimed: false, reason: 'daily_ceiling' }], error: null } })
    expect(await recoverFailedRenders(g.sb, { env: ENV, limit: 3 })).toMatchObject({ claimed: 0, stoppedAt: 'daily_ceiling', refused: { daily_ceiling: 1 } }); expect(n).toEqual(['a'])      // one ask, then it stops
  })
  it('without the render cost configured nothing is claimed, and it says so', async () => {
    const f = fakeSupabase({ tables: { portfolio_items: [ITEM('a')] } }); f.onRpc('claim_render_recovery', () => { throw new Error('must not be called') })
    expect(await recoverFailedRenders(f.sb, { env: { RENDER_RECOVERY_ENABLED: '1' } })).toMatchObject({ claimed: 0, stoppedAt: 'accounting_not_configured' })
  })
})

describe('the cron route', () => {
  async function tick(env: Record<string, string>) {
    Object.assign(process.env, { CRON_SECRET: 's3cret' }); for (const k of ['RENDER_RECOVERY_ENABLED', 'RENDER_RECOVERY_COST_USD']) delete process.env[k]; Object.assign(process.env, env)
    const { GET } = await import('@/app/api/v1/portfolios/items/render-poll/route')
    const res = await GET(new Request('https://x.test/api/v1/portfolios/items/render-poll', { headers: { authorization: 'Bearer s3cret' } }) as any)
    return { status: res.status, body: await res.json() }
  }
  beforeEach(() => { h.fake = fakeSupabase({ tables: { portfolio_items: [ITEM('a')], portfolios: [] } }) })
  it('runs the sweep only when enabled; disabled, the response says so and nothing is claimed', async () => {
    const rpc = vi.fn(async () => ({ data: [{ claimed: true, reason: 'claimed' }], error: null })); h.fake.onRpc('claim_render_recovery', rpc)
    const off = await tick({}); expect(off.status).toBe(200); expect(off.body.recovery).toMatchObject({ enabled: false }); expect(rpc).not.toHaveBeenCalled()
    const on = await tick({ RENDER_RECOVERY_ENABLED: '1', RENDER_RECOVERY_COST_USD: '0.5' }); expect(on.body.recovery).toMatchObject({ enabled: true, claimed: 1 }); expect(rpc).toHaveBeenCalledTimes(1)
  })
  it('a failing sweep never stops the tick (the ordinary poll still runs)', async () => {
    h.fake.onRpc('claim_render_recovery', () => { throw new Error('boom') })
    const r = await tick({ RENDER_RECOVERY_ENABLED: '1', RENDER_RECOVERY_COST_USD: '0.5' }); expect(r.status).toBe(200)
  })
})

describe('what the customer may be told', () => {
  const failed = { status: 'failed', error: 'generate_failed', preview_id: null, recovery_count: 0, failed_at: HOURS(3) }
  it('"scheduled" only for a transient failure with no artwork, never recovered, in a paid-and-activated portfolio, while recovery is on', () => {
    expect(recoveryStateFor(failed, 'ready', ENV)).toBe('scheduled'); expect(recoveryStateFor(failed, 'generating', ENV)).toBe('scheduled')
    expect(recoveryStateFor(failed, 'ready', {})).toBeNull()                                           // recovery off: no promise
    expect(recoveryStateFor(failed, 'ready', { RENDER_RECOVERY_ENABLED: '1' })).toBeNull()             // no accounting: no promise
    for (const over of [{ error: 'age_restricted' }, { error: 'mystery' }, { preview_id: 'p' }, { recovery_count: 1 }, { failed_at: null }]) expect(recoveryStateFor({ ...failed, ...over }, 'ready', ENV), JSON.stringify(over)).toBeNull()
    expect(recoveryStateFor(failed, 'pending', ENV)).toBeNull(); expect(recoveryStateFor(failed, 'failed', ENV)).toBeNull()
  })
  it('"in_progress" once the automatic try is under way', () => {
    expect(recoveryStateFor({ status: 'pending', recovery_count: 1 }, 'generating', {})).toBe('in_progress'); expect(recoveryStateFor({ status: 'rendering', recovery_count: 1 }, 'generating', {})).toBe('in_progress')
    expect(recoveryStateFor({ status: 'pending', recovery_count: 0 }, 'generating', ENV)).toBeNull(); expect(recoveryStateFor({ status: 'done', recovery_count: 1 }, 'ready', ENV)).toBeNull()
  })
  it('the status route carries it per item, never the raw error, and still works when migration 053 is not applied', async () => {
    h.fake = fakeSupabase({ tables: {
      portfolios: [{ id: 'pf1', user_id: 'u1', series: 'pets', size: 4, status: 'ready', free_unlocks: 0, aspect_ratio: null }],
      portfolio_items: [{ ...ITEM('a'), slot: 0 }, { ...ITEM('b'), slot: 1, error: 'age_restricted' }, { ...ITEM('c'), slot: 2, status: 'rendering', recovery_count: 1, preview_id: null }],
      preview_ledger: [],
    } })
    Object.assign(process.env, ENV)
    const { GET } = await import('@/app/api/v1/portfolios/[portfolioId]/status/route')
    const call = async () => (await GET(new Request('https://x.test') as any, { params: Promise.resolve({ portfolioId: 'pf1' }) } as any)).json()
    const out = await call()
    expect(out.items.map((i: any) => [i.slot, i.recovery])).toEqual([[0, 'scheduled'], [1, null], [2, 'in_progress']]); expect(JSON.stringify(out)).not.toContain('age_restricted')
    // before the migration: the read of the new columns fails, the route still answers, and nothing is promised
    const real = h.fake.sb.from; let n = 0
    h.fake.sb.from = (t: string) => { const q = real(t); if (t === 'portfolio_items' && ++n === 2) return { select: () => ({ eq: async () => ({ data: null, error: { message: 'column portfolio_items.failed_at does not exist' } }) }) }; return q }
    const old = await call(); expect(old.items.every((i: any) => i.recovery === null)).toBe(true); expect(old.items.length).toBe(3)
    delete process.env.RENDER_RECOVERY_ENABLED; delete process.env.RENDER_RECOVERY_COST_USD
  })
})

describe('the operator script', () => {
  const U = '7c63738b-ccfa-4d55-ba79-a4e1f3a27295'
  it('takes named item ids only, a dry run unless --execute, and --execute needs the deployment that will render', () => {
    expect(parseRecoveryArgs(['--item', U])).toEqual({ items: [U], baseUrl: null, execute: false })
    expect(parseRecoveryArgs(['--item', U, '--base-url', 'https://x-abc-litenco.vercel.app/', '--execute'])).toEqual({ items: [U], baseUrl: 'https://x-abc-litenco.vercel.app', execute: true })
    for (const bad of [[], ['--all'], ['--item'], ['--item', 'nope'], ['--item', U, '--execute'], ['--item', U, '--base-url', 'https://litenco.com', '--execute'], ['--item', U, '--base-url', 'http://x.vercel.app', '--execute']]) expect(() => parseRecoveryArgs(bad), JSON.stringify(bad)).toThrow()
    const many = Array.from({ length: MAX_ITEMS_PER_RUN + 1 }, (_, i) => ['--item', `7c63738b-ccfa-4d55-ba79-a4e1f3a2729${i}`]).flat(); expect(() => parseRecoveryArgs(many)).toThrow(/at most/)
  })
  it('the dry run explains, in the database\'s order, why an item would or would not be recovered, and writes nothing', async () => {
    const f = fakeSupabase({ tables: {
      portfolio_items: [ITEM('good', { portfolio_id: 'p-paid' }), ITEM('art', { portfolio_id: 'p-paid', preview_id: 'x' }), ITEM('young', { portfolio_id: 'p-paid', failed_at: HOURS(1) }), ITEM('old-failure', { portfolio_id: 'p-paid', failed_at: null }),
        ITEM('perm', { portfolio_id: 'p-paid', error: 'age_restricted' }), ITEM('unpaid', { portfolio_id: 'p-unpaid' }), ITEM('inactive', { portfolio_id: 'p-pending' })],
      portfolios: [{ id: 'p-paid', status: 'ready', purchase_id: 'pu1' }, { id: 'p-unpaid', status: 'ready', purchase_id: 'pu2' }, { id: 'p-pending', status: 'pending', purchase_id: 'pu1' }],
      purchases: [{ id: 'pu1', status: 'paid' }, { id: 'pu2', status: 'refunded' }],
    } })
    const out: Record<string, string> = {}; for (const id of ['good', 'art', 'young', 'old-failure', 'perm', 'unpaid', 'inactive', 'missing']) out[id] = await explainRecovery(f.sb, id, ENV)
    expect(out).toEqual({ good: 'eligible', art: 'has_artwork', young: 'backoff', 'old-failure': 'no_failure_time', perm: 'permanent_error', unpaid: 'not_paid', inactive: 'portfolio_not_active', missing: 'item_not_found' })
    expect(await explainRecovery(f.sb, 'good', {})).toBe('accounting_not_configured'); expect(f.tables.portfolio_items.find((r: any) => r.id === 'good')).toMatchObject({ status: 'failed', recovery_count: 0 })
  })
})
