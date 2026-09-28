import { beforeEach, describe, expect, it, vi } from 'vitest'
const state=vi.hoisted(()=>({ledger:{id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',email:'portfolio:bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb:0',storage_path:'clean.png',unlocked_at:'2026-09-27'},portfolio:{id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',series:'portraits'},item:{status:'done',preset:'bronze'},width:2048,height:2048,clean:vi.fn(),calls:[] as any[]}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{}}))
vi.mock('@/lib/store/preview',()=>({PREVIEW_BUCKET:'previews',fetchCleanOriginal:state.clean}))
vi.mock('sharp',()=>({default:()=>({metadata:async()=>({width:state.width,height:state.height})})}))
import {ownedPrintSource,requireSandboxPrint} from './owned-source'
function db(){return {from:(table:string)=>{const q:any={select:()=>q,eq:(k:string,v:any)=>{state.calls.push([table,k,v]);return q},maybeSingle:async()=>({data:table==='preview_ledger'?state.ledger:table==='portfolios'?state.portfolio:state.item,error:null})};return q}} as any}
beforeEach(()=>{state.calls=[];state.ledger.unlocked_at='2026-09-27';state.portfolio={id:'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',series:'portraits'};state.width=2048;state.height=2048;state.clean.mockReset().mockResolvedValue('YQ==');vi.unstubAllEnvs()})
describe('owned clean square print',()=>{
 it('uses verified portfolio ownership, slot and server storage',async()=>{const p=await ownedPrintSource('owner',state.ledger.id,db());expect(state.calls).toContainEqual(['portfolios','user_id','owner']);expect(state.calls).toContainEqual(['portfolio_items','slot',0]);expect(state.clean).toHaveBeenCalledWith(expect.anything(),'clean.png');expect(p.width).toBe(2048)})
 it('rejects a locked image before downloading',async()=>{state.ledger.unlocked_at='';await expect(ownedPrintSource('owner',state.ledger.id,db())).rejects.toThrow('owned_artwork_required');expect(state.clean).not.toHaveBeenCalled()})
 it('rejects artwork outside the owner query',async()=>{state.portfolio=null as any;await expect(ownedPrintSource('other',state.ledger.id,db())).rejects.toThrow('owned_artwork_required');expect(state.clean).not.toHaveBeenCalled()})
 it('rejects an incompatible rectangular original',async()=>{state.height=900;await expect(ownedPrintSource('owner',state.ledger.id,db())).rejects.toThrow('compatible_artwork_required')})
 it('accepts native portrait and landscape originals',async()=>{state.width=1024;state.height=1536;expect((await ownedPrintSource('owner',state.ledger.id,db())).height).toBe(1536);state.width=1536;state.height=1024;expect((await ownedPrintSource('owner',state.ledger.id,db())).width).toBe(1536)})
 it('rejects missing clean storage',async()=>{state.clean.mockResolvedValue(null);await expect(ownedPrintSource('owner',state.ledger.id,db())).rejects.toThrow('clean_original_unavailable')})
 it('requires Preview, sandbox and test Stripe together',()=>{vi.stubEnv('VERCEL_ENV','preview');vi.stubEnv('PRODIGI_ENV','sandbox');vi.stubEnv('STRIPE_SECRET_KEY','sk_test_fixture');expect(requireSandboxPrint).not.toThrow();vi.stubEnv('PRODIGI_ENV','live');expect(requireSandboxPrint).toThrow('prodigi_sandbox_required');vi.stubEnv('PRODIGI_ENV','sandbox');vi.stubEnv('STRIPE_SECRET_KEY','sk_live_fixture');expect(requireSandboxPrint).toThrow('stripe_test_mode_required');vi.stubEnv('VERCEL_ENV','production');expect(requireSandboxPrint).toThrow('preview_only')})
})
