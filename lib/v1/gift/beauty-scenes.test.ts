// The 17 beauty scenes (Codex 1's display photographs): the backend's facts are reconciled with their manifest, and every configuration is routed only when finish, orientation and opening match.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { BEAUTY_SCENES, resolveBeautyScene } from './beauty-scenes'
import { allProducts, getProduct } from '../print/catalog'

const DIR = path.resolve(__dirname, '../../../public/gift-wizard/beauty-scenes')
const manifest = fs.existsSync(path.join(DIR, 'manifest.next.json')) ? JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.next.json'), 'utf8')) : null

describe.skipIf(!manifest)('the backend knows exactly the scenes in the manifest', () => {
  it('same ids, families, openings and display-only status; every photograph and mask is where the manifest says', () => {
    const ids = manifest.scenes.map((s: any) => s.id).sort()
    expect(BEAUTY_SCENES.map(s => s.id).sort()).toEqual(ids); expect(ids).toHaveLength(17)
    for (const s of manifest.scenes) {
      const f = BEAUTY_SCENES.find(x => x.id === s.id)!
      expect(f.family, s.id).toBe(s.family); expect(Math.abs(f.openingAspect - s.surfaceAspectRatio), s.id).toBeLessThan(1e-4)
      expect(s.status, s.id).toBe('display-only'); expect(s.productionPrintFile, s.id).toBe(false)
      expect(fs.existsSync(path.join(DIR, f.folder, s.sourceImage)), s.id).toBe(true); expect(fs.existsSync(path.join(DIR, f.folder, s.artworkMask)), s.id).toBe(true)
      if (s.frameMask) expect(fs.existsSync(path.join(DIR, f.folder, s.frameMask)), s.id).toBe(true)
      expect(f.inputKind, s.id).toBe(s.artworkLayout === 'full-wrap' ? 'mug_full_wrap_view' : 'generation_picture')
    }
  })
})

describe('routing: only a configuration whose finish, orientation and opening match is routed', () => {
  const route = (id: string) => resolveBeautyScene(getProduct(id)!)
  it('what is routed today', () => {
    const routed = Object.fromEntries(allProducts().filter(p => p.status === 'launch').map(p => [p.productId, resolveBeautyScene(p)]).filter(([, r]) => (r as any).sceneId).map(([id, r]) => [id, (r as any).sceneId]))
    const sq = (f: string, s: string) => ['8x8', '12x12', '16x16', '20x20'].map(z => [`${f}:${z}`, s]), pt = (f: string, s: string) => ['8x12', '12x18', '16x24', '20x30'].map(z => [`${f}:${z}`, s])
    expect(routed).toEqual(Object.fromEntries([
      ...sq('fine_art', 'beauty-fine_art_print_square'), ...pt('fine_art', 'beauty-fine_art_print_portrait'),
      ...sq('premium', 'beauty-fine_art_print_square'), ...pt('premium', 'beauty-fine_art_print_portrait'),                  // Premium shares the Fine Art photography
      ...sq('canvas', 'beauty-wrapped_canvas_sqaure'), ...pt('canvas', 'beauty-wrapped_canvas_portrait'),
      ['mug:11oz', 'beauty-mug'], ['card:7x5', 'beauty-greeting_card'],
    ]))
  })
  it('the mug input is the full-wrap VIEW (2670:1110), never the raw band; flat products get their own generation picture at the opening\'s exact shape', () => {
    expect(route('mug:11oz')).toMatchObject({ sceneId: 'beauty-mug', input: { kind: 'mug_full_wrap_view', aspect: 2.405405 }, displayOnly: true, productionPrintFile: false })
    expect(route('premium:12x18')).toMatchObject({ sceneId: 'beauty-fine_art_print_portrait', family: 'fine_art', input: { kind: 'generation_picture', aspect: 0.666667 } }); expect((route('premium:12x18') as any).extension).toBeLessThan(1e-5)
    expect(route('card:7x5')).toMatchObject({ sceneId: 'beauty-greeting_card', input: { kind: 'generation_picture' } })
  })
  it('refuses, with the reason, what no photograph truthfully shows', () => {
    // All framed families stay black; the supplied natural-oak scenes cannot represent them.
    for (const p of allProducts().filter(x => ['framed', 'matted', 'framed_canvas'].includes(x.family))) expect(route(p.productId), p.productId).toMatchObject({ sceneId: null, reason: 'finish_not_photographed' })
    // the other card variants are 6118 x 2161 spreads (landscape): no photograph of that
    expect(route('card:7x5-gloss')).toMatchObject({ sceneId: null, reason: 'orientation_not_photographed' })
  })
  it('owner keeps black frames; natural photographs do not change sold finishes', () => {
    for (const p of allProducts().filter(x => x.family === 'matted' || x.family === 'framed_canvas')) expect(p.attributes.color, p.productId).toBe('black')
    for (const p of allProducts().filter(x => x.family === 'framed_canvas')) expect(p.attributes.wrap, p.productId).toBe('MirrorWrap')
    for (const p of allProducts().filter(x => x.family === 'framed')) expect(p.attributes, p.productId).toEqual({ color: 'black' })
  })
})
