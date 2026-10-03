import {beforeEach,expect,it,vi} from 'vitest'
import {NextRequest} from 'next/server'
const h=vi.hoisted(()=>({event:{} as any,verify:vi.fn(),print:vi.fn(),confirm:vi.fn(),portfolio:vi.fn(),unlock:vi.fn(),failure:vi.fn(),set:vi.fn(),bundle:vi.fn()}))
vi.mock('@/lib/store/stripe',()=>({getStripe:()=>({webhooks:{constructEvent:h.verify}})}))
vi.mock('@/lib/v1/print/webhook-handler',()=>({handlePrintWebhook:h.print}))
vi.mock('@/lib/store/entitlements',()=>({confirmPurchase:h.confirm,handlePaymentFailure:h.failure}))
vi.mock('@/lib/store/portfolio-checkout',()=>({activatePortfolio:h.portfolio}))
vi.mock('@/lib/store/discovery-unlock',()=>({activateDiscoveryUnlock:h.unlock}))
vi.mock('@/lib/store/collection-unlock-set',()=>({COLLECTION_SET_KIND:'collection_set',fulfillCollectionSet:h.set}))
vi.mock('@/lib/store/collection-unlocks',()=>({COLLECTION_UNLOCK_KIND:'collection_unlock',fulfillCollectionUnlocks:h.bundle}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{}}))
import {POST} from '@/app/api/v1/webhooks/stripe/route'
const post=()=>POST(new NextRequest('http://localhost:3000/api/v1/webhooks/stripe',{method:'POST',headers:{'stripe-signature':'sig'},body:'raw-body'}))
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('STRIPE_WEBHOOK_SECRET','whsec_existing');h.event={type:'checkout.session.completed',data:{object:{id:'cs_test',payment_intent:'pi_test',payment_status:'paid',metadata:{}}}};h.verify.mockImplementation(()=>h.event);h.confirm.mockResolvedValue({purchaseId:'purchase'});h.unlock.mockResolvedValue({activated:true});h.print.mockResolvedValue(new Response('print-response',{status:200}))})
it.each(['catalog_v2','square_8x8'])('dispatches verified %s Print only',async tag=>{h.event.data.object.metadata.print_test=tag;const response=await post();expect(await response.text()).toBe('print-response');expect(h.verify).toHaveBeenCalledWith('raw-body','sig','whsec_existing');expect(h.print).toHaveBeenCalledWith(h.event);expect(h.confirm).not.toHaveBeenCalled();expect(h.portfolio).not.toHaveBeenCalled()})
it.each([200,409,500])('preserves Print response status %s',async status=>{h.event.data.object.metadata.print_test='catalog_v2';h.print.mockResolvedValue(new Response('unchanged',{status}));const r=await post();expect(r.status).toBe(status);expect(await r.text()).toBe('unchanged')})
it('rejects forged Print event before dispatch',async()=>{h.event.data.object.metadata.print_test='catalog_v2';h.verify.mockImplementation(()=>{throw Error('invalid signature')});expect((await post()).status).toBe(400);expect(h.print).not.toHaveBeenCalled();expect(h.confirm).not.toHaveBeenCalled()})
it.each(['','discovery_unlock','collection_set','collection_unlock'])('preserves non-Print %s dispatch',async kind=>{h.event.data.object.metadata.kind=kind;expect((await post()).status).toBe(200);expect(h.print).not.toHaveBeenCalled();if(kind==='collection_set')expect(h.set).toHaveBeenCalledWith('cs_test');else if(kind==='collection_unlock')expect(h.bundle).toHaveBeenCalledWith('cs_test');else {expect(h.confirm).toHaveBeenCalledWith({stripeSessionId:'cs_test',stripeChargeId:'pi_test'});expect(h.portfolio).toHaveBeenCalledWith('purchase');if(kind==='discovery_unlock')expect(h.unlock).toHaveBeenCalledWith({stripeSessionId:'cs_test'})}})
it('preserves expired-session behavior',async()=>{h.event.type='checkout.session.expired';expect((await post()).status).toBe(200);expect(h.failure).toHaveBeenCalledWith({stripeSessionId:'cs_test',reason:'session_expired'});expect(h.print).not.toHaveBeenCalled()})
