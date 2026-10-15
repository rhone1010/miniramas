import { it, expect, vi, beforeEach } from 'vitest'
import { memoryJobStore } from './upscale/store'
import { AssetsNotReadyError } from './upscale/orders'

const s = vi.hoisted(() => ({
  gate: { flag: true, active: true, reason: null as any, problems: [] as string[] },
  order: null as any, allowed: true, refunds: [] as any[], refundError: null as any, store: null as any,
  place: vi.fn(), markPlaced: vi.fn(), markError: vi.fn(), sandbox: vi.fn(), verify: vi.fn(),
}))
vi.mock('./db', () => ({ getPrintOrderById: async () => s.order, canFulfil: async () => s.allowed, markPlaced: s.markPlaced, markError: s.markError }))
vi.mock('./fulfillment', () => ({
  PlacementUncertainError: class extends Error {},
  prepareAndPlacePrint: async (o: any, sq: boolean, before?: () => Promise<void>) => { if (before) await before(); return s.place(o, sq) },
}))
vi.mock('./upscale/pipeline', async () => ({ ...(await vi.importActual<typeof import('./upscale/pipeline')>('./upscale/pipeline')), pipelineState: async () => s.gate }))
vi.mock('./upscale/runtime', () => ({ assetRuntime: () => ({ store: s.store }) }))
vi.mock('./owned-source', () => ({ requireSandboxPrint: s.sandbox }))
vi.mock('./retry', () => ({ verifyRetryPayment: s.verify }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => { const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: s.refunds, error: s.refundError }) }; return q } } }))
import { completePrintOrder } from './complete'

const base = () => ({ id: 'o1', status: 'paid', error_message: null, prodigi_order_id: null, placed_at: null, owner_key: 'owner', stripe_session_id: 'cs_1' })
async function jobs(kind: 'owned' | 'url' = 'owned') {
  s.store = memoryJobStore()
  await s.store.enqueue({ order_id: 'o1', item_index: 0, render_id: 'r', sku: 'GLOBAL-FAP-8X8', size: '8x8', finish: 'fine_art', source_kind: kind })
}
beforeEach(async () => {
  s.gate = { flag: true, active: true, reason: null, problems: [] }
  s.order = base(); s.allowed = true; s.refunds = []; s.refundError = null
  for (const f of [s.place, s.markPlaced, s.markError, s.sandbox, s.verify]) f.mockReset()
  s.place.mockResolvedValue('prodigi-1'); s.markPlaced.mockResolvedValue(undefined); s.markError.mockResolvedValue(undefined); await jobs()
})

it('places a paid order whose pictures are approved, and records it', async () => {
  expect(await completePrintOrder('o1')).toEqual({ status: 'placed', prodigiOrderId: 'prodigi-1' })
  expect(s.markPlaced).toHaveBeenCalledWith({ sessionId: 'cs_1', prodigiOrderId: 'prodigi-1', wholesaleCents: null })
})
it('re-verifies payment and sandbox mode for sandbox orders only', async () => {
  await completePrintOrder('o1'); expect(s.sandbox).toHaveBeenCalledTimes(1); expect(s.verify).toHaveBeenCalledTimes(1)
  s.sandbox.mockReset(); s.verify.mockReset(); await jobs('url')
  await completePrintOrder('o1'); expect(s.sandbox).not.toHaveBeenCalled(); expect(s.verify).not.toHaveBeenCalled()
})
it('resumes orders held only by an asset review or failure', async () => {
  s.order = { ...base(), status: 'withheld', error_message: 'asset_review:qa_uncertain' }
  expect((await completePrintOrder('o1')).status).toBe('placed')
  s.order = { ...base(), status: 'error', error_message: 'asset_failed:invalid_file' }
  expect((await completePrintOrder('o1')).status).toBe('placed')
})
it('leaves every other order alone', async () => {
  for (const o of [{ status: 'placed' }, { status: 'shipped' }, { status: 'created' }, { status: 'cancelled' },
    { status: 'withheld', error_message: 'account acct is not cleared for fulfilment' }, { status: 'error', error_message: 'prodigi: timeout' }, { status: 'paid', prodigi_order_id: 'p' }]) {
    s.order = { ...base(), ...o }
    expect((await completePrintOrder('o1')).status).toBe('skipped')
  }
  expect(s.place).not.toHaveBeenCalled()
})
it('does nothing for an order with no jobs, or one that does not exist', async () => {
  s.store = memoryJobStore(); expect(await completePrintOrder('o1')).toEqual({ status: 'skipped', reason: 'no_jobs' })
  s.order = null; expect(await completePrintOrder('o1')).toEqual({ status: 'skipped', reason: 'order_missing' })
})
it('refuses after a refund, an uncleared account or a refund-check outage, without marking the order an error', async () => {
  s.refunds = [{ id: 'n1' }]; expect(await completePrintOrder('o1')).toMatchObject({ status: 'blocked', reason: 'order_refunded' })
  s.refunds = []; s.allowed = false; expect(await completePrintOrder('o1')).toMatchObject({ status: 'blocked', reason: 'fulfilment_not_cleared' })
  s.allowed = true; s.refundError = { message: 'down' }; expect(await completePrintOrder('o1')).toMatchObject({ status: 'blocked', reason: 'refund_check_unavailable' })
  expect(s.markError).not.toHaveBeenCalled(); expect(s.markPlaced).not.toHaveBeenCalled()
})
it('waits, without error, while pictures are unfinished or held', async () => {
  s.place.mockRejectedValue(new AssetsNotReadyError('pending', 'in_progress'))
  expect(await completePrintOrder('o1')).toMatchObject({ status: 'pending' })
  s.place.mockRejectedValue(new AssetsNotReadyError('review', '0:qa_uncertain'))
  expect(await completePrintOrder('o1')).toMatchObject({ status: 'blocked' })
  expect(s.markError).not.toHaveBeenCalled(); expect(s.markPlaced).not.toHaveBeenCalled()
})
it('records a placement failure as an error', async () => {
  s.place.mockRejectedValue(new Error('prodigi: HTTP 500'))
  expect(await completePrintOrder('o1')).toMatchObject({ status: 'blocked' })
  expect(s.markError).toHaveBeenCalledWith('cs_1', 'prodigi: HTTP 500'); expect(s.markPlaced).not.toHaveBeenCalled()
})
