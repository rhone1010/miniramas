// lib/v1/gift/policy.ts
//
// The Gift Wizard's business and retention rules, in one place. Approved rules are marked APPROVED; the retention
// numbers are PROPOSED and need sign-off before launch (they were not specified, so nothing is silently decided).

/** APPROVED: first six previews free, second six free, every further six $2.99 after verified payment. */
export const FREE_BATCHES = 2
export const BATCH_SIZE = 6
export const PACK_PRICE_CENTS = 299
export const PACK_CURRENCY = 'usd'
/** Stripe metadata.kind for a preview pack. The webhook dispatches on it; the metadata only selects the handler. */
export const PACK_KIND = 'gift_preview_pack'

/** A preview that fails is retried on its own row up to this many times per slot, charging nothing. */
export const MAX_PREVIEW_ATTEMPTS = 3
/** A lease that is not finished within this long may be taken over by a retry. NB2 renders finish well inside this. */
export const PREVIEW_LEASE_SECONDS = 300
export const MAX_PARALLEL_RENDERS = 3

/**
 * Paid calls are counted exactly; their cost is an ESTIMATE, and only when a unit price is configured (Replicate's price for NB2.1 is
 * not in the codebase and has not been verified). Set GIFT_NB21_COST_USD and GIFT_OUTPAINT_COST_USD to record dollars; until then the
 * recorded cost is null, never a guess.
 */
export function estimateCompositionCost(calls: { nb21: number; outpaint: number }, env: Record<string, string | undefined> = process.env): number | null {
  const unit = (k: string) => { const v = Number(env[k]); return env[k] !== undefined && env[k] !== '' && Number.isFinite(v) && v >= 0 ? v : null }
  const nb = unit('GIFT_NB21_COST_USD'), op = unit('GIFT_OUTPAINT_COST_USD')
  if ((calls.nb21 > 0 && nb === null) || (calls.outpaint > 0 && op === null)) return null
  return Math.round((calls.nb21 * (nb ?? 0) + calls.outpaint * (op ?? 0)) * 1e4) / 1e4
}

/**
 * How far a product-specific adaptation has been validated, so nothing treats it as more than it is.
 *   not_applicable  the selected artwork is adapted deterministically (background only, no generation)
 *   provisional     Portraits and Pets favorite-reference generation: six calibration cases (2026-10-17) kept subject, effect and
 *                   composition well, with the background re-rendered and the subject sometimes scaled; awaiting the owner's verdict
 *   unvalidated     Groups photo regeneration: the calibration showed the composition drifting (new room, scale and framing), and the
 *                   Groups route cannot take the favorite as a reference. NOT production-validated; the customer approval is the only control
 * Metadata only: it changes no behaviour.
 */
export type AdaptationValidation = 'not_applicable' | 'provisional' | 'unvalidated'
export function adaptationValidationFor(series: 'portraits' | 'pets' | 'groups' | null, method: 'deterministic' | 'generated' | null): AdaptationValidation {
  if (method !== 'generated' || !series) return 'not_applicable'
  return series === 'groups' ? 'unvalidated' : 'provisional'
}

/** Per-line quantity limit, shared with the Print Shop checkout. */
export const MAX_COPIES = 20

/**
 * RETENTION (PROPOSED, needs approval). Consistent with what exists:
 *   - Foyer reveals keep the clean result 2 hours (foyer-result-claim.ts); a Gift session is a longer journey, so 7 days.
 *   - Portfolios keep source_image with no expiry; Gift sessions DO expire, because nothing has been bought.
 *   - A print order needs its clean master until fulfilment; the future checkout phase PINS the session
 *     (gift_sessions.pinned_at), after which cleanup never touches it and the order's own retention applies.
 *   - Paid preview packs are financial records and are never deleted by cleanup; they belong to the user, not the session.
 */
export const RETENTION = {
  /** Idle time before an unpinned session expires (each batch or edit extends it to at least this far ahead). */
  sessionIdleDays: 7,
  /** Hard ceiling from creation, whatever the activity. */
  sessionMaxDays: 30,
  /** What cleanup removes from an expired, unpinned session: source photo, clean masters, watermarked previews, rows. */
  removed: ['source photo', 'clean masters', 'watermarked previews', 'session, batch and preview rows'],
  /** What it keeps. */
  kept: ['paid preview packs (consumed or not)', 'anything attached to a pinned session'],
} as const

/** Master aspect per series for a Gift Wizard preview: what Discovery already renders. Groups depends on the people count. */
export const MASTER_ASPECT_DEFAULT = { portraits: '1:1', pets: '2:3', groups: '3:2' } as const

export const STORAGE = {
  /** Same private bucket the existing previews use; Gift objects live under their own prefix. */
  prefix: 'gift',
  source: (sessionId: string) => `gift/${sessionId}/source.jpg`,
  master: (sessionId: string, previewId: string, ext: 'png' | 'jpg' = 'png') => `gift/${sessionId}/masters/${previewId}.${ext}`,
  preview: (sessionId: string, previewId: string) => `gift/${sessionId}/previews/${previewId}.jpg`,
}
