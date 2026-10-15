// The Stripe webhook now only RECORDS the work. It must never prepare artwork or call Prodigi inline.

import { it, expect, vi, beforeEach } from 'vitest'

const s = vi.hoisted(() => ({
  gate: { flag: true, active: true, reason: null as any, problems: [] as string[] },
  order: null as any, allowed: true, enqueue: vi.fn(), markPaid: vi.fn(), markError: vi.fn(), markWithheld: vi.fn(), notify: vi.fn(), sandbox: vi.fn(),
}))
vi.mock('@/lib/v1/print/order-email', () => ({ notifyPrintOrder: s.notify }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))
vi.mock('@/lib/v1/print/upscale/runtime', () => ({ assetRuntime: () => ({ store: 'STORE' }) }))
vi.mock('@/lib/v1/print/upscale/pipeline', async () => ({ ...(await vi.importActual<typeof import('@/lib/v1/print/upscale/pipeline')>('@/lib/v1/print/upscale/pipeline')), pipelineState: async () => s.gate }))
vi.mock('@/lib/v1/print/upscale/orders', () => ({ enqueueOrderJobs: s.enqueue }))
vi.mock('@/lib/v1/print/owned-source', () => ({ requireSandboxPrint: s.sandbox }))
vi.mock('@/lib/v1/print/db', () => ({
  getPrintOrderBySessionId: async () => s.order, canFulfil: async () => s.allowed,
  markPaid: s.markPaid, markError: s.markError, markWithheld: s.markWithheld,
}))
import { handlePrintWebhook } from './webhook-handler'

const event = (metadata: Record<string, string> = {}) => ({ type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_intent: 'pi_1', livemode: false, payment_status: 'paid', metadata } } }) as any
beforeEach(() => {
  s.gate = { flag: true, active: true, reason: null, problems: [] }
  s.order = { id: 'o1', status: 'created', owner_key: 'owner', items: [{ renderId: 'a', copies: 1 }], retail_total_cents: 5000 }; s.allowed = true
  for (const f of [s.enqueue, s.markPaid, s.markError, s.markWithheld, s.notify, s.sandbox]) f.mockReset().mockResolvedValue(undefined)
})

it('marks the order paid and queues the pictures, without placing anything', async () => {
  const res = await handlePrintWebhook(event())
  expect(await res.json()).toEqual({ ok: true, queued: true })
  expect(s.markPaid).toHaveBeenCalledWith('cs_1', 'pi_1'); expect(s.enqueue).toHaveBeenCalledWith('STORE', s.order, false)
  expect(s.markError).not.toHaveBeenCalled()
})
it('sandbox test checkouts queue owned-source jobs', async () => {
  await handlePrintWebhook(event({ print_test: 'catalog_v2' }))
  expect(s.sandbox).toHaveBeenCalled(); expect(s.enqueue).toHaveBeenCalledWith('STORE', s.order, true)
})
it('an account that is not cleared is withheld and nothing is queued', async () => {
  s.allowed = false
  const res = await handlePrintWebhook(event())
  expect(await res.json()).toMatchObject({ ok: true, withheld: true }); expect(s.markWithheld).toHaveBeenCalled(); expect(s.enqueue).not.toHaveBeenCalled()
})
it('a repeated webhook is a no-op for an order already past created', async () => {
  s.order.status = 'paid'
  expect(await (await handlePrintWebhook(event())).json()).toMatchObject({ deduped: true })
  expect(s.enqueue).not.toHaveBeenCalled(); expect(s.markPaid).not.toHaveBeenCalled()
})
it('a failure to queue is recorded as an error rather than lost', async () => {
  s.enqueue.mockRejectedValue(new Error('db down'))
  expect(await (await handlePrintWebhook(event())).json()).toEqual({ ok: false, error: 'db down' })
  expect(s.markError).toHaveBeenCalledWith('cs_1', 'db down')
})

it('with the pipeline OFF: payment and account checks still run, then the order is withheld visibly and nothing is queued', async () => {
  s.gate = { flag: false, active: false, reason: 'disabled', problems: [] }
  const res = await handlePrintWebhook(event())
  expect(await res.json()).toEqual({ ok: true, withheld: true, reason: 'print_pipeline_disabled;source=url' })
  expect(s.markPaid).toHaveBeenCalledWith('cs_1', 'pi_1')                    // payment is recorded exactly as before
  expect(s.markWithheld).toHaveBeenCalledWith('cs_1', 'print_pipeline_disabled;source=url')
  expect(s.enqueue).not.toHaveBeenCalled(); expect(s.markError).not.toHaveBeenCalled()
})
it('switched on but not ready: held with the reasons, and sandbox verification still ran first', async () => {
  s.gate = { flag: true, active: false, reason: 'not_ready', problems: ['migration_046_not_applied:jobs', 'missing_OPENAI_API_KEY'] }
  const res = await handlePrintWebhook(event({ print_test: 'catalog_v2' }))
  expect(await res.json()).toMatchObject({ withheld: true, reason: 'print_pipeline_not_ready:migration_046_not_applied:jobs,missing_OPENAI_API_KEY;source=owned' })
  expect(s.sandbox).toHaveBeenCalled(); expect(s.enqueue).not.toHaveBeenCalled()
})
it('the flag cannot bypass the account gate: an uncleared account is withheld with the existing reason, flag on or off', async () => {
  s.allowed = false
  for (const g of [{ flag: true, active: true, reason: null, problems: [] }, { flag: false, active: false, reason: 'disabled', problems: [] }]) {
    s.gate = g as any; s.markWithheld.mockClear()
    expect(await (await handlePrintWebhook(event())).json()).toMatchObject({ withheld: true, reason: expect.stringContaining('not cleared') })
  }
  expect(s.enqueue).not.toHaveBeenCalled()
})
