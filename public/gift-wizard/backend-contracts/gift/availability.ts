import type {PreviewRepresentation} from './types';
import {GIFT_CONTRACT_VERSION} from './types';
type PreviewBasis=PreviewRepresentation['previewBasis'];
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
  /**
   * EVERY open condition that keeps this product from being sold, in the order they would be cleared (empty when purchasable). Codes: 'retail_price_pending' (no approved retail price),
   * 'family_not_launched' (the owner has not launched the family), 'orientation_unverified' (a Prodigi fact is still open for this size), 'not_a_launch_candidate'. Photography is never a blocker.
   */
  blockers: string[]
  /** The product-first generation for THIS product and the series of this session: the ratio asked of NB2.1, how much of the picture is trimmed to reach the exact shape (fraction per axis), or why it cannot. */
  generation: { supported: true; requestedAspect: string; trimFraction: number; geometryKey: string } | { supported: false; reason: 'no_ratio_within_bound_for_series' | 'not_a_launch_candidate' }
  /** The manufacturing configuration the backend sends to Prodigi. Fixed by LITEN, not customer-selectable; `unexposed` lists what Prodigi offers that is deliberately not offered. */
  configuration: { artworkProfile: 'flat_print' | 'mug_wrap' | 'card_spread' | null; skuOrientation: string; fixedAttributes: Record<string, string>; unexposed: Record<string, string[]>; picturePx: { w: number; h: number }; finalPx: { w: number; h: number }; pictureAspect: number }
}

export interface AvailabilityView {
  contractVersion: typeof GIFT_CONTRACT_VERSION
  sessionId: string
  favoriteId: string | null
  /** The shape the selected artwork was made in. */
  masterAspect: string
  products: ProductAvailability[]
  orientations: Record<'square' | 'portrait' | 'landscape', { supported: boolean; reason: string | null; productIds: string[] }>
}

