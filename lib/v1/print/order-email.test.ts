import {it,expect,vi,beforeEach} from 'vitest'
const state=vi.hoisted(()=>({order:null as any,rows:new Map<string,any>(),calls:[] as any[]}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{storage:{from:()=>({createSignedUrl:async()=>({data:{signedUrl:'https://private.test/art'}})})},from:(table:string)=>{
 let patch:any,insert:any,filters:any={};const run=()=>{
 if(table==='print_orders')return {data:state.order,error:null}
 if(table==='portfolio_items')return {data:{preset:'balloon'},error:null}
 if(table==='preview_ledger')return {data:{storage_path:'art'},error:null}
 if(insert){const key=insert.event_key;if(state.rows.has(key))return {error:{code:'23505'}};state.rows.set(key,{...insert,status:'pending'});return {error:null}}
 const row=state.rows.get(filters.event_key);if(!row||(filters.status&&row.status!==filters.status))return {data:null,error:null}
 if(patch)Object.assign(row,patch);return {data:row,error:null}
 };const q:any={select:()=>q,insert:(v:any)=>{insert=v;return q},update:(v:any)=>{patch=v;return q},eq:(k:string,v:any)=>{filters[k]=v;return q},maybeSingle:async()=>run(),then:(r:any)=>r(run())};return q
}}}))
import {notifyPrintOrder,printEmailContent,printEmailKind} from './order-email'
beforeEach(()=>{
 state.rows.clear();state.calls=[];state.order={id:'order',prodigi_merchant_ref:'LC-123',stripe_session_id:'session',paid_at:'now',status:'paid',customer_email:'customer@example.test',shipping_address:{name:'Customer',line1:'1 Street',city:'Town',postcode:'12345',countryCode:'US'},items:[{renderId:'art',finish:'fine_art',size:'8x12',sizeLabel:'12 × 8″',copies:1,retailCents:2900}],retail_subtotal_cents:2900,retail_shipping_cents:685,retail_total_cents:3585}
 vi.stubEnv('RESEND_API_KEY','test');vi.stubEnv('SUPPORT_TO_EMAIL','studio@example.test');vi.stubEnv('VERCEL_ENV','preview')
 vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{state.calls.push(JSON.parse(init.body));return {ok:true,json:async()=>({id:'mail'})}}))
})
it('uses durable order status and sends one payment email under concurrent retries',async()=>{
 await Promise.all([notifyPrintOrder('session'),notifyPrintOrder('session')]);await notifyPrintOrder('session')
 expect(state.calls).toHaveLength(1);expect(state.rows.get('paid').status).toBe('accepted')
 expect(state.calls[0].text).toContain('$35.85');expect(state.calls[0].text).toContain('12 × 8″');expect(state.calls[0].html).toContain('<img')
})
it('does not send for an unpaid order',async()=>{state.order.paid_at=null;await notifyPrintOrder('session');expect(fetch).not.toHaveBeenCalled()})
it('notifies the studio before telling the paid customer not to reorder',async()=>{
 state.order.status='error';await notifyPrintOrder('session');await notifyPrintOrder('session')
 expect(state.calls).toHaveLength(2);expect(state.calls[0].to).toEqual(['studio@example.test']);expect(state.calls[1].text).toContain('Please do not reorder');expect(state.calls[1].text).toContain('studio has been notified')
})
it('does not falsely claim studio notification when the studio send fails',async()=>{
 state.order.status='error';vi.mocked(fetch).mockResolvedValueOnce({ok:false,json:async()=>({})} as any);await notifyPrintOrder('session')
 expect(state.calls[0].text).not.toContain('studio has been notified')
})
it('renders accepted, shipping and cancellation only from matching persisted states',()=>{
 for(const [status,kind] of [['placed','accepted'],['shipped','shipped'],['cancelled','cancelled']]){state.order.status=status;expect(printEmailKind(state.order)).toBe(kind)}
 state.order.shipping_carrier='Carrier';state.order.tracking_number='Tracking';const mail=printEmailContent(state.order,'shipped','https://example.test',[{title:'Balloon'}])
 expect(mail.text).toContain('Carrier');expect(mail.text).toContain('Tracking');expect(mail.text).not.toContain('GLOBAL-FAP');expect(mail.text).not.toContain('Prodigi')
})
it('records one notification for each verified refund identifier',async()=>{
 const refund={id:'refund-1',amount:1000};await notifyPrintOrder('session',refund);await notifyPrintOrder('session',refund)
 expect(state.calls).toHaveLength(1);expect(state.calls[0].text).toContain('Refunded: $10.00');expect(state.calls[0].text).toContain('original payment method')
})
it('does not retry an uncertain send automatically',async()=>{
 vi.mocked(fetch).mockRejectedValueOnce(new Error('timeout'));await notifyPrintOrder('session');await notifyPrintOrder('session')
 expect(fetch).toHaveBeenCalledTimes(1);expect(state.rows.get('paid').status).toBe('uncertain')
})
