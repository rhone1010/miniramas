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

describe('routing: only a configuration whose orientation and opening match is routed; frame scenes recolour to the selected colour', () => {
  const route = (id: string, color?: string) => resolveBeautyScene(getProduct(id)!, color)
  it('what is routed today', () => {
    const routed = Object.fromEntries(allProducts().filter(p => p.status === 'launch').map(p => [p.productId, resolveBeautyScene(p)]).filter(([, r]) => (r as any).sceneId).map(([id, r]) => [id, (r as any).sceneId]))
    const sq = (f: string, s: string) => ['8x8', '12x12', '16x16', '20x20'].map(z => [`${f}:${z}`, s]), pt = (f: string, s: string) => ['8x12', '12x18', '16x24', '20x30'].map(z => [`${f}:${z}`, s])
    expect(routed).toEqual(Object.fromEntries([
      ...sq('fine_art', 'beauty-fine_art_print_square'), ...pt('fine_art', 'beauty-fine_art_print_portrait'),
      ...sq('premium', 'beauty-fine_art_print_square'), ...pt('premium', 'beauty-fine_art_print_portrait'),                  // Premium shares the Fine Art photography
      ...sq('canvas', 'beauty-wrapped_canvas_sqaure'), ...pt('canvas', 'beauty-wrapped_canvas_portrait'),
      ...sq('framed', 'beauty-framed_print_square'), ...pt('framed', 'beauty-framed_print_portrait'),                        // frame scenes recolour: the Classic Frame routes in any colour
      ...sq('matted', 'beauty-matted_frame_square'),
      ...sq('framed_canvas', 'beauty-framed_canvas_square'), ['framed_canvas:8x12', 'beauty-framed_canvas_landscape'], ['framed_canvas:12x18', 'beauty-framed_canvas_portrait'], ['framed_canvas:16x24', 'beauty-framed_canvas_portrait'], ['framed_canvas:20x30', 'beauty-framed_canvas_portrait'],
      ['mug:11oz', 'beauty-mug'], ['card:7x5', 'beauty-greeting_card'],
    ]))
  })
  it('the mug input is the full-wrap VIEW (2670:1110), never the raw band; flat products get their own generation picture at the exact shape of the opening', () => {
    expect(route('mug:11oz')).toMatchObject({ sceneId: 'beauty-mug', input: { kind: 'mug_full_wrap_view', aspect: 2.405405 }, displayOnly: true, productionPrintFile: false })
    expect(route('premium:12x18')).toMatchObject({ sceneId: 'beauty-fine_art_print_portrait', family: 'fine_art', input: { kind: 'generation_picture', aspect: 0.666667 } }); expect((route('premium:12x18') as any).extension).toBeLessThan(1e-5)
    expect(route('card:7x5')).toMatchObject({ sceneId: 'beauty-greeting_card', input: { kind: 'generation_picture' } })
    expect((route('premium:12x18') as any).frame).toBeUndefined()
  })
  it('frame scenes carry the recolour: the supplied frame mask, the photographed colour (natural), the selected colour and every colour the product is sold in; the opening check is unchanged', () => {
    const r: any = route('framed_canvas:12x18', 'gold')
    expect(r).toMatchObject({ sceneId: 'beauty-framed_canvas_portrait', frame: { selected: 'gold', supported: ['black', 'white', 'natural', 'brown', 'gold', 'silver'], recolor: { mask: 'frame-mask.svg', folder: 'framed_canvas_portrait', photographedColor: 'natural', toColor: 'gold', needed: true } } })
    expect(route('framed_canvas:12x18', 'natural')).toMatchObject({ frame: { recolor: { needed: false } } })
    expect(route('framed:12x12')).toMatchObject({ sceneId: 'beauty-framed_print_square', frame: { selected: 'black', supported: ['black', 'white', 'natural', 'brown', 'dark grey', 'light grey', 'gold', 'silver'] } })
    expect((route('matted:8x8', 'light grey') as any).frame.supported).toHaveLength(8)
    // orientation and opening still decide: the matted rectangles' mount openings (0.57 to 0.62) are not the 2:3 photograph, in any colour
    for (const id of ['matted:8x12', 'matted:12x18', 'matted:16x24', 'matted:20x30']) expect(route(id, 'white'), id).toMatchObject({ sceneId: null, reason: 'shape_not_photographed', nearest: { openingAspect: 0.6667 } })
    expect((route('matted:12x18') as any).nearest.extension).toBeGreaterThan(0.1)
    expect(route('card:7x5-gloss')).toMatchObject({ sceneId: null, reason: 'orientation_not_photographed' })
  })
})
