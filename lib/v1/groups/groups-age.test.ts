import {describe,it,expect,vi} from 'vitest'
import sharp from 'sharp'
import {groupsAgeDecision,groupsAgeEvidence} from './groups-shared'
import {GROUPS_EFFECTS} from './groups-effects'
const state=vi.hoisted(()=>({detect:vi.fn()}))
vi.mock('./groups-refine',()=>({detectFaceVisibility:state.detect,scorePerFigureFidelity:vi.fn()}))
vi.mock('../shared/outpaint',()=>({outpaintMargin:vi.fn()}))
import {generateGroupsRender} from './groups-generator'
const age=(age_class:any,age_confidence=9)=>({age_class,age_confidence})
describe('approved Groups age policy',()=>{
 it.each([
  ['adult family: an adult never overrides the block',[age('adult'),age('child'),age('infant')],'blocked'],
  ['one teen among adults',[age('adult'),age('adult'),age('teen')],'blocked'],
  ['one infant, confident, with an elder',[age('elder'),age('infant',7)],'blocked'],
  ['all adults',[age('adult'),age('elder')],'allowed'],
  ['lone minor',[age('teen')],'blocked'],
  ['all minors',[age('child'),age('teen')],'blocked'],
  ['child plus an unreadable face',[age('child'),age('unknown',0)],'blocked'],
  ['adult plus an unreadable face',[age('adult'),age('unknown',0)],'uncertain'],
  ['adult plus a low-confidence child',[age('adult'),age('child',6)],'uncertain'],
  ['only unreadable faces',[age('unknown',0),age('unknown',0)],'uncertain'],
  ['uncertain teen',[age('teen',6)],'uncertain'],
  ['no evidence',[],'uncertain'],
 ])('%s',(label,faces,expected)=>expect(groupsAgeDecision(faces as any)).toBe(expected))
 it('does not invent confidence from missing or invalid evidence',()=>{expect(groupsAgeEvidence({age_class:'teen'}).age_confidence).toBe(0);expect(groupsAgeEvidence({age_class:'other',age_confidence:10}).age_class).toBe('unknown')})
 it.each([
  ['all minors',[age('child'),age('teen')]],
  ['a child among adults',[age('adult'),age('adult'),age('child')]],
  ['an infant with an elder',[age('elder'),age('infant')]],
  ['a child and an unreadable face',[age('child'),age('unknown',0)]],
 ])('blocks group_photo generation before NB2 for %s, including skip_scoring',async(_label,faces)=>{
  const img=(await sharp({create:{width:64,height:64,channels:3,background:'#888'}}).jpeg().toBuffer()).toString('base64')
  state.detect.mockClear();state.detect.mockResolvedValue({face_visible:true,subject_count_estimate:faces.length,reason:'test',faces})
  const effect=Object.values(GROUPS_EFFECTS).find(e=>e.intake==='group_photo')!
  const http=vi.spyOn(globalThis,'fetch');
  const r=await generateGroupsRender({request:{source_images_b64:[img],effect_id:effect.id,subject_count:faces.length,skip_scoring:true},replicateApiToken:'fixture',openaiApiKey:'fixture'})
  expect(r.error_code).toBe('age_restricted');expect(r.image_b64).toBeNull();expect(http).not.toHaveBeenCalled();expect(state.detect).toHaveBeenCalledTimes(1);http.mockRestore()
 })
})
