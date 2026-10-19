// Which photographic scene may show which purchased configuration, and the scene-compatible picture derived for it. Uses the REAL scene manifests and the REAL
// scene renderer (no network, no model, no storage): the scenes are Codex's approved photography and are only read.

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { allProducts, getProduct } from '../print/catalog'
import { realSceneRenderer } from './mockup-real'
import { resolveScene, prepareSceneArtwork, sceneRepresentationId, SCENE_FACTS, SCENE_MAX_EDGE, type SceneDescription } from './scenes'
import { mockupArtwork } from './mockup'

const describeReal = (id: string) => realSceneRenderer.describe(id)
const product = (id: string) => getProduct(id)!

/** A recognisable picture: every pixel is a distinct function of its position, so any crop, shift, stretch or recolour is caught by an exact comparison. */
const picture = (w: number, h: number) => {
  const raw = Buffer.alloc(w * h * 3)
  for (let y = 0, o = 0; y < h; y++) for (let x = 0; x < w; x++, o += 3) { raw[o] = x * 255 / w; raw[o + 1] = y * 255 / h; raw[o + 2] = (x * 7 + y * 13) & 255 }
  return sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png({ compressionLevel: 1 }).toBuffer()
}

describe('which scene may show which purchased configuration', () => {
  const resolved = allProducts().map(p => ({ p, r: resolveScene(p, describeReal) }))
  const routed = resolved.filter(x => x.r.scene).map(x => `${x.p.sku} -> ${x.r.scene!.sceneId}`)

  it('routes exactly the configurations a photograph truthfully shows, and no others', () => {
    expect(routed).toEqual([
      'GLOBAL-CAN-8X8 -> gallery-canvas-square', 'GLOBAL-CAN-12X12 -> gallery-canvas-square', 'GLOBAL-CAN-16X16 -> gallery-canvas-square', 'GLOBAL-CAN-20X20 -> gallery-canvas-square',
      'GLOBAL-MUG-W -> ceramic-mug', 'GLOBAL-GRE-MOH-7X5-BLA -> greeting-card',
    ])
  })

  it('names the reason for every configuration with no scene (those keep the calibrated renderer)', () => {
    const reason = (id: string) => resolveScene(product(id), describeReal).reason
    // a different orientation than any photograph: never rotate a photographed product
    for (const id of ['canvas:12x18', 'canvas:8x12', 'fine_art:12x18', 'premium:8x8', 'premium:12x12']) expect(reason(id), id).toBe('orientation_not_photographed')
    // the shape is within the 20% extension band: that would need a PAID outpaint, which is never done for a mockup
    for (const id of ['fine_art:8x8', 'fine_art:20x20', 'premium:12x18', 'premium:8x12']) expect(reason(id), id).toBe('shape_needs_extension')
    // the photograph's finish is not verified, or is a different finish than the catalog sells
    for (const id of ['framed:8x8', 'framed:12x18', 'matted:12x12', 'matted:8x12', 'framed_canvas:8x8', 'framed_canvas:12x18', 'framed_canvas:20x20']) expect(reason(id), id).toBe('configuration_not_photographed')
    // the other cards are other SKUs than the one photographed
    for (const id of ['card:7x5-gloss', 'card:6x4-gloss', 'card:6x6-gloss']) expect(reason(id), id).toBe('configuration_not_photographed')
    expect(resolved.filter(x => !x.r.scene).length).toBe(allProducts().length - 6)
  })

  it("never shows a black framed canvas in the photographed brown wood frame, and never routes a finish nobody verified", () => {
    for (const p of allProducts().filter(x => x.family === 'framed_canvas')) expect(resolveScene(p, describeReal).scene, p.productId).toBeNull()
    expect(SCENE_FACTS['framed-canvas'].attributes).toEqual({ color: 'natural-brown-wood' })
    for (const id of ['classic-framed', 'matted-frame-square', 'matted-frame-landscape']) expect(SCENE_FACTS[id].attributes, id).toBeNull()
  })

  it('every scene has facts that agree with the renderer manifest (family) and none claims production geometry', () => {
    for (const [id, f] of Object.entries(SCENE_FACTS)) { const d = describeReal(id); expect(d.family, id).toBe(f.family); expect(d.productionGeometry).toBe(false) }
  })

  it('a canvas scene is chosen only for a wrap the photograph shows, never a canvas with another wrap', () => {
    const base = product('canvas:12x12')
    expect(resolveScene({ ...base, attributes: { wrap: 'White' } }, describeReal).scene).toBeNull()
    expect(resolveScene({ ...base, attributes: { wrap: 'MirrorWrap' } }, describeReal).scene?.sceneId).toBe('gallery-canvas-square')
  })

  it('a scene the renderer cannot describe is unavailable, not a guess', () => {
    const r = resolveScene(product('canvas:12x12'), () => { throw new Error('missing files') })
    expect(r).toEqual({ scene: null, reason: 'scene_unavailable' })
  })
})

describe('the scene-compatible picture', () => {
  it('keeps every original pixel of the production picture and only adds mirrored pixels outside it (square canvas)', async () => {
    const scene = describeReal('gallery-canvas-square')
    const src = await picture(1200, 1200)
    const rep = await prepareSceneArtwork(src, scene)
    const m = await sharp(rep.bytes).metadata()
    expect(rep.fit).toBe('resample'); expect(m.width).toBeGreaterThan(1200); expect(m.height).toBe(1200)
    expect(Math.abs(m.width! / m.height! / scene.inputAspect - 1)).toBeLessThanOrEqual(1 / m.width! + 1 / m.height!)          // the renderer's own shape test
    expect(rep.addedPx.h).toBe(0); expect(rep.addedPx.w).toBe(m.width! - 1200); expect(rep.addedPx.w / 1200).toBeLessThan(0.02)
    const left = Math.floor((m.width! - 1200) / 2)
    const inner = await sharp(rep.bytes).extract({ left, top: 0, width: 1200, height: 1200 }).raw().toBuffer()
    expect(inner.equals(await sharp(src).raw().toBuffer())).toBe(true)                                                              // nothing cropped, shifted, stretched or recoloured
    expect(rep.sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reduces a very large production picture to a mockup-sized one before shaping it, keeping its shape', async () => {
    const scene = describeReal('gallery-canvas-square')
    const rep = await prepareSceneArtwork(await picture(3600, 3600), scene)
    const m = await sharp(rep.bytes).metadata()
    expect(Math.max(m.width!, m.height!)).toBeLessThanOrEqual(Math.ceil(SCENE_MAX_EDGE * scene.inputAspect) + 1)
    expect(rep.source).toEqual({ w: 3600, h: 3600 })
  }, 60_000)

  it("the card's front panel reaches the photographed card by a few pixels of mirror-extension, and the renderer accepts it", async () => {
    const scene = describeReal('greeting-card')
    const p = product('card:7x5')
    const front = await picture(1500, 2100)
    const rep = await prepareSceneArtwork(front, scene)
    expect(rep.addedPx.w + rep.addedPx.h).toBeLessThan(8); expect(['exact', 'resample']).toContain(rep.fit)          // 0.1% off: within the renderer's own pixel tolerance at this size
    const out = await realSceneRenderer.render({ sceneId: 'greeting-card', productFamily: p.family, artworkId: 'comp-1', artwork: rep.bytes })
    expect(out).toMatchObject({ width: 1254, height: 1254 })
  })

  it('refuses instead of guessing: a picture beyond the 2% band, a mug wrap of the wrong shape, an unreadable file', async () => {
    const scene = describeReal('gallery-canvas-square')
    await expect(prepareSceneArtwork(await picture(800, 1200), scene)).rejects.toThrow('scene_extension_not_permitted')
    await expect(prepareSceneArtwork(await picture(1000, 1000), describeReal('ceramic-mug'))).rejects.toThrow('scene_input_shape')
    await expect(prepareSceneArtwork(Buffer.from('not an image'), scene)).rejects.toThrow()
  })

  it('makes no network call and needs no provider key (no outpaint, no generation)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const keys = { s: process.env.STABILITY_API_KEY, r: process.env.REPLICATE_API_TOKEN }
    delete process.env.STABILITY_API_KEY; delete process.env.REPLICATE_API_TOKEN
    try { await prepareSceneArtwork(await picture(600, 600), describeReal('gallery-canvas-square')) } finally { if (keys.s) process.env.STABILITY_API_KEY = keys.s; if (keys.r) process.env.REPLICATE_API_TOKEN = keys.r }
    expect(fetchSpy).not.toHaveBeenCalled(); fetchSpy.mockRestore()
  })

  it("the mug is given the existing rolled 2670:1110 wrap, which the scene accepts exactly", async () => {
    const p = product('mug:11oz')
    const wrap = await mockupArtwork(await picture(910, 910), p)
    const rep = await prepareSceneArtwork(wrap, describeReal('ceramic-mug'))
    expect(rep.fit).toBe('exact'); expect(rep.bytes.equals(wrap)).toBe(true); expect(rep.addedPx).toEqual({ w: 0, h: 0 })
  })

  it('the representation identity changes with the artwork, the scene revision, the composition attempt and the favorite, and with nothing else', () => {
    const b = { artworkSha256: 'a'.repeat(64), sceneId: 'gallery-canvas-square', sceneRevision: 'r1', compositionId: 'c1', attempt: 1, favoriteId: 'f1' }
    const id = sceneRepresentationId(b)
    expect(sceneRepresentationId({ ...b })).toBe(id)
    for (const change of [{ artworkSha256: 'b'.repeat(64) }, { sceneRevision: 'r2' }, { attempt: 2 }, { favoriteId: 'f2' }, { compositionId: 'c2' }, { sceneId: 'ceramic-mug' }]) expect(sceneRepresentationId({ ...b, ...change })).not.toBe(id)
  })

  it('exposes the shape each scene needs, from the renderer (not from this repository)', () => {
    const d: SceneDescription = describeReal('classic-framed')
    expect(d).toMatchObject({ family: 'framed', inputKind: 'scene-composition', productionGeometry: false }); expect(d.inputAspect).toBeCloseTo(1002 / 671, 4)
  })
})
