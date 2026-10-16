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
import { decodeSource } from '../foyer/foyer-source'
import { BATCH_SIZE, FREE_BATCHES, MASTER_ASPECT_DEFAULT, MAX_COPIES, MAX_PARALLEL_RENDERS, PACK_PRICE_CENTS, RETENTION, STORAGE } from './policy'
import { EffectSelectionError, fillEffects, remainingEffectCount } from './effects'
import { StoreError, type BatchRec, type GiftStore, type PreviewRec, type SessionRec } from './store'
import { GIFT_CONTRACT_VERSION, type BatchRequest, type BatchView, type GiftLine, type LineGeometry, type NextBatch, type PreviewView, type Series, type SessionView } from './types'

export type GiftErrorCode =
  | 'image_b64_required' | 'image_too_large' | 'image_not_base64' | 'image_unreadable'
  | 'age_restricted' | 'unsupported_subject' | 'analysis_unavailable'
  | 'invalid_lines' | 'product_not_available' | 'invalid_quantity' | 'duplicate_line'
  | 'invalid_idempotency_key' | 'invalid_effect_selection' | 'effect_already_used' | 'not_enough_effects'
  | 'session_not_found' | 'payment_required' | 'previous_batch_incomplete' | 'session_expired' | 'generation_unavailable'
const STATUS: Partial<Record<GiftErrorCode, number>> = {
  image_b64_required: 400, image_too_large: 400, image_not_base64: 400, image_unreadable: 400, age_restricted: 403, unsupported_subject: 422, analysis_unavailable: 503,
  invalid_lines: 400, product_not_available: 409, invalid_quantity: 400, duplicate_line: 400, invalid_idempotency_key: 400, invalid_effect_selection: 400,
  effect_already_used: 400, not_enough_effects: 409, session_not_found: 404, payment_required: 402, previous_batch_incomplete: 409, session_expired: 409, generation_unavailable: 503,
}
export class GiftError extends Error {
  readonly status: number
  constructor(public code: GiftErrorCode) { super(code); this.status = STATUS[code] ?? 400 }
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
  generate(input: { series: Series; sourceB64: string; effectId: string; aspect: string; userId: string; peopleCount: number | null }): Promise<{ imageB64: string }>
  /** Baked-watermark customer preview (JPEG) from the clean master. Must fail rather than return an unmarked image. */
  watermark(masterB64: string): Promise<Buffer>
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
  }
  try { await deps.store.createSession(rec) } catch (e) { await deps.storage.remove([path]).catch(() => {}); throw e }
  return buildView(deps, rec)
}

async function owned(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionRec> {
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
    catch (e) { if (e instanceof StoreError) throw new GiftError(e.code === 'six_distinct_effects_required' ? 'invalid_effect_selection' : e.code); throw e }
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
  const geometries: LineGeometry[] = rec.lines.flatMap(l => {
    const p = catalog.find(x => x.productId === l.productId)
    return p ? [{ lineId: l.lineId, productId: p.productId, pictureAspect: p.requirements.pictureAspect, orientation: p.requirements.skuOrientation, requiredPx: p.requirements.finalPx }] : []
  })
  const incomplete = batches.some(b => !b.complete)
  const expired = rec.status !== 'active' || Date.parse(rec.expires_at) < now(deps)
  let nextBatch: NextBatch
  if (expired) nextBatch = { kind: 'blocked', reason: 'session_expired' }
  else if (incomplete) nextBatch = { kind: 'blocked', reason: 'previous_batch_incomplete' }
  else if (rec.series && remainingEffectCount(rec.series, used) < BATCH_SIZE) nextBatch = { kind: 'blocked', reason: 'no_effects_remaining' }
  else if (batches.length < FREE_BATCHES) nextBatch = { kind: 'free' }
  else if (packs > 0) nextBatch = { kind: 'paid', packAvailable: true }
  else nextBatch = { kind: 'payment_required', amountCents: PACK_PRICE_CENTS as 299, currency: 'USD' }
  return {
    contractVersion: GIFT_CONTRACT_VERSION, sessionId: rec.id,
    source: { sourceRef: rec.id, width: rec.source_width, height: rec.source_height, series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null },
    lines: rec.lines, geometries, masterAspect: rec.master_aspect ?? '', batches, usedEffectIds: used,
    entitlement: { freeBatchesTotal: 2, freeBatchesUsed: Math.min(FREE_BATCHES, batches.filter(b => b.kind === 'free').length), paidPacksAvailable: packs },
    nextBatch, expiresAt: rec.expires_at, catalogVersion: catalogVersion(catalog),
  }
}

// ── retention ───────────────────────────────────────────────────────────

async function removeObjects(deps: GiftDeps, rec: SessionRec): Promise<void> {
  const all = await deps.store.listBatches(rec.id)
  const paths = [rec.source_path, ...all.flatMap(b => b.previews.flatMap(p => [p.master_path, p.preview_path]))].filter((x): x is string => !!x)
  if (paths.length) await deps.storage.remove(paths)
}

/** The customer deleting their own session: objects first, then rows, so a storage failure leaves the rows to retry. */
export async function deleteSessionNow(deps: GiftDeps, userId: string, sessionId: string): Promise<void> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.pinned_at) throw new GiftError('session_expired')     // attached to an order: the order's retention applies
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
