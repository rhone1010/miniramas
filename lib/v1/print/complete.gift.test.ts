// How the existing fulfilment path treats a Gift Wizard order: invisible until approved, queued only when approved, paid
// (re-verified with Stripe) and unrefunded, read from the approved composition, and never placed for another product.

import { it, expect, vi, beforeEach, describe } from 'vitest'
import sharp from 'sharp'
import { memoryJobStore } from './upscale/store'
import { enqueueOrderJobs } from './upscale/orders'
import { memoryGiftStore } from '../gift/store'
import { loadApprovedCompositionWith } from '../gift/print-source'
import { giftRenderId } from '../gift/order-kind'

const SID = '10000000-0000-4000-8000-0000000000aa', U1 = '10000000-0000-4000-8000-000000000001'
const s = vi.hoisted(() => ({
  gate: { flag: true, active: true, reason: null as any, problems: [] as string[] },
  order: null as any, allowed: true, store: null as any, giftStore: null as any,
  place: vi.fn(), markPlaced: vi.fn(), markError: vi.fn(), sandbox: vi.fn(), verifyRetry: vi.fn(), verifyGift: vi.fn(), refunds: [] as any[],
}))
vi.mock('./db', () => ({ getPrintOrderById: async () => s.order, canFulfil: async () => s.allowed, markPlaced: s.markPlaced, markError: s.markError }))
vi.mock('./fulfillment', () => ({
  PlacementUncertainError: class extends Error {},
  prepareAndPlacePrint: async (o: any, sq: boolean, before?: () => Promise<void>) => { if (before) await before(); return s.place(o, sq) },
}))
vi.mock('./upscale/pipeline', async () => ({ ...(await vi.importActual<typeof import('./upscale/pipeline')>('./upscale/pipeline')), pipelineState: async () => s.gate }))
vi.mock('./upscale/runtime', () => ({ assetRuntime: () => ({ store: s.store }) }))
vi.mock('./owned-source', () => ({ requireSandboxPrint: s.sandbox }))
vi.mock('./retry', () => ({ verifyRetryPayment: s.verifyRetry }))
vi.mock('../gift/orders', async () => ({ ...(await vi.importActual<typeof import('../gift/orders')>('../gift/orders')), verifyGiftPayment: s.verifyGift }))
vi.mock('../gift/store', async () => ({ ...(await vi.importActual<typeof import('../gift/store')>('../gift/store')), supabaseGiftStore: () => s.giftStore }))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => ({}) }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => { const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: s.refunds, error: null }) }; return q } } }))
import { completePrintOrder } from './complete'

const giftOrder = (status = 'paid') => ({
  id: 'o1', status, error_message: null, prodigi_order_id: null, placed_at: null, owner_key: U1, stripe_session_id: 'cs_1', paid_at: new Date().toISOString(),
  items: [{ renderId: giftRenderId(SID, 'a'), renderUrl: '', size: '8x8', finish: 'fine_art', copies: 1, sku: 'GLOBAL-FAP-8X8', retailCents: 2900 }],
})
function giftSession(over: Record<string, unknown> = {}) {
  s.giftStore.sessions.set(SID, { id: SID, user_id: U1, status: 'active', order_id: 'o1', approved_at: new Date().toISOString(), refund_requested_at: null, refunded_at: null, artwork_preview_id: 'p1', pinned_at: 'x', ...over })
}
beforeEach(() => {
  s.gate = { flag: true, active: true, reason: null, problems: [] }; s.allowed = true; s.store = memoryJobStore(); s.giftStore = memoryGiftStore(); s.refunds = []
  for (const f of [s.place, s.markPlaced, s.markError, s.sandbox, s.verifyRetry, s.verifyGift]) f.mockReset()
  s.place.mockResolvedValue('prodigi-1'); s.markPlaced.mockResolvedValue(undefined); s.verifyGift.mockResolvedValue(undefined)
  s.order = giftOrder(); giftSession()
})

describe('queueing', () => {
  it('an order awaiting artwork can never be queued, by any caller', async () => {
    await expect(enqueueOrderJobs(memoryJobStore(), giftOrder('awaiting_artwork') as any, false)).rejects.toThrow('order_awaiting_artwork')
    await expect(enqueueOrderJobs(memoryJobStore(), giftOrder('awaiting_artwork') as any, true)).rejects.toThrow('order_awaiting_artwork')
  })
  it('gift orders get gift jobs; every other order keeps its existing kind', async () => {
    const st = memoryJobStore()
    expect((await enqueueOrderJobs(st, giftOrder() as any, false))[0].source_kind).toBe('gift')
    const plain = { ...giftOrder(), items: [{ ...giftOrder().items[0], renderId: 'render_1', renderUrl: 'https://x/y.png' }] }
    expect((await enqueueOrderJobs(memoryJobStore(), plain as any, false))[0].source_kind).toBe('url')
    expect((await enqueueOrderJobs(memoryJobStore(), plain as any, true))[0].source_kind).toBe('owned')
  })
  it('an order awaiting artwork is skipped by completion: nothing is queued or placed', async () => {
    s.order = giftOrder('awaiting_artwork')
    expect(await completePrintOrder('o1')).toMatchObject({ status: 'skipped', reason: 'status_awaiting_artwork' })
    expect(s.store.jobs.size).toBe(0); expect(s.place).not.toHaveBeenCalled()
  })
})

describe('completion of an approved gift order', () => {
  it('queues the print job when approved (no webhook ever did), after the payment is re-verified with Stripe', async () => {
    expect(await completePrintOrder('o1')).toEqual({ status: 'pending', reason: 'queued_after_activation' })
    expect([...s.store.jobs.values()].map((j: any) => j.source_kind)).toEqual(['gift']); expect(s.verifyGift).toHaveBeenCalledTimes(1)
    expect(s.verifyGift.mock.calls[0][2]).toEqual({ testModeOnly: false }); expect(s.place).not.toHaveBeenCalled()
  })
  it('on Preview, Stripe test mode and the Prodigi sandbox are required', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    await completePrintOrder('o1'); expect(s.sandbox).toHaveBeenCalled(); expect(s.verifyGift.mock.calls[0][2]).toEqual({ testModeOnly: true })
    vi.unstubAllEnvs()
  })
  it('places only when every job is approved, and then releases the session', async () => {
    await completePrintOrder('o1')
    for (const j of s.store.jobs.values()) Object.assign(j, { status: 'approved' })
    s.giftStore.releaseSession = vi.fn(async () => {})
    expect(await completePrintOrder('o1')).toEqual({ status: 'placed', prodigiOrderId: 'prodigi-1' })
    expect(s.giftStore.releaseSession).toHaveBeenCalledWith('o1'); expect(s.verifyGift).toHaveBeenCalledTimes(2)
  })
  it('a refund request, a refund, a missing approval or a failed payment re-check each stop it with nothing queued or placed', async () => {
    for (const [mutate, reason] of [
      [() => giftSession({ refund_requested_at: new Date().toISOString() }), 'refund_pending'],
      [() => giftSession({ refunded_at: new Date().toISOString() }), 'order_refunded'],
      [() => giftSession({ approved_at: null }), 'artwork_not_approved'],
      [() => s.verifyGift.mockRejectedValueOnce(new Error('gift_charge_ineligible')), 'gift_charge_ineligible'],
    ] as Array<[() => void, string]>) {
      beforeEachReset(); mutate()
      expect(await completePrintOrder('o1')).toEqual({ status: 'blocked', reason }); expect(s.store.jobs.size).toBe(0); expect(s.place).not.toHaveBeenCalled(); expect(s.markError).not.toHaveBeenCalled()
    }
  })
  it('an account that is not cleared for fulfilment is still held', async () => {
    s.allowed = false
    expect(await completePrintOrder('o1')).toEqual({ status: 'blocked', reason: 'fulfilment_not_cleared' }); expect(s.store.jobs.size).toBe(0)
  })
  it('the activation flag still gates everything', async () => {
    s.gate = { flag: false, active: false, reason: 'disabled', problems: [] }
    expect(await completePrintOrder('o1')).toMatchObject({ status: 'skipped' }); expect(s.store.jobs.size).toBe(0)
  })
  it('ordinary orders are untouched by the gift checks', async () => {
    s.order = { ...giftOrder(), items: [{ ...giftOrder().items[0], renderId: 'render_1' }] }
    await s.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'render_1', sku: 'GLOBAL-FAP-8X8', size: '8x8', finish: 'fine_art', source_kind: 'url' })
    for (const j of s.store.jobs.values()) Object.assign(j, { status: 'approved' })
    expect(await completePrintOrder('o1')).toEqual({ status: 'placed', prodigiOrderId: 'prodigi-1' }); expect(s.verifyGift).not.toHaveBeenCalled()
  })
})
function beforeEachReset() { s.store = memoryJobStore(); s.giftStore = memoryGiftStore(); s.order = giftOrder(); giftSession(); s.place.mockReset(); s.markError.mockReset(); s.verifyGift.mockReset(); s.verifyGift.mockResolvedValue(undefined) }

describe('the job source', () => {
  const setup = async () => {
    const store = memoryGiftStore(), files = new Map<string, Buffer>()
    const storage = { put: async () => {}, get: async (p: string) => files.get(p) ?? null, remove: async () => {}, signedUrl: async () => null }
    store.sessions.set(SID, { id: SID, user_id: U1, status: 'active', order_id: 'o1', approved_at: new Date().toISOString(), refund_requested_at: null, refunded_at: null, artwork_preview_id: 'p1' } as any)
    store.lines.push({ order_id: 'o1', line_index: 0, session_id: SID, line_id: 'a', product_id: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1, corrections_used: 0 })
    const img = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#fff' } }).png().toBuffer(); files.set('c/ok.png', img)
    store.compositions.push({ id: 'c1', session_id: SID, line_id: 'a', preview_id: 'p1', attempt: 1, status: 'approved', composed_path: 'c/ok.png', preview_path: 'c/ok.jpg', width: 64, height: 64, plan: {}, created_at: '', approved_at: '' })
    return { store, storage, files, img }
  }
  const job = { render_id: giftRenderId(SID, 'a'), item_index: 0 }
  it('reads the approved composition for that line of the selected artwork', async () => {
    const { store, storage, img } = await setup()
    expect((await loadApprovedCompositionWith(store, storage, { id: 'o1' }, job)).equals(img)).toBe(true)
  })
  it('refuses anything not approved, not matching, refunded, or missing', async () => {
    for (const [mutate, msg] of [
      [(x: any) => { x.store.compositions[0].status = 'ready' }, 'gift_composition_not_approved'],
      [(x: any) => { x.store.compositions[0].status = 'superseded' }, 'gift_composition_not_approved'],
      [(x: any) => { x.store.compositions[0].preview_id = 'other' }, 'gift_composition_not_approved'],
      [(x: any) => { x.store.sessions.get(SID).approved_at = null }, 'gift_artwork_not_approved'],
      [(x: any) => { x.store.sessions.get(SID).refunded_at = 'x' }, 'gift_order_not_releasable'],
      [(x: any) => { x.store.sessions.get(SID).refund_requested_at = 'x' }, 'gift_order_not_releasable'],
      [(x: any) => { x.files.clear() }, 'gift_composition_missing'],
      [(x: any) => { x.store.lines[0].line_id = 'zzz' }, 'gift_line_mismatch'],
    ] as Array<[(x: any) => void, string]>) {
      const x = await setup(); mutate(x)
      await expect(loadApprovedCompositionWith(x.store, x.storage, { id: 'o1' }, job), msg).rejects.toThrow(msg)
    }
    const x = await setup()
    await expect(loadApprovedCompositionWith(x.store, x.storage, { id: 'o1' }, { render_id: 'render_1', item_index: 0 })).rejects.toThrow('gift_render_id_invalid')
    await expect(loadApprovedCompositionWith(x.store, x.storage, { id: 'o1' }, { render_id: giftRenderId('20000000-0000-4000-8000-000000000000', 'a'), item_index: 0 })).rejects.toThrow('gift_session_mismatch')
    await expect(loadApprovedCompositionWith(x.store, x.storage, { id: 'unknown' }, job)).rejects.toThrow('gift_session_mismatch')
  })
})
