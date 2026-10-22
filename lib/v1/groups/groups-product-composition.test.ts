// Groups product compositions (Gift Wizard): the internal favorite-reference input and the skipped margin outpaint. The general Groups
// effect generation must behave exactly as before when neither is sent. No model is called: fetch, detection, scoring and outpaint are fakes.

import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import fs from 'node:fs'
import sharp from 'sharp'
import { FAVORITE_ADAPTATION_CLAUSE } from '../shared/favorite-adaptation'
import { GROUPS_EFFECTS } from './groups-effects'
import { generateBody } from '../gift/real'
import { GROUPS_FAVORITE_REFERENCE_ENABLED, supportsFavoriteReference } from '../gift/aspects'

const h = vi.hoisted(() => ({ detect: vi.fn(), score: vi.fn(), outpaint: vi.fn() }))
vi.mock('./groups-refine', () => ({ detectFaceVisibility: h.detect, scorePerFigureFidelity: h.score }))
vi.mock('../shared/outpaint', () => ({ outpaintMargin: h.outpaint }))
vi.mock('@/lib/store/internal-fetch', () => ({ internalBaseUrl: () => 'http://self.test', internalHeaders: (x: Record<string, string>) => x }))
import { generateGroupsRender } from './groups-generator'

const effect = Object.values(GROUPS_EFFECTS).find(e => e.intake === 'group_photo')!.id
let jpeg: Buffer
beforeEach(async () => {
  vi.resetAllMocks()
  jpeg = await sharp({ create: { width: 200, height: 300, channels: 3, background: '#789' } }).jpeg().toBuffer()
  h.detect.mockResolvedValue({ face_visible: true, subject_count_estimate: 3, faces: [{ age_class: 'adult', age_confidence: 10 }] })
  h.score.mockResolvedValue([{ figure_index: 1, score: 10, reason: 'ok' }, { figure_index: 2, score: 10, reason: 'ok' }, { figure_index: 3, score: 10, reason: 'ok' }])
  h.outpaint.mockResolvedValue({ outpainted: true, image: jpeg })
})
afterEach(() => vi.unstubAllGlobals())
const http = () => {
  const f = vi.fn().mockImplementation(async (url: string) => String(url).includes('predictions') ? new Response(JSON.stringify({ status: 'succeeded', output: 'https://fixture.invalid/i' })) : new Response(new Uint8Array(jpeg)))
  vi.stubGlobal('fetch', f); return f
}
const call = async (extra: Record<string, unknown> = {}, stability = 'k') => {
  const f = http()
  const r = await generateGroupsRender({ request: { source_images_b64: ['PHOTO'], effect_id: effect, subject_count: 3, format: '2:3', ...extra } as any, replicateApiToken: 'x', openaiApiKey: 'x', stabilityApiKey: stability })
  const input = JSON.parse(f.mock.calls.find(c => String(c[0]).includes('predictions'))![1].body).input
  return { r, input }
}

describe('general Groups generation is unchanged', () => {
  it('without the new fields: the photograph is the only image, there is no adaptation clause, and the margin outpaint still runs', async () => {
    const { r, input } = await call()
    expect(input.image_input).toHaveLength(1); expect(input.prompt).not.toContain(FAVORITE_ADAPTATION_CLAUSE)
    expect(h.outpaint).toHaveBeenCalledTimes(1); expect(r.outpainted).toBe(true)
  })
  it('a reference without the adaptation flag, or the flag without a reference, adds no clause', async () => {
    expect((await call({ favorite_reference_b64: 'FAV'.repeat(50) })).input.prompt).not.toContain(FAVORITE_ADAPTATION_CLAUSE)
    expect((await call({ adaptation: 'favorite' })).input.prompt).not.toContain(FAVORITE_ADAPTATION_CLAUSE)
  })
  it('still requires exactly one source photograph', async () => {
    http()
    const r = await generateGroupsRender({ request: { source_images_b64: ['A', 'B'], effect_id: effect, subject_count: 3, format: '2:3' } as any, replicateApiToken: 'x', openaiApiKey: 'x' })
    expect(r.error_code).toBe('invalid_sources')
  })
})

describe('initial previews (Gift Wizard): no Stability margin outpaint and a lower attempt cap', () => {
  it('skip_outpaint keeps the model output as it came back: the outpaint is never called and the result says why', async () => {
    const { r } = await call({ skip_outpaint: true })
    expect(h.outpaint).not.toHaveBeenCalled(); expect(r.outpainted).toBe(false); expect(r.outpaint_skip).toBe('initial_preview')
  })
  it('max_attempts caps the NB2 attempts (a failed score still returns the best attempt, passed false, with the scores)', async () => {
    h.score.mockResolvedValue([{ figure_index: 1, score: 5, reason: 'x' }, { figure_index: 2, score: 5, reason: 'x' }, { figure_index: 3, score: 5, reason: 'x' }])
    const capped = await call({ skip_outpaint: true, max_attempts: 2 }); expect(capped.r.attempts).toHaveLength(2); expect(capped.r.passed).toBe(false); expect(capped.r.ok).toBe(true); expect(capped.r.image_b64).toBeTruthy()
    expect(capped.r.attempts.every((a: any) => a.per_figure_scores.length === 3)).toBe(true)
    h.score.mockClear(); const one = await call({ max_attempts: 1 }); expect(one.r.attempts).toHaveLength(1)
    const dflt = await call({}); expect(dflt.r.attempts).toHaveLength(4)                                   // unchanged without the field
    const higher = await call({ max_attempts: 9 }); expect(higher.r.attempts).toHaveLength(4)              // a caller can only lower the cap
  })
  it('the internal-only Groups route reads both fields', () => {
    const route = fs.readFileSync('app/api/v1/groups/generate/route.ts', 'utf8'); expect(route).toContain('skip_outpaint'); expect(route).toContain('max_attempts')
  })
})

describe('internal product composition', () => {
  it('sends the favorite AFTER the photograph with the shared clause, while detection, age check and scoring see only the photograph', async () => {
    const fav = 'F'.repeat(200)
    const { input } = await call({ favorite_reference_b64: fav, adaptation: 'favorite', product_composition: true })
    expect(input.image_input).toEqual(['data:image/jpeg;base64,PHOTO', `data:image/jpeg;base64,${fav}`]); expect(input.prompt.endsWith(FAVORITE_ADAPTATION_CLAUSE)).toBe(true)
    expect(h.detect.mock.calls[0][0]).toMatchObject({ sourceImageB64: 'PHOTO', additionalImagesB64: [] })        // the favorite is never counted as another person
    expect(h.score.mock.calls[0][0]).toMatchObject({ sourceImageB64: 'PHOTO', expectedSubjectCount: 3 })
  })
  it('skips the margin outpaint for a product composition and says why; the aspect ratio is still the one requested', async () => {
    const { r, input } = await call({ product_composition: true })
    expect(h.outpaint).not.toHaveBeenCalled(); expect(r.outpainted).toBe(false); expect(input.aspect_ratio).toBe('2:3')
  })
})

describe('what the Gift flow sends (Groups reference is OFF until calibration clears it)', () => {
  const base = { series: 'groups' as const, sourceB64: 'PHOTO', effectId: 'bronze', aspect: '2:3', peopleCount: 3, productComposition: true, referenceB64: 'FAV' }
  it('is disabled today, so a Groups product composition is exactly what it was before', () => {
    expect(GROUPS_FAVORITE_REFERENCE_ENABLED).toBe(false); expect(supportsFavoriteReference('groups')).toBe(false)
    expect(generateBody(base)).toEqual({ source_image_b64: 'PHOTO', effect_id: 'bronze', format: '2:3', subject_count: 3 })
  })
  it('when switched on, carries the favorite, the adaptation flag and product_composition through the internal fields only', () => {
    expect(generateBody(base, true)).toEqual({ source_image_b64: 'PHOTO', effect_id: 'bronze', format: '2:3', subject_count: 3, product_composition: true, favorite_reference_b64: 'FAV', adaptation: 'favorite' })
    expect(generateBody({ ...base, referenceB64: undefined, productComposition: false }, true)).toEqual({ source_image_b64: 'PHOTO', effect_id: 'bronze', format: '2:3', subject_count: 3, skip_outpaint: true, max_attempts: 2 })      // an INITIAL preview: no margin outpaint, at most 2 attempts
  })
  it('Groups adaptation remains labeled unvalidated regardless', async () => {
    const { adaptationValidationFor } = await import('../gift/policy'); expect(adaptationValidationFor('groups', 'generated')).toBe('unvalidated')
  })
  it('only the internal-only Groups route accepts the new fields', () => {
    const route = fs.readFileSync('app/api/v1/groups/generate/route.ts', 'utf8')
    expect(route.indexOf('checkInternalAuth(req)')).toBeLessThan(route.indexOf('favorite_reference_b64'))
    for (const f of fs.readdirSync('public').filter(x => x.endsWith('.html') || x.endsWith('.js'))) expect(fs.readFileSync('public/' + f, 'utf8').includes('favorite_reference_b64'), f).toBe(false)
  })
})
