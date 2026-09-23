import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'
import vm from 'vm'
import { createHash } from 'crypto'
import { PETS_35 } from '@/lib/v1/pets/pets-catalog-35'
import data from '@/lib/v1/pets/pets-discovery-data.json'
import hashes from './fixtures/pets-approved-preview-hashes.json'

const mocks = vi.hoisted(() => ({ from:vi.fn(), ledger:vi.fn(), clean:vi.fn(), upload:vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin:{from:mocks.from,storage:{from:()=>({upload:mocks.upload})}} }))
vi.mock('@/lib/store/internal-fetch', () => ({internalBaseUrl:()=> 'https://preview.test',internalHeaders:(v:Record<string,string>)=>v}))
vi.mock('@/lib/store/preview', () => ({storeCleanOriginal:mocks.clean,recordPreview:mocks.ledger,
  lockedPreviewPath:(series:string,id:string)=>`locked/${series}/${id}.jpg`,PREVIEW_BUCKET:'previews',LOCKED_PREVIEW_QUALITY:90}))
vi.mock('@/lib/v1/foyer/foyer-watermark', () => ({bakeFoyerWatermark:async()=>Buffer.from('image').toString('base64')}))
vi.mock('sharp', () => ({default:()=>({toColourspace:()=>({jpeg:()=>({toBuffer:async()=>Buffer.from('locked')})})})}))
import { renderOnePortfolioItem } from '../portfolio-render'

const page = fs.readFileSync('public/pets.html','utf8')
type Registry = {effects:Array<{id:string}>,byId:(id:string)=>unknown,plateFor:(id:string)=>string}
const registry = {window:{} as {EFFECT_REGISTRY:Registry}}
vm.runInNewContext(fs.readFileSync('public/pets-registry.js','utf8'),registry)
const reg = registry.window.EFFECT_REGISTRY

describe('Pets Discovery catalog, artwork and checkout identity', () => {
  it('offers exactly the active 36 IDs and labels, with no obsolete effect', () => {
    expect(data.effects.map(e=>e.id)).toEqual(Object.keys(PETS_35))
    expect(reg.effects.map(e=>e.id)).toEqual(Object.keys(PETS_35))
    expect(reg.byId('forest_guardian')).toBeUndefined()
    for (const e of data.effects) expect(e.label).toBe(PETS_35[e.id].label)
  })
  it.each(Object.keys(PETS_35))('%s keeps preview bytes and checkout identity', id => {
    const preview = reg.plateFor(id)
    expect(preview).toBe(`/previews/pets/pets_${id}.jpg`)
    const installed=fs.readFileSync(`public${preview}`)
    expect(createHash('sha256').update(installed).digest('hex')).toBe(hashes[id as keyof typeof hashes])
    const body=page.slice(page.indexOf('function buildCheckoutPayload(){'),page.indexOf('\nfunction ',page.indexOf('function buildCheckoutPayload(){')+1))
    const context={SELECTED:[{key:id}],POSE:'as_photographed',ASPECT:'portrait',aspectRatioOf:()=> '3:4',
      SUBJECT:null,SRC_B64:'source-bytes',SERVER_OFFER:{priceUsd:2.99},window:{location:{origin:'https://preview.test',pathname:'/pets.html'}}}
    vm.runInNewContext(body.slice(0,body.indexOf('\n}')+2),context)
    expect((context as typeof context & {buildCheckoutPayload:()=>unknown}).buildCheckoutPayload()).toMatchObject({series:'pets',selectedEffectIds:[id],sourceImageRef:'source-bytes',aspect_ratio:'3:4'})
  })
  it('makes all 36 Pets effects eligible for Curated instead of the Portraits subset',()=>{
    const statement=page.match(/var CURATED_UNIVERSE = [^\n]+/)?.[0];
    const context={window:{EFFECT_REGISTRY:reg}};
    vm.runInNewContext(statement!,context);
    expect((context as typeof context & {CURATED_UNIVERSE:string[]}).CURATED_UNIVERSE).toEqual(Object.keys(PETS_35));
  })
  it.each(Object.keys(PETS_35))('%s uses approved Pets artwork in the actual Curated helper', id => {
    const preview=page.match(/function previewUrlFor\(effectId,subject\)\{[\s\S]*?\n\}/)?.[0] || page.match(/function previewUrlFor\(effectId, subject\)\{[\s\S]*?\n\}/)?.[0];
    const curated=page.match(/function curatedPreviewUrl\(base, subject\)\{[\s\S]*?\n\}/)?.[0];
    expect(preview).toBeTruthy(); expect(curated).toBeTruthy();
    const context={window:{EFFECT_REGISTRY:reg}};
    vm.runInNewContext(preview+'\n'+curated,context);
    const helper=(context as typeof context & {curatedPreviewUrl:(id:string,subject:string|null)=>string}).curatedPreviewUrl;
    for(const subject of [null,'man','woman']) expect(helper(id,subject)).toBe('/previews/pets/pets_'+id+'.jpg');
  })
  it('keeps Pets sign-in on upload and never invokes the human guest analyzer', async () => {
    expect(page).not.toContain("fetch('/api/v1/foyer/intake'")
    const start=page.indexOf('function runAnalyze(){');
    const body=page.slice(start,page.indexOf('\n/* What a detection',start));
    const openSignin=vi.fn();
    const context={SRC_B64:'photo',ANALYZE_SEQ:0,console,openSignin,applyDetection:vi.fn(),
      fetch:vi.fn().mockResolvedValue({status:401,ok:false,json:async()=>({reason:'not_signed_in'})})};
    vm.runInNewContext(body,context);
    await (context as typeof context & {runAnalyze:()=>Promise<unknown>}).runAnalyze();
    expect(openSignin).toHaveBeenCalledTimes(1);
    expect(context.applyDetection).not.toHaveBeenCalled();
    expect(context.fetch.mock.calls[0][0]).toBe('/api/v1/pets/analyze');
  })
  it('parses every inline JavaScript block', () => {
    for (const match of page.matchAll(/<script(?:[^>]*)>([\s\S]*?)<\/script>/g)) {
      if (match[1].trim()) expect(()=>new vm.Script(match[1])).not.toThrow();
    }
  })
  it('isolates resume storage and preserves the accepted CSS byte-for-byte', () => {
    const reference=fs.readFileSync('public/discovery-consolidated-draft.html','utf8')
    expect(page.replace(/<style id="petsRoomFlow">[\s\S]*?<\/style>/, '').match(/<style[\s\S]*?<\/style>/g)).toEqual(reference.match(/<style[\s\S]*?<\/style>/g))
    expect(page).toContain('liten_pets_resume_v1')
    expect(page).not.toContain('src="/effect-registry.js"')
    expect(page).toContain('/api/v1/pets/analyze')
  })
})

interface Query {
  select:()=>Query; eq:()=>Query; update:()=>Query; in:()=>Query;
  maybeSingle:()=>Promise<{data:unknown,error:null}>;
  then:(resolve:(value:{data:Array<{status:string}>,error:null})=>unknown)=>unknown;
}

describe('Pets portfolio Craft → Collection, preserving Portraits', () => {
  beforeEach(()=>vi.clearAllMocks())
  it.each(['preview', 'purchased'])('preserves the Portraits %s request', async delivery => {
    const results=[{id:'item',portfolio_id:'portfolio',slot:0,preset:'bronze',attempts:0},
      {id:'portfolio',series:'portraits',source_image:'source-bytes',delivery,aspect_ratio:'3:4',framing:'bust',pose:'as_photographed',subject:'man'}]
    const query:Query={select:()=>query,eq:()=>query,update:()=>query,in:()=>query,
      maybeSingle:async()=>({data:results.shift(),error:null}),then:(resolve:(value:{data:Array<{status:string}>,error:null})=>unknown)=>resolve({data:[{status:'done'}],error:null})}
    mocks.from.mockReturnValue(query)
    mocks.clean.mockResolvedValue('portraits/clean.png');mocks.ledger.mockResolvedValue(true);mocks.upload.mockResolvedValue({error:null})
    const request=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({result:{ok:true,image_b64:'image'}})})
    vi.stubGlobal('fetch',request)
    await renderOnePortfolioItem('item')
    expect(request.mock.calls[0][0]).toBe('https://preview.test/api/v1/portraits/generate')
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({source_image_b64:'source-bytes',style_id:'realistic',preset_id:'bronze',framing:'bust',scale:'close_up',
      ...(delivery==='purchased'?{output_aspect_ratio:'3:4',pose:'as_photographed',subject:'man'}:{})})
    expect(mocks.ledger).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({series:'portraits',unlockedAt:delivery==='purchased'?expect.any(String):null}))
    vi.unstubAllGlobals()
  })
  it.each(Object.keys(PETS_35))('%s reaches Pets generation and locked Collection persistence', async id => {
    const results=[{id:'item',portfolio_id:'portfolio',slot:0,preset:id,attempts:0},
      {id:'portfolio',series:'pets',source_image:'source-bytes',delivery:'preview',aspect_ratio:'3:4'}]
    const query:Query={select:()=>query,eq:()=>query,update:()=>query,in:()=>query,
      maybeSingle:async()=>({data:results.shift(),error:null}),then:(resolve:(value:{data:Array<{status:string}>,error:null})=>unknown)=>resolve({data:[{status:'done'}],error:null})}
    mocks.from.mockReturnValue(query)
    mocks.clean.mockResolvedValue('pets/clean.png');mocks.ledger.mockResolvedValue(true);mocks.upload.mockResolvedValue({error:null})
    const request=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({result:{ok:true,image_b64:'image'}})})
    vi.stubGlobal('fetch',request)
    await renderOnePortfolioItem('item')
    expect(request).toHaveBeenCalledTimes(1)
    expect(request.mock.calls[0][0]).toBe('https://preview.test/api/v1/pets/generate')
    expect(JSON.parse(request.mock.calls[0][1].body)).toMatchObject({preset_id:id,source_image_b64:'source-bytes',aspect_ratio:'3:4',action_id:'as_photographed'})
    expect(mocks.ledger).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({series:'pets',preset:id,unlockedAt:null}))
    vi.unstubAllGlobals()
  })
})
