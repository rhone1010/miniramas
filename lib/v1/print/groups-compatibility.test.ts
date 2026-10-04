import {beforeEach,describe,expect,it,vi} from 'vitest'
const h=vi.hoisted(()=>({series:'groups',unlocked:true,owner:true,status:'done',width:1536,height:1024,clean:vi.fn(),calls:[] as any[]}))
vi.mock('@/lib/supabase',()=>({supabaseAdmin:{}}))
vi.mock('@/lib/store/preview',()=>({PREVIEW_BUCKET:'previews',fetchCleanOriginal:h.clean}))
vi.mock('sharp',()=>({default:()=>({metadata:async()=>({width:h.width,height:h.height})})}))
import {ownedPrintSource} from './owned-source'
const preview='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',portfolio='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
function db(){return {from:(table:string)=>{const q:any={select:()=>q,eq:(k:string,v:any)=>{h.calls.push([table,k,v]);return q},maybeSingle:async()=>({error:null,data:table==='preview_ledger'?{email:'portfolio:'+portfolio+':0',unlocked_at:h.unlocked?'yes':null,storage_path:'clean.png'}:table==='portfolios'?(h.owner?{id:portfolio,series:h.series}:null):{status:h.status,preset:'fixture'}})};return q}} as any}
beforeEach(()=>{Object.assign(h,{series:'groups',unlocked:true,owner:true,status:'done',width:1536,height:1024,calls:[]});h.clean.mockReset().mockResolvedValue('YQ==')})
describe('shared Print source eligibility',()=>{
 for(const series of ['portraits','pets','groups']) {
  for(const [width,height] of [[1024,1024],[1024,1536],[1536,1024],[1600,900]]) {
   it(series+' '+width+'x'+height+' uses existing clean-source path',async()=>{
    Object.assign(h,{series,width,height});const result=await ownedPrintSource('owner',preview,db())
    expect(result.series).toBe(series);expect(result.width).toBe(width);expect(result.height).toBe(height)
    expect(h.calls).toContainEqual(['portfolios','user_id','owner']);expect(h.calls).toContainEqual(['portfolio_items','slot',0]);expect(h.clean).toHaveBeenCalledWith(expect.anything(),'clean.png')
   })
  }
 }
 it.each(['locked','not-owner','unfinished'])('rejects %s Groups artwork before download',async(reason)=>{
  if(reason==='locked')h.unlocked=false;if(reason==='not-owner')h.owner=false;if(reason==='unfinished')h.status='generating'
  await expect(ownedPrintSource('owner',preview,db())).rejects.toThrow('owned_artwork_required');expect(h.clean).not.toHaveBeenCalled()
 })
 it('preserves unsupported series rejection',async()=>{h.series='wallpapers';await expect(ownedPrintSource('owner',preview,db())).rejects.toThrow('square_artwork_required')})
 it('preserves incompatible geometry rejection',async()=>{h.width=3000;h.height=1000;await expect(ownedPrintSource('owner',preview,db())).rejects.toThrow('compatible_artwork_required')})
})
