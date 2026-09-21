import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({
  event: {} as any,
  confirm: vi.fn(), portfolio: vi.fn(), unlock: vi.fn(), failure: vi.fn(),
}))
vi.mock('@/lib/store/stripe', () => ({ getStripe: () => ({ webhooks: {
  constructEvent: () => h.event,
} }) }))
vi.mock('@/lib/store/entitlements', () => ({ confirmPurchase: h.confirm, handlePaymentFailure: h.failure }))
vi.mock('@/lib/store/portfolio-checkout', () => ({ activatePortfolio: h.portfolio }))
vi.mock('@/lib/store/discovery-unlock', () => ({ activateDiscoveryUnlock: h.unlock }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))
import { POST } from '@/app/api/v1/webhooks/stripe/route'

const post = () => POST(new NextRequest('https://litenco.com/api/v1/webhooks/stripe', {
  method: 'POST', headers: { 'stripe-signature': 'test-signature' }, body: '{}',
}))
beforeEach(() => {
  vi.resetAllMocks()
  process.env.STRIPE_WEBHOOK_SECRET = 'test-only'
  h.event = { id: 'evt_one', type: 'checkout.session.completed', data: { object: {
    id: 'cs_one', payment_intent: 'pi_one', payment_status: 'paid', metadata: {kind:'discovery_unlock'},
  } } }
  h.confirm.mockResolvedValue({purchaseId:'purchase-one'})
  h.portfolio.mockResolvedValue(undefined)
  h.unlock.mockResolvedValue({activated:true})
})
describe('Stripe fulfillment acknowledgements', () => {
  it('returns 500 on portfolio activation failure, then retries activation', async () => {
    h.portfolio.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await post()).status).toBe(500)
    expect((await post()).status).toBe(200)
    expect(h.portfolio.mock.calls).toEqual([['purchase-one'],['purchase-one']])
  })
  it('returns 500 on unlock activation failure and accepts a successful retry', async () => {
    h.unlock.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await post()).status).toBe(500)
    expect((await post()).status).toBe(200)
    expect(h.unlock).toHaveBeenCalledTimes(2)
  })
  it.each(['entitlement_missing','owner_mismatch','purchase_not_found','not_pending'])('does not acknowledge %s as fulfillment', async reason => {
    h.unlock.mockResolvedValue({activated:false,reason})
    expect((await post()).status).toBe(500)
  })
  it.each(['already_available','already_consumed'])('acknowledges safe duplicate %s', async reason => {
    h.unlock.mockResolvedValue({activated:false,reason})
    expect((await post()).status).toBe(200)
  })
  it('does not activate an unpaid delayed-payment checkout', async () => {
    h.event.data.object.payment_status='unpaid'
    expect((await post()).status).toBe(200)
    expect(h.confirm).not.toHaveBeenCalled()
    expect(h.unlock).not.toHaveBeenCalled()
  })
  it('fulfills the subsequent async payment success', async () => {
    h.event.type='checkout.session.async_payment_succeeded'
    expect((await post()).status).toBe(200)
    expect(h.confirm).toHaveBeenCalledWith({stripeSessionId:'cs_one',stripeChargeId:'pi_one'})
    expect(h.unlock).toHaveBeenCalledTimes(1)
  })
  it('returns 500 if purchase confirmation fails', async () => {
    h.confirm.mockRejectedValue(new Error('database unavailable'))
    expect((await post()).status).toBe(500)
    expect(h.portfolio).not.toHaveBeenCalled()
  })
})
