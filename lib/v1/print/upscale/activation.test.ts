// Switching the pipeline on and off with real orders in flight: no duplicate jobs, no duplicate placement,
// no stranded order, and no check skipped. Real complete.ts, fulfillment.ts and orders.ts over in-memory stores;
// only the database rows, Prodigi, the gate and Stripe verification are faked.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHash } from 'node:crypto'
import { memoryJobStore, memoryStorage } from './store'

const s = vi.hoisted(() => ({
  gate: { flag: false, active: false, reason: 'disabled' as any, problems: [] as string[] },
  order: null as any, allowed: true, refunds: [] as any[], store: null as any, storage: null as any,
  prodigi: vi.fn(), markError: vi.fn(), verify: vi.fn(), sandbox: vi.fn(),
}))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: () => { const q: any = { select: () => q, eq: () => q, limit: async () => ({ data: s.refunds, error: null }) }; return q } } }))
vi.mock('../db', () => ({
  getPrintOrderById: async () => s.order, canFulfil: async () => s.allowed, markError: s.markError,
  markPlaced: async (i: any) => { s.order = { ...s.order, status: 'placed', placed_at: 'now', prodigi_order_id: i.prodigiOrderId } },
}))
vi.mock('../prodigi-client', () => ({ createOrder: s.prodigi }))
vi.mock('../owned-source', () => ({ requireSandboxPrint: s.sandbox }))
vi.mock('../retry', () => ({ verifyRetryPayment: s.verify }))
vi.mock('./runtime', () => ({ assetRuntime: () => ({ store: s.store, storage: s.storage }) }))
vi.mock('./pipeline', async () => ({ ...(await vi.importActual<typeof import('./pipeline')>('./pipeline')), pipelineState: async () => s.gate }))
import { completePrintOrder } from '../complete'
import { pipelineHoldReason } from './pipeline'

const OFF = { flag: false, active: false, reason: 'disabled' as const, problems: [] as string[] }
const ON = { flag: true, active: true, reason: null, problems: [] as string[] }
const NOT_READY = { flag: true, active: false, reason: 'not_ready' as const, problems: ['migration_046_not_applied:jobs'] }
const FILE = Buffer.from('print-file-bytes')

async function approveAll() {
  for (const j of s.store.jobs.values()) {
    await s.storage.put(`${j.id}/final.jpg`, FILE, 'image/jpeg')
    Object.assign(j, { status: 'approved', final_path: `${j.id}/final.jpg`, final_sha256: createHash('sha256').update(FILE).digest('hex') })
  }
}
const heldByPipeline = (source: 'owned' | 'url' = 'url') => ({ id: 'o1', status: 'withheld', error_message: pipelineHoldReason(OFF, source), prodigi_order_id: null, placed_at: null, owner_key: 'owner', stripe_session_id: 'cs_1',
  shipping_method: 'Standard', customer_email: 'c@example.test', shipping_address: { name: 'C', line1: 'L', city: 'T', postcode: '1', countryCode: 'US' }, items: [{ renderId: 'r', size: '8x8', finish: 'fine_art', copies: 1 }] })

beforeEach(() => {
  s.store = memoryJobStore(); s.storage = memoryStorage(); s.gate = OFF; s.allowed = true; s.refunds = []
  s.order = heldByPipeline(); s.prodigi.mockReset().mockResolvedValue({ order: { id: 'prodigi-1' } }); s.markError.mockReset().mockResolvedValue(undefined); s.verify.mockReset(); s.sandbox.mockReset()
})

describe('an order paid while the pipeline was off', () => {
  it('stays held, untouched, for as long as the pipeline is off or not ready: no jobs, no calls', async () => {
    for (const g of [OFF, NOT_READY]) { s.gate = g; expect(await completePrintOrder('o1')).toEqual({ status: 'skipped', reason: `pipeline_${g.reason}` }) }
    expect(s.store.jobs.size).toBe(0); expect(s.prodigi).not.toHaveBeenCalled(); expect(s.order.status).toBe('withheld')
  })
  it('is queued once at activation, never twice, however often the poller runs', async () => {
    s.gate = ON
    expect(await completePrintOrder('o1')).toEqual({ status: 'pending', reason: 'queued_after_activation' })
    expect(s.store.jobs.size).toBe(1)
    for (let i = 0; i < 3; i++) expect((await completePrintOrder('o1')).status).toBe('pending')
    expect(s.store.jobs.size).toBe(1); expect(s.prodigi).not.toHaveBeenCalled()
  })
  it('is placed exactly once when its pictures are approved, and a repeat does nothing', async () => {
    s.gate = ON; await completePrintOrder('o1'); await approveAll()
    expect(await completePrintOrder('o1')).toEqual({ status: 'placed', prodigiOrderId: 'prodigi-1' })
    expect(await completePrintOrder('o1')).toEqual({ status: 'skipped', reason: 'already_placed' })
    expect(s.prodigi).toHaveBeenCalledTimes(1); expect(s.prodigi.mock.calls[0][0]).toMatchObject({ idempotencyKey: 'cs_1', merchantReference: 'cs_1' })
  })
  it('keeps the sandbox source: an order held as owned-source resumes with owned-source jobs and sandbox verification', async () => {
    s.order = heldByPipeline('owned'); s.gate = ON; await completePrintOrder('o1')
    expect([...s.store.jobs.values()].map(j => j.source_kind)).toEqual(['owned'])
    await approveAll(); await completePrintOrder('o1'); expect(s.sandbox).toHaveBeenCalled(); expect(s.verify).toHaveBeenCalled()
  })
})

describe('the flag cannot loosen a check', () => {
  it('a refund recorded while it was held blocks the order, and no money is spent queuing it', async () => {
    s.gate = ON; s.refunds = [{ id: 'n1' }]
    expect(await completePrintOrder('o1')).toEqual({ status: 'blocked', reason: 'order_refunded' }); expect(s.store.jobs.size).toBe(0)
  })
  it('an account that is no longer cleared blocks it too', async () => {
    s.gate = ON; s.allowed = false
    expect(await completePrintOrder('o1')).toEqual({ status: 'blocked', reason: 'fulfilment_not_cleared' }); expect(s.store.jobs.size).toBe(0)
  })
  it('an order held for any OTHER reason is never resumed by activation', async () => {
    s.gate = ON
    for (const message of ['account acct is not cleared for fulfilment', 'order has no signed-in owner', null]) {
      s.order = { ...heldByPipeline(), error_message: message }; expect((await completePrintOrder('o1')).status).toBe('skipped')
    }
    expect(s.store.jobs.size).toBe(0); expect(s.prodigi).not.toHaveBeenCalled()
  })
  it('a refund appearing between approval and placement still stops the order', async () => {
    s.gate = ON; await completePrintOrder('o1'); await approveAll(); s.refunds = [{ id: 'n1' }]
    expect(await completePrintOrder('o1')).toEqual({ status: 'blocked', reason: 'order_refunded' }); expect(s.prodigi).not.toHaveBeenCalled()
  })
})

describe('switching off mid-flight, then on again', () => {
  it('pauses everything, strands nothing and duplicates nothing', async () => {
    s.gate = ON; await completePrintOrder('o1')
    const ids = [...s.store.jobs.keys()]
    s.store.jobs.get(ids[0])!.status = 'upscaling'                              // work is in flight
    s.gate = OFF
    expect(await completePrintOrder('o1')).toMatchObject({ status: 'skipped', reason: 'pipeline_disabled' })
    s.store.jobs.get(ids[0])!.prediction_id = 'pred-1'; s.gate = ON             // it is switched back on later
    expect(await completePrintOrder('o1')).toMatchObject({ status: 'pending' })
    expect([...s.store.jobs.keys()]).toEqual(ids); expect(s.store.jobs.get(ids[0])!.prediction_id).toBe('pred-1')
    await approveAll(); expect((await completePrintOrder('o1')).status).toBe('placed'); expect(s.prodigi).toHaveBeenCalledTimes(1)
  })
  it('switching off after approval but before placement defers the order; it is placed once when switched on again', async () => {
    s.gate = ON; await completePrintOrder('o1'); await approveAll()
    s.gate = OFF; expect((await completePrintOrder('o1')).status).toBe('skipped'); expect(s.prodigi).not.toHaveBeenCalled()
    s.gate = ON; expect((await completePrintOrder('o1')).status).toBe('placed'); expect((await completePrintOrder('o1')).status).toBe('skipped'); expect(s.prodigi).toHaveBeenCalledTimes(1)
  })
  it('an order already placed is never touched, whichever way the flag moves', async () => {
    s.order = { ...heldByPipeline(), status: 'placed', placed_at: 'x', prodigi_order_id: 'p' }
    for (const g of [OFF, ON, NOT_READY, ON]) { s.gate = g; await completePrintOrder('o1') }
    expect(s.store.jobs.size).toBe(0); expect(s.prodigi).not.toHaveBeenCalled()
  })
})
