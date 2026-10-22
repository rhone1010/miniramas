// lib/v1/gift/store.ts
//
// Persistence for Gift Wizard sessions, batches, previews and paid packs, behind one interface so the service is tested
// without a database. The Supabase implementation delegates every rule that must be atomic (reserving a batch, consuming
// a pack, leasing a preview) to the functions in migration 047, which migration-047.test.ts runs against real Postgres.
// The memory implementation mirrors those rules for the service tests.

import { randomUUID } from 'node:crypto'
import { FREE_PREVIEWS, SESSION_ATTEMPTS, type FreeBlockReason } from './policy'
import type { BatchKind, GenerationRecord, GiftLine, PreviewStatus, Series } from './types'

export interface SessionRec {
  id: string; user_id: string; status: 'active' | 'expired' | 'deleted'
  source_path: string | null; source_sha256: string; source_width: number; source_height: number
  series: Series | null; analysis: { peopleCount?: number | null; [k: string]: unknown }
  lines: GiftLine[]; master_aspect: string | null
  created_at: string; last_activity_at: string; expires_at: string; pinned_at: string | null
  // 048: the purchase-before-generation flow
  order_id: string | null; free_batches_granted: number; artwork_preview_id: string | null; approved_at: string | null
  /** 056: the customer's FINAL order approval. approved_at means "released to manufacturing" (it is what the fulfilment code checks); this does not. Absent before 056. */
  final_approved_at?: string | null
  /** 057: the owned preview_ledger id a My Collection session was started from; null/absent for photo sessions. */
  collection_preview_id?: string | null
  refund_requested_at: string | null; refunded_at: string | null; unlock_portfolio_id: string | null
  disclosure_version: string | null; disclosure_accepted_at: string | null
}
export interface OrderInfo {
  id: string; status: string; paid_at: string | null; stripe_session_id: string; stripe_payment_intent: string | null
  retail_total_cents: number; retail_shipping_cents: number; items: Array<{ renderId: string; size: string; finish: string; copies: number; sku: string; retailCents: number; frozen?: unknown }>
  prodigi_order_id: string | null; placed_at: string | null
  customer_email?: string; prodigi_merchant_ref?: string | null
  /** What an unpaid order was last quoted and sold with; checkout reuses its Stripe session only when ALL of this still matches. */
  shipping_address?: Record<string, unknown> | null; shipping_method?: string | null
}
export interface OrderLineRec { order_id: string; line_index: number; session_id: string; line_id: string; product_id: string; sku: string; copies: number; corrections_used: number }
/** 055: a composition being prepared (or that failed) for one requirement of the selected artwork. A successful job is deleted: the gift_compositions rows are the record. */
export interface CompositionJobRec {
  session_id: string; preview_id: string; geometry_key: string; line_ids: string[]; method: 'deterministic' | 'generated' | null
  state: 'preparing' | 'failed'; attempts: number; claimed_at: string; expires_at: string; error_code: string | null
}
export interface CompositionJobKey { sessionId: string; previewId: string; geometryKey: string; token: string }
export interface CompositionClaim { token: string | null; reason: 'claimed' | 'in_progress' | 'attempts_exhausted' }

export interface CompositionRec {
  id: string; session_id: string; line_id: string; preview_id: string; attempt: 1 | 2; status: 'ready' | 'approved' | 'failed' | 'superseded'
  composed_path: string | null; preview_path: string | null; width: number | null; height: number | null; plan: Record<string, unknown>
  /** 049: the requirement this row satisfies; rows with the same key and artwork share files. */
  geometry_key: string | null; method: 'deterministic' | 'generated'; source_composition_id: string | null
  /** 049: how it was made. 'none' = adapted from the selected artwork; 'favorite_reference' = NB2.1 given the approved artwork as a reference;
   *  'photo_regeneration' = NB2.1 from the customer's photograph only (a series that cannot take a reference). The artwork it was made FROM is preview_id. */
  generation_mode: 'none' | 'photo_regeneration' | 'favorite_reference'; generation_aspect: string | null
  nb21_calls: number; outpaint_calls: number; cost_usd_est: number | null
  created_at: string; approved_at: string | null
  /** 052 (operator repair of a geometry defect): 0/absent for every ordinary row; a repair replacement carries 1, 2, ... beside the row it replaces, which is kept for audit. */
  repair_seq?: number
}
/**
 * Whether a line's ONE included correction is spent. It is a property of the LINE across the purchase boundary: a correction made on a draft
 * (before payment, when there is no order line to count on) is an attempt-2 composition row, and the paid order line starts its counter at 0, so the
 * rows themselves are the record. A technical repair never creates an attempt-2 row for a first attempt and never counts.
 */
export const correctionUsed = (comps: Array<Pick<CompositionRec, 'line_id' | 'attempt'>>, line: Pick<OrderLineRec, 'line_id' | 'corrections_used'>): boolean =>
  line.corrections_used >= 1 || comps.some(c => c.line_id === line.line_id && c.attempt === 2)

/** The current composition of a line: the highest attempt, and within it the latest repair. */
export const byNewest = (a: Pick<CompositionRec, 'attempt' | 'repair_seq'>, b: Pick<CompositionRec, 'attempt' | 'repair_seq'>) => b.attempt - a.attempt || (b.repair_seq ?? 0) - (a.repair_seq ?? 0)
export interface BatchRec { id: string; session_id: string; user_id: string; batch_index: number; kind: BatchKind; pack_id: string | null; idempotency_key: string; effect_ids: string[]; created_at: string }
export interface PreviewRec {
  id: string; batch_id: string; session_id: string; slot: number; effect_id: string; status: PreviewStatus; attempts: number
  lease_until: string | null; master_path: string | null; preview_path: string | null; width: number | null; height: number | null; error: string | null
  /** 058: how it was generated (attempts, quality, post-processing); null/absent before. */
  generation?: GenerationRecord | null
}
export type StoreErrorCode =
  | 'repair_claim_lost' | 'repair_not_consistent' | 'composition_not_found'
  | 'session_not_found' | 'session_expired' | 'payment_required' | 'previous_batch_incomplete' | 'effect_already_used' | 'six_distinct_effects_required'
  | 'order_payment_required' | 'order_refunded' | 'refund_pending' | 'order_not_awaiting_artwork' | 'preview_not_ready' | 'correction_limit' | 'line_not_found'
  | 'artwork_not_selected' | 'compositions_not_approved' | 'order_has_no_lines' | 'order_not_paid' | 'refund_not_available_after_manufacturing'
  | 'session_already_has_order' | 'order_not_found' | 'order_session_mismatch' | 'order_not_payable' | 'rate_limited'
  | 'final_approval_required' | 'finalization_unavailable' | 'artwork_not_found' | 'artwork_not_compatible' | 'collection_session_no_generation' | 'collection_unavailable'
const STORE_ERROR = /repair_claim_lost|repair_not_consistent|composition_not_found|session_not_found|session_expired|payment_required|previous_batch_incomplete|effect_already_used|six_distinct_effects_required|order_payment_required|order_refunded|refund_pending|order_not_awaiting_artwork|preview_not_ready|correction_limit|line_not_found|artwork_not_selected|compositions_not_approved|order_has_no_lines|order_not_paid|refund_not_available_after_manufacturing|session_already_has_order|order_not_found|order_session_mismatch|order_not_payable|rate_limited|final_approval_required|finalization_unavailable|artwork_not_found|artwork_not_compatible|collection_session_no_generation/
/** The customer's final approval time, whichever way it was recorded: 056 sets final_approved_at; an order approved and released before 056 only has approved_at. */
export const finalizedAt = (s: Pick<SessionRec, 'approved_at'> & { final_approved_at?: string | null }): string | null => s.final_approved_at ?? s.approved_at ?? null
export class StoreError extends Error { constructor(public code: StoreErrorCode) { super(code) } }

export interface GiftStore {
  createSession(rec: SessionRec): Promise<void>
  getSession(id: string, userId: string): Promise<SessionRec | null>
  /** The user's ACTIVE sessions, most recently used first (restoring work after navigation). Never another user's, never a deleted or expired-status one. */
  listSessions(userId: string, limit: number): Promise<SessionRec[]>
  patchSession(id: string, userId: string, patch: Partial<Pick<SessionRec, 'lines' | 'master_aspect' | 'source_path' | 'expires_at' | 'last_activity_at'>>): Promise<void>
  listBatches(sessionId: string): Promise<Array<{ batch: BatchRec; previews: PreviewRec[] }>>
  reserveBatch(i: { sessionId: string; userId: string; key: string; effects: string[] }): Promise<{ batch: BatchRec; reused: boolean }>
  /** Count one photo-analysis attempt for this account and photograph, or throw StoreError('rate_limited') (migration 051). Call BEFORE the paid analysis. */
  recordSessionAttempt(userId: string, sha256: string): Promise<void>
  /** Whether this session may take another FREE batch and, if not, why (migration 050). Read-only. */
  freeStatus(sessionId: string, userId: string): Promise<{ available: boolean; used: number; reason: FreeBlockReason | null }>
  claimPreview(previewId: string, userId: string): Promise<PreviewRec | null>
  /** Returns false when the preview no longer exists (the project was cancelled while the model worked): the caller then discards what it stored. */
  markReady(previewId: string, r: { master_path: string; preview_path: string; width: number; height: number; generation?: GenerationRecord }): Promise<boolean>
  markFailed(previewId: string, error: string): Promise<void>
  paidPackCount(userId: string): Promise<number>
  fulfillPack(userId: string, stripeSessionId: string, amountCents: number): Promise<string>
  expiredSessions(nowIso: string, limit: number): Promise<SessionRec[]>
  deleteSession(id: string): Promise<void>

  // ── 048 ──
  linkOrder(sessionId: string, userId: string, orderId: string, disclosureVersion: string): Promise<void>
  getOrder(orderId: string): Promise<OrderInfo | null>
  orderByStripeSession(stripeSessionId: string): Promise<OrderInfo | null>
  orderByPaymentIntent(paymentIntent: string): Promise<OrderInfo | null>
  /** The gift session an order belongs to, or null when it is not a gift order. No user filter: server callers only. */
  sessionForOrder(orderId: string): Promise<SessionRec | null>
  confirmOrder(i: { sessionId: string; orderId: string; userId: string; stripeSessionId: string; paymentIntent: string; lines: Array<{ lineId: string; productId: string; sku: string; copies: number }> }): Promise<'confirmed' | 'already'>
  orderLines(orderId: string): Promise<OrderLineRec[]>
  selectArtwork(sessionId: string, userId: string, previewId: string): Promise<void>
  listCompositions(sessionId: string): Promise<CompositionRec[]>
  insertComposition(rec: Omit<CompositionRec, 'id' | 'created_at' | 'approved_at'>): Promise<CompositionRec>
  patchComposition(id: string, patch: Partial<Pick<CompositionRec, 'status' | 'approved_at' | 'plan'>>): Promise<void>
  /** 052, operator repair. The claim is database-atomic: one live claim per (session, line). Returns its token, or null when another holds an unexpired one. */
  claimRepair(i: { sessionId: string; lineId: string; compositionId: string; operator: string; ttlMs: number; nowMs: number }): Promise<string | null>
  releaseRepair(sessionId: string, lineId: string, token: string): Promise<void>
  /** 055: take the preparation of one composition requirement atomically (the guard against paying for the same generation twice). token null = someone else is preparing it, or its attempts are used up. */
  claimComposition(i: { sessionId: string; previewId: string; geometryKey: string; lineIds: string[]; method: 'deterministic' | 'generated'; ttlMs: number; maxAttempts: number; nowMs: number }): Promise<CompositionClaim>
  finishComposition(i: CompositionJobKey): Promise<void>
  failComposition(i: CompositionJobKey & { code: string }): Promise<void>
  listCompositionJobs(sessionId: string): Promise<CompositionJobRec[]>
  /** One transaction: the claim must still be ours and the order must still await approval; the old composition is superseded (history kept) and the claim dropped. */
  completeRepair(i: { sessionId: string; lineId: string; token: string; oldId: string; newId: string; note: Record<string, unknown>; nowMs: number }): Promise<void>
  useCorrection(sessionId: string, userId: string, lineId: string): Promise<void>
  approveOrder(i: { sessionId: string; userId: string; portfolioId: string; cleanPath: string; sourceImage: string }): Promise<'approved' | 'already'>
  /** 056. The customer's final approval ONLY: validates, creates the My Collection piece, records final_approved_at. Never touches the order's status, so fulfilment cannot see it. */
  finalizeOrder(i: { sessionId: string; userId: string; portfolioId: string; cleanPath: string; sourceImage: string }): Promise<'approved' | 'already'>
  /** 057. Starts a session whose favorite is an artwork the customer already owns. The database decides ownership; the owned records are never written. Idempotent per (user, owned artwork). */
  createCollectionSession(i: { userId: string; ownedPreviewId: string; rec: SessionRec; batchId: string; previewId: string; master_path: string; preview_path: string; width: number; height: number }): Promise<{ sessionId: string; created: boolean }>
  collectionSession(userId: string, ownedPreviewId: string): Promise<SessionRec | null>
  /** 056. The separate, explicit release to manufacturing (service role, no customer route): needs final approval, then awaiting_artwork -> paid. */
  releaseOrder(sessionId: string): Promise<'released' | 'already'>
  requestRefund(i: { sessionId: string; userId: string; reason: string }): Promise<string>
  declineRefund(orderId: string): Promise<void>
  applyRefund(i: { orderId: string; refundId: string; amountCents: number; full: boolean }): Promise<'cancelled' | 'recorded_partial' | 'already' | 'refunded_after_placement' | 'not_gift_order'>
  releaseSession(orderId: string): Promise<void>
}

// ── Supabase ────────────────────────────────────────────────────────────

const VOLATILE = 'volatile'
const JOBS_MISSING = /could not find the function|does not exist|schema cache|relation .* does not exist/i
const jobsMissing = { v: false }              // module-wide: once the table is known to be absent, stop asking on every request

export function supabaseGiftStore(db: any): GiftStore {
  const one = async (q: any) => { const { data, error } = await q; if (error) throw new Error(error.message); return data }
  const fromRpc = (e: any): never => {
    if (/gift_(finalize|release)_order/.test(String(e?.message ?? '')) && /could not find the function|does not exist|schema cache/i.test(String(e?.message ?? ''))) throw new StoreError('finalization_unavailable')      // 056 not applied
    if (/gift_create_collection_session/.test(String(e?.message ?? '')) && /could not find the function|does not exist|schema cache/i.test(String(e?.message ?? ''))) throw new StoreError('collection_unavailable')        // 057 not applied
    const m = STORE_ERROR.exec(String(e?.message ?? ''))
    if (m) throw new StoreError(m[0] as StoreErrorCode)
    throw new Error(String(e?.message ?? 'gift_store_error'))
  }
  const rpc = async (fn: string, args: Record<string, unknown>) => { const { data, error } = await db.rpc(fn, args); if (error) fromRpc(error); return data }
  const ORDER_COLS = 'id,status,paid_at,stripe_session_id,stripe_payment_intent,retail_total_cents,retail_shipping_cents,items,prodigi_order_id,placed_at,customer_email,prodigi_merchant_ref,shipping_address,shipping_method'
  return {
    async createSession(rec) { await one(db.from('gift_sessions').insert(rec)) },
    async getSession(id, userId) { return await one(db.from('gift_sessions').select('*').eq('id', id).eq('user_id', userId).neq('status', 'deleted').maybeSingle()) },
    async listSessions(userId, limit) { return (await one(db.from('gift_sessions').select('*').eq('user_id', userId).eq('status', 'active').order('last_activity_at', { ascending: false }).limit(limit))) ?? [] },
    async patchSession(id, userId, patch) { await one(db.from('gift_sessions').update(patch).eq('id', id).eq('user_id', userId)) },
    async listBatches(sessionId) {
      const batches: BatchRec[] = (await one(db.from('gift_batches').select('*').eq('session_id', sessionId).order('batch_index'))) ?? []
      const previews: PreviewRec[] = (await one(db.from('gift_previews').select('*').eq('session_id', sessionId).order('slot'))) ?? []
      return batches.map(batch => ({ batch, previews: previews.filter(p => p.batch_id === batch.id) }))
    },
    async reserveBatch({ sessionId, userId, key, effects }) {
      const { data, error } = await db.rpc('gift_reserve_batch', { p_session: sessionId, p_user: userId, p_key: key, p_effects: effects, ...FREE_ARGS })
      if (error) fromRpc(error)
      const row = Array.isArray(data) ? data[0] : data
      const batch: BatchRec = await one(db.from('gift_batches').select('*').eq('id', row.o_batch_id).single())
      return { batch, reused: !!row.o_reused }
    },
    async recordSessionAttempt(userId, sha) {
      await rpc('gift_record_session_attempt', { p_user: userId, p_sha: sha, p_hour_cap: SESSION_ATTEMPTS.perAccountHour, p_day_cap: SESSION_ATTEMPTS.perAccountDay, p_photo_cap: SESSION_ATTEMPTS.perPhotoDay })
    },
    async freeStatus(sessionId, userId) {
      const { data, error } = await db.rpc('gift_free_status', { p_session: sessionId, p_user: userId, ...FREE_ARGS })
      if (error) fromRpc(error)
      const row = Array.isArray(data) ? data[0] : data
      return { available: !!row?.o_available, used: Number(row?.o_used_in_session ?? 0), reason: (row?.o_reason ?? null) as FreeBlockReason | null }
    },
    async claimPreview(previewId, userId) {
      const { data, error } = await db.rpc('gift_claim_preview', { p_preview: previewId, p_user: userId })
      if (error) throw new Error(error.message)
      const row = Array.isArray(data) ? data[0] : data
      return row?.id ? (row as PreviewRec) : null
    },
    async markReady(previewId, r) {
      const base = { status: 'ready', lease_until: null, error: null, updated_at: new Date().toISOString() }
      const run = (fields: Record<string, unknown>) => db.from('gift_previews').update({ ...fields, ...base }).eq('id', previewId).select('id')
      let res = await run(r)
      if (res.error && r.generation && /generation/i.test(String(res.error.message))) { const { generation: _g, ...rest } = r; res = await run(rest) }          // 058 not applied: the preview is stored without its record
      if (res.error) throw new Error(res.error.message)
      return (res.data ?? []).length > 0
    },
    async markFailed(previewId, error) {
      await one(db.from('gift_previews').update({ status: 'failed', lease_until: null, error: error.slice(0, 200), updated_at: new Date().toISOString() }).eq('id', previewId).neq('status', 'ready'))
    },
    async paidPackCount(userId) {
      const { count, error } = await db.from('gift_preview_packs').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('status', 'paid')
      if (error || count === null) throw new Error('pack_balance_unavailable')
      return count
    },
    async fulfillPack(userId, stripeSessionId, amountCents) {
      const { data, error } = await db.rpc('gift_fulfill_preview_pack', { p_user: userId, p_stripe_session: stripeSessionId, p_amount: amountCents })
      if (error) throw new Error(error.message)
      return data as string
    },
    async expiredSessions(nowIso, limit) {
      return (await one(db.from('gift_sessions').select('*').eq('status', 'active').is('pinned_at', null).lt('expires_at', nowIso).limit(limit))) ?? []
    },
    async deleteSession(id) { await one(db.from('gift_sessions').delete().eq('id', id)) },

    async linkOrder(sessionId, userId, orderId, v) { await rpc('gift_link_order', { p_session: sessionId, p_user: userId, p_order: orderId, p_version: v }) },
    async getOrder(orderId) { return await one(db.from('print_orders').select(ORDER_COLS).eq('id', orderId).maybeSingle()) },
    async orderByStripeSession(id) { return await one(db.from('print_orders').select(ORDER_COLS).eq('stripe_session_id', id).maybeSingle()) },
    async orderByPaymentIntent(pi) { return await one(db.from('print_orders').select(ORDER_COLS).eq('stripe_payment_intent', pi).maybeSingle()) },
    async sessionForOrder(orderId) { return await one(db.from('gift_sessions').select('*').eq('order_id', orderId).maybeSingle()) },
    async confirmOrder(i) {
      return (await rpc('gift_confirm_order', { p_session: i.sessionId, p_order: i.orderId, p_user: i.userId, p_stripe_session: i.stripeSessionId, p_intent: i.paymentIntent, p_lines: i.lines })) as 'confirmed' | 'already'
    },
    async orderLines(orderId) { return (await one(db.from('gift_order_lines').select('*').eq('order_id', orderId).order('line_index'))) ?? [] },
    async selectArtwork(sessionId, userId, previewId) { await rpc('gift_select_artwork', { p_session: sessionId, p_user: userId, p_preview: previewId }) },
    async listCompositions(sessionId) { return (await one(db.from('gift_compositions').select('*').eq('session_id', sessionId).order('created_at'))) ?? [] },
    async insertComposition(rec) { const { repair_seq, ...row } = rec; return await one(db.from('gift_compositions').insert(repair_seq ? { ...row, repair_seq } : row).select('*').single()) },     // repair_seq exists only after migration 052; ordinary rows never send it
    async patchComposition(id, patch) { await one(db.from('gift_compositions').update(patch).eq('id', id)) },
    async claimRepair(i) { const t = await rpc('gift_claim_repair', { p_session: i.sessionId, p_line: i.lineId, p_composition: i.compositionId, p_operator: i.operator, p_ttl_seconds: Math.round(i.ttlMs / 1000) }); return typeof t === 'string' ? t : null },
    async releaseRepair(sessionId, lineId, token) { await rpc('gift_release_repair', { p_session: sessionId, p_line: lineId, p_token: token }) },
    // 055. Before the migration is applied the durable job table does not exist: everything below then degrades to today's behavior (no durable guard, nothing to list), never an error.
    async claimComposition(i) {
      if (jobsMissing.v) return { token: VOLATILE, reason: 'claimed' }
      const { data, error } = await db.rpc('gift_claim_composition', { p_session: i.sessionId, p_preview: i.previewId, p_geometry: i.geometryKey, p_lines: i.lineIds, p_method: i.method, p_ttl_seconds: Math.round(i.ttlMs / 1000), p_max_attempts: i.maxAttempts })
      if (error) { if (JOBS_MISSING.test(String(error.message))) { jobsMissing.v = true; console.warn('[gift] gift_composition_jobs is not applied (migration 055): compositions run without a durable guard'); return { token: VOLATILE, reason: 'claimed' } } fromRpc(error) }
      const row = Array.isArray(data) ? data[0] : data
      return { token: row?.o_token ?? null, reason: (row?.o_reason ?? 'in_progress') as CompositionClaim['reason'] }
    },
    async finishComposition(i) { if (jobsMissing.v || i.token === VOLATILE) return; const { error } = await db.rpc('gift_finish_composition', { p_session: i.sessionId, p_preview: i.previewId, p_geometry: i.geometryKey, p_token: i.token }); if (error && !JOBS_MISSING.test(String(error.message))) fromRpc(error) },
    async failComposition(i) { if (jobsMissing.v || i.token === VOLATILE) return; const { error } = await db.rpc('gift_fail_composition', { p_session: i.sessionId, p_preview: i.previewId, p_geometry: i.geometryKey, p_token: i.token, p_code: i.code }); if (error && !JOBS_MISSING.test(String(error.message))) fromRpc(error) },
    async listCompositionJobs(sessionId) {
      if (jobsMissing.v) return []
      const { data, error } = await db.from('gift_composition_jobs').select('*').eq('session_id', sessionId)
      if (error) { if (JOBS_MISSING.test(String(error.message))) { jobsMissing.v = true; return [] } throw new Error(error.message) }
      return (data ?? []) as CompositionJobRec[]
    },
    async completeRepair(i) { await rpc('gift_complete_repair', { p_session: i.sessionId, p_line: i.lineId, p_token: i.token, p_old: i.oldId, p_new: i.newId, p_note: i.note }) },
    async useCorrection(sessionId, userId, lineId) { await rpc('gift_use_correction', { p_session: sessionId, p_user: userId, p_line: lineId }) },
    async approveOrder(i) {
      return (await rpc('gift_approve_order', { p_session: i.sessionId, p_user: i.userId, p_portfolio: i.portfolioId, p_clean_path: i.cleanPath, p_source_image: i.sourceImage })) as 'approved' | 'already'
    },
    async createCollectionSession(i) {
      const r = i.rec
      const data = await rpc('gift_create_collection_session', { p_user: i.userId, p_owned_preview: i.ownedPreviewId, p_session: r.id, p_batch: i.batchId, p_gpreview: i.previewId, p_source_path: r.source_path, p_source_sha: r.source_sha256, p_source_w: r.source_width, p_source_h: r.source_height, p_analysis: r.analysis, p_master_aspect: r.master_aspect, p_expires: r.expires_at, p_master_path: i.master_path, p_preview_path: i.preview_path, p_w: i.width, p_h: i.height })
      const row = Array.isArray(data) ? data[0] : data
      return { sessionId: row.o_session as string, created: !!row.o_created }
    },
    async collectionSession(userId, ownedPreviewId) {
      const { data, error } = await db.from('gift_sessions').select('*').eq('user_id', userId).eq('collection_preview_id', ownedPreviewId).eq('status', 'active').maybeSingle()
      if (error) { if (/collection_preview_id|does not exist|schema cache/i.test(String(error.message))) return null; throw new Error(error.message) }
      return (data as SessionRec | null) ?? null
    },
    async finalizeOrder(i) {
      return (await rpc('gift_finalize_order', { p_session: i.sessionId, p_user: i.userId, p_portfolio: i.portfolioId, p_clean_path: i.cleanPath, p_source_image: i.sourceImage })) as 'approved' | 'already'
    },
    async releaseOrder(sessionId) { return (await rpc('gift_release_order', { p_session: sessionId })) as 'released' | 'already' },
    async requestRefund(i) { return (await rpc('gift_request_refund', { p_session: i.sessionId, p_user: i.userId, p_reason: i.reason.slice(0, 1000), p_message: null })) as string },
    async declineRefund(orderId) { await rpc('gift_decline_refund', { p_order: orderId }) },
    async applyRefund(i) { return (await rpc('gift_apply_refund', { p_order: i.orderId, p_refund_id: i.refundId, p_amount: i.amountCents, p_full: i.full })) as any },
    async releaseSession(orderId) { await rpc('gift_release_session', { p_order: orderId }) },
  }
}

// ── Memory (tests) ──────────────────────────────────────────────────────
// Mirrors the rules of migrations 047 and 048 (which migration-047/048.test.ts run against real Postgres) so the service
// is tested without a database. `orders` stands in for print_orders.

export type MemoryPack = { id: string; user_id: string; stripe_session_id: string; amount_cents: number; status: 'paid' | 'consumed' }
export type MemoryPortfolio = { id: string; user_id: string; series: string | null; origin: 'gift'; preview_id: string; clean_path: string; unlocked: boolean; source_image: string }

const FREE_ARGS = { p_session_cap: FREE_PREVIEWS.perSession, p_photo_cap: FREE_PREVIEWS.perAccountPhoto, p_24h_cap: FREE_PREVIEWS.perAccount24h, p_total_cap: FREE_PREVIEWS.perAccountLifetime }

export function memoryGiftStore(clock: () => number = Date.now) {
  const sessions = new Map<string, SessionRec>(), batches: BatchRec[] = [], previews: PreviewRec[] = []
  /** Tests seed this with the owned artwork a My Collection session may start from (the memory stand-in for preview_ledger + portfolios + portfolio_items). */
  const ownedArtwork = new Map<string, { userId: string; portfolioId: string; series: string; preset: string; unlocked: boolean; done: boolean }>()
  const packs: MemoryPack[] = [], orders = new Map<string, OrderInfo>(), lines: OrderLineRec[] = [], compositions: CompositionRec[] = []
  const attempts: Array<{ user_id: string; sha: string; at: number }> = []
  const freeGrants: Array<{ user_id: string; source_sha256: string; session_id: string | null; batch_id: string; at: number }> = []     // the free-batch ledger: survives session deletion
  const portfolios: MemoryPortfolio[] = [], refunds = new Map<string, { order_id: string; amount: number }>()
  const refundRequests = new Map<string, { id: string; session_id: string; status: 'requested' | 'refunded' | 'declined' }>()
  const repairClaims = new Map<string, { token: string; expiresAt: number }>()
  const compositionJobs = new Map<string, CompositionJobRec & { token: string }>()
  const jobKey = (s: string, p: string, g: string) => s + '|' + p + '|' + g
  const iso = (ms = clock()) => new Date(ms).toISOString()
  const orderOf = (s: SessionRec) => (s.order_id ? orders.get(s.order_id) ?? null : null)
  const owned = (id: string, userId: string) => { const s = sessions.get(id); if (!s || s.user_id !== userId) throw new StoreError('session_not_found'); return s }
  const freeOf = (s: SessionRec): { available: boolean; used: number; reason: FreeBlockReason | null } => {
    const used = batches.filter(b => b.session_id === s.id && b.kind === 'free').length
    const mine = freeGrants.filter(g => g.user_id === s.user_id)
    if (used >= FREE_PREVIEWS.perSession) return { available: false, used, reason: 'session_limit' }
    if (mine.filter(g => g.source_sha256 === s.source_sha256).length >= FREE_PREVIEWS.perAccountPhoto) return { available: false, used, reason: 'photo_limit' }
    if (mine.filter(g => clock() - g.at < 864e5).length >= FREE_PREVIEWS.perAccount24h) return { available: false, used, reason: 'daily_limit' }
    if (mine.length >= FREE_PREVIEWS.perAccountLifetime) return { available: false, used, reason: 'lifetime_limit' }
    return { available: true, used, reason: null }
  }
  const store: GiftStore = {
    async createSession(rec) { sessions.set(rec.id, structuredClone(rec)) },
    async freeStatus(sessionId, userId) { return freeOf(owned(sessionId, userId)) },
    async recordSessionAttempt(userId, sha) {                                       // the ledger survives session deletion
      const mine = attempts.filter(a => a.user_id === userId)
      if (mine.filter(a => clock() - a.at < 3600_000).length >= SESSION_ATTEMPTS.perAccountHour || mine.filter(a => clock() - a.at < 864e5).length >= SESSION_ATTEMPTS.perAccountDay ||
          mine.filter(a => a.sha === sha && clock() - a.at < 864e5).length >= SESSION_ATTEMPTS.perPhotoDay) throw new StoreError('rate_limited')
      attempts.push({ user_id: userId, sha, at: clock() })
    },
    async getSession(id, userId) { const s = sessions.get(id); return s && s.user_id === userId && s.status !== 'deleted' ? structuredClone(s) : null },
    async listSessions(userId, limit) { return [...sessions.values()].filter(s => s.user_id === userId && s.status === 'active').sort((a, b) => Date.parse(b.last_activity_at) - Date.parse(a.last_activity_at)).slice(0, limit).map(s => structuredClone(s)) },
    async patchSession(id, userId, patch) { const s = sessions.get(id); if (s && s.user_id === userId) Object.assign(s, structuredClone(patch)) },
    async listBatches(sessionId) {
      return batches.filter(b => b.session_id === sessionId).sort((a, b) => a.batch_index - b.batch_index)
        .map(batch => ({ batch: structuredClone(batch), previews: previews.filter(p => p.batch_id === batch.id).sort((a, b) => a.slot - b.slot).map(p => structuredClone(p)) }))
    },
    async reserveBatch({ sessionId, userId, key, effects }) {
      const s = owned(sessionId, userId)
      if (s.status !== 'active' || (Date.parse(s.expires_at) < clock() && !s.pinned_at)) throw new StoreError('session_expired')
      const same = batches.find(b => b.session_id === sessionId && b.idempotency_key === key)
      if (same) return { batch: structuredClone(same), reused: true }
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      const o = orderOf(s)
      if (o && !['created', 'awaiting_artwork', 'cancelled'].includes(o.status)) throw new StoreError('order_not_awaiting_artwork')      // generation needs no order, but not after approval
      if (effects.length !== 6 || new Set(effects).size !== 6) throw new StoreError('six_distinct_effects_required')
      if (previews.some(p => p.session_id === sessionId && effects.includes(p.effect_id))) throw new StoreError('effect_already_used')
      if (previews.some(p => p.session_id === sessionId && p.status !== 'ready')) throw new StoreError('previous_batch_incomplete')
      const n = batches.filter(b => b.session_id === sessionId).length
      let kind: BatchKind = 'free', packId: string | null = null
      if (!freeOf(s).available) {
        const pack = packs.find(p => p.user_id === userId && p.status === 'paid')
        if (!pack) throw new StoreError('payment_required')
        kind = 'paid'; packId = pack.id; pack.status = 'consumed'
      }
      const batch: BatchRec = { id: randomUUID(), session_id: sessionId, user_id: userId, batch_index: n + 1, kind, pack_id: packId, idempotency_key: key, effect_ids: [...effects], created_at: iso() }
      batches.push(batch)
      if (kind === 'free') freeGrants.push({ user_id: userId, source_sha256: s.source_sha256, session_id: sessionId, batch_id: batch.id, at: clock() })
      effects.forEach((effect_id, i) => previews.push({ id: randomUUID(), batch_id: batch.id, session_id: sessionId, slot: i + 1, effect_id, status: 'pending', attempts: 0, lease_until: null, master_path: null, preview_path: null, width: null, height: null, error: null }))
      s.last_activity_at = iso()
      if (!s.pinned_at) s.expires_at = iso(Math.min(Date.parse(s.created_at) + 30 * 864e5, Math.max(Date.parse(s.expires_at), clock() + 7 * 864e5)))
      return { batch: structuredClone(batch), reused: false }
    },
    async claimPreview(previewId, userId) {
      const p = previews.find(x => x.id === previewId); const s = p && sessions.get(p.session_id)
      if (!p || !s || s.user_id !== userId || s.status !== 'active') return null
      const lapsed = p.status === 'generating' && p.lease_until !== null && Date.parse(p.lease_until) < clock()
      if (p.attempts >= 3 || !(p.status === 'pending' || p.status === 'failed' || lapsed)) return null
      p.status = 'generating'; p.attempts += 1; p.lease_until = iso(clock() + 300_000); p.error = null
      return structuredClone(p)
    },
    async markReady(previewId, r) { const p = previews.find(x => x.id === previewId); if (!p || !sessions.has(p.session_id)) return false; Object.assign(p, r, { status: 'ready', lease_until: null, error: null }); return true },
    async markFailed(previewId, error) { const p = previews.find(x => x.id === previewId)!; if (p.status !== 'ready') Object.assign(p, { status: 'failed', lease_until: null, error }) },
    async paidPackCount(userId) { return packs.filter(p => p.user_id === userId && p.status === 'paid').length },
    async fulfillPack(userId, stripeSessionId, amountCents) {
      const existing = packs.find(p => p.stripe_session_id === stripeSessionId); if (existing) return existing.id
      const id = randomUUID(); packs.push({ id, user_id: userId, stripe_session_id: stripeSessionId, amount_cents: amountCents, status: 'paid' }); return id
    },
    async expiredSessions(nowIso, limit) { return [...sessions.values()].filter(s => s.status === 'active' && !s.pinned_at && s.expires_at < nowIso).slice(0, limit).map(s => structuredClone(s)) },
    async deleteSession(id) {
      sessions.delete(id)
      for (const list of [batches, previews, lines, compositions] as Array<Array<{ session_id: string }>>) for (let i = list.length - 1; i >= 0; i--) if (list[i].session_id === id) list.splice(i, 1)
    },

    async linkOrder(sessionId, userId, orderId, v) {
      const s = owned(sessionId, userId)
      if (s.order_id && s.order_id !== orderId) throw new StoreError('session_already_has_order')
      if ([...sessions.values()].some(x => x.id !== sessionId && x.order_id === orderId)) throw new Error('order_already_linked')
      s.order_id = orderId; s.disclosure_version = v; s.disclosure_accepted_at ??= iso(); s.last_activity_at = iso()
    },
    async getOrder(id) { const o = orders.get(id); return o ? structuredClone(o) : null },
    async orderByStripeSession(id) { const o = [...orders.values()].find(x => x.stripe_session_id === id); return o ? structuredClone(o) : null },
    async orderByPaymentIntent(pi) { const o = [...orders.values()].find(x => x.stripe_payment_intent === pi); return o ? structuredClone(o) : null },
    async sessionForOrder(orderId) { const s = [...sessions.values()].find(x => x.order_id === orderId); return s ? structuredClone(s) : null },
    async confirmOrder(i) {
      const s = owned(i.sessionId, i.userId)
      if (s.order_id !== i.orderId) throw new StoreError('session_not_found')
      const o = orders.get(i.orderId); if (!o) throw new StoreError('order_not_found')
      if (o.stripe_session_id !== i.stripeSessionId) throw new StoreError('order_session_mismatch')
      if (o.status === 'created') {
        o.status = 'awaiting_artwork'; o.stripe_payment_intent = i.paymentIntent; o.paid_at = iso()
        s.free_batches_granted = 2; s.pinned_at ??= iso(); s.last_activity_at = iso()
        i.lines.forEach((l, idx) => { if (!lines.some(x => x.order_id === o.id && x.line_index === idx)) lines.push({ order_id: o.id, line_index: idx, session_id: s.id, line_id: l.lineId, product_id: l.productId, sku: l.sku, copies: l.copies, corrections_used: 0 }) })
        return 'confirmed'
      }
      if (o.status === 'cancelled') throw new StoreError('order_not_payable')
      return 'already'
    },
    async orderLines(orderId) { return lines.filter(l => l.order_id === orderId).sort((a, b) => a.line_index - b.line_index).map(l => structuredClone(l)) },
    async selectArtwork(sessionId, userId, previewId) {
      const s = owned(sessionId, userId); const o = orderOf(s)
      if (o && !['created', 'awaiting_artwork', 'cancelled'].includes(o.status)) throw new StoreError('order_not_awaiting_artwork')       // saved before any order, or while one awaits; not after approval
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      if (!previews.some(p => p.id === previewId && p.session_id === sessionId && p.status === 'ready')) throw new StoreError('preview_not_ready')
      for (const c of compositions) if (c.session_id === sessionId && c.preview_id !== previewId && (c.status === 'ready' || c.status === 'approved')) c.status = 'superseded'
      s.artwork_preview_id = previewId; s.last_activity_at = iso()
    },
    async listCompositions(sessionId) { return compositions.filter(c => c.session_id === sessionId).map(c => structuredClone(c)) },
    async insertComposition(rec) {
      if (compositions.some(c => c.session_id === rec.session_id && c.line_id === rec.line_id && c.preview_id === rec.preview_id && c.attempt === rec.attempt && (c.repair_seq ?? 0) === (rec.repair_seq ?? 0))) throw new Error('composition_exists')
      const c: CompositionRec = { ...structuredClone(rec), id: randomUUID(), created_at: iso(), approved_at: null }; compositions.push(c); return structuredClone(c)
    },
    async patchComposition(id, patch) { const c = compositions.find(x => x.id === id); if (c) Object.assign(c, patch) },
    async claimRepair(i) {
      const c = compositions.find(x => x.id === i.compositionId && x.session_id === i.sessionId && x.line_id === i.lineId && (x.status === 'ready' || x.status === 'approved'))
      if (!c) throw new StoreError('composition_not_found')
      const key = i.sessionId + ':' + i.lineId, held = repairClaims.get(key)
      if (held && held.expiresAt > i.nowMs) return null                                  // synchronous check-and-set: atomic, like the database's single INSERT ... ON CONFLICT
      const token = randomUUID(); repairClaims.set(key, { token, expiresAt: i.nowMs + Math.max(30_000, i.ttlMs) }); return token
    },
    async releaseRepair(sessionId, lineId, token) { const key = sessionId + ':' + lineId; if (repairClaims.get(key)?.token === token) repairClaims.delete(key) },
    async claimComposition(i) {                                                   // synchronous check-and-set: atomic, like the database's single INSERT ... ON CONFLICT
      const key = jobKey(i.sessionId, i.previewId, i.geometryKey), cur = compositionJobs.get(key)
      const expired = !!cur && (Date.parse(cur.expires_at) <= i.nowMs || cur.state === 'failed')
      if (cur && !(expired && cur.attempts < i.maxAttempts)) return { token: null, reason: expired ? 'attempts_exhausted' : 'in_progress' }
      const token = randomUUID()
      compositionJobs.set(key, { session_id: i.sessionId, preview_id: i.previewId, geometry_key: i.geometryKey, line_ids: [...i.lineIds], method: i.method, state: 'preparing', attempts: (cur?.attempts ?? 0) + 1,
        claimed_at: new Date(i.nowMs).toISOString(), expires_at: new Date(i.nowMs + Math.max(30_000, i.ttlMs)).toISOString(), error_code: null, token })
      return { token, reason: 'claimed' }
    },
    async finishComposition(i) { const key = jobKey(i.sessionId, i.previewId, i.geometryKey); if (compositionJobs.get(key)?.token === i.token) compositionJobs.delete(key) },
    async failComposition(i) { const key = jobKey(i.sessionId, i.previewId, i.geometryKey), j = compositionJobs.get(key); if (j && j.token === i.token) Object.assign(j, { state: 'failed', error_code: i.code.slice(0, 60), expires_at: new Date(clock()).toISOString() }) },
    async listCompositionJobs(sessionId) { return [...compositionJobs.values()].filter(j => j.session_id === sessionId).map(({ token: _t, ...j }) => structuredClone(j)) },
    async completeRepair(i) {
      const s = sessions.get(i.sessionId); if (!s) throw new StoreError('session_not_found')
      if (s.refunded_at) throw new StoreError('order_refunded'); if (s.refund_requested_at) throw new StoreError('refund_pending')
      if (s.approved_at || (s.order_id && !['created', 'awaiting_artwork'].includes(orders.get(s.order_id)?.status ?? ''))) throw new StoreError('order_not_awaiting_artwork')       // a draft, or a paid order awaiting approval
      const key = i.sessionId + ':' + i.lineId, held = repairClaims.get(key)
      if (!held || held.token !== i.token) throw new StoreError('repair_claim_lost')
      const o = compositions.find(x => x.id === i.oldId && x.session_id === i.sessionId && x.line_id === i.lineId), n = compositions.find(x => x.id === i.newId && x.session_id === i.sessionId && x.line_id === i.lineId)
      if (!o || !n || o.id === n.id || (n.repair_seq ?? 0) <= 0 || n.status !== 'ready' || n.preview_id !== o.preview_id || n.attempt !== o.attempt) throw new StoreError('repair_not_consistent')
      if (o.status === 'ready' || o.status === 'approved') { o.status = 'superseded'; o.plan = { ...o.plan, ...i.note, supersededReason: 'geometry_defect', supersededBy: n.id, supersededAt: iso(i.nowMs) } }
      repairClaims.delete(key)
    },
    async useCorrection(sessionId, userId, lineId) {
      owned(sessionId, userId)
      const l = lines.find(x => x.session_id === sessionId && x.line_id === lineId)
      if (!l) throw new StoreError('line_not_found')
      if (l.corrections_used >= 1) throw new StoreError('correction_limit')
      l.corrections_used += 1
    },
    async approveOrder(i) {
      const s = owned(i.sessionId, i.userId)
      if (!s.order_id) throw new StoreError('order_payment_required')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      const o = orders.get(s.order_id)!
      if (o.status !== 'awaiting_artwork') { if (s.approved_at) return 'already'; throw new StoreError('order_not_awaiting_artwork') }
      if (!s.artwork_preview_id) throw new StoreError('artwork_not_selected')
      const ls = lines.filter(l => l.order_id === s.order_id)
      if (!ls.length) throw new StoreError('order_has_no_lines')
      if (ls.some(l => !compositions.some(c => c.session_id === s.id && c.line_id === l.line_id && c.preview_id === s.artwork_preview_id && c.status === 'approved'))) throw new StoreError('compositions_not_approved')
      if (!s.unlock_portfolio_id) {
        if (!previews.some(p => p.id === s.artwork_preview_id && p.session_id === s.id && p.status === 'ready')) throw new StoreError('preview_not_ready')
        portfolios.push({ id: i.portfolioId, user_id: i.userId, series: s.series, origin: 'gift', preview_id: s.artwork_preview_id, clean_path: i.cleanPath, unlocked: true, source_image: i.sourceImage })
        s.unlock_portfolio_id = i.portfolioId
      }
      o.status = 'paid'; s.approved_at = iso(); s.last_activity_at = iso()
      return 'approved'
    },
    async createCollectionSession(i) {
      const art = ownedArtwork.get(i.ownedPreviewId)                                                           // mirrors gift_create_collection_session: the owned record decides, and a refusal does not say why
      if (!art || art.userId !== i.userId || !art.unlocked || !art.done) throw new StoreError('artwork_not_found')
      if (!['portraits', 'pets', 'groups'].includes(art.series)) throw new StoreError('artwork_not_compatible')
      const existing = [...sessions.values()].find(x => x.user_id === i.userId && x.collection_preview_id === i.ownedPreviewId && x.status === 'active')
      if (existing) return { sessionId: existing.id, created: false }
      sessions.set(i.rec.id, structuredClone({ ...i.rec, series: art.series as Series, unlock_portfolio_id: art.portfolioId, collection_preview_id: i.ownedPreviewId, artwork_preview_id: i.previewId }))
      batches.push({ id: i.batchId, session_id: i.rec.id, user_id: i.userId, batch_index: 1, kind: 'collection', pack_id: null, idempotency_key: 'collection:' + i.ownedPreviewId, effect_ids: [art.preset], created_at: iso() })
      previews.push({ id: i.previewId, batch_id: i.batchId, session_id: i.rec.id, slot: 1, effect_id: art.preset, status: 'ready', attempts: 0, lease_until: null, master_path: i.master_path, preview_path: i.preview_path, width: i.width, height: i.height, error: null })
      return { sessionId: i.rec.id, created: true }
    },
    async collectionSession(userId, ownedPreviewId) { const s = [...sessions.values()].find(x => x.user_id === userId && x.collection_preview_id === ownedPreviewId && x.status === 'active'); return s ? structuredClone(s) : null },
    async finalizeOrder(i) {
      const s = owned(i.sessionId, i.userId)
      if (!s.order_id) throw new StoreError('order_payment_required')
      if (s.refunded_at) throw new StoreError('order_refunded')
      if (s.refund_requested_at) throw new StoreError('refund_pending')
      if (s.final_approved_at || s.approved_at) return 'already'
      const o = orders.get(s.order_id)!
      if (o.status !== 'awaiting_artwork') throw new StoreError('order_not_awaiting_artwork')
      if (!s.artwork_preview_id) throw new StoreError('artwork_not_selected')
      const ls = lines.filter(l => l.order_id === s.order_id)
      if (!ls.length) throw new StoreError('order_has_no_lines')
      if (ls.some(l => !compositions.some(c => c.session_id === s.id && c.line_id === l.line_id && c.preview_id === s.artwork_preview_id && c.status === 'approved'))) throw new StoreError('compositions_not_approved')
      if (!s.unlock_portfolio_id) {
        if (!previews.some(p => p.id === s.artwork_preview_id && p.session_id === s.id && p.status === 'ready')) throw new StoreError('preview_not_ready')
        portfolios.push({ id: i.portfolioId, user_id: i.userId, series: s.series, origin: 'gift', preview_id: s.artwork_preview_id, clean_path: i.cleanPath, unlocked: true, source_image: i.sourceImage })
        s.unlock_portfolio_id = i.portfolioId
      }
      s.final_approved_at = iso(); s.last_activity_at = iso()            // the order row is NOT touched
      return 'approved'
    },
    async releaseOrder(sessionId) {
      const s = sessions.get(sessionId); if (!s) throw new StoreError('session_not_found')
      if (!s.order_id) throw new StoreError('order_payment_required')
      if (s.refunded_at) throw new StoreError('order_refunded'); if (s.refund_requested_at) throw new StoreError('refund_pending')
      if (s.approved_at) return 'already'
      if (!s.final_approved_at) throw new StoreError('final_approval_required')
      const o = orders.get(s.order_id)!; if (o.status !== 'awaiting_artwork') throw new StoreError('order_not_awaiting_artwork')
      o.status = 'paid'; s.approved_at = iso(); s.last_activity_at = iso()
      return 'released'
    },
    async requestRefund(i) {
      const s = owned(i.sessionId, i.userId); const o = orderOf(s)
      if (!o || !o.paid_at || o.status === 'created') throw new StoreError('order_not_paid')
      if (o.status === 'cancelled' || s.refunded_at) throw new StoreError('order_refunded')
      if (o.prodigi_order_id || o.placed_at || ['placed', 'in_production', 'shipped', 'delivered'].includes(o.status)) throw new StoreError('refund_not_available_after_manufacturing')
      let r = refundRequests.get(o.id)
      if (r && r.status === 'requested') return r.id
      if (r) r.status = 'requested'; else { r = { id: randomUUID(), session_id: s.id, status: 'requested' }; refundRequests.set(o.id, r) }
      s.refund_requested_at = iso(); s.last_activity_at = iso()
      return r.id
    },
    async declineRefund(orderId) {
      const r = refundRequests.get(orderId); if (r && r.status === 'requested') r.status = 'declined'
      const s = [...sessions.values()].find(x => x.order_id === orderId); if (s && !s.refunded_at) s.refund_requested_at = null
    },
    async applyRefund(i) {
      const s = [...sessions.values()].find(x => x.order_id === i.orderId); if (!s) return 'not_gift_order'
      if (refunds.has(i.refundId)) return 'already'
      refunds.set(i.refundId, { order_id: i.orderId, amount: i.amountCents })
      if (!i.full) return 'recorded_partial'
      const o = orders.get(i.orderId)!
      s.refunded_at = iso(); s.refund_requested_at = null
      const r = refundRequests.get(i.orderId); if (r) r.status = 'refunded'
      if (o.prodigi_order_id || ['placed', 'in_production', 'shipped', 'delivered'].includes(o.status)) return 'refunded_after_placement'
      if (['awaiting_artwork', 'paid', 'withheld', 'error'].includes(o.status)) o.status = 'cancelled'
      s.pinned_at = null; s.expires_at = iso(clock() + 7 * 864e5)
      return 'cancelled'
    },
    async releaseSession(orderId) { const s = [...sessions.values()].find(x => x.order_id === orderId); if (s?.pinned_at) { s.pinned_at = null; s.expires_at = iso(clock() + 7 * 864e5) } },
  }
  return Object.assign(store, { ownedArtwork, sessions, batches, previews, packs, orders, lines, compositions, portfolios, refunds, refundRequests, compositionJobs })
}
