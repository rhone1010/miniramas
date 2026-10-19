// Faces effects accept 2 to 9 subjects. Two is new (one centred row of two equal portrait panels); 3 to 9, every effect definition and every prompt that existed
// before are byte-for-byte what they were (the fingerprints below were taken from the deployed file before the change).
import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { GROUPS_EFFECTS, MAX_FACES_SUBJECTS, MIN_FACES_SUBJECTS, buildGroupsPrompt, facesLayoutClause } from './groups-effects'

const hash = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex')
const TWO = 'Arrange two equal portrait panels side by side in one centered row.'
const BEFORE = [
  'Arrange three equal portrait panels in one centered row.',
  'Arrange four equal portrait panels in a balanced 2×2 grid.',
  'Arrange five equal portrait panels in two centered rows: three across the top and two centered beneath.',
  'Arrange six equal portrait panels in a balanced 3×2 grid.',
  'Arrange seven equal portrait panels in two centered rows: four across the top and three centered beneath.',
  'Arrange eight equal portrait panels in a balanced 4×2 grid.',
  'Arrange nine equal portrait panels in a balanced 3×3 grid.',
]

describe('Faces: two to nine subjects', () => {
  it('accepts two, with the approved two-person wording, and still stops at nine', () => {
    expect(MIN_FACES_SUBJECTS).toBe(2); expect(MAX_FACES_SUBJECTS).toBe(9); expect(facesLayoutClause(2)).toBe(TWO)
    for (const n of [0, 1, 10, 18, 20]) expect(() => facesLayoutClause(n)).toThrow(/2–9 subjects/)
  })
  it('every Faces effect, for two subjects, carries the two-panel clause in its prompt; no other effect does', () => {
    const faces = Object.values(GROUPS_EFFECTS).filter(e => e.faces)
    expect(faces.length).toBe(10)
    for (const e of faces) expect(buildGroupsPrompt({ effectId: e.id, subjectCount: 2, format: '3:2' })).toContain(TWO)
    for (const e of Object.values(GROUPS_EFFECTS).filter(x => !x.faces)) expect(buildGroupsPrompt({ effectId: e.id, subjectCount: 3, format: '3:2' })).not.toContain(TWO)
  })
  it('three to nine panels are exactly as before', () => {
    for (let n = 3; n <= 9; n++) expect(facesLayoutClause(n)).toBe(BEFORE[n - 3])
  })
  it('no effect definition and no previously reachable prompt changed (48 effects, 324 prompt combinations)', () => {
    expect(Object.keys(GROUPS_EFFECTS).length).toBe(48)
    expect(hash(GROUPS_EFFECTS)).toBe('270a5684a922d8de5cc6122950760289f3312389820dff70155870574432e17a')
    const prompts: Record<string, string> = {}
    for (const id of Object.keys(GROUPS_EFFECTS)) {
      const e = (GROUPS_EFFECTS as any)[id]
      for (const n of e.faces ? [3, 4, 5, 6, 7, 8, 9] : [e.minSubjects ?? 2]) for (const f of ['3:2', '2:3', '1:1']) {
        try { prompts[`${id}|${n}|${f}`] = buildGroupsPrompt({ effectId: id as any, subjectCount: n, format: f as any }) } catch { prompts[`${id}|${n}|${f}`] = 'ERR' }
      }
    }
    expect(Object.keys(prompts).length).toBe(324)
    expect(hash(prompts)).toBe('b0dc69ecc52ba3367f42b640bc6a86b34a0d855789b2d6a208b4c68ad334fb9c')
  })
})
