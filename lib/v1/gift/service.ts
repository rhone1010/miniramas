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
import { planContextFor, planFor, type PlanContext } from './composition-plan'
import { draftOrderLines, resolveFrozenProduct } from './frozen'
import { decodeSource } from '../foyer/foyer-source'
import { approvedSceneFor, requireApprovedScene } from './presentation'
import { realSceneRenderer } from './mockup-real'
import { COMPOSITION_MAX_ATTEMPTS, adaptationValidationFor, BATCH_SIZE, FREE_BATCHES, MASTER_ASPECT_DEFAULT, MAX_COPIES, PACK_PRICE_CENTS, RATE_LIMIT_PAUSE_MS, RATE_LIMIT_RETRY_WORKERS, parallelRenders, RETENTION, STORAGE, FREE_GENERATIONS, GENERATIONS_PER_PACK, GENERATION_MAX_ATTEMPTS, MAX_INFLIGHT_GENERATIONS, newSessionFlow } from './policy'
import { bindGenerationLines } from './generations'
import { frameColorsFor, lineFrameColor, resolveFrameColor } from './frame-colors'
import { EffectSelectionError, fillEffects, remainingEffectCount } from './effects'
import type { GenerationAllowance, GenerationRec } from './generation-store'
import { StoreError, byNewest, correctionUsed, finalizedAt, type BatchRec, type GiftStore, type PreviewRec, type SessionRec } from './store'
import { GIFT_CONTRACT_VERSION, type CompositionView, type BatchGeneration, type RestoreResponse, type RestoreStep, type BatchRequest, type BatchView, type GiftLine, type LineGeometry, type NextBatch, type PreviewView, type Series, type SessionView, type SubjectGender, type GenerationView, type GenerationsView } from './types'

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
  | 'final_approval_required' | 'finalization_unavailable' | 'artwork_not_found' | 'artwork_not_compatible' | 'artwork_unavailable' | 'collection_session_no_generation' | 'collection_unavailable'
  // product mockup and frozen geometry
  | 'disclosure_version_required' | 'disclosure_version_mismatch' | 'rate_limited'
  | 'geometry_snapshot_invalid' | 'geometry_snapshot_unavailable' | 'stale_composition' | 'mockup_failed' | 'mockup_renderer_unavailable' | 'mockup_configuration_mismatch'
  | 'composition_failed' | 'composition_geometry_mismatch' | 'repair_claim_lost' | 'repair_not_consistent' | 'composition_not_found' | 'order_has_no_lines' | 'order_not_found' | 'order_not_payable' | 'session_already_has_order'
  | 'generations_unavailable' | 'effect_not_chosen' | 'effect_fixed' | 'flow_not_generations' | 'legacy_batches_closed' | 'generation_in_progress' | 'generation_not_found' | 'generation_not_ready' | 'generation_not_accepted' | 'generation_changed' | 'invalid_frame_color' | 'invalid_composition' | 'finish_required' | 'finish_not_accepted' | 'product_aspect_unsupported'
  | 'order_session_mismatch' | 'invalid_refund_request' | 'payment_not_confirmed' | 'session_retained'
const STATUS: Partial<Record<GiftErrorCode, number>> = {
  image_b64_required: 400, image_too_large: 400, image_not_base64: 400, image_unreadable: 400, age_restricted: 403, unsupported_subject: 422, analysis_unavailable: 503,
  invalid_lines: 400, product_not_available: 409, invalid_quantity: 400, duplicate_line: 400, invalid_idempotency_key: 400, invalid_effect_selection: 400,
  effect_already_used: 400, not_enough_effects: 409, session_not_found: 404, payment_required: 402, previous_batch_incomplete: 409, session_expired: 409, generation_unavailable: 503,
  disclosure_required: 400, no_lines: 400, invalid_address: 400, invalid_email: 400, product_not_available_for_artwork: 409, fulfilment_unavailable: 409,
  shipping_quote_failed: 502, order_already_paid: 409, order_persist_failed: 500, checkout_unavailable: 503, lines_locked: 409,
  final_approval_required: 409, finalization_unavailable: 503, artwork_not_found: 404, artwork_not_compatible: 409, artwork_unavailable: 503, collection_session_no_generation: 409, collection_unavailable: 503, order_payment_required: 402, order_refunded: 409, refund_pending: 409, order_not_awaiting_artwork: 409, preview_not_ready: 409, correction_limit: 409,
  compositions_not_approved: 409, artwork_not_selected: 409, refund_not_available_after_manufacturing: 409, order_not_paid: 409, line_not_found: 404,
  composition_failed: 502, composition_geometry_mismatch: 409, repair_claim_lost: 409, repair_not_consistent: 409, composition_not_found: 404, order_has_no_lines: 409, order_not_found: 404, order_not_payable: 409, session_already_has_order: 409,
  order_session_mismatch: 409, invalid_refund_request: 400, payment_not_confirmed: 409, session_retained: 409,
  generations_unavailable: 503, effect_not_chosen: 409, effect_fixed: 409, flow_not_generations: 409, legacy_batches_closed: 409, generation_in_progress: 429, generation_not_found: 404, generation_not_ready: 409, generation_not_accepted: 409, generation_changed: 409, invalid_frame_color: 400, invalid_composition: 400, finish_required: 400, finish_not_accepted: 409, product_aspect_unsupported: 409,
  disclosure_version_required: 400, disclosure_version_mismatch: 409, rate_limited: 429,
  geometry_snapshot_invalid: 409, geometry_snapshot_unavailable: 409, stale_composition: 409, mockup_failed: 502, mockup_renderer_unavailable: 503, mockup_configuration_mismatch: 409,
}
export class GiftError extends Error {
  readonly status: number
  /** Extra, customer-safe facts the response may carry next to the code (e.g. where to continue). Never internal detail. */
  constructor(public code: GiftErrorCode, public details?: Record<string, unknown>) { super(code); this.status = STATUS[code] ?? 400 }
}

/** Rules enforced in the database arrive as StoreError; the API speaks GiftError. */
export function fromStoreError(e: unknown): never {
  if (e instanceof StoreError) throw new GiftError((e.code === 'six_distinct_effects_required' ? 'invalid_effect_selection' : e.code) as GiftErrorCode)
  throw e
}

/** The Portraits subject gender contract: only a stored 'female'/'male' is passed on; anything else (missing, malformed, old sessions) is 'unknown'; not applicable (pets, groups) is null. */
export function genderFor(series: Series | null, v: unknown): SubjectGender | null {
  if (series !== 'portraits') return null
  return v === 'female' || v === 'male' ? v : 'unknown'
}

export interface GiftStorage {
  put(path: string, body: Buffer, contentType: string): Promise<void>
  get(path: string): Promise<Buffer | null>
  remove(paths: string[]): Promise<void>
  signedUrl(path: string, seconds: number): Promise<string | null>
  /** Object paths directly under a directory prefix (e.g. 'gift/<id>/product-previews/'). Optional: used by cleanup for files no row points at. */
  list?(dirPrefix: string): Promise<string[]>
}
export type SourceAnalysis =
  | { status: 'supported'; series: Series; peopleCount: number | null; subjectGender?: SubjectGender }
  | { status: 'unsupported' }
  | { status: 'age_restricted' }
export interface GiftDeps {
  /** Compose product artwork before payment (a draft). Off in the approved journey: checkout, then compose. See scope.ts. */
  draftCompositions?: boolean
  store: GiftStore
  storage: GiftStorage
  /** Existing classifier, face/age check and (Groups) people count; see real.ts. */
  analyze(input: { b64: string; bytes: Buffer }): Promise<SourceAnalysis>
  /** ONE NB2.1 render of the selected effect through the existing series generate route; returns the CLEAN master. */
  generate(input: { series: Series; sourceB64: string; effectId: string; aspect: string; userId: string; peopleCount: number | null; productComposition?: boolean; exactAspect?: boolean; referenceB64?: string }): Promise<{ imageB64: string; generation?: import('./types').GenerationRecord }>
  /** Baked-watermark customer preview (JPEG) from the clean master. Must fail rather than return an unmarked image. */
  watermark(masterB64: string): Promise<Buffer>
  /** One product composition of the selected master: background extension only, never a crop (compose.ts). */
  compose?(input: { masterB64: string; size: import('../print/sku-map').PrintSize; finish: import('../print/sku-map').PrintFinish }): Promise<{ image: Buffer; width: number; height: number; fit: 'exact' | 'resample' | 'extend'; outpainted: boolean }>
  /** The existing Node/Sharp product-mockup compositor behind one server-owned boundary (mockup.ts). Absent: the mockup endpoint answers 503. */
  mockup?: import('./mockup').MockupRenderer
  /** My Collection: resolves an artwork the customer owns (ownership checked again in the database). Absent: the from-collection entrance answers 503. */
  collection?: CollectionPort
  /** Release an approved order to the existing fulfilment pipeline (completePrintOrder). Failure is deferred, never fatal. */
  kick?(orderId: string): Promise<unknown>
  clock?: () => number
  newId?: () => string
  /** Pause between the main pass and the gentle retry of rate-limited previews (tests make it instant). */
  pause?: (ms: number) => Promise<void>
}
/** An owned artwork as the Gift flow needs it. The clean original is read; nothing is ever written back to My Collection. */
export interface CollectionArtwork { previewId: string; portfolioId: string; series: Series; preset: string; bytes: Buffer; width: number; height: number; /** the customer's own photograph the piece was made from (needed to regenerate for a corrected composition) */ sourcePhoto: Buffer | null }
export interface CollectionPort { resolve(userId: string, previewId: string): Promise<CollectionArtwork> }
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
  const photoHash = createHash('sha256').update(src.bytes).digest('hex')
  try { await deps.store.recordSessionAttempt(input.userId, photoHash) } catch (e) {
    if (e instanceof StoreError && e.code === 'rate_limited') {
      // The limit is a reason to CONTINUE, not a dead end: point at this customer's own current session (the same photo's if there is one) so the Wizard can resume it.
      const t = now(deps), mine = (await deps.store.listSessions(input.userId, 5).catch(() => [] as SessionRec[])).filter(s => s.status === 'active' && (!!s.pinned_at || Date.parse(s.expires_at) >= t))
      const same = mine.find(s => s.source_sha256 === photoHash), pick = same ?? mine[0]
      throw new GiftError('rate_limited', pick ? { resumeSessionId: pick.id, samePhoto: !!same } : undefined)
    }
    fromStoreError(e)
  }
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
    source_width: jpeg.info.width, source_height: jpeg.info.height, series: analysis.series, analysis: { peopleCount: analysis.peopleCount, subjectGender: genderFor(analysis.series, analysis.subjectGender) },
    lines: [], master_aspect: masterAspectFor(analysis.series, analysis.peopleCount),
    created_at: iso(t), last_activity_at: iso(t), expires_at: iso(t + RETENTION.sessionIdleDays * DAY), pinned_at: null,
    order_id: null, free_batches_granted: 0, artwork_preview_id: null, approved_at: null, final_approved_at: null, refund_requested_at: null, refunded_at: null,
    unlock_portfolio_id: null, disclosure_version: null, disclosure_accepted_at: null,
    ...(newSessionFlow() === 'generations' ? { flow: 'generations' as const } : {}),
  }
  try { await deps.store.createSession(rec) } catch (e) { await deps.storage.remove([path]).catch(() => {}); fromStoreError(e) }
  return buildView(deps, rec)
}

/**
 * MY COLLECTION ENTRANCE (POST /api/v1/gift/sessions/from-collection). Starts a Gift session whose favorite is an artwork the customer already owns. The owned piece (ledger row,
 * portfolio, item, stored original) is only READ; the session gets its own copies of the files and its own records, so everything after this (product selection, adaptation,
 * preview, cart, checkout, corrections, approval, finalize, release) is exactly the photo entrance's. Idempotent: the same piece again returns the same live session. Needs migration 057.
 */
export async function createSessionFromCollection(deps: GiftDeps, input: { userId: string; previewId: unknown }): Promise<{ view: SessionView; created: boolean }> {
  if (!deps.collection) throw new GiftError('collection_unavailable')
  if (typeof input.previewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(input.previewId)) throw new GiftError('artwork_not_found')
  const ownedId = input.previewId.toLowerCase()
  const again = await deps.store.collectionSession(input.userId, ownedId)
  if (again) return { view: await buildView(deps, again), created: false }
  try { await deps.store.recordSessionAttempt(input.userId, createHash('sha256').update('collection:' + ownedId).digest('hex')) } catch (e) {        // the same limits as photo sessions, keyed by the piece
    if (e instanceof StoreError && e.code === 'rate_limited') throw new GiftError('rate_limited')
    fromStoreError(e)
  }
  let art: CollectionArtwork
  try { art = await deps.collection.resolve(input.userId, ownedId) } catch (e) {
    const m = e instanceof Error ? e.message : ''
    if (e instanceof GiftError) throw e
    if (/artwork_not_found|owned_artwork_required|portfolio_artwork_required/.test(m)) throw new GiftError('artwork_not_found')
    if (/square_artwork_required|compatible_artwork_required|artwork_not_compatible/.test(m)) throw new GiftError('artwork_not_compatible')
    throw new GiftError('artwork_unavailable')
  }
  // THE PHOTOGRAPH IS OPTIONAL. The customer's original is deleted after 60 days; the owned artwork is all this purchase needs. While the photograph still exists it is kept for the one thing only it can do (a
  // product-specific generated adaptation, and the head count that generation needs); once it is gone the session is the owned artwork alone and offers only the products that artwork can become without it.
  let analysis: SourceAnalysis | null = null, jpeg: { data: Buffer; info: { width: number; height: number } } | null = null
  if (art.sourcePhoto) {
    try { analysis = await deps.analyze({ b64: art.sourcePhoto.toString('base64'), bytes: art.sourcePhoto }) } catch { throw new GiftError('analysis_unavailable') }
    if (analysis.status === 'age_restricted') throw new GiftError('age_restricted')
    if (analysis.status !== 'supported') throw new GiftError('unsupported_subject')
    jpeg = await sharp(art.sourcePhoto).rotate().jpeg({ quality: 92 }).toBuffer({ resolveWithObject: true })
  }
  const id = (deps.newId ?? randomUUID)(), batchId = (deps.newId ?? randomUUID)(), previewId = (deps.newId ?? randomUUID)()
  const masterPath = STORAGE.master(id, previewId, 'png'), previewPath = STORAGE.preview(id, previewId), sourcePath = jpeg ? STORAGE.source(id) : null
  const marked = await deps.watermark(art.bytes.toString('base64'))                                                    // fails closed: never an unmarked customer view
  const peopleCount = analysis && art.series === 'groups' && analysis.series === 'groups' ? analysis.peopleCount : null
  const t = now(deps)
  const rec: SessionRec = {
    id, user_id: input.userId, status: 'active', source_path: sourcePath, source_sha256: createHash('sha256').update(art.sourcePhoto ?? art.bytes).digest('hex'),
    source_width: jpeg?.info.width ?? art.width, source_height: jpeg?.info.height ?? art.height, series: art.series, analysis: { peopleCount, subjectGender: genderFor(art.series, analysis?.series === 'portraits' ? analysis.subjectGender : undefined) },
    lines: [], master_aspect: collectionMasterAspect(art.width, art.height),
    created_at: iso(t), last_activity_at: iso(t), expires_at: iso(t + RETENTION.sessionIdleDays * DAY), pinned_at: null,
    order_id: null, free_batches_granted: 0, artwork_preview_id: null, approved_at: null, final_approved_at: null, refund_requested_at: null, refunded_at: null,
    unlock_portfolio_id: art.portfolioId, disclosure_version: null, disclosure_accepted_at: null, collection_preview_id: ownedId,
  }
  const files = [...(sourcePath ? [sourcePath] : []), masterPath, previewPath]
  try {
    if (sourcePath && jpeg) await deps.storage.put(sourcePath, jpeg.data, 'image/jpeg')
    await deps.storage.put(masterPath, art.bytes, 'image/png'); await deps.storage.put(previewPath, marked, 'image/jpeg')
    const out = await deps.store.createCollectionSession({ userId: input.userId, ownedPreviewId: ownedId, rec, batchId, previewId, master_path: masterPath, preview_path: previewPath, width: art.width, height: art.height })
    if (!out.created) { await deps.storage.remove(files).catch(() => {}); const existing = await deps.store.collectionSession(input.userId, ownedId); return { view: await buildView(deps, existing ?? rec), created: false } }      // lost a race: the winner's session
    return { view: await buildView(deps, { ...rec, artwork_preview_id: previewId }), created: true }
  } catch (e) { await deps.storage.remove(files).catch(() => {}); fromStoreError(e) }
}
/** The aspect the session works at for an owned piece: its own shape (the nearest standard ratio), never a regeneration ratio chosen from a series default. */
function collectionMasterAspect(w: number, h: number): string {
  const r = w / h
  if (Math.abs(r - 1) <= 0.02) return '1:1'
  const std: Array<[string, number]> = [['3:2', 1.5], ['2:3', 2 / 3], ['4:3', 4 / 3], ['3:4', 3 / 4], ['5:4', 1.25], ['4:5', 0.8], ['16:9', 16 / 9], ['9:16', 9 / 16]]
  return std.reduce((b, c) => Math.abs(c[1] - r) < Math.abs(b[1] - r) ? c : b)[0]
}

/**
 * TEMPORARY CHILDREN GATE for Groups (2026-10-26). Every Gift generation for a Groups session goes through here, so a session created BEFORE the gate (an unpaid restored session, a Collection
 * adaptation of an owned Groups piece) can never start new processing from a photograph with a minor in it. The photograph is analysed again by the same analyser and the same shared age policy
 * the intake uses; the series route re-checks too (groups-generator). Nothing already made is touched: paid orders, approved compositions, owned artwork and downloads are not read here.
 * If the photograph cannot be analysed the answer is 503 analysis_unavailable (retry), never a pass.
 */
export async function assertGroupsAdultsOnly(deps: GiftDeps, series: string | null, photo: Buffer | null | undefined): Promise<void> {
  if (series !== 'groups' || !photo) return
  let a: SourceAnalysis
  try { a = await deps.analyze({ b64: photo.toString('base64'), bytes: photo }) } catch { throw new GiftError('analysis_unavailable') }
  if (a.status === 'age_restricted') throw new GiftError('age_restricted')
}
/** deps.generate, behind the Groups children gate; the series route's own refusal is mapped to the same code. */
export async function generateGated(deps: GiftDeps, input: Parameters<GiftDeps['generate']>[0]): ReturnType<GiftDeps['generate']> {
  await assertGroupsAdultsOnly(deps, input.series, Buffer.from(input.sourceB64, 'base64'))
  try { return await deps.generate(input) } catch (e) { if (e instanceof Error && e.message === 'age_restricted') throw new GiftError('age_restricted'); throw e }
}

export async function owned(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionRec> {
  const rec = typeof sessionId === 'string' && /^[0-9a-f-]{36}$/i.test(sessionId) ? await deps.store.getSession(sessionId, userId) : null
  if (!rec) throw new GiftError('session_not_found')
  return rec
}

export async function getSessionView(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  return buildView(deps, await owned(deps, userId, sessionId))
}

/** The scene renderer's description function: the injected renderer's, else the real adapter's (the same manifests). */
const sceneDescriber = (deps: GiftDeps) => (id: string) => (deps.mockup?.scenes ?? realSceneRenderer).describe(id)

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
    if (requireApprovedScene() && !approvedSceneFor(p, sceneDescriber(deps))) throw new GiftError('product_not_available')       // no approved scene: it could not be shown or approved after payment (presentation.ts)
    if (!Number.isInteger(l.copies) || l.copies < 1 || l.copies > MAX_COPIES) throw new GiftError('invalid_quantity')
    // An owned artwork is adapted only by what it can still be adapted by: a product whose shape needs a generation cannot be chosen once the photograph that generation needs is gone.
    if (rec.collection_preview_id && rec.series && !planFor(p, planContextFor(rec))) throw new GiftError('product_not_available_for_artwork')
    if (l.generationId !== undefined && l.generationId !== null && (typeof l.generationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(l.generationId))) throw new GiftError('invalid_lines')
    // FRAME COLOUR (Gift Shop only): validated here against the product's exact Prodigi values; absent = black for a frame product; refused for a product with no frame colour.
    const before = rec.lines.find(x => x.lineId === l.lineId && x.productId === p.productId)
    const frameColor = resolveFrameColor(p, l.frameColor ?? (before ? lineFrameColor(p, before) : undefined))
    const sameFinish = !!before && lineFrameColor(p, before) === frameColor
    // A line keeps the generation it was bound to while its product AND finish are unchanged (the client need not resend it). A different finish is a different approval: the binding is dropped, and a
    // client that re-sends the generation for a new finish must say it explicitly accepts that finish (acceptFinish: true).
    const kept = sameFinish ? before?.generationId : undefined
    if (l.generationId && frameColorsFor(p) && l.frameColor === undefined) throw new GiftError('finish_required')              // binding a picture to a frame needs the colour stated, not assumed
    if (l.generationId && before?.generationId === l.generationId && !sameFinish && l.acceptFinish !== true) throw new GiftError('finish_not_accepted')
    const generationId: string | undefined = l.generationId || kept || undefined
    out.push({ lineId: l.lineId, productId: p.productId, size: p.size, copies: l.copies, ...(generationId ? { generationId } : {}), ...(frameColor ? { frameColor } : {}) })   // size is the catalog's, never the client's
  }
  // A composition belongs to a line AND its product: when a line is removed or its product changes, its reviewed composition (and approval) no longer applies.
  const before = new Map(rec.lines.map(l => [l.lineId, l.productId]))
  for (const c of await deps.store.listCompositions(rec.id)) {
    const nl = out.find(l => l.lineId === c.line_id)
    const finishChanged = !!nl && frameColorsFor(allProducts().find(x => x.productId === nl.productId) ?? { family: 'x' as any }) !== null && (c.plan as { frameColor?: string }).frameColor !== undefined && (c.plan as { frameColor?: string }).frameColor !== nl.frameColor
    if ((c.status !== 'ready' && c.status !== 'approved') || (nl?.productId === before.get(c.line_id) && !finishChanged)) continue
    await deps.store.patchComposition(c.id, { status: 'superseded', plan: { ...c.plan, supersededReason: 'line_changed' } })
  }
  await bindGenerationLines(deps, rec, out)                       // generations flow: an accepted generation becomes the line's approved composition (validated before anything is written)
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
  if (rec.collection_preview_id) throw new GiftError('collection_session_no_generation')           // an owned artwork has nothing to generate
  if (rec.flow === 'generations') throw new GiftError('legacy_batches_closed')                       // the product-first journey has no six-preview batches
  if (!repeat && finalizedAt(rec)) throw new GiftError('order_not_awaiting_artwork')       // final approval is recorded: no new generation (a repeat of an earlier request still answers)
  let batchRec: BatchRec
  if (repeat) {
    batchRec = repeat.batch                                  // same key: the same batch, nothing charged, nothing reselected
  } else {
    if (!rec.series) throw new GiftError('unsupported_subject')
    if (rec.series === 'groups' && rec.source_path) await assertGroupsAdultsOnly(deps, rec.series, await deps.storage.get(rec.source_path))          // before a free or paid batch is reserved: a refused session spends nothing
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
    await assertGroupsAdultsOnly(deps, rec.series, source)                  // a retry of a batch from a session older than the gate stops here, before any preview is claimed
    const sourceB64 = source.toString('base64')
    const pass = async (list: PreviewRec[], workers: number) => {
      let next = 0
      const worker = async () => {
        while (next < list.length) {
          const p = list[next++]
          const claimed = await deps.store.claimPreview(p.id, userId)        // one worker per preview; a ready or capped one is refused
          if (claimed) await renderOne(deps, rec, claimed, sourceB64)
        }
      }
      await Promise.all(Array.from({ length: Math.min(workers, list.length) }, worker))
    }
    await pass(todo, parallelRenders())                                      // every unfinished preview at once
    // Previews the provider turned away for RATE (nothing was generated or charged) get one gentle second pass with fewer workers; anything else stays failed for the retry route.
    const limited = (await deps.store.listBatches(rec.id)).find(b => b.batch.batch_index === batchIndex)!.previews.filter(p => p.status === 'failed' && p.attempts < 3 && isRateLimited(p.error))
    if (limited.length) { await (deps.pause ?? (ms => new Promise<void>(r => setTimeout(r, ms))))(RATE_LIMIT_PAUSE_MS); await pass(limited, RATE_LIMIT_RETRY_WORKERS) }
  }
  const session = await getSessionView(deps, userId, rec.id)
  const batch = session.batches.find(b => b.batchIndex === batchIndex)!
  return { batch, session, complete: batch.complete }
}

const isRateLimited = (error: string | null) => !!error && /\b429\b|rate.?limit|too many requests|throttl/i.test(error)

async function renderOne(deps: GiftDeps, rec: SessionRec, p: PreviewRec, sourceB64: string): Promise<void> {
  try {
    const { imageB64, generation } = await generateGated(deps, { series: rec.series!, sourceB64, effectId: p.effect_id, aspect: rec.master_aspect ?? masterAspectFor(rec.series!, null), userId: rec.user_id, peopleCount: rec.analysis.peopleCount ?? null })
    // The customer may have cancelled (deleted the project) or it may have expired while the provider worked: the paid result is then discarded and nothing is stored.
    const live = await deps.store.getSession(rec.id, rec.user_id).catch(() => rec)
    if (!live || live.status !== 'active') return
    const bytes = Buffer.from(imageB64, 'base64')
    const md = await sharp(bytes).metadata()
    if (!md.width || !md.height) throw new Error('master_unreadable')
    const ext = md.format === 'jpeg' ? 'jpg' : 'png'
    const masterPath = STORAGE.master(rec.id, p.id, ext), previewPath = STORAGE.preview(rec.id, p.id)
    const marked = await deps.watermark(imageB64)                             // throws rather than return an unmarked image
    await deps.storage.put(masterPath, bytes, ext === 'jpg' ? 'image/jpeg' : 'image/png')
    await deps.storage.put(previewPath, marked, 'image/jpeg')
    const stored = await deps.store.markReady(p.id, { master_path: masterPath, preview_path: previewPath, width: md.width, height: md.height, ...(generation ? { generation } : {}) })
    if (!stored) await deps.storage.remove([masterPath, previewPath]).catch(() => {})                 // the project was deleted between the check and now: leave nothing behind
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

async function generationsViewOf(deps: GiftDeps, rec: SessionRec, allRaw: Array<{ batch: BatchRec; previews: PreviewRec[] }>, expired: boolean, order: { status: string } | null): Promise<GenerationsView | null> {
  if (rec.flow !== 'generations' && !rec.collection_preview_id) return null
  let items: GenerationRec[] = [], allowance: GenerationAllowance = { freeUsed: 0, freeAvailable: true, reason: null, paidUnits: 0 }
  try { items = await deps.store.listGenerations(rec.id); allowance = await deps.store.generationAllowance(rec.id, rec.user_id) }
  catch (e) { if (!(e instanceof StoreError && e.code === 'generations_unavailable')) throw e; if (rec.flow === 'generations') throw e; return null }          // 059 not applied: a collection session simply has no generations yet
  const anchor = rec.artwork_preview_id ? allRaw.flatMap(b => b.previews).find(p => p.id === rec.artwork_preview_id) ?? null : null
  const clock = now(deps)
  const live = (g: GenerationRec) => g.status === 'pending' || (g.status === 'generating' && !!g.lease_until && Date.parse(g.lease_until) > clock)
  const inFlight = items.filter(live).length
  let blockedReason: GenerationsView['allowance']['blockedReason'] = null
  if (expired) blockedReason = 'session_expired'
  else if (rec.refunded_at) blockedReason = 'order_refunded'
  else if (rec.refund_requested_at) blockedReason = 'refund_pending'
  else if (order && !['created', 'awaiting_artwork', 'cancelled'].includes(order.status)) blockedReason = 'order_not_awaiting_artwork'
  else if (!anchor) blockedReason = 'effect_not_chosen'
  else if (inFlight >= MAX_INFLIGHT_GENERATIONS) blockedReason = 'generation_in_progress'
  const next: GenerationsView['allowance']['next'] = blockedReason ? 'blocked' : allowance.freeAvailable ? 'free' : allowance.paidUnits > 0 ? 'paid' : 'payment_required'
  const views: GenerationView[] = []
  for (const g of items) views.push(await generationViewOf(deps, g, clock))
  return {
    effectId: anchor?.effect_id ?? null, anchorPreviewId: anchor?.id ?? null, items: views,
    allowance: { freeTotal: FREE_GENERATIONS.perSession, freeUsed: allowance.freeUsed, freeRemaining: Math.max(0, FREE_GENERATIONS.perSession - allowance.freeUsed), freeAvailable: allowance.freeAvailable, freeBlockedReason: allowance.reason, paidUnits: allowance.paidUnits,
      next, blockedReason, packPriceCents: PACK_PRICE_CENTS as 299, generationsPerPack: GENERATIONS_PER_PACK, currency: 'USD' },
    inFlight, maxInFlight: MAX_INFLIGHT_GENERATIONS,
  }
}

export async function generationViewOf(deps: GiftDeps, g: GenerationRec, clock: number = now(deps)): Promise<GenerationView> {
  const ready = g.status === 'ready'
  const conform = (g.generation as { conform?: { method?: string; trimFraction?: number } } | null)?.conform
  const q = g.generation as { quality?: 'passed' | 'below_bar' | 'unscored'; attempts?: number } | null
  return {
    generationId: g.id, status: g.status === 'generating' && (!g.lease_until || Date.parse(g.lease_until) < clock) ? 'pending' : g.status, productId: g.product_id, geometryKey: g.geometry_key,
    width: ready ? g.width : null, height: ready ? g.height : null, url: ready && g.preview_path ? await deps.storage.signedUrl(g.preview_path, 3600) : null,
    kind: g.kind, accepted: !!g.accepted_at, acceptedAt: g.accepted_at, sha256: ready ? g.sha256 : null,
    quality: ready && q?.quality ? { status: q.quality, attempts: q.attempts ?? 1 } : null,
    conform: ready && conform ? { method: conform.method === 'trim' ? 'trim' : 'native', trimFraction: Number(conform.trimFraction ?? 0) } : null,
    retryable: g.status === 'failed' && g.attempts < GENERATION_MAX_ATTEMPTS, createdAt: g.created_at,
  }
}

async function buildView(deps: GiftDeps, rec: SessionRec): Promise<SessionView> {
  const allRaw = await deps.store.listBatches(rec.id)
  const all = allRaw.filter(b => b.batch.kind !== 'generation')          // the generation anchor is internal: the view exposes it as generations.anchorPreviewId
  const packs = await deps.store.paidPackCount(rec.user_id)
  const order = rec.order_id ? await deps.store.getOrder(rec.order_id) : null
  const comps = await deps.store.listCompositions(rec.id)         // drafts (reviewed before payment) have compositions too
  const jobs = await deps.store.listCompositionJobs(rec.id).catch(() => [])         // 055: what is being prepared, stalled or failed (empty until the migration is applied)
  const orderLines = rec.order_id ? await deps.store.orderLines(rec.order_id) : []
  const batches: BatchView[] = []
  const clockNow = now(deps)
  for (const { batch, previews } of all) {
    const views: PreviewView[] = []
    for (const p of previews) {
      const url = p.status === 'ready' && p.preview_path ? await deps.storage.signedUrl(p.preview_path, 3600) : null
      views.push({ previewId: p.id, slot: p.slot, effectId: p.effect_id, status: p.status, url, width: p.width, height: p.height, retryable: p.status === 'failed' && p.attempts < 3,
        quality: p.status === 'ready' && p.generation ? { status: p.generation.quality, attempts: p.generation.attempts } : null })
    }
    const complete = views.length === (batch.kind === 'collection' ? 1 : BATCH_SIZE) && views.every(v => v.status === 'ready')          // a collection batch is the one owned artwork
    const count = (s: PreviewRec['status']) => previews.filter(p => p.status === s).length
    batches.push({ batchIndex: batch.batch_index, kind: batch.kind, complete, previews: views, generation: generationOf(previews, complete, clockNow),
      progress: { ready: count('ready'), generating: count('generating'), pending: count('pending'), failed: count('failed') } })
  }
  const used = all.flatMap(b => b.previews.map(p => p.effect_id))
  const catalog = allProducts()
  const planCtx: PlanContext = planContextFor(rec)
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
  else if (rec.collection_preview_id) nextBatch = { kind: 'blocked', reason: 'collection_session' }
  else if (rec.flow === 'generations') nextBatch = { kind: 'blocked', reason: 'generations_flow' }
  else if (rec.refunded_at) nextBatch = { kind: 'blocked', reason: 'order_refunded' }
  else if (rec.refund_requested_at) nextBatch = { kind: 'blocked', reason: 'refund_pending' }
  else if (order && !['created', 'awaiting_artwork', 'cancelled'].includes(order.status)) nextBatch = { kind: 'blocked', reason: 'order_not_awaiting_artwork' }     // generation needs no purchase, but ends at approval
  else if (incomplete) nextBatch = { kind: 'blocked', reason: 'previous_batch_incomplete' }
  else if (rec.series && remainingEffectCount(rec.series, used) < BATCH_SIZE) nextBatch = { kind: 'blocked', reason: 'no_effects_remaining' }
  else if (free.available) nextBatch = { kind: 'free' }
  else if (packs > 0) nextBatch = { kind: 'paid', packAvailable: true }
  else nextBatch = { kind: 'payment_required', amountCents: PACK_PRICE_CENTS as 299, currency: 'USD' }
  return {
    contractVersion: GIFT_CONTRACT_VERSION, sessionId: rec.id, flow: rec.flow === 'generations' ? 'generations' : 'previews',
    generations: await generationsViewOf(deps, rec, allRaw, expired, order),
    source: { sourceRef: rec.id, width: rec.source_width, height: rec.source_height, series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null, subjectGender: genderFor(rec.series!, rec.analysis.subjectGender), photoUrl: rec.source_path ? await deps.storage.signedUrl(rec.source_path, 3600) : null },
    lines: rec.lines, geometries, masterAspect: rec.master_aspect ?? '', batches, usedEffectIds: used,
    entitlement: { freeBatchesTotal: FREE_BATCHES, freeBatchesUsed: free.used, paidPacksAvailable: packs, freeAvailable: rec.collection_preview_id ? false : free.available, freeBlockedReason: rec.collection_preview_id ? 'session_limit' : free.reason },          // 'session_limit' is an existing value, so older readers still validate: this session takes no free batch
    nextBatch, expiresAt: rec.expires_at, catalogVersion: catalogVersion(catalog),
    order: orderView(rec, order),
    entrance: rec.collection_preview_id ? 'collection' : 'photo', collection: rec.collection_preview_id ? { previewId: rec.collection_preview_id, portfolioId: rec.unlock_portfolio_id } : null,
    artworkPreviewId: rec.artwork_preview_id,
    compositions: await Promise.all((orderLines.length || !(deps.draftCompositions || rec.collection_preview_id) ? orderLines : draftOrderLines(rec, catalog)).map(async l => {
      const mine = comps.filter(c => c.line_id === l.line_id && c.preview_id === rec.artwork_preview_id && c.status !== 'superseded' && c.status !== 'failed').sort(byNewest)[0]
      const g = geometries.find(x => x.lineId === l.line_id)
      const gp = planned.find(x => x.l.lineId === l.line_id)
      const job = !mine && rec.artwork_preview_id ? jobs.find(j => j.preview_id === rec.artwork_preview_id && j.geometry_key === (g?.geometryKey ?? '\u0000')) : undefined
      const live = !!job && job.state === 'preparing' && Date.parse(job.expires_at) > clockNow
      const state: CompositionView['state'] = mine ? (mine.status === 'approved' ? 'approved' : 'ready') : !job ? 'not_started' : live ? 'preparing' : job.state === 'failed' ? 'failed' : 'stalled'
      return {
        state, preparingSince: live ? job!.claimed_at : null, failureCode: state === 'failed' ? job!.error_code : null, attempts: job?.attempts ?? 0,
        retryable: state === 'failed' ? job!.attempts < COMPOSITION_MAX_ATTEMPTS : state === 'stalled' || state === 'not_started',
        lineId: l.line_id, productId: l.product_id, geometryKey: mine?.geometry_key ?? g?.geometryKey ?? null, method: (mine?.method ?? g?.method ?? null) as 'deterministic' | 'generated' | null,
        generationAspect: mine?.generation_aspect ?? g?.generationAspect ?? null, sharedWithLineIds: g?.sharedWithLineIds ?? [], picturePx: gp?.p.requirements.picturePx ?? null,
        sku: gp?.p.sku ?? null, geometrySource: gp?.source ?? 'catalog', adaptationValidation: adaptationValidationFor(rec.series, (mine?.method ?? g?.method ?? null) as 'deterministic' | 'generated' | null),
        generationMode: (mine?.generation_mode ?? null) as 'none' | 'favorite_reference' | 'photo_regeneration' | null, sourceArtworkId: mine ? mine.preview_id : null, status: (mine ? (mine.status === 'approved' ? 'approved' : 'ready') : 'none') as 'none' | 'ready' | 'approved',
        compositionId: mine?.id ?? null, attempt: mine?.attempt ?? 0, correctionsRemaining: correctionUsed(comps, l) ? 0 : 1,
        previewUrl: mine?.preview_path ? await deps.storage.signedUrl(mine.preview_path, 3600) : null, width: mine?.width ?? null, height: mine?.height ?? null,
        fit: ((mine?.plan as { fit?: string } | undefined)?.fit ?? null) as 'exact' | 'resample' | 'extend' | null,
      }
    })),
  }
}

// ── restoring work after navigation, refresh or Back/Forward ───────────────────────────────────────────────────────────────────────────────────

/** A preview may be claimed at most this many times (the same bound gift_claim_preview and the view's retryable flag use). */
const PREVIEW_ATTEMPTS = 3

/** A batch's generation state from the preview rows and the clock only. See BatchGeneration. */
function generationOf(previews: PreviewRec[], complete: boolean, nowMs: number): BatchGeneration {
  if (complete) return 'complete'
  const live = (p: PreviewRec) => p.status === 'generating' && !!p.lease_until && Date.parse(p.lease_until) > nowMs
  if (previews.some(live)) return 'running'
  const claimable = (p: PreviewRec) => p.attempts < PREVIEW_ATTEMPTS && (p.status === 'pending' || p.status === 'failed' || p.status === 'generating')       // a generating row with a lapsed lease is claimable again
  return previews.some(claimable) ? 'stalled' : 'failed'
}

function compositionsResume(v: SessionView): NonNullable<RestoreResponse['resume']>['compositions'] {
  if (!v.compositions.length) return null
  const ids = (s: CompositionView['state']) => v.compositions.filter(c => c.state === s).map(c => c.lineId)
  const preparing = ids('preparing'), stalled = ids('stalled'), failed = v.compositions.filter(c => c.state === 'failed').map(c => c.lineId), notStarted = ids('not_started')
  const state = preparing.length ? 'preparing' : failed.length ? 'failed' : stalled.length ? 'stalled' : notStarted.length ? 'not_started' : 'ready'
  const resumeNeeded = !preparing.length && (stalled.length > 0 || notStarted.length > 0 || v.compositions.some(c => c.state === 'failed' && c.retryable))
  return { state, resumeNeeded, preparing, stalled, failed }
}

function stepOf(v: SessionView): RestoreStep {
  const o = v.order.state
  if (o === 'checkout_open') return 'checkout'
  if (o === 'awaiting_artwork') return 'compositions'
  if (o !== 'none') return 'order'
  if (!v.batches.length) return 'effects'
  if (!v.artworkPreviewId) return 'previews'
  return v.lines.length ? 'cart' : 'products'
}

/**
 * The customer's current Gift session, so the Wizard can pick up exactly where it was: the uploaded photo, the batch of previews that was requested (with every
 * preview that finished, kept in storage), whether generation is running, and how far they had got. READ-ONLY with respect to generation: it never starts,
 * retries or reserves anything (the caller resumes a 'stalled' batch with the existing retry route). It only extends the session's idle expiry, like every other action does,
 * so work in progress is not cleaned up while the customer is still coming back.
 */
export async function restoreSession(deps: GiftDeps, userId: string): Promise<RestoreResponse> {
  const t = now(deps)
  const live = (await deps.store.listSessions(userId, 5)).filter(s => s.status === 'active' && (!!s.pinned_at || Date.parse(s.expires_at) >= t))
  const recent = live.map(s => ({ sessionId: s.id, createdAt: s.created_at, lastActivityAt: s.last_activity_at, expiresAt: s.expires_at, series: s.series, orderId: s.order_id }))
  let rec = live[0]
  if (!rec) return { contractVersion: GIFT_CONTRACT_VERSION, current: null, resume: null, recent: [] }
  if (t - Date.parse(rec.last_activity_at) > 60 * 60 * 1000) {                  // at most one write an hour
    const patch = { last_activity_at: iso(t), expires_at: extend(rec, t) }
    await deps.store.patchSession(rec.id, userId, patch)
    rec = { ...rec, ...patch }
  }
  const current = await buildView(deps, rec)
  return {
    contractVersion: GIFT_CONTRACT_VERSION, current, recent,
    resume: {
      sessionId: rec.id, suggestedStep: stepOf(current),
      resumeBatches: current.batches.filter(b => b.generation === 'stalled').map(b => b.batchIndex),
      runningBatches: current.batches.filter(b => b.generation === 'running').map(b => b.batchIndex),
      compositions: compositionsResume(current),
    },
  }
}

function orderView(rec: SessionRec, order: Awaited<ReturnType<GiftDeps['store']['getOrder']>>): SessionView['order'] {
  const state: SessionView['order']['state'] =
    rec.refunded_at ? 'refunded'
    : rec.refund_requested_at ? 'refund_requested'
    : !order ? 'none'
    : order.status === 'created' ? 'checkout_open'
    : order.status === 'awaiting_artwork' ? (finalizedAt(rec) ? 'approved' : 'awaiting_artwork')          // approved by the customer, NOT released: the order row is still invisible to fulfilment
    : order.status === 'cancelled' ? 'cancelled'
    : ['placed', 'in_production', 'shipped', 'delivered'].includes(order.status) ? 'with_lab'
    // 'approved' means the customer approved the artwork and the order was released: paid (or held or errored afterwards) WITH an approval time.
    // Any other status, or one of those without an approval, is unexpected and is reported as such instead of being mistaken for approval.
    : ['paid', 'withheld', 'error'].includes(order.status) && finalizedAt(rec) ? 'approved'
    : 'needs_attention'
  return {
    orderId: rec.order_id, state, freeBatchesGranted: FREE_BATCHES, approvedAt: finalizedAt(rec), finalApprovedAt: finalizedAt(rec), releasedAt: rec.approved_at ?? null,
    manufacturing: !order ? 'not_released' : ['placed', 'in_production', 'shipped', 'delivered'].includes(order.status) ? 'with_lab' : ['paid', 'withheld', 'error'].includes(order.status) && rec.approved_at ? 'released' : 'not_released',
    unlockPortfolioId: rec.unlock_portfolio_id,
    totalCents: order?.retail_total_cents ?? null, disclosureVersion: rec.disclosure_version,
  }
}

// ── retention ───────────────────────────────────────────────────────────

async function removeObjects(deps: GiftDeps, rec: SessionRec): Promise<void> {
  const all = await deps.store.listBatches(rec.id)
  const comps = await deps.store.listCompositions(rec.id)
  const gens = rec.flow === 'generations' || rec.collection_preview_id ? await deps.store.listGenerations(rec.id).catch(() => []) : []
  const paths = [rec.source_path, ...gens.flatMap(g => [g.master_path, g.preview_path]), ...all.flatMap(b => b.previews.flatMap(p => [p.master_path, p.preview_path])), ...comps.flatMap(c => [c.composed_path, c.preview_path, (c.plan as { mockup?: { path?: string } }).mockup?.path])]
    .filter((x): x is string => !!x)
  if (deps.storage.list) { try { paths.push(...await deps.storage.list(STORAGE.productPreviewDir(rec.id))) } catch { /* the preview files are a cache: a listing failure never blocks the session's removal */ } }
  if (paths.length) await deps.storage.remove([...new Set(paths)])         // shared compositions point at the same files: remove each once
}

/** The customer deleting their own session: objects first, then rows, so a storage failure leaves the rows to retry. */
export async function deleteSessionNow(deps: GiftDeps, userId: string, sessionId: string): Promise<void> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.pinned_at) throw new GiftError('session_retained')     // a paid order is waiting on this session: retained until resolved
  await removeObjects(deps, rec)
  await deps.store.deleteSession(rec.id)
  await sweepLateFiles(deps, rec.id)                      // a preview that finished between the object removal and the row deletion must not leave its files behind
}

/** Files a still-running generation stored after removeObjects looked: list the session's own directories and remove whatever is there. Best effort; the rows are already gone. */
async function sweepLateFiles(deps: GiftDeps, sessionId: string): Promise<void> {
  if (!deps.storage.list) return
  for (const dir of ['masters', 'previews', 'compositions', 'mockups']) {
    try { const left = await deps.storage.list(`gift/${sessionId}/${dir}/`); if (left.length) await deps.storage.remove(left) } catch { /* a listing failure never fails the deletion */ }
  }
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
  if (rec.collection_preview_id) throw new GiftError('collection_session_no_generation')
  if (finalizedAt(rec)) throw new GiftError('order_not_awaiting_artwork')                   // final approval is recorded: no more generation
  if (!Number.isInteger(batchIndex) || batchIndex < 1) throw new GiftError('session_not_found')
  return runBatch(deps, userId, rec, batchIndex)
}
