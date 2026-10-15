import {it,expect,vi,beforeEach} from 'vitest'
import {createHash} from 'node:crypto'
import {memoryJobStore,memoryStorage} from './upscale/store'

const s=vi.hoisted(()=>({place:vi.fn(),rt:null as any,gate:{flag:true,active:true,reason:null as any,problems:[] as string[]}}))
vi.mock('./prodigi-client',()=>({createOrder:s.place}))
vi.mock('./upscale/runtime',()=>({assetRuntime:()=>s.rt}))
vi.mock('./upscale/pipeline',async()=>({...(await vi.importActual<typeof import('./upscale/pipeline')>('./upscale/pipeline')),pipelineState:async()=>s.gate}))
import {prepareAndPlacePrint,PlacementUncertainError,AssetsNotReadyError,PipelineInactiveError} from './fulfillment'

const order:any={id:'order-1',stripe_session_id:'original-session',owner_key:'owner',prodigi_merchant_ref:'original-reference',customer_email:'customer@example.test',shipping_method:'Standard',shipping_address:{name:'Customer',line1:'Street',city:'Town',postcode:'12345',countryCode:'US'},items:[{renderId:'art',size:'8x12',finish:'fine_art',copies:1}]}
const FILE=Buffer.from('print-file-bytes')
const sha=(b:Buffer)=>createHash('sha256').update(b).digest('hex')

/** Put the order's one job into a given state, with its print file saved. */
async function seed(status:string,over:Record<string,unknown>={}){
  const store=memoryJobStore(),storage=memoryStorage()
  const job=await store.enqueue({order_id:'order-1',item_index:0,render_id:'art',sku:'GLOBAL-FAP-8X12',size:'8x12',finish:'fine_art',source_kind:'owned'})
  await storage.put(`${job.id}/final.jpg`,FILE,'image/jpeg')
  Object.assign(store.jobs.get(job.id)!,{status,final_path:`${job.id}/final.jpg`,final_sha256:sha(FILE),...over})
  s.rt={store,storage}
  return {store,storage,job}
}
beforeEach(()=>{s.place.mockReset().mockResolvedValue({order:{id:'sandbox-reference'}});s.gate={flag:true,active:true,reason:null,problems:[]}})

it('places only approved, hash-verified files, sharing original items, shipping and idempotency key',async()=>{
  const {job}=await seed('approved')
  const before=JSON.stringify(order),check=vi.fn().mockResolvedValue(undefined)
  expect(await prepareAndPlacePrint(order,true,check)).toBe('sandbox-reference')
  expect(check).toHaveBeenCalledTimes(1)
  expect(s.place).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:'original-session',merchantReference:'original-reference',shippingMethod:'Standard',items:[expect.objectContaining({sku:'GLOBAL-FAP-8X12',copies:1,assets:[{printArea:'default',url:expect.stringContaining(`${job.id}/final.jpg`)}]})]}))
  expect(JSON.stringify(order)).toBe(before)
})
for(const status of ['queued','upscaling','qa','review','rejected','failed'])it(`never places while a job is ${status}`,async()=>{
  await seed(status,status==='review'?{review_reason:'qa_uncertain'}:{})
  const check=vi.fn()
  await expect(prepareAndPlacePrint(order,true,check)).rejects.toBeInstanceOf(AssetsNotReadyError)
  expect(s.place).not.toHaveBeenCalled();expect(check).not.toHaveBeenCalled()
})
it('creates the jobs for an order that has none and waits, rather than preparing anything inline',async()=>{
  const store=memoryJobStore(),storage=memoryStorage();s.rt={store,storage}
  await expect(prepareAndPlacePrint(order,true)).rejects.toMatchObject({state:'pending'})
  expect((await store.listForOrder('order-1')).map(j=>j.status)).toEqual(['queued']);expect(s.place).not.toHaveBeenCalled()
})
it('refuses a file whose bytes no longer match the approved hash',async()=>{
  const {storage,job}=await seed('approved')
  await storage.put(`${job.id}/final.jpg`,Buffer.from('tampered'),'image/jpeg')
  await expect(prepareAndPlacePrint(order,true)).rejects.toThrow('asset_hash_mismatch')
  expect(s.place).not.toHaveBeenCalled()
})
it('refuses an approved job that has no file',async()=>{
  await seed('approved',{final_path:null})
  await expect(prepareAndPlacePrint(order,true)).rejects.toThrow('approved_job_without_file');expect(s.place).not.toHaveBeenCalled()
})
it('does not place if the final eligibility recheck fails',async()=>{
  await seed('approved')
  await expect(prepareAndPlacePrint(order,true,async()=>{throw new Error('refunded')})).rejects.toThrow('refunded');expect(s.place).not.toHaveBeenCalled()
})
it('marks provider-call failure as uncertain, preventing an automatic second placement',async()=>{
  await seed('approved')
  s.place.mockRejectedValue(new Error('network timeout'));await expect(prepareAndPlacePrint(order,true)).rejects.toBeInstanceOf(PlacementUncertainError)
})
it('holds a multi-line order until every line is approved',async()=>{
  const store=memoryJobStore(),storage=memoryStorage();s.rt={store,storage}
  const two={...order,items:[order.items[0],{...order.items[0],renderId:'art2'}]}
  const a=await store.enqueue({order_id:'order-1',item_index:0,render_id:'art',sku:'GLOBAL-FAP-8X12',size:'8x12',finish:'fine_art',source_kind:'owned'})
  await store.enqueue({order_id:'order-1',item_index:1,render_id:'art2',sku:'GLOBAL-FAP-8X12',size:'8x12',finish:'fine_art',source_kind:'owned'})
  await storage.put(`${a.id}/final.jpg`,FILE,'image/jpeg');Object.assign(store.jobs.get(a.id)!,{status:'approved',final_path:`${a.id}/final.jpg`,final_sha256:sha(FILE)})
  await expect(prepareAndPlacePrint(two,true)).rejects.toMatchObject({state:'pending'});expect(s.place).not.toHaveBeenCalled()
})

for(const [reason,problems] of [['disabled',[]],['not_ready',['migration_046_not_applied:jobs']]] as const)it(`starts nothing while the pipeline is ${reason}: no jobs created, no file read, nothing placed`,async()=>{
  await seed('approved')
  const fresh=memoryJobStore(),storage=memoryStorage();s.rt={store:fresh,storage}
  s.gate={flag:reason==='not_ready',active:false,reason,problems:[...problems]}
  const check=vi.fn()
  await expect(prepareAndPlacePrint(order,true,check)).rejects.toBeInstanceOf(PipelineInactiveError)
  expect(fresh.jobs.size).toBe(0);expect(storage.files.size).toBe(0);expect(check).not.toHaveBeenCalled();expect(s.place).not.toHaveBeenCalled()
})
