// lib/v1/gift/service.ts
//
// The Gift Wizard backend: owned sessions, product selection, hybrid effect selection, free-then-paid six-preview
// batches, resumable and idempotent generation, and retention. Every external effect (storage, source analysis, the
// NB2.1 render, the watermark) arrives through GiftDeps, so this is tested without any network or paid call.
//
// WHAT THIS DOES NOT DO (later phases): product-specific composition approval, checkout, the artwork unlock grant.

import { randomUUID, createHash } from 'node:crypto'
import sharp from 'sharp'
import { allProducts, catalogVersion } from '../print/catalog'
import { planFor, type PlanContext } from './composition-plan'
import { resolveFrozenProduct } from './frozen'
import { decodeSource } from '../foyer/foyer-source'
import { adaptationValidationFor, BATCH_SIZE, FREE_BATCHES, MASTER_ASPECT_DEFAULT, MAX_COPIES, MAX_PARALLEL_RENDERS, PACK_PRICE_CENTS, RETENTION, STORAGE } from './policy'
import { EffectSelectionError, fillEffects, remainingEffectCount } from './effects'
import { StoreError, byNewest, type BatchRec, type GiftStore, type PreviewRec, type SessionRec } from './store'
import { GIFT_CONTRACT_VERSION, type BatchRequest, type BatchView, type GiftLine, type LineGeometry, type NextBatch, type PreviewView, type Series, type SessionView } from './types'

export type GiftErrorCode =
  | 'image_b64_required' | 'image_too_large' | 'image_not_base64' | 'image_unreadable'
  | 'age_restricted' | 'unsupported_subject' | 'analysis_unavailable'
  | 'invalid_lines' | 'product_not_available' | 'invalid_quantity' | 'duplicate_line'
  | 'invalid_idempotency_key' | 'invalid_effect_selection' | 'effect_already_used' | 'not_enough_effects'
  | 'session_not_found' | 'payment_required' | 'previous_batch_incomplete' | 'session_expired' | 'generation_unavailable'
  // purchase before generation (migration 048)
  | 'disclosure_required' | 'no_lines' | 'invalid_address' | 'invalid_email' | 'product_not_available_for_artwork' | 'fulfilment_unavailable'
  | 'shipping_quote_failed' | 'order_already_paid' | 'order_persist_failed' | 'checkout_unavailable' | 'lines_locked'
  | 'order_payment_required' | 'order_refunded' | 'refund_pending' | 'order_not_awaiting_artwork' | 'preview_not_ready' | 'correction_limit'
  | 'compositions_not_approved' | 'artwork_not_selected' | 'refund_not_available_after_manufacturing' | 'order_not_paid' | 'line_not_found'
  // product mockup and frozen geometry
  | 'disclosure_version_required' | 'disclosure_version_mismatch' | 'rate_limited'
  | 'geometry_snapshot_invalid' | 'geometry_snapshot_unavailable' | 'stale_composition' | 'mockup_failed' | 'mockup_renderer_unavailable' | 'mockup_configuration_mismatch'
  | 'composition_failed' | 'composition_geometry_mismatch' | 'repair_claim_lost' | 'repair_not_consistent' | 'composition_not_found' | 'order_has_no_lines' | 'order_not_found' | 'order_not_payable' | 'session_already_has_order'
  | 'order_session_mismatch' | 'invalid_refund_request' | 'payment_not_confirmed' | 'session_retained'
const STATUS: Partial<Record<GiftErrorCode, number>> = {
  image_b64_required: 400, image_too_large: 400, image_not_base64: 400, image_unreadable: 400, age_restricted: 403, unsupported_subject: 422, analysis_unavailable: 503,
  invalid_lines: 400, product_not_available: 409, invalid_quantity: 400, duplicate_line: 400, invalid_idempotency_key: 400, invalid_effect_selection: 400,
  effect_already_used: 400, not_enough_effects: 409, session_not_found: 404, payment_required: 402, previous_batch_incomplete: 409, session_expired: 409, generation_unavailable: 503,
  disclosure_required: 400, no_lines: 400, invalid_address: 400, invalid_email: 400, product_not_available_for_artwork: 409, fulfilment_unavailable: 409,
  shipping_quote_failed: 502, order_already_paid: 409, order_persist_failed: 500, checkout_unavailable: 503, lines_locked: 409,
  order_payment_required: 402, order_refunded: 409, refund_pending: 409, order_not_awaiting_artwork: 409, preview_not_ready: 409, correction_limit: 409,
  compositions_not_approved: 409, artwork_not_selected: 409, refund_not_available_after_manufacturing: 409, order_not_paid: 409, line_not_found: 404,
  composition_failed: 502, composition_geometry_mismatch: 409, repair_claim_lost: 409, repair_not_consistent: 409, composition_not_found: 404, order_has_no_lines: 409, order_not_found: 404, order_not_payable: 409, session_already_has_order: 409,
  order_session_mismatch: 409, invalid_refund_request: 400, payment_not_confirmed: 409, session_retained: 409,
  disclosure_version_required: 400, disclosure_version_mismatch: 409, rate_limited: 429,
  geometry_snapshot_invalid: 409, geometry_snapshot_unavailable: 409, stale_composition: 409, mockup_failed: 502, mockup_renderer_unavailable: 503, mockup_configuration_mismatch: 409,
}
export class GiftError extends Error {
  readonly status: number
  constructor(public code: GiftErrorCode) { super(code); this.status = STATUS[code] ?? 400 }
}

/** Rules enforced in the database arrive as StoreError; the API speaks GiftError. */
export function fromStoreError(e: unknown): never {
  if (e instanceof StoreError) throw new GiftError((e.code === 'six_distinct_effects_required' ? 'invalid_effect_selection' : e.code) as GiftErrorCode)
  throw e
}

export interface GiftStorage {
  put(path: string, body: Buffer, contentType: string): Promise<void>
  get(path: string): Promise<Buffer | null>
  remove(paths: string[]): Promise<void>
  signedUrl(path: string, seconds: number): Promise<string | null>
}
export type SourceAnalysis =
  | { status: 'supported'; series: Series; peopleCount: number | null }
  | { status: 'unsupported' }
  | { status: 'age_restricted' }
export interface GiftDeps {
  store: GiftStore
  storage: GiftStorage
  /** Existing classifier, face/age check and (Groups) people count; see real.ts. */
  analyze(input: { b64: string; bytes: Buffer }): Promise<SourceAnalysis>
  /** ONE NB2.1 render of the selected effect through the existing series generate route; returns the CLEAN master. */
  generate(input: { series: Series; sourceB64: string; effectId: string; aspect: string; userId: string; peopleCount: number | null; productComposition?: boolean; referenceB64?: string }): Promise<{ imageB64: string }>
  /** Baked-watermark customer preview (JPEG) from the clean master. Must fail rather than return an unmarked image. */
  watermark(masterB64: string): Promise<Buffer>
  /** One product composition of the selected master: background extension only, never a crop (compose.ts). */
  compose?(input: { masterB64: string; size: import('../print/sku-map').PrintSize; finish: import('../print/sku-map').PrintFinish }): Promise<{ image: Buffer; width: number; height: number; fit: 'exact' | 'resample' | 'extend'; outpainted: boolean }>
  /** The existing Node/Sharp product-mockup compositor behind one server-owned boundary (mockup.ts). Absent: the mockup endpoint answers 503. */
  mockup?: import('./mockup').MockupRenderer
  /** Release an approved order to the existing fulfilment pipeline (completePrintOrder). Failure is deferred, never fatal. */
  kick?(orderId: string): Promise<unknown>
  clock?: () => number
  newId?: () => string
}
const now = (d: GiftDeps) => (d.clock ?? Date.now)()
const iso = (ms: number) => new Date(ms).toISOString()
const DAY = 864e5

/** The aspect every master for this session is generated at. Groups: only some formats are allowed for a given head count. */
export function masterAspectFor(series: Series, peopleCount: number | null): string {
  if (series === 'groups') return peopleCount !== null && peopleCount <= 3 ? '2:3' : '3:2'
  return MASTER_ASPECT_DEFAULT[series]
}

// ── sessions ────────────────────────────────────────────────────────────

export async function createSession(deps: GiftDeps, input: { userId: string; imageB64: unknown }): Promise<SessionView> {
  const src = await decodeSource(input.imageB64)
  if ('error' in src) throw new GiftError(src.error as GiftErrorCode)
  // Count this attempt BEFORE the paid analysis runs. The ledger has no link to sessions, so deleting or recreating sessions cannot reset it.
  try { await deps.store.recordSessionAttempt(input.userId, createHash('sha256').update(src.bytes).digest('hex')) } catch (e) { fromStoreError(e) }
  let analysis: SourceAnalysis
  try { analysis = await deps.analyze({ b64: src.b64, bytes: src.bytes }) } catch { throw new GiftError('analysis_unavailable') }
  if (analysis.status === 'age_restricted') throw new GiftError('age_restricted')     // nothing has been stored
  if (analysis.status !== 'supported') throw new GiftError('unsupported_subject')

  // Stored as a re-encoded JPEG: orientation is applied and EXIF (including location) is dropped.
  const jpeg = await sharp(src.bytes).rotate().jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true })
  const id = (deps.newId ?? randomUUID)()
  const path = STORAGE.source(id)
  await deps.storage.put(path, jpeg.data, 'image/jpeg')
  const t = now(deps)
  const rec: SessionRec = {
    id, user_id: input.userId, status: 'active', source_path: path, source_sha256: createHash('sha256').update(src.bytes).digest('hex'),
    source_width: jpeg.info.width, source_height: jpeg.info.height, series: analysis.series, analysis: { peopleCount: analysis.peopleCount },
    lines: [], master_aspect: masterAspectFor(analysis.series, analysis.peopleCount),
    created_at: iso(t), last_activity_at: iso(t), expires_at: iso(t + RETENTION.sessionIdleDays * DAY), pinned_at: null,
    order_id: null, free_batches_granted: 0, artwork_preview_id: null, approved_at: null, refund_requested_at: null, refunded_at: null,
    unlock_portfolio_id: null, disclosure_version: null, disclosure_accepted_at: null,
  }
  try { await deps.store.createSession(rec) } catch (e) { await deps.storage.remove([path]).catch(() => {}); throw e }
  return buildView(deps, rec)
}

export async function owned(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionRec> {
  const rec = typeof sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(sessionId) ? await deps.store.getSession(sessionId, userId) : null
  if (!rec) throw new GiftError('session_not_found')
  return rec
}

export async function getSessionView(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  return buildView(deps, await owned(deps, userId, sessionId))
}

/** Replaces the product selection. Only launch products are accepted; geometry comes from the canonical catalog. */
export async function setLines(deps: GiftDeps, userId: string, sessionId: string, lines: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.order_id) throw new GiftError('lines_locked')            // once an order exists the purchased products are frozen
  if (!Array.isArray(lines) || lines.length > 20) throw new GiftError('invalid_lines')
  const catalog = new Map(allProducts().map(p => [p.productId, p]))
  const seen = new Set<string>(), out: GiftLine[] = []
  for (const l of lines as any[]) {
    if (!l || typeof l.lineId !== 'string' || !/^[\w-]{1,40}$/.test(l.lineId) || typeof l.productId !== 'string') throw new GiftError('invalid_lines')
    if (seen.has(l.lineId)) throw new GiftError('duplicate_line')
    seen.add(l.lineId)
    const p = catalog.get(l.productId)
    if (!p || p.status !== 'launch') throw new GiftError('product_not_available')
    if (!Number.isInteger(l.copies) || l.copies < 1 || l.copies > MAX_COPIES) throw new GiftError('invalid_quantity')
    out.push({ lineId: l.lineId, productId: p.productId, size: p.size, copies: l.copies })   // size is the catalog's, never the client's
  }
  const t = now(deps)
  const patch = { lines: out, last_activity_at: iso(t), expires_at: extend(rec, t) }
  await deps.store.patchSession(rec.id, userId, patch)
  return buildView(deps, { ...rec, ...patch })
}

function extend(rec: SessionRec, t: number): string {
  const ceiling = Date.parse(rec.created_at) + RETENTION.sessionMaxDays * DAY
  return iso(Math.min(ceiling, Math.max(Date.parse(rec.expires_at), t + RETENTION.sessionIdleDays * DAY)))
}

// ── batches ─────────────────────────────────────────────────────────────

const IDEMPOTENCY = /^[\w.:-]{8,80}$/

/** Reserve the next batch (free, or paid from a verified pack) and generate it. Safe to repeat with the same key. */
export async function startBatch(deps: GiftDeps, userId: string, sessionId: string, req: BatchRequest): Promise<{ batch: BatchView; session: SessionView; complete: boolean }> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof req?.idempotencyKey !== 'string' || !IDEMPOTENCY.test(req.idempotencyKey)) throw new GiftError('invalid_idempotency_key')
  if (req.effectIds !== undefined && !Array.isArray(req.effectIds)) throw new GiftError('invalid_effect_selection')
  const batches = await deps.store.listBatches(rec.id)
  const repeat = batches.find(b => b.batch.idempotency_key === req.idempotencyKey)
  let batchRec: BatchRec
  if (repeat) {
    batchRec = repeat.batch                                  // same key: the same batch, nothing charged, nothing reselected
  } else {
    if (!rec.series) throw new GiftError('unsupported_subject')
    const used = batches.flatMap(b => b.previews.map(p => p.effect_id))
    let effects: string[]
    try { effects = fillEffects(rec.series, req.effectIds, used) }
    catch (e) { if (e instanceof EffectSelectionError) throw new GiftError(e.code); throw e }
    try { batchRec = (await deps.store.reserveBatch({ sessionId: rec.id, userId, key: req.idempotencyKey, effects })).batch }
    catch (e) { fromStoreError(e) }
  }
  return runBatch(deps, userId, rec, batchRec.batch_index)
}

/** Generate whatever in a batch is not ready: pending, failed (attempts left) or lapsed. Ready previews are never touched. */
export async function runBatch(deps: GiftDeps, userId: string, recIn: SessionRec, batchIndex: number): Promise<{ batch: BatchView; session: SessionView; complete: boolean }> {
  const rec = (await deps.store.getSession(recIn.id, userId)) ?? recIn
  const all = await deps.store.listBatches(rec.id)
  const target = all.find(b => b.batch.batch_index === batchIndex)
  if (!target) throw new GiftError('session_not_found')
  const todo = target.previews.filter(p => p.status !== 'ready')
  if (todo.length && rec.series && rec.source_path) {
    const source = await deps.storage.get(rec.source_path)
    if (!source) throw new GiftError('generation_unavailable')
    const sourceB64 = source.toString('base64')
    let next = 0
    const worker = async () => {
      while (next < todo.length) {
        const p = todo[next++]
        const claimed = await deps.store.claimPreview(p.id, userId)        // one worker per preview; a ready or capped one is refused
        if (claimed) await renderOne(deps, rec, claimed, sourceB64)
      }
    }
    await Promise.all(Array.from({ length: Math.min(MAX_PARALLEL_RENDERS, todo.length) }, worker))
  }
  const session = await getSessionView(deps, userId, rec.id)
  const batch = session.batches.find(b => b.batchIndex === batchIndex)!
  return { batch, session, complete: batch.complete }
}

async function renderOne(deps: GiftDeps, rec: SessionRec, p: PreviewRec, sourceB64: string): Promise<void> {
  try {
    const { imageB64 } = await deps.generate({ series: rec.series!, sourceB64, effectId: p.effect_id, aspect: rec.master_aspect ?? masterAspectFor(rec.series!, null), userId: rec.user_id, peopleCount: rec.analysis.peopleCount ?? null })
    const bytes = Buffer.from(imageB64, 'base64')
    const md = await sharp(bytes).metadata()
    if (!md.width || !md.height) throw new Error('master_unreadable')
    const ext = md.format === 'jpeg' ? 'jpg' : 'png'
    const masterPath = STORAGE.master(rec.id, p.id, ext), previewPath = STORAGE.preview(rec.id, p.id)
    const marked = await deps.watermark(imageB64)                             // throws rather than return an unmarked image
    await deps.storage.put(masterPath, bytes, ext === 'jpg' ? 'image/jpeg' : 'image/png')
    await deps.storage.put(previewPath, marked, 'image/jpeg')
    await deps.store.markReady(p.id, { master_path: masterPath, preview_path: previewPath, width: md.width, height: md.height })
  } catch (e: any) {
    await deps.store.markFailed(p.id, String(e?.message ?? 'generation_failed')).catch(() => {})
  }
}

export async function getBatchView(deps: GiftDeps, userId: string, sessionId: string, batchIndex: number): Promise<BatchView> {
  const view = await getSessionView(deps, userId, sessionId)
  const b = view.batches.find(x => x.batchIndex === batchIndex)
  if (!b) throw new GiftError('session_not_found')
  return b
}

// ── views ───────────────────────────────────────────────────────────────

async function buildView(deps: GiftDeps, rec: SessionRec): Promise<SessionView> {
  const all = await deps.store.listBatches(rec.id)
  const packs = await deps.store.paidPackCount(rec.user_id)
  const order = rec.order_id ? await deps.store.getOrder(rec.order_id) : null
  const comps = rec.order_id ? await deps.store.listCompositions(rec.id) : []
  const orderLines = rec.order_id ? await deps.store.orderLines(rec.order_id) : []
  const batches: BatchView[] = []
  for (const { batch, previews } of all) {
    const views: PreviewView[] = []
    for (const p of previews) {
      const url = p.status === 'ready' && p.preview_path ? await deps.storage.signedUrl(p.preview_path, 3600) : null
      views.push({ previewId: p.id, slot: p.slot, effectId: p.effect_id, status: p.status, url, width: p.width, height: p.height, retryable: p.status === 'failed' && p.attempts < 3 })
    }
    batches.push({ batchIndex: batch.batch_index, kind: batch.kind, complete: views.length === BATCH_SIZE && views.every(v => v.status === 'ready'), previews: views })
  }
  const used = all.flatMap(b => b.previews.map(p => p.effect_id))
  const catalog = allProducts()
  const planCtx: PlanContext = { series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null, masterAspect: rec.master_aspect ?? '1:1' }
  // Once the order exists, geometry comes from the snapshot frozen at checkout, never from today's catalog (see frozen.ts).
  const orderItems = order?.items ?? []
  const planned = rec.lines.flatMap(l => {
    const ol = orderLines.find(x => x.line_id === l.lineId)
    const fr = ol ? resolveFrozenProduct(orderItems, ol, catalog) : null
    if (fr && !fr.ok) return []                                     // an unusable snapshot is never replaced by a guess; compositions refuse it
    const p = fr ? fr.product : catalog.find(x => x.productId === l.productId)
    const plan = p && rec.series ? planFor(p, planCtx) : null
    return p && plan ? [{ l, p, plan, source: (fr ? fr.source : 'catalog') as 'catalog' | 'frozen' | 'legacy_catalog', frozenVersion: fr && fr.ok ? fr.catalogVersion : null }] : []
  })
  const sharing = (key: string, lineId: string) => planned.filter(x => x.plan.geometryKey === key && x.l.lineId !== lineId).map(x => x.l.lineId)
  const geometries: LineGeometry[] = planned.map(({ l, p, plan, source, frozenVersion }) => ({
    lineId: l.lineId, productId: p.productId, pictureAspect: p.requirements.pictureAspect, orientation: p.requirements.skuOrientation, requiredPx: p.requirements.finalPx,
    picturePx: p.requirements.picturePx, wrapPx: p.requirements.wrapPx, geometryKey: plan.geometryKey, sharedWithLineIds: sharing(plan.geometryKey, l.lineId),
    method: plan.method, fit: plan.fit, extensionFraction: plan.extensionFraction, generationAspect: plan.generationAspect,
    sku: p.sku, geometrySource: source, frozenCatalogVersion: frozenVersion, adaptationValidation: adaptationValidationFor(rec.series, plan.method),
  }))
  const incomplete = batches.some(b => !b.complete)
  const free = await deps.store.freeStatus(rec.id, rec.user_id)            // FREE previews: a server-controlled allocation, independent of any purchase (migration 050)
  const expired = rec.status !== 'active' || (Date.parse(rec.expires_at) < now(deps) && !rec.pinned_at)
  const paid = !!order?.paid_at && !['created', 'cancelled'].includes(order.status)
  let nextBatch: NextBatch
  if (expired) nextBatch = { kind: 'blocked', reason: 'session_expired' }
  else if (rec.refunded_at) nextBatch = { kind: 'blocked', reason: 'order_refunded' }
  else if (rec.refund_requested_at) nextBatch = { kind: 'blocked', reason: 'refund_pending' }
  else if (order && !['created', 'awaiting_artwork', 'cancelled'].includes(order.status)) nextBatch = { kind: 'blocked', reason: 'order_not_awaiting_artwork' }     // generation needs no purchase, but ends at approval
  else if (incomplete) nextBatch = { kind: 'blocked', reason: 'previous_batch_incomplete' }
  else if (rec.series && remainingEffectCount(rec.series, used) < BATCH_SIZE) nextBatch = { kind: 'blocked', reason: 'no_effects_remaining' }
  else if (free.available) nextBatch = { kind: 'free' }
  else if (packs > 0) nextBatch = { kind: 'paid', packAvailable: true }
  else nextBatch = { kind: 'payment_required', amountCents: PACK_PRICE_CENTS as 299, currency: 'USD' }
  return {
    contractVersion: GIFT_CONTRACT_VERSION, sessionId: rec.id,
    source: { sourceRef: rec.id, width: rec.source_width, height: rec.source_height, series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null },
    lines: rec.lines, geometries, masterAspect: rec.master_aspect ?? '', batches, usedEffectIds: used,
    entitlement: { freeBatchesTotal: FREE_BATCHES, freeBatchesUsed: free.used, paidPacksAvailable: packs, freeAvailable: free.available, freeBlockedReason: free.reason },
    nextBatch, expiresAt: rec.expires_at, catalogVersion: catalogVersion(catalog),
    order: orderView(rec, order),
    artworkPreviewId: rec.artwork_preview_id,
    compositions: await Promise.all(orderLines.map(async l => {
      const mine = comps.filter(c => c.line_id === l.line_id && c.preview_id === rec.artwork_preview_id && c.status !== 'superseded' && c.status !== 'failed').sort(byNewest)[0]
      const g = geometries.find(x => x.lineId === l.line_id)
      const gp = planned.find(x => x.l.lineId === l.line_id)
      return {
        lineId: l.line_id, productId: l.product_id, geometryKey: mine?.geometry_key ?? g?.geometryKey ?? null, method: (mine?.method ?? g?.method ?? null) as 'deterministic' | 'generated' | null,
        generationAspect: mine?.generation_aspect ?? g?.generationAspect ?? null, sharedWithLineIds: g?.sharedWithLineIds ?? [], picturePx: gp?.p.requirements.picturePx ?? null,
        sku: gp?.p.sku ?? null, geometrySource: gp?.source ?? 'catalog', adaptationValidation: adaptationValidationFor(rec.series, (mine?.method ?? g?.method ?? null) as 'deterministic' | 'generated' | null),
        generationMode: (mine?.generation_mode ?? null) as 'none' | 'favorite_reference' | 'photo_regeneration' | null, sourceArtworkId: mine ? mine.preview_id : null, status: (mine ? (mine.status === 'approved' ? 'approved' : 'ready') : 'none') as 'none' | 'ready' | 'approved',
        compositionId: mine?.id ?? null, attempt: mine?.attempt ?? 0, correctionsRemaining: Math.max(0, 1 - l.corrections_used),
        previewUrl: mine?.preview_path ? await deps.storage.signedUrl(mine.preview_path, 3600) : null, width: mine?.width ?? null, height: mine?.height ?? null,
        fit: ((mine?.plan as { fit?: string } | undefined)?.fit ?? null) as 'exact' | 'resample' | 'extend' | null,
      }
    })),
  }
}

function orderView(rec: SessionRec, order: Awaited<ReturnType<GiftDeps['store']['getOrder']>>): SessionView['order'] {
  const state: SessionView['order']['state'] =
    rec.refunded_at ? 'refunded'
    : rec.refund_requested_at ? 'refund_requested'
    : !order ? 'none'
    : order.status === 'created' ? 'checkout_open'
    : order.status === 'awaiting_artwork' ? 'awaiting_artwork'
    : order.status === 'cancelled' ? 'cancelled'
    : ['placed', 'in_production', 'shipped', 'delivered'].includes(order.status) ? 'with_lab'
    // 'approved' means the customer approved the artwork and the order was released: paid (or held or errored afterwards) WITH an approval time.
    // Any other status, or one of those without an approval, is unexpected and is reported as such instead of being mistaken for approval.
    : ['paid', 'withheld', 'error'].includes(order.status) && rec.approved_at ? 'approved'
    : 'needs_attention'
  return {
    orderId: rec.order_id, state, freeBatchesGranted: FREE_BATCHES, approvedAt: rec.approved_at, unlockPortfolioId: rec.unlock_portfolio_id,
    totalCents: order?.retail_total_cents ?? null, disclosureVersion: rec.disclosure_version,
  }
}

// ── retention ───────────────────────────────────────────────────────────

async function removeObjects(deps: GiftDeps, rec: SessionRec): Promise<void> {
  const all = await deps.store.listBatches(rec.id)
  const comps = await deps.store.listCompositions(rec.id)
  const paths = [rec.source_path, ...all.flatMap(b => b.previews.flatMap(p => [p.master_path, p.preview_path])), ...comps.flatMap(c => [c.composed_path, c.preview_path, (c.plan as { mockup?: { path?: string } }).mockup?.path])]
    .filter((x): x is string => !!x)
  if (paths.length) await deps.storage.remove([...new Set(paths)])         // shared compositions point at the same files: remove each once
}

/** The customer deleting their own session: objects first, then rows, so a storage failure leaves the rows to retry. */
export async function deleteSessionNow(deps: GiftDeps, userId: string, sessionId: string): Promise<void> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.pinned_at) throw new GiftError('session_retained')     // a paid order is waiting on this session: retained until resolved
  await removeObjects(deps, rec)
  await deps.store.deleteSession(rec.id)
}

/** Sweep: expired, unpinned sessions lose their source photo, masters, previews and rows. Paid packs are never touched. */
export async function purgeExpired(deps: GiftDeps, limit = 25): Promise<{ purged: number; failed: number }> {
  let purged = 0, failed = 0
  for (const rec of await deps.store.expiredSessions(iso(now(deps)), limit)) {
    try { await removeObjects(deps, rec); await deps.store.deleteSession(rec.id); purged++ } catch { failed++ }
  }
  return { purged, failed }
}

/** Resume a batch: only previews that are not ready run, and nothing is reserved or charged. */
export async function retryBatch(deps: GiftDeps, userId: string, sessionId: string, batchIndex: number) {
  const rec = await owned(deps, userId, sessionId)
  if (!Number.isInteger(batchIndex) || batchIndex < 1) throw new GiftError('session_not_found')
  return runBatch(deps, userId, rec, batchIndex)
}
