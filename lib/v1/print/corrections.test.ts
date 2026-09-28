import {it,expect,vi,beforeEach} from 'vitest'
import fs from 'node:fs'
import vm from 'node:vm'
const state=vi.hoisted(()=>({purchase:null as string|null,owner:'owner',queries:[] as any[],ledger:true}))
vi.mock('@/lib/store/auth',()=>({getUser:async()=>({id:'owner'})}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{from:(table:string)=>{
 const filters:any[]=[];const q:any={select:()=>q,eq:(k:string,v:any)=>{filters.push([k,v]);state.queries.push([table,k,v]);return q},neq:(k:string,v:any)=>{state.queries.push([table,k,v]);return q},in:()=>q,not:()=>q,order:()=>q,maybeSingle:async()=>({data:{id:'portfolio',user_id:state.owner,purchase_id:state.purchase,free_unlocks:state.purchase?1:0},error:null}),then:(resolve:any)=>resolve({data:table==='entitlements'?[{status:'available'}]:table==='portfolio_items'?[{slot:0,preset:'balloon',status:'done',preview_id:'preview'}]:state.ledger?[{id:'preview',unlocked_at:'now'}]:[],error:null})};return q
}}}))
import {GET} from '../../../app/api/v1/portfolios/[portfolioId]/unlocks/route'
beforeEach(()=>{state.purchase=null;state.owner='owner';state.queries=[];state.ledger=true})
it('purchase-less owned portfolio avoids null purchase filters and preserves unlock state',async()=>{
 const r=await GET({} as any,{params:Promise.resolve({portfolioId:'portfolio'})});const j=await r.json()
 expect(r.status).toBe(200);expect(j.includedRemaining).toBe(0);expect(j.items[0].unlocked).toBe(true)
 expect(state.queries.filter(q=>q[0]==='entitlements').every(q=>q[1]!=='purchase_id')).toBe(true)
})
it('paid portfolios retain purchase-specific entitlement queries',async()=>{
 state.purchase='purchase';const r=await GET({} as any,{params:Promise.resolve({portfolioId:'portfolio'})})
 expect((await r.json()).includedRemaining).toBe(1);expect(state.queries).toContainEqual(['entitlements','purchase_id','purchase'])
})
it('wrong owner is rejected before entitlement lookup',async()=>{
 state.owner='someone-else';expect((await GET({} as any,{params:Promise.resolve({portfolioId:'portfolio'})})).status).toBe(403)
 expect(state.queries.filter(q=>q[0]==='entitlements')).toEqual([])
})
it('gallery retains valid artwork when another portfolio fails',async()=>{
 const html=fs.readFileSync('public/portraits.html','utf8'),start=html.indexOf('  function loadPrintCollection(){'),end=html.indexOf('  function renderWall()',start)
 let done!:()=>void;const completed=new Promise<void>(r=>{done=r})
 const context:any={PRINT_COLLECTION:[],PRINT_COLLECTION_STATE:'loading',printCollectionGallery:done,fetch:async(url:string)=>({ok:!url.includes('/bad/'),json:async()=>url==='/api/v1/portfolios'?{portfolios:[{id:'good',series:'portraits'},{id:'bad',series:'pets'}]}:url.endsWith('/unlocks')?{items:[{slot:0,unlocked:true}]}:{items:[{slot:0,status:'done',previewId:'art',previewUrl:'private-art',preset:'balloon'}]}})}
 vm.createContext(context);vm.runInContext(html.slice(start,end)+';loadPrintCollection();',context);await completed
 expect(context.PRINT_COLLECTION).toHaveLength(1);expect(context.PRINT_COLLECTION_STATE).toBe('partial')
})
