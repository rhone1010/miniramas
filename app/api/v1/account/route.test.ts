import { beforeEach, expect, it, vi } from 'vitest'
const h = vi.hoisted(() => ({ user:vi.fn(), balance:vi.fn(), queries:[] as any[], failure:false }))
vi.mock('@/lib/store/auth',()=>({getUser:h.user}))
vi.mock('@/lib/store/collection-unlocks',()=>({collectionUnlockBalance:h.balance,COLLECTION_UNLOCK_LOCK:'discovery_unlock_credit',COLLECTION_UNLOCK_OFFERS:[{sku:'discovery_unlock_3',count:3}]}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{from:(table:string)=>{
 const q:any={table,filters:[],select(){return this},eq(k:string,v:any){this.filters.push([k,v]);return this},order(){return this},limit(){return Promise.resolve({error:h.failure?{}:null,data:table==='entitlements'?[{consumed_at:'2026-09-25'}]:[{sku_id:'discovery_unlock_3',status:'paid',amount_cents:799},{sku_id:'unlock_addon_1',status:'paid',amount_cents:2864}]})}};h.queries.push(q);return q;
}}}))
import {GET} from './route'
beforeEach(()=>{h.queries=[];h.failure=false;h.user.mockResolvedValue({id:'owner',email:'owner@example.test'});h.balance.mockResolvedValue(2)})
it('rejects unauthenticated reads without queries',async()=>{h.user.mockResolvedValue(null);expect((await GET()).status).toBe(401);expect(h.queries).toHaveLength(0)})
it('uses reusable balance, scopes all reads, labels wallet versus set purchases',async()=>{
 const r=await GET(),b=await r.json();expect(b.unlocks).toEqual({reusable:2});expect(b.ledger[0].delta).toBe(-1);
 expect(b.purchases.map((x:any)=>x.label)).toEqual(['3 Collection Unlocks','Collection artwork unlock purchase']);
 for(const q of h.queries)expect(q.filters).toContainEqual(['user_id','owner']);
 expect(h.queries[0].filters).toContainEqual(['purchases.status','paid']);
 expect(b).not.toHaveProperty('credits');expect(b).not.toHaveProperty('prints');expect(r.headers.get('cache-control')).toContain('no-store');
})
it('keeps unavailable data distinct from zero',async()=>{h.failure=true;h.balance.mockRejectedValue(new Error('offline'));const b=await(await GET()).json();expect(b.unlocks).toBeNull();expect(b.ledger).toBeNull();expect(b.purchases).toBeNull()})
