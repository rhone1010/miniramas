// lib/v1/gift/presentation.ts
//
// THREE SEPARATE QUESTIONS, never one. (1) Can this product be PURCHASED: a verified Prodigi product, launched, with an approved price (the catalog's status 'launch'). (2) What must be
// done to the customer's artwork to make this product's shape: nothing, a bounded extension, or an NB2.1 adaptation (composition-plan.ts; every launch product has a plan for every series).
// (3) How can the customer SEE the product before approving it: a photograph of the product with their artwork in it (an approved scene, scenes.ts) or, where no photograph truthfully shows
// that exact configuration, their artwork exactly as it will be printed, in the product's shape (artwork-only). A missing photograph affects (3) only. It never makes a product
// unpurchasable and it never produces an invented or physically inaccurate picture of the product: the artwork-only view says plainly that it is not a photograph of the product.
//
// GIFT_REQUIRE_APPROVED_SCENE=1 is an OPTIONAL strict mode (off by default): refuse, before payment, any product without an approved scene.
// GIFT_NO_SCENE_PRESENTATION=calibrated restores the retired template renderer for products without a scene (legacy; the launch environment check flags it).

import { allProducts, type CanonicalProduct } from '../print/catalog'
import { resolveScene, type SceneDescription } from './scenes'

export const requireApprovedScene = (env: Record<string, string | undefined> = process.env) => env.GIFT_REQUIRE_APPROVED_SCENE === '1'
export const noScenePresentation = (env: Record<string, string | undefined> = process.env): 'artwork' | 'calibrated' => env.GIFT_NO_SCENE_PRESENTATION === 'calibrated' ? 'calibrated' : 'artwork'

/** The scene that truthfully shows this configuration, or null. `describe` is the scene renderer's own description (injected so tests and the real adapter share one path). */
export function approvedSceneFor(product: CanonicalProduct, describe: (sceneId: string) => SceneDescription): string | null {
  try { return resolveScene(product, describe).scene?.sceneId ?? null } catch { return null }
}

/** Every launch configuration with the scene that shows it (null = none: it is shown artwork-only). */
export function launchCoverage(describe: (sceneId: string) => SceneDescription) {
  return allProducts().filter(p => p.status === 'launch').map(p => ({ productId: p.productId, sku: p.sku, scene: approvedSceneFor(p, describe) }))
}

export const ARTWORK_ONLY_DISCLOSURE = "This shows your artwork exactly as it will be printed, in this product's shape. It is not a photograph of the product."
export type PreviewBasis = 'in_situ_mockup' | 'product_shaped_artwork'
/** What a preview is, in data, so no client has to infer it from the renderer name. */
export const representationFields = (renderer: 'scene' | 'artwork' | 'calibrated') => renderer === 'scene'
  ? { representation: 'scene' as const, physicalProductShown: true as boolean, previewBasis: 'in_situ_mockup' as PreviewBasis, disclosureCode: null as 'artwork_only_preview' | null, disclosure: null as string | null }
  : renderer === 'artwork'
    ? { representation: 'artwork_only' as const, physicalProductShown: false as boolean, previewBasis: 'product_shaped_artwork' as PreviewBasis, disclosureCode: 'artwork_only_preview' as 'artwork_only_preview' | null, disclosure: ARTWORK_ONLY_DISCLOSURE as string | null }
    : { representation: 'calibrated_template' as const, physicalProductShown: true as boolean, previewBasis: 'in_situ_mockup' as PreviewBasis, disclosureCode: null as 'artwork_only_preview' | null, disclosure: null as string | null }
