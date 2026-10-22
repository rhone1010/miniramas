// lib/v1/gift/availability.ts
//
// PRODUCT AVAILABILITY FOR THE SHARED PRODUCT STUDIO. Answers, per product and for THIS session's selected artwork, the three questions the contract keeps apart (presentation.ts):
//   purchasable   can it be bought at all: a verified Prodigi product, launched, with an approved price (catalog status). Independent of the artwork's shape and of any photograph.
//   adaptation    what must be done to the selected artwork to make this product's shape: nothing, a bounded extension, or an NB2.1 adaptation. The original artwork is never modified.
//   preview       how the customer will SEE it before approving: an approved scene (a photograph of the product with the artwork in it) or the artwork exactly as printed in the product's shape.
// Any selected artwork can be adapted to any purchasable product (composition-plan.ts has a plan for every launch product for every series), so shape never makes a product unavailable.
// Orientation support is reported as data: square and portrait are verified; landscape is not (Prodigi publishes no landscape SKU, and turning a portrait SKU's file is unverified).

import { allProducts } from '../print/catalog'
import { planFor } from './composition-plan'
import { GiftError, owned, type GiftDeps } from './service'
import { approvedSceneFor, noScenePresentation, representationFields, type PreviewBasis } from './presentation'
import { realSceneRenderer } from './mockup-real'
import { scenesEnabledNow } from './mockup'
import { GIFT_CONTRACT_VERSION } from './types'

export interface ProductAvailability {
  productId: string
  sku: string
  family: string
  familyLabel: string
  size: string
  label: string
  orientation: string
  retailCents: number | null
  /** The only thing that decides whether the customer may add it to a cart and pay. */
  purchasable: boolean
  disabledReason: string | null
  adaptation: {
    /** false only when the artwork already has the product's shape (exact, or within 2% by a free mirror extension). */
    required: boolean
    method: 'none' | 'deterministic' | 'generated'
    fit: 'exact' | 'resample' | 'extend'
    extensionFraction: number
    /** For 'generated': the NB2.1 ratio requested, then bounded extension finishes the exact shape. */
    generationAspect: string | null
    /** Paid calls the composition will make after purchase (estimates: nothing is generated before payment). */
    paidCalls: { nb21: number; outpaint: number }
    originalPreserved: true
  } | null
  preview: {
    representation: 'scene' | 'artwork_only'
    sceneId: string | null
    previewBasis: PreviewBasis
    physicalProductShown: boolean
    disclosureCode: 'artwork_only_preview' | null
    disclosure: string | null
  }
  /** Approval needs no photograph: the exact product-shaped artwork is a sufficient, honest basis. */
  approval: { possible: boolean; basis: PreviewBasis }
}

export interface AvailabilityView {
  contractVersion: typeof GIFT_CONTRACT_VERSION
  sessionId: string
  favoriteId: string | null
  /** The shape the selected artwork was made in. */
  masterAspect: string
  products: ProductAvailability[]
  orientations: Record<'square' | 'portrait' | 'landscape', { supported: boolean; reason: string | null }>
}

export async function getProductAvailability(deps: GiftDeps, userId: string, sessionId: string): Promise<AvailabilityView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (!rec.series) throw new GiftError('session_not_found')
  const ctx = { series: rec.series, peopleCount: rec.analysis.peopleCount ?? null, masterAspect: rec.master_aspect ?? '1:1' }
  const scenes = scenesEnabledNow() ? (deps.mockup?.scenes ?? realSceneRenderer) : null
  const legacy = noScenePresentation() === 'calibrated'
  const products: ProductAvailability[] = allProducts().map(p => {
    const purchasable = p.status === 'launch' && p.retailCents !== null
    const plan = purchasable ? planFor(p, ctx) : null
    const sceneId = purchasable && scenes ? approvedSceneFor(p, id => scenes.describe(id)) : null
    const rep = representationFields(sceneId ? 'scene' : legacy ? 'calibrated' : 'artwork')
    const nb21 = plan?.method === 'generated' ? 1 : 0
    const outpaint = plan ? (plan.method === 'deterministic' ? (plan.fit === 'extend' ? 1 : 0) : ((plan.generationExtensionFraction ?? 0) > 0.02 + 1e-10 ? 1 : 0)) : 0
    return {
      productId: p.productId, sku: p.sku, family: p.family, familyLabel: p.familyLabel, size: p.size, label: p.label, orientation: p.requirements.skuOrientation, retailCents: p.retailCents,
      purchasable: purchasable && !!plan, disabledReason: purchasable ? (plan ? null : 'no_bounded_adaptation') : (p.disabledReason ?? 'not_launched'),
      adaptation: plan ? { required: !(plan.method === 'deterministic' && (plan.fit === 'exact' || plan.fit === 'resample')), method: plan.method === 'deterministic' && plan.fit === 'exact' ? 'none' : plan.method, fit: plan.fit, extensionFraction: plan.extensionFraction, generationAspect: plan.generationAspect, paidCalls: { nb21, outpaint }, originalPreserved: true } : null,
      preview: { representation: rep.representation === 'scene' ? 'scene' : 'artwork_only', sceneId, previewBasis: rep.previewBasis, physicalProductShown: rep.physicalProductShown, disclosureCode: rep.disclosureCode, disclosure: rep.disclosure },
      approval: { possible: purchasable && !!plan, basis: rep.previewBasis },
    }
  })
  return {
    contractVersion: GIFT_CONTRACT_VERSION, sessionId: rec.id, favoriteId: rec.artwork_preview_id, masterAspect: rec.master_aspect ?? '',
    products,
    orientations: {
      square: { supported: true, reason: null }, portrait: { supported: true, reason: null },
      landscape: { supported: false, reason: 'no_landscape_sku_verified_with_prodigi' },        // no landscape SKU exists in Prodigi's catalog (checked in the sandbox), and a turned portrait file is unverified
    },
  }
}
