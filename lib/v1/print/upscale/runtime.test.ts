import { describe, it, expect, vi, beforeEach } from 'vitest'

const s = vi.hoisted(() => ({ order: null as any, inserted: [] as any[], insertError: null as any, markWithheld: vi.fn(), markError: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: { from: (t: string) => ({ insert: async (row: any) => { s.inserted.push({ t, row }); return { error: s.insertError } } }) } }))
vi.mock('../db', () => ({ getPrintOrderById: async () => s.order, markWithheld: s.markWithheld, markError: s.markError }))
vi.mock('../owned-source', () => ({ ownedPrintSource: vi.fn() }))
import { notifyAttention } from './runtime'

const job = (over: Record<string, unknown> = {}) => ({ id: '40000000-0000-4000-8000-000000000001', order_id: 'o1', item_index: 1, sku: 'GLOBAL-CAN-8X8', status: 'review', review_reason: 'qa_uncertain,source_quality_below_floor', error: null, warnings: [{ code: 'source_quality_below_floor', detail: '61 PPI' }], ...over }) as any

beforeEach(() => {
  s.order = { id: 'o1', status: 'paid', stripe_session_id: 'cs_1', owner_key: '20000000-0000-4000-8000-000000000001', customer_email: 'c@example.test', prodigi_merchant_ref: 'LIT-1001' }
  s.inserted = []; s.insertError = null; s.markWithheld.mockReset().mockResolvedValue(undefined); s.markError.mockReset().mockResolvedValue(undefined)
})

describe('a job needing a person is routed through the existing Concierge record and order notices', () => {
  it('writes one support_messages row keyed by the job, with context a person and the Concierge can use', async () => {
    await notifyAttention(job())
    const { t, row } = s.inserted[0]
    expect(t).toBe('support_messages')
    expect(row).toMatchObject({ id: job().id, user_id: '20000000-0000-4000-8000-000000000001', reply_to: 'c@example.test', subject: 'Print artwork needs review: order LIT-1001' })
    expect(row.body).toContain('Print file 2 of order LIT-1001'); expect(row.body).toContain('less real detail'); expect(row.body).toContain('Nothing has been sent to the print lab')
    expect(row.context).toMatchObject({ kind: 'print_asset_review', order_id: 'o1', job_id: job().id, item_index: 1, sku: 'GLOBAL-CAN-8X8', status: 'review' })
  })
  it('holds a review order with the existing withheld status, which sends the existing notices', async () => {
    await notifyAttention(job())
    expect(s.markWithheld).toHaveBeenCalledWith('cs_1', 'asset_review:qa_uncertain,source_quality_below_floor'); expect(s.markError).not.toHaveBeenCalled()
  })
  it('marks an order whose file could not be made as an error', async () => {
    await notifyAttention(job({ status: 'failed', error: 'invalid_file:wrong_dimensions', review_reason: null }))
    expect(s.markError).toHaveBeenCalledWith('cs_1', 'asset_failed:invalid_file:wrong_dimensions'); expect(s.markWithheld).not.toHaveBeenCalled()
  })
  it('a repeat is harmless: a duplicate record is ignored and the order is not disturbed once placed', async () => {
    s.insertError = { code: '23505', message: 'duplicate' }; await expect(notifyAttention(job())).resolves.toBeUndefined()
    s.order.status = 'placed'; s.markWithheld.mockReset(); await notifyAttention(job()); expect(s.markWithheld).not.toHaveBeenCalled()
  })
  it('a guest order (no account id) still records the message, without a user', async () => {
    s.order.owner_key = null; await notifyAttention(job()); expect(s.inserted[0].row.user_id).toBeNull()
  })
  it('does nothing for a job whose order is gone, and never refunds or credits anything', async () => {
    s.order = null; await notifyAttention(job()); expect(s.inserted).toHaveLength(0)
  })
})
