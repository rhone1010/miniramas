import {beforeEach,it,expect,vi} from 'vitest'
import sharp from 'sharp'
const state=vi.hoisted(()=>({uploaded:Buffer.alloc(0),steps:[] as string[],outpaint:vi.fn()}))
vi.mock('../shared/outpaint',()=>({outpaint:state.outpaint}))
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({storage:{from:()=>({upload:async(_p:string,b:Buffer)=>{state.uploaded=b;return {error:null}},createSignedUrl:async()=>({data:{signedUrl:'private-test-url'},error:null})})}})}))
import {preparePrintAsset} from './asset-pipeline'
beforeEach(()=>{
 state.steps=[];state.outpaint.mockReset();vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://example.test');vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test');vi.stubEnv('REPLICATE_API_TOKEN','test')
 state.outpaint.mockImplementation(async(input)=>{
   state.steps.push('outpaint')
   return {outpainted:true,image:await sharp(input.image).extend({left:input.padding.left,right:input.padding.right,top:input.padding.up,bottom:input.padding.down,background:'blue'}).png().toBuffer()}
 })
 let enlarged:Buffer
 vi.stubGlobal('fetch',vi.fn(async(url,options)=>{
   if(String(url).includes('/predictions')){
     state.steps.push('upscale');const {input}=JSON.parse(options.body)
     expect(input.face_enhance).toBe(false)
     const src=Buffer.from(input.image.split(',')[1],'base64'),meta=await sharp(src).metadata()
     enlarged=await sharp(src).resize(Math.round(meta.width!*input.scale),Math.round(meta.height!*input.scale)).png().toBuffer()
     return {ok:true,json:async()=>({output:'https://example.test/upscaled',status:'succeeded'})}
   }
   return {ok:true,arrayBuffer:async()=>enlarged}
 }))
})
async function source(w:number,h:number){return (await sharp({create:{width:w,height:h,channels:3,background:'red'}}).png().toBuffer()).toString('base64')}
it('outpaints before minimum fractional upscale, then prepares exact landscape dimensions',async()=>{
 const input=await source(1200,900)
 const result=await preparePrintAsset({imageB64:input,renderId:'test',size:'8x12',finish:'fine_art'})
 expect(state.steps).toEqual(['outpaint','upscale']);expect(result.scale).toBe(8/3)
 expect([result.width,result.height]).toEqual([3600,2400])
 expect(state.outpaint.mock.calls[0][0].padding).toEqual({left:75,right:75,up:0,down:0})
 const meta=await sharp(state.uploaded).metadata();expect([meta.width,meta.height]).toEqual([3600,2400])
 const center=await sharp(state.uploaded).extract({left:1800,top:1200,width:1,height:1}).raw().toBuffer();expect(center[0]).toBeGreaterThan(240)
 expect(input).toBe(await source(1200,900))
})
it('skips both providers for sufficient native resolution and adds Canvas wrap last',async()=>{
 const result=await preparePrintAsset({imageB64:await source(2400,3600),renderId:'native',size:'8x12',finish:'canvas'})
 expect(state.steps).toEqual([]);expect(result.upscaled).toBe(false);expect(result.scale).toBe(0)
 expect([result.width,result.height]).toEqual([2454,3654])
})
it('uses reflection, not outpaint, for the native allowance and preserves original pixels',async()=>{
 const result=await preparePrintAsset({imageB64:await source(2400,3590),renderId:'near',size:'8x12',finish:'fine_art'})
 expect(state.steps).toEqual([]);expect([result.width,result.height]).toEqual([2400,3600])
 const center=await sharp(state.uploaded).extract({left:1200,top:1800,width:1,height:1}).raw().toBuffer();expect(center[0]).toBeGreaterThan(240)
})
it('fails closed when outpaint fails or changes expected geometry',async()=>{
 const input={imageB64:await source(1200,900),renderId:'fail',size:'8x12' as const,finish:'fine_art' as const}
 state.outpaint.mockResolvedValueOnce({outpainted:false,reason:'timeout'})
 await expect(preparePrintAsset(input)).rejects.toThrow('print_outpaint_failed')
 state.outpaint.mockResolvedValueOnce({outpainted:true,image:Buffer.from(input.imageB64,'base64')})
 await expect(preparePrintAsset(input)).rejects.toThrow('print_outpaint_dimensions_changed')
 expect(fetch).not.toHaveBeenCalled()
})

it('sends only the approved Stability edge inputs and settings',async()=>{
 const {outpaint}=await vi.importActual<typeof import('../shared/outpaint')>('../shared/outpaint')
 const image=Buffer.from(await source(1200,900),'base64')
 vi.mocked(fetch).mockImplementationOnce(async(_url,options)=>{
  const form=options!.body as FormData
  expect(form.get('left')).toBe('75');expect(form.get('right')).toBe('75')
  expect(form.get('up')).toBeNull();expect(form.get('down')).toBeNull()
  expect(form.get('creativity')).toBe('0.35');expect(form.get('output_format')).toBe('jpeg')
  return {ok:true,arrayBuffer:async()=>image} as Response
 })
 expect((await outpaint({image,width:1200,height:900,stabilityApiKey:'test',mode:'print',padding:{left:75,right:75,up:0,down:0}})).outpainted).toBe(true)
})
