// store/types.ts
// lib/store/types.ts
//
// Shared types for the commerce layer. The DB stores snake_case; everything
// above the data layer uses camelCase. The stub-vs-real generation kickoff
// interface lives here too so the application chat can swap in a real impl
// without changing call sites.

export type SkuKind = 'single' | 'bundle'

export interface Sku {
  id:            string
  displayName:   string
  kind:          SkuKind
  count:         number
  priceCents:    number
  stripePriceId: string
  active:        boolean
}

export type PurchaseStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface Purchase {
  id:               string
  userId:           string | null
  guestEmail:       string | null
  skuId:            string
  stripeSessionId:  string
  stripeChargeId:   string | null
  amountCents:      number
  status:           PurchaseStatus
  createdAt:        string
  paidAt:           string | null
}

export type EntitlementStatus = 'available' | 'pending' | 'consumed' | 'restored'

export interface Entitlement {
  id:                  string
  purchaseId:          string
  userId:              string | null
  guestEmail:          string | null
  lockedStyle:         string | null
  lockedVariant:       string | null
  status:              EntitlementStatus
  jobId:               string | null
  generationStartedAt: string | null
  consumedAt:          string | null
  restoredAt:          string | null
  createdAt:           string
}

// Stub interface — application chat replaces the implementation when it
// wires in lib/v1/* generation pipelines. The store layer only knows how
// to call .start(); it doesn't know what generation actually does.
//
// sourceImageRef is nullable to support no-photo modes (e.g. /build,
// where the customer composes a scene from text without uploading).
// Implementations must handle null explicitly.
export interface GenerationKickoff {
  start(args: {
    jobId:          string
    entitlementId:  string
    style:          string
    variant:        string
    sourceImageRef: string | null
  }): Promise<void>
}
