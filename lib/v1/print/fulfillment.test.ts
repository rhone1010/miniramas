import {it,expect,vi,beforeEach} from 'vitest'
const s=vi.hoisted(()=>({source:vi.fn(),prepare:vi.fn(),place:vi.fn()}))
vi.mock('./owned-source',()=>({ownedPrintSource:s.source}))
vi.mock('./asset-pipeline',()=>({preparePrintAsset:s.prepare}))
vi.mock('./prodigi-client',()=>({createOrder:s.place}))
import {prepareAndPlacePrint,PlacementUncertainError} from './fulfillment'
const order:any={stripe_session_id:'original-session',owner_key:'owner',prodigi_merchant_ref:'original-reference',customer_email:'customer@example.test',shipping_method:'Standard',shipping_address:{name:'Customer',line1:'Street',city:'Town',postcode:'12345',countryCode:'US'},items:[{renderId:'art',size:'8x12',finish:'fine_art',copies:1}]}
beforeEach(()=>{s.source.mockReset().mockResolvedValue({bytes:Buffer.from('clean')});s.prepare.mockReset().mockResolvedValue({signedUrl:'https://private.test/derivative'});s.place.mockReset().mockResolvedValue({order:{id:'sandbox-reference'}})})
it('shares original items, shipping and idempotency key, using the prepared private derivative',async()=>{
 const before=JSON.stringify(order),check=vi.fn().mockResolvedValue(undefined)
 expect(await prepareAndPlacePrint(order,true,check)).toBe('sandbox-reference')
 expect(s.source).toHaveBeenCalledWith('owner','art');expect(check).toHaveBeenCalledTimes(1)
 expect(s.place).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:'original-session',merchantReference:'original-reference',shippingMethod:'Standard',items:[expect.objectContaining({sku:'GLOBAL-FAP-8X12',copies:1,assets:[{printArea:'default',url:'https://private.test/derivative'}]})]}))
 expect(JSON.stringify(order)).toBe(before)
})
it('does not place if the final eligibility recheck fails',async()=>{
 await expect(prepareAndPlacePrint(order,true,async()=>{throw new Error('refunded')})).rejects.toThrow('refunded');expect(s.place).not.toHaveBeenCalled()
})
it('marks provider-call failure as uncertain, preventing an automatic second placement',async()=>{
 s.place.mockRejectedValue(new Error('network timeout'));await expect(prepareAndPlacePrint(order,true)).rejects.toBeInstanceOf(PlacementUncertainError)
})
