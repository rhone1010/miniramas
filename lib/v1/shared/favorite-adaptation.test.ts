// Product-composition ratios and favorite-artwork adaptation: what the Portraits and Pets routes accept, what the Gift generator
// sends, and that Discovery's own choices and defaults are unchanged. No model is called.

import { describe, it, expect, vi, afterEach } from 'vitest'
import fs from 'node:fs'
import { FAVORITE_ADAPTATION_CLAUSE, applyFavoriteAdaptation } from './favorite-adaptation'
import { PORTRAIT_OUTPUT_ASPECTS, PORTRAIT_PRODUCT_ASPECTS, isPortraitOutputAspect, isPortraitProductAspect } from '../portraits/portraits-shared'
import { NB21_ASPECTS, supportsFavoriteReference } from '../gift/aspects'
import { generateMaster } from '../gift/real'

vi.mock('@/lib/store/internal-fetch', () => ({ internalBaseUrl: () => 'http://self.test', internalHeaders: (h: Record<string, string>) => h }))

describe('Discovery is unchanged', () => {
  it("Discovery's four ratios stay exactly as they were, and the product ratios are a separate list", () => {
    expect([...PORTRAIT_OUTPUT_ASPECTS]).toEqual(['1:1', '3:4', '4:3', '9:16'])
    for (const a of ['2:3', '3:2', '4:5', '5:4', '16:9', '21:9']) { expect(isPortraitOutputAspect(a), a).toBe(false); expect(isPortraitProductAspect(a), a).toBe(true) }
    expect([...PORTRAIT_PRODUCT_ASPECTS].every(a => (NB21_ASPECTS as readonly string[]).includes(a))).toBe(true)         // only ratios the model really has
    expect(isPortraitProductAspect('1:8')).toBe(false)
  })
  const route = fs.readFileSync('app/api/v1/portraits/generate/route.ts', 'utf8')
  it('the route accepts a product ratio only from the internal call that says product_composition', () => {
    expect(route).toContain('const productComposition = internalCall && body.product_composition === true')
    expect(route).toMatch(/isPortraitOutputAspect\(body\.output_aspect_ratio\) \|\| \(productComposition && isPortraitProductAspect\(body\.output_aspect_ratio\)\)/)
    expect(route).toContain("adaptation:             internalCall && body.adaptation === 'favorite' ? 'favorite' : undefined")
  })
  it('the Pets route accepts the adaptation flag only from the internal call', () => {
    expect(fs.readFileSync('app/api/v1/pets/generate/route.ts', 'utf8')).toContain("body.adaptation === 'favorite' && checkInternalAuth(req).ok")
  })
  it('no browser page can send the flags: nothing under public/ mentions them', () => {
    for (const f of fs.readdirSync('public').filter(x => x.endsWith('.html') || x.endsWith('.js'))) {
      const t = fs.readFileSync('public/' + f, 'utf8'); expect(t.includes('product_composition') || t.includes("adaptation:'favorite'"), f).toBe(false)
    }
  })
})

describe('the adaptation clause', () => {
  it('is appended only when asked for AND a reference image is really sent; effect prompts are never touched', () => {
    expect(applyFavoriteAdaptation('P', { adaptation: 'favorite', referenceImages: 1 })).toBe(`P\n\n${FAVORITE_ADAPTATION_CLAUSE}`)
    expect(applyFavoriteAdaptation('P', { adaptation: 'favorite', referenceImages: 0 })).toBe('P')
    expect(applyFavoriteAdaptation('P', { adaptation: undefined, referenceImages: 2 })).toBe('P')
    expect(applyFavoriteAdaptation('P', { adaptation: 'other', referenceImages: 1 })).toBe('P')
  })
  it('names the image roles and forbids cropping, stretching, adding, removing and restyling', () => {
    for (const w of ['first image is the original photograph', 'second image', 'likeness', 'composition', 'Do not crop, stretch or distort', 'do not add or remove', 'do not restyle']) expect(FAVORITE_ADAPTATION_CLAUSE).toContain(w)
  })
})

describe('series support', () => {
  it('Portraits and Pets take the favorite as a reference; Groups does not (its route needs exactly one source image)', () => {
    expect([supportsFavoriteReference('portraits'), supportsFavoriteReference('pets'), supportsFavoriteReference('groups')]).toEqual([true, true, false])
  })
})

describe('what the Gift generator sends', () => {
  afterEach(() => vi.unstubAllGlobals())
  async function sent(i: Parameters<typeof generateMaster>[0]) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ image_b64: 'AAAA', url: 'x' }), { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    try { await generateMaster(i) } catch { /* the response shape is not under test */ }
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { body: string }]
    return { url, body: JSON.parse(init.body) }
  }
  const base = { sourceB64: 'PHOTO', effectId: 'tin_windup_portrait', peopleCount: null }
  it('a Portraits preview sends none of the new fields, so previews behave exactly as before', async () => {
    const { body } = await sent({ ...base, series: 'portraits', aspect: '1:1' })
    expect(body).not.toHaveProperty('output_aspect_ratio'); expect(body).not.toHaveProperty('product_composition'); expect(body).not.toHaveProperty('additional_images_b64'); expect(body).not.toHaveProperty('adaptation')
  })
  it('a Portraits product composition names its ratio, says it is a product composition, and carries the favorite as the second image', async () => {
    const { url, body } = await sent({ ...base, series: 'portraits', aspect: '2:3', productComposition: true, referenceB64: 'FAVORITE' })
    expect(url).toContain('/api/v1/portraits/generate')
    expect(body).toMatchObject({ source_image_b64: 'PHOTO', output_aspect_ratio: '2:3', product_composition: true, additional_images_b64: ['FAVORITE'], adaptation: 'favorite' })
  })
  it('Pets carries the favorite and the ratio; Groups never carries a reference', async () => {
    expect((await sent({ ...base, series: 'pets', aspect: '1:1', productComposition: true, referenceB64: 'FAVORITE' })).body).toMatchObject({ aspect_ratio: '1:1', additional_images_b64: ['FAVORITE'], adaptation: 'favorite' })
    const g = (await sent({ ...base, series: 'groups', aspect: '2:3', productComposition: true, referenceB64: 'FAVORITE', peopleCount: 4 })).body
    expect(g).toMatchObject({ source_image_b64: 'PHOTO', format: '2:3' }); expect(g).not.toHaveProperty('additional_images_b64'); expect(g).not.toHaveProperty('adaptation')
  })
})
