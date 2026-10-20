// lib/v1/gift/presentation.ts
//
// CAN THE CUSTOMER SEE (AND APPROVE) THIS CONFIGURATION? Final Approval shows the product only through an APPROVED photographic scene (scenes.ts): a configuration with no scene has a
// calibrated fallback renderer the Wizard no longer accepts, so a customer could pay for something whose Final Approval says "Not currently available" and cannot be approved.
//
// GIFT_REQUIRE_APPROVED_SCENE=1 closes that gap on the server: a configuration with no approved scene is refused when it is added (setLines) and again at checkout, with the existing
// product_not_available error, BEFORE any payment. Default OFF: turning it on removes products from sale, which is the owner's decision, not a side effect of this code.

import { allProducts, type CanonicalProduct } from '../print/catalog'
import { resolveScene, type SceneDescription } from './scenes'

export const requireApprovedScene = (env: Record<string, string | undefined> = process.env) => env.GIFT_REQUIRE_APPROVED_SCENE === '1'

/** The scene that truthfully shows this configuration, or null. `describe` is the scene renderer's own description (injected so tests and the real adapter share one path). */
export function approvedSceneFor(product: CanonicalProduct, describe: (sceneId: string) => SceneDescription): string | null {
  try { return resolveScene(product, describe).scene?.sceneId ?? null } catch { return null }
}

/** Every launch configuration with the scene that shows it (null = none): the coverage the owner is deciding on. */
export function launchCoverage(describe: (sceneId: string) => SceneDescription) {
  return allProducts().filter(p => p.status === 'launch').map(p => ({ productId: p.productId, sku: p.sku, scene: approvedSceneFor(p, describe) }))
}
