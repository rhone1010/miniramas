import {describe,it,expect,vi} from 'vitest'
import {groupsAgeDecision,groupsAgeEvidence} from './groups-shared'
import {GROUPS_EFFECTS} from './groups-effects'
const state=vi.hoisted(()=>({detect:vi.fn()}))
vi.mock('./groups-refine',()=>({detectFaceVisibility:state.detect,scorePerFigureFidelity:vi.fn()}))
vi.mock('../shared/outpaint',()=>({outpaintMargin:vi.fn()}))
import {generateGroupsRender} from './groups-generator'
const age=(age_class:any,age_confidence=9)=>({age_class,age_confidence})
describe('approved Groups age policy',()=>{
 it.each([
  ['adult family',[age('adult'),age('child'),age('infant')],'allowed'],
  ['all adults',[age('adult'),age('elder')],'allowed'],
  ['lone minor',[age('teen')],'blocked'],
  ['all minors',[age('child'),age('teen')],'blocked'],
  ['unknown age',[age('child'),age('unknown',0)],'uncertain'],
  ['uncertain teen',[age('teen',6)],'uncertain'],
  ['no evidence',[],'uncertain'],
 ])('%s',(label,faces,expected)=>expect(groupsAgeDecision(faces as any)).toBe(expected))
 it('does not invent confidence from missing or invalid evidence',()=>{expect(groupsAgeEvidence({age_class:'teen'}).age_confidence).toBe(0);expect(groupsAgeEvidence({age_class:'other',age_confidence:10}).age_class).toBe('unknown')})
 it.each(['group_photo','multi_photo'])('blocks %s generation before NB2, including skip_scoring',async intake=>{
  state.detect.mockResolvedValue({face_visible:true,subject_count_estimate:2,reason:'test',faces:[age('child'),age('teen')]})
  const effect=Object.values(GROUPS_EFFECTS).find(e=>e.intake===intake)!
  const http=vi.spyOn(globalThis,'fetch');
  const r=await generateGroupsRender({request:{source_images_b64:['YQ==','Yg=='],effect_id:effect.id,subject_count:2,skip_scoring:true},replicateApiToken:'fixture',openaiApiKey:'fixture'})
  expect(r.error_code).toBe('age_restricted');expect(r.image_b64).toBeNull();expect(http).not.toHaveBeenCalled();expect(state.detect).toHaveBeenCalledWith(expect.objectContaining({additionalImagesB64:['Yg==']}));http.mockRestore()
 })
})
