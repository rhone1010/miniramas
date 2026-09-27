import { describe, it, expect } from 'vitest'
import { uploadRouting } from './upload-routing'

describe('approved three-series upload routing', () => {
  it.each([
    ['person_single','pets','portraits'],
    ['person_group','portraits','groups'],
    ['pet_animal','portraits','pets'],
    ['person_single','groups','portraits'],
  ] as const)('routes %s in %s to %s', (subjectType,series,target) => {
    const result=uploadRouting({subjectType,activityDetected:true,confidence:7,description:'the subject'})
    expect(result.decisions[series].redirectSeries).toBe(target)
    expect(result.decisions[series].stayLabel).toContain('anyway')
  })
  it('preserves uncertainty and matching-series behavior',()=>{
    const result=uploadRouting({subjectType:'pet_animal',activityDetected:false,confidence:6,description:'the subject'})
    expect(result.decisions.portraits.match).toBe(true)
    expect(result.decisions.pets.match).toBe(true)
  })
})
