import { beforeEach, expect, it, vi } from 'vitest'
const h=vi.hoisted(()=>({tables:{} as Record<string,any[]>,fail:'',user:{id:'owner',email:'owner@example.test'} as any}))
vi.mock('@/lib/store/auth',()=>({getUser:async()=>h.user}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{from:(table:string)=>{
 let filters:((r:any)=>boolean)[]=[], inserted:any=null,head=false;
 const run=()=>{
  if(h.fail===table)return {data:null,error:{message:'unavailable'}};
  if(inserted){if((h.tables[table]||[]).some(r=>r.id===inserted.id))return {data:null,error:{code:'23505'}};(h.tables[table]||=[]).push(inserted);return {data:[inserted],error:null}}
  const rows=(h.tables[table]||[]).filter(r=>filters.every(f=>f(r)));return {data:head?null:rows,error:null,count:rows.length};
 };
 const q:any={select:(s:any,o:any)=>{head=!!o?.head;return q},eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q},
 in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q},contains:(k:string,v:any[])=>{filters.push(r=>v.every(x=>r[k].includes(x)));return q},
 gte:()=>q,order:()=>q,limit:()=>q,insert:(v:any)=>{inserted=v;return q},maybeSingle:async()=>{const r=run();return {...r,data:r.data?.[0]||null}},then:(resolve:any,reject:any)=>Promise.resolve(run()).then(resolve,reject)};return q;
}}}))
import {verifyCase} from './support-case'
import {POST,GET} from '../app/api/v1/support/route'
const A='11111111-1111-4111-8111-111111111111',P='22222222-2222-4222-8222-222222222222',R='33333333-3333-4333-8333-333333333333';
const input=()=>({requestId:R,artwork:{kind:'portfolio',id:A,portfolioId:P},issue:'quality',remedy:'redo'});
const req=(c:any=input())=>new Request('https://example.test/api/v1/support',{method:'POST',body:JSON.stringify({message:'Test issue',case:c,context:{case:{status:'approved'}}})});
beforeEach(()=>{h.user={id:'owner',email:'owner@example.test'};h.fail='';delete process.env.RESEND_API_KEY;delete process.env.SUPPORT_TO_EMAIL;
 h.tables={portfolios:[{id:P,user_id:'owner',purchase_id:'craft',series:'pets'}],portfolio_items:[{portfolio_id:P,preview_id:A,status:'done',slot:0,preset:'felt'}],
 entitlements:[{user_id:'owner',locked_variant:A,status:'consumed',purchase_id:'wallet'}],collection_unlock_sets:[],purchases:[{id:'craft',user_id:'owner',status:'paid',amount_cents:499},{id:'wallet',user_id:'owner',status:'paid',amount_cents:799}],support_messages:[]};
 vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new Error('mail offline')))
})
it('verifies artwork and both relevant purchase relationships without executing remedies',async()=>{const c=await verifyCase('owner',{...input(),status:'approved',purchases:['forged']});expect(c.status).toBe('requested');expect(c.purchases.map((p:any)=>p.roles)).toEqual([['craft'],['unlock']]);expect(fetch).not.toHaveBeenCalled()})
it('rejects another customer and incomplete artwork',async()=>{await expect(verifyCase('other',input())).rejects.toMatchObject({status:404});h.tables.portfolio_items[0].status='running';await expect(verifyCase('owner',input())).rejects.toMatchObject({status:404})})
it('marks older owned artwork for purchase review',async()=>{h.tables.collection_pieces=[{id:A,owner_key:'owner'}];const c=await verifyCase('owner',{...input(),artwork:{id:A,kind:'piece'}});expect(c.purchase_context).toBe('requires_review');expect(c.purchases).toEqual([])})
it('fails closed when verification fails',async()=>{h.fail='purchases';expect((await POST(req())).status).toBe(503);expect(h.tables.support_messages).toHaveLength(0)})
it('records durably without mail configuration and does not duplicate resubmissions',async()=>{const r=await POST(req());expect(r.status).toBe(200);expect((await r.json()).saved).toBe(true);await POST(req());expect(h.tables.support_messages).toHaveLength(1);expect(h.tables.support_messages[0].context.case.status).toBe('requested')})
it('does not claim success when persistence fails',async()=>{h.fail='support_messages';expect((await POST(req())).status).toBe(503);expect(fetch).not.toHaveBeenCalled()})
it('keeps a receipt when notification throws',async()=>{process.env.RESEND_API_KEY='test';process.env.SUPPORT_TO_EMAIL='example@example.test';const b=await(await POST(req())).json();expect(b.ok).toBe(true);expect(b.ref).toBe(R);expect(b.notification).toBe('failed')})
it('rejects anonymous case submission and retrieval',async()=>{h.user=null;expect((await POST(req())).status).toBe(401);expect((await GET()).status).toBe(401)})
it('rejects changed request under an existing id and scopes case reads',async()=>{await POST(req());expect((await POST(req({...input(),remedy:'refund'}))).status).toBe(409);h.user={id:'other'};expect((await(await GET()).json()).cases).toEqual([])})
