// What the redesigned product-first selector can rely on from the backend, pinned so it cannot drift: each family is one group of the existing flat catalog (productId, family, familyLabel,
// size, requirements.skuOrientation, status, selectable); orientation, size and finish are options WITHIN a family; approved-scene availability per configuration comes from the same
// resolver the preview and checkout gate use. No landscape SKU exists for a launch family, so a "landscape" option must not be offered for them.

import { describe, it, expect } from 'vitest'
import { allProducts } from '../print/catalog'
import { catalogResponse } from '../print/catalog'
import { resolveScene, orientationOf } from './scenes'
import { realSceneRenderer } from './mockup-real'
import { launchCoverage } from './presentation'

const describeReal = (id: string) => realSceneRenderer.describe(id)
const launch = allProducts().filter(p => p.status === 'launch' && ['fine_art', 'premium', 'canvas', 'framed'].includes(p.family))          // the Print Shop families (Gift-only families are sold through the availability contract)
const by = <T,>(xs: T[], key: (x: T) => string) => xs.reduce<Record<string, T[]>>((m, x) => { (m[key(x)] ??= []).push(x); return m }, {})

describe('product families, orientations, sizes and finishes from the existing catalog contract', () => {
  it('the catalog response is flat, every row names its family, label, size, orientation, status and selectable flag', () => {
    const c: any = catalogResponse(null)
    for (const p of c.products) expect(p, p.productId).toMatchObject({ productId: expect.any(String), family: expect.any(String), familyLabel: expect.any(String), size: expect.any(String), status: expect.stringMatching(/launch|disabled/), selectable: expect.any(Boolean), requirements: { skuOrientation: expect.stringMatching(/square|portrait|landscape|wrap|spread/) } })
    expect(c.products.filter((p: any) => p.status === 'launch' && ['fine_art', 'premium', 'canvas', 'framed'].includes(p.family)).every((p: any) => p.selectable === true)).toBe(true)
    expect(c.products.filter((p: any) => p.status !== 'launch' || !['fine_art', 'premium', 'canvas', 'framed'].includes(p.family)).every((p: any) => p.selectable === false)).toBe(true)
  })
  it('launch families, each once, with these orientation/size options (square and portrait only: there is no landscape launch SKU)', () => {
    const fam = by(launch, p => p.family)
    expect(Object.keys(fam).sort()).toEqual(['canvas', 'fine_art', 'framed', 'premium'])
    for (const [f, ps] of Object.entries(fam)) {
      const o = by(ps, p => orientationOf(p))
      expect(Object.keys(o).sort(), f).toEqual(['portrait', 'square'])
      expect(o.square.map(p => p.size), f).toEqual(['8x8', '12x12', '16x16', '20x20']); expect(o.portrait.map(p => p.size), f).toEqual(['8x12', '12x18', '16x24', '20x30'])
      expect(new Set(ps.map(p => p.familyLabel)).size, f).toBe(1)                                   // one label per family, so the family appears once
    }
    expect(launch.some(p => orientationOf(p) === 'landscape')).toBe(false)
  })
  it('finish options inside a family: one value each today (fine art EMA 200gsm, premium HPR 308gsm, canvas MirrorWrap, framed black), so "finish" is a single fixed choice per family', () => {
    const fam = by(launch, p => p.family); const finishes = (f: string) => [...new Set(fam[f].map(p => JSON.stringify(Object.fromEntries(Object.entries(p.attributes).filter(([k]) => k !== 'size')))))]
    for (const f of Object.keys(fam)) expect(finishes(f).length, f).toBe(f === 'fine_art' || f === 'premium' ? 2 : 1)      // square and portrait fine art / premium differ only in whether paper attributes are listed
  })
})

describe('approved-scene availability per configuration (the same resolver the preview and the payment gate use)', () => {
  const cov = launchCoverage(describeReal), scene = (id: string) => cov.find(c => c.productId === id)!.scene
  it('is exactly: every fine art size, premium and canvas squares, the mug and the card; nothing else', () => {
    const withScene = cov.filter(c => c.scene).map(c => c.productId).sort()
    expect(withScene).toEqual(['canvas:12x12', 'canvas:16x16', 'canvas:20x20', 'canvas:8x8', 'card:7x5', 'fine_art:12x12', 'fine_art:12x18', 'fine_art:16x16', 'fine_art:16x24', 'fine_art:20x20', 'fine_art:20x30', 'fine_art:8x12', 'fine_art:8x8', 'mug:11oz', 'premium:12x12', 'premium:16x16', 'premium:20x20', 'premium:8x8'])
    for (const id of ['framed:8x8', 'framed:12x18', 'premium:12x18', 'canvas:12x18']) expect(scene(id), id).toBeFalsy()
  })
  it('a scene is only ever used for the same family and the same orientation as the purchased configuration, within 2% of its shape', () => {
    for (const p of launch) {
      const r: any = resolveScene(p, describeReal); if (!r.scene) continue
      const d = describeReal(r.scene.sceneId); expect(d.family, p.productId).toBe(p.family); expect(r.scene.extension, p.productId).toBeLessThanOrEqual(0.02 + 1e-9)
    }
  })
  it('no retired or physically different photograph can stand in: a configuration without a scene resolves to none, with a reason', () => {
    for (const p of launch) { const r: any = resolveScene(p, describeReal); if (!r.scene) expect(r.reason, p.productId).toMatch(/orientation_not_photographed|configuration_not_photographed|shape_needs_extension|shape_incompatible|no_scene_for_family|scene_unavailable/) }
  })
})
