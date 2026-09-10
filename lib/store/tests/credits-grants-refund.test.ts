// lib/store/tests/credits-grants-refund.test.ts
//
// /credits/gate issues single-use grants for a Portraits craft, and
// /credits/refund refunds only what was never delivered -- and nothing that
// was never spent.
//
// THE MINTING HOLE THIS CLOSES. /credits/refund capped a refund at what had
// been spent only when it found a spend. For a ref_id with no spend rows --
// one the caller made up -- it refunded count x cost_per, count taken from
// the body, and refund_credits adds whatever it is given. Any signed-in
// account could mint credits. That route serves all nine craft pages.
//
// The REAL route handlers; only the session and the database are faked.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fakeSupabase } from './helpers/fake-supabase'

const h = vi.hoisted(() => ({ fake: null as any, user: null as null | { id: string } }))
vi.mock('@supabase/supabase-js', async (orig) => ({ ...(await orig<any>()), createClient: () => h.fake.sb }))
vi.mock('@/lib/store/auth', () => ({ getUser: async () => h.user }))

import { POST as gatePOST } from '@/app/api/v1/credits/gate/route'
import { POST as refundPOST } from '@/app/api/v1/credits/refund/route'
import { PRESET_LABELS } from '@/lib/v1/portraits/portraits-shared'
import { GRANT_STALE_CLAIM_MS } from '@/lib/store/generation-grants'

const OWNER = 'owner-1'
const P = Object.keys(PRESET_LABELS)
const post = (fn: any, body: any) => fn(new Request('https://litenco.com/x', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
}))

beforeEach(() => {
  process.env.SUPABASE_URL = 'https://example.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-for-tests'
  h.user = { id: OWNER }
  h.fake = fakeSupabase({ tables: { credit_ledger: [], craft_events: [], credit_balances: [{ owner_key: OWNER, balance: 100 }], generation_grants: [] } })
  h.fake.onRpc('refund_credits', (a: any) => ({ data: 100 + a.p_n, error: null }))
  h.fake.onRpc('spend_credits', (a: any) => ({ data: 100 - a.p_n, error: null }))
})

// -- the gate ---------------------------------------------------------------

describe('/credits/gate issues grants for a Portraits craft', () => {
  it('spends and issues in one call, and returns one grant per image in unit order', async () => {
    h.fake.onRpc('issue_generation_grants', (a: any) => ({
      data: a.p_presets.map((preset: string, i: number) => ({ grant_id: `g${i}`, unit: i, preset, balance_after: 80 })).reverse(),
      error: null,
    }))
    const res = await post(gatePOST, { count: 2, cost_per: 10, series: 'portraits', presets: [P[0], P[1]] })
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.grants).toEqual([{ id: 'g0', unit: 0, preset: P[0] }, { id: 'g1', unit: 1, preset: P[1] }])
    expect(body.balance_after).toBe(80)
    const call = h.fake.calls.rpc.find((c: any) => c.name === 'issue_generation_grants')
    expect(call.args).toMatchObject({ p_owner: OWNER, p_presets: [P[0], P[1]], p_cost_per: 10, p_charge: true })
    expect(h.fake.calls.rpc.some((c: any) => c.name === 'spend_credits')).toBe(false)   // the spend is inside the RPC
  })

  it('a short balance spends nothing, issues nothing, and says so', async () => {
    h.fake.onRpc('issue_generation_grants', () => ({ data: [], error: null }))
    const res = await post(gatePOST, { count: 2, cost_per: 10, series: 'portraits', presets: [P[0], P[1]] })
    const body = await res.json()
    expect(body).toMatchObject({ ok: false, reason: 'insufficient_credits', needed: 20 })
    expect(h.fake.tables.craft_events).toEqual([])
    expect(h.fake.tables.credit_ledger).toEqual([])
  })

  it('an admin craft is issued grants without being charged', async () => {
    h.fake.tables.code_redemptions = [{ owner_key: OWNER, code: 'ADMIN1' }]
    h.fake.tables.access_codes = [{ code: 'ADMIN1', kind: 'admin' }]
    h.fake.onRpc('issue_generation_grants', (a: any) => ({ data: [{ grant_id: 'g0', unit: 0, preset: a.p_presets[0], balance_after: 100 }], error: null }))
    await post(gatePOST, { count: 1, cost_per: 10, series: 'portraits', presets: [P[0]] })
    expect(h.fake.calls.rpc.find((c: any) => c.name === 'issue_generation_grants').args.p_charge).toBe(false)
  })

  it('a Portraits craft must name a preset per image', async () => {
    const res = await post(gatePOST, { count: 2, cost_per: 10, series: 'portraits', presets: [] })
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('presets_required')
  })

  it('every other series spends exactly as before, and gets no grants', async () => {
    const res = await post(gatePOST, { count: 2, cost_per: 10, series: 'halloween' })
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(body.grants).toBeUndefined()
    expect(h.fake.calls.rpc.map((c: any) => c.name)).toEqual(['spend_credits'])
  })
})

// -- minting --------------------------------------------------------------

describe('/credits/refund never refunds what was never spent', () => {
  it('a made-up ref_id refunds nothing, whatever count is asked for', async () => {
    const res = await post(refundPOST, { ref_id: 'craft_invented', count: 1000, cost_per: 10 })
    expect(res.status).toBe(400)
    expect((await res.json()).reason).toBe('nothing_to_refund')
    expect(h.fake.calls.rpc.some((c: any) => c.name === 'refund_credits')).toBe(false)
  })

  it('a real ref refunds at most what it spent', async () => {
    h.fake.tables.credit_ledger.push(
      { owner_key: OWNER, reason: 'craft', ref_id: 'craft_real', delta: -10 },
      { owner_key: OWNER, reason: 'craft', ref_id: 'craft_real', delta: -10 },
    )
    const res = await post(refundPOST, { ref_id: 'craft_real', count: 100, cost_per: 10 })
    expect((await res.json()).refunded).toBe(20)
    expect(h.fake.calls.rpc.find((c: any) => c.name === 'refund_credits').args.p_n).toBe(20)
  })

  it("another owner's spend is not this caller's to refund", async () => {
    h.fake.tables.credit_ledger.push({ owner_key: 'someone-else', reason: 'craft', ref_id: 'craft_theirs', delta: -50 })
    const res = await post(refundPOST, { ref_id: 'craft_theirs', count: 5, cost_per: 10 })
    expect(res.status).toBe(400)
    expect(h.fake.calls.rpc.some((c: any) => c.name === 'refund_credits')).toBe(false)
  })

  it('a wallpaper basket (one "wallpapers" row) refunds up to that spend, not count x 10', async () => {
    h.fake.tables.credit_ledger.push({ owner_key: OWNER, reason: 'wallpapers', ref_id: 'wp_1', delta: -13 })
    const res = await post(refundPOST, { ref_id: 'wp_1', count: 5, cost_per: 10 })
    expect((await res.json()).refunded).toBe(13)
  })

  it('a second refund of the same ref pays nothing (unchanged)', async () => {
    h.fake.tables.credit_ledger.push(
      { owner_key: OWNER, reason: 'craft', ref_id: 'craft_real', delta: -10 },
      { owner_key: OWNER, reason: 'refund', ref_id: 'craft_real', delta: 10 },
    )
    const res = await post(refundPOST, { ref_id: 'craft_real', count: 1, cost_per: 10 })
    expect(await res.json()).toMatchObject({ ok: true, already: true, refunded: 0 })
    expect(h.fake.calls.rpc.some((c: any) => c.name === 'refund_credits')).toBe(false)
  })
})

// -- a Portraits craft refunds by its grants --------------------------------

describe('/credits/refund for a Portraits craft goes by its grants', () => {
  const withGrants = () => h.fake.tables.generation_grants.push({ id: 'g0', owner_key: OWNER, ref_id: 'craft_p' })
  const rpcReturns = (r: any) => h.fake.onRpc('refund_generation_grants', () => ({ data: [r], error: null }))

  it('asks the grants, with the 600s stale threshold, and never trusts count for money', async () => {
    withGrants()
    rpcReturns({ refunded_units: 1, refunded_credits: 10, already_refunded: 0, delivered_units: 1, held_units: 0, balance_after: 110 })
    const res = await post(refundPOST, { ref_id: 'craft_p', count: 999, cost_per: 10 })
    const call = h.fake.calls.rpc.find((c: any) => c.name === 'refund_generation_grants')
    expect(call.args).toEqual({ p_owner: OWNER, p_ref: 'craft_p', p_stale_seconds: GRANT_STALE_CLAIM_MS / 1000 })
    expect(h.fake.calls.rpc.some((c: any) => c.name === 'refund_credits')).toBe(false)
    expect((await res.json()).refunded).toBe(10)
  })

  it('ok only when every failed image the client counted was actually refunded', async () => {
    withGrants()
    rpcReturns({ refunded_units: 2, refunded_credits: 20, already_refunded: 0, delivered_units: 2, held_units: 0, balance_after: 120 })
    expect((await (await post(refundPOST, { ref_id: 'craft_p', count: 2, cost_per: 10 })).json()).ok).toBe(true)
  })

  it('not ok when an image the client thought failed was in fact delivered', async () => {
    withGrants()
    rpcReturns({ refunded_units: 1, refunded_credits: 10, already_refunded: 0, delivered_units: 3, held_units: 0, balance_after: 110 })
    const body = await (await post(refundPOST, { ref_id: 'craft_p', count: 2, cost_per: 10 })).json()
    expect(body).toMatchObject({ ok: false, reason: 'delivered_not_refundable', refunded: 10 })
  })

  it('not ok while a render on the craft is still in flight', async () => {
    withGrants()
    rpcReturns({ refunded_units: 0, refunded_credits: 0, already_refunded: 0, delivered_units: 0, held_units: 1, balance_after: 100 })
    const body = await (await post(refundPOST, { ref_id: 'craft_p', count: 1, cost_per: 10 })).json()
    expect(body).toMatchObject({ ok: false, reason: 'held_in_progress', held_units: 1 })
  })

  it('a repeat call reports "already" and pays nothing', async () => {
    withGrants()
    rpcReturns({ refunded_units: 0, refunded_credits: 0, already_refunded: 2, delivered_units: 2, held_units: 0, balance_after: 120 })
    const body = await (await post(refundPOST, { ref_id: 'craft_p', count: 2, cost_per: 10 })).json()
    expect(body).toMatchObject({ ok: true, already: true, refunded: 0 })
  })
})
