import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest'
import {GROUPS_FORMATS,groupsFormatAllowed,GROUPS_EFFECTS} from './groups-effects'
const h=vi.hoisted(()=>({detect:vi.fn(),score:vi.fn()}))
vi.mock('./groups-refine',()=>({detectFaceVisibility:h.detect,scorePerFigureFidelity:h.score}))
vi.mock('../shared/outpaint',()=>({outpaintMargin:vi.fn()}))
import {generateGroupsRender} from './groups-generator'
const cases=[{count:3,allowed:['9:16','2:3','1:1']},{count:4,allowed:['2:3','1:1','4:3','3:2','16:9']},{count:6,allowed:['2:3','1:1','4:3','3:2','16:9']},{count:7,allowed:['4:3','3:2','16:9']},{count:8,allowed:['4:3','3:2','16:9']},{count:10,allowed:['4:3','3:2','16:9']}]
beforeEach(()=>{vi.resetAllMocks();h.score.mockResolvedValue([{figure_index:1,score:10,reason:'test'}])})
afterEach(()=>vi.unstubAllGlobals())
for(const c of cases)describe(c.count+' people',()=>{
 it.each(GROUPS_FORMATS)('%s eligibility',ratio=>expect(groupsFormatAllowed(c.count,ratio)).toBe(c.allowed.includes(ratio)))
 it.each(GROUPS_FORMATS)('%s uses authoritative count and exact NB2 ratio',async ratio=>{
  h.detect.mockResolvedValue({face_visible:true,subject_count_estimate:c.count,faces:[{age_class:'adult',age_confidence:10}]})
  const http=vi.fn().mockImplementation(async(url)=>String(url).includes('predictions')?new Response(JSON.stringify({status:'succeeded',output:'https://fixture.invalid/image'})):new Response(new Uint8Array([1,2,3])))
  vi.stubGlobal('fetch',http)
  const result=await generateGroupsRender({request:{source_images_b64:['YQ=='],effect_id:Object.values(GROUPS_EFFECTS).find(e=>e.intake==='group_photo')!.id,subject_count:99,format:ratio,skip_scoring:true},replicateApiToken:'fixture',openaiApiKey:'fixture'})
  if(!c.allowed.includes(ratio)){expect(result.error_code).toBe('format_not_allowed');expect(http).not.toHaveBeenCalled()}
  else {expect(result.passed).toBe(true);expect(result.subject_count).toBe(c.count);expect(JSON.parse(http.mock.calls[0][1].body).input.aspect_ratio).toBe(ratio)}
 })
})
it('preserves detection-error fallback without replacing the requested ratio',async()=>{
 h.detect.mockRejectedValue(new Error('existing detection outage'))
 const http=vi.fn().mockImplementation(async(url)=>String(url).includes('predictions')?new Response(JSON.stringify({status:'succeeded',output:'https://fixture.invalid/image'})):new Response(new Uint8Array([1,2,3])))
 vi.stubGlobal('fetch',http)
 const result=await generateGroupsRender({request:{source_images_b64:['YQ=='],effect_id:Object.values(GROUPS_EFFECTS)[0].id,subject_count:3,format:'16:9',skip_scoring:true},replicateApiToken:'fixture',openaiApiKey:'fixture'})
 expect(result.passed).toBe(true);expect(result.subject_count).toBe(3);expect(JSON.parse(http.mock.calls[0][1].body).input.aspect_ratio).toBe('16:9')
})
