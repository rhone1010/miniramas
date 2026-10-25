// lib/v1/gift/policy.ts
//
// The Gift Wizard's business and retention rules, in one place. Approved rules are marked APPROVED; the retention
// numbers are PROPOSED and need sign-off before launch (they were not specified, so nothing is silently decided).

/** APPROVED: first six previews free, second six free, every further six $2.99 after verified payment. */
export const FREE_BATCHES = 2

/**
 * PREVIEWS BEFORE PURCHASE (migration 050). The first six and the second six previews are free with no product purchase; every further six is a
 * verified $2.99 pack. Free batches are SERVER-CONTROLLED: each is recorded in a ledger that outlives the session, and these caps are enforced in the
 * database under the session lock, so recreating a session (or deleting and recreating it) cannot repeat a free allocation.
 *   perSession          free batches per session
 *   perAccountPhoto     free batches per account for the same photograph, across all sessions, deleted ones included
 *   perAccount24h       free batches per account in any rolling 24 hours
 *   perAccountLifetime  free batches per account, ever
 * The last three are proposed limits, not previously approved numbers.
 */
export const FREE_PREVIEWS = { perSession: FREE_BATCHES, perAccountPhoto: 2, perAccount24h: 6, perAccountLifetime: 20 } as const
/**
 * Photo analysis (session creation) is paid work, so every attempt is counted BEFORE the analysis runs, in a ledger that deletion cannot reset
 * (migration 051). Per account: 10 per hour and 30 per 24 hours; per account and photograph: 5 per 24 hours.
 */
export const SESSION_ATTEMPTS = { perAccountHour: 10, perAccountDay: 30, perPhotoDay: 5 } as const
export type FreeBlockReason = 'session_limit' | 'photo_limit' | 'daily_limit' | 'lifetime_limit'
export const BATCH_SIZE = 6
export const PACK_PRICE_CENTS = 299
export const PACK_CURRENCY = 'usd'
/** Stripe metadata.kind for a preview pack. The webhook dispatches on it; the metadata only selects the handler. */
export const PACK_KIND = 'gift_preview_pack'

/** A preview that fails is retried on its own row up to this many times per slot, charging nothing. */
export const MAX_PREVIEW_ATTEMPTS = 3
/** A lease that is not finished within this long may be taken over by a retry. NB2 renders finish well inside this. */
export const PREVIEW_LEASE_SECONDS = 300
/**
 * All six previews of a batch are dispatched at once (they used to run in two waves of three), so the customer sees each one as soon as it finishes.
 * GIFT_PARALLEL_RENDERS (1 to 6) lowers it if the provider or the platform needs it. Claims, attempts, idempotency and entitlement accounting are unchanged:
 * every preview is still claimed atomically before it is rendered, so concurrency never adds a render, only starts the same ones sooner.
 */
/** The most NB2 attempts the Groups route may make for ONE initial preview (its own default is 4, each followed by a vision scoring call). Portraits and Pets already stop at 2. The best attempt is kept and its quality recorded. */
export const INITIAL_PREVIEW_MAX_ATTEMPTS = 2
export const MAX_PARALLEL_RENDERS = 6
export const parallelRenders = (env: Record<string, string | undefined> = process.env): number => {
  const n = Number(env.GIFT_PARALLEL_RENDERS)
  return Number.isInteger(n) && n >= 1 && n <= MAX_PARALLEL_RENDERS ? n : MAX_PARALLEL_RENDERS
}
/** Preparing one composition requirement (an NB2.1 generation plus bounded extension) holds its durable job this long; a request that dies leaves a job that lapses into 'stalled' and can be resumed. */
export const COMPOSITION_LEASE_MS = 6 * 60 * 1000
export const COMPOSITION_MAX_ATTEMPTS = 3

/** A preview refused by the provider for rate (never reached the model, nothing charged) is tried once more, gently, after this pause. */
export const RATE_LIMIT_PAUSE_MS = 4000
export const RATE_LIMIT_RETRY_WORKERS = 2

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

/**
 * PERSONALIZED PRODUCT GENERATIONS (migration 059; APPROVED 2026-10-22). Six free generations per session; each further six is the $2.99 pack (PACK_PRICE_CENTS; a pack is worth
 * GENERATIONS_PER_PACK generations). Account abuse limits are per GENERATION and live in a ledger that deleting sessions cannot reset. A generation that is not delivered does not count.
 */
export const FREE_GENERATIONS = { perSession: 6, perAccountPhoto: 6, perAccount24h: 18, perAccountLifetime: 60 } as const
export const GENERATIONS_PER_PACK = 6
/** At most this many generations of one session may be in flight at once. */
export const MAX_INFLIGHT_GENERATIONS = 2
export const GENERATION_LEASE_SECONDS = 300
export const GENERATION_MAX_ATTEMPTS = 3
/** The most a generated picture may be trimmed (per axis, fraction of its size) to reach the product's EXACT aspect. This happens when it is generated, BEFORE the customer sees and accepts it; nothing is extended or invented, and nothing changes after acceptance. Today's launch shapes need 0 to 1%; mount openings and the card front need up to about 8% because the model offers no closer ratio. Anything further off is refused. */
export const MAX_CONFORM_CROP = 0.10
/** Which flow NEW sessions start in. 'previews' (default) is the six-preview journey, unchanged; 'generations' is the product-first journey. Existing sessions keep their own flow. */
export const newSessionFlow = (env: Record<string, string | undefined> = process.env): 'previews' | 'generations' => env.GIFT_NEW_SESSION_FLOW === 'generations' ? 'generations' : 'previews'

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
  /** Source photographs are deleted this many days after the qualifying event (approved policy 2026-10-25). */
  sourceDays: 60,
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
  /** Pre-checkout personalized product previews (watermarked JPEGs only). One directory, so the session's cleanup can remove them all by listing it. */
  productPreviewDir: (sessionId: string) => `gift/${sessionId}/product-previews/`,
}
