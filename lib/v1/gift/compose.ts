// lib/v1/gift/compose.ts
//
// After payment: choose THE artwork, prepare one composition per purchased line from it, let the customer correct each once,
// approve each, and approve the order. Approval is what releases the order to the existing fulfilment pipeline.
//
// Rules held here and in migration 048:
//   * one selected artwork per order; changing it before approval supersedes its compositions
//   * a composition adds background only (extension or mirror, inside geometry.ts limits); it never crops, distorts or
//     regenerates the subject (prepareComposition keeps the original pixels untouched)
//   * one free correction per order line; further requests go to Concierge (409 correction_limit)
//   * approval needs every line approved for the selected artwork; it creates ONE unlocked My Collection piece (no credit
//     consumed) and moves the order from awaiting_artwork to paid, the state the fulfilment pipeline already handles
//   * nothing reaches the print lab from here: the existing poller, QA and Prodigi safeguards run after approval

import sharp from 'sharp'
import { createHash, randomUUID } from 'node:crypto'
import { lockedPreviewPath } from '@/lib/store/preview'
import type { PrintFinish, PrintSize } from '../print/sku-map'
import type { CanonicalProduct } from '../print/catalog'
import { compositionFitsProduct, resolveFrozenProduct } from './frozen'
import { requireOpen, scopeOf } from './scope'
import { removeMockupFile } from './mockup'
import { correctionPlanFor, groupLines, planContextFor, planFor, type CompositionPlan, type PlanContext } from './composition-plan'
import { supportsFavoriteReference } from './aspects'
import { frameColorsFor, lineFrameColor } from './frame-colors'
import { COMPOSITION_LEASE_MS, COMPOSITION_MAX_ATTEMPTS, estimateCompositionCost } from './policy'
import { GiftError, fromStoreError, generateGated, getSessionView, owned, type GiftDeps } from './service'
import { StoreError, byNewest, correctionUsed, finalizedAt, type CompositionJobKey, type CompositionRec, type OrderLineRec, type PreviewRec, type SessionRec } from './store'
import type { SessionView } from './types'
import { correctGenerationLine } from './generations'

async function selectedPreview(deps: GiftDeps, rec: SessionRec): Promise<PreviewRec> {
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')
  const all = await deps.store.listBatches(rec.id)
  const p = all.flatMap(b => b.previews).find(x => x.id === rec.artwork_preview_id && x.status === 'ready' && x.master_path)
  if (!p) throw new GiftError('preview_not_ready')
  return p
}

const active = (comps: CompositionRec[], lineId: string, previewId: string) =>
  comps.filter(c => c.line_id === lineId && c.preview_id === previewId && (c.status === 'ready' || c.status === 'approved')).sort(byNewest)[0]

/** Pick THE artwork. Allowed until approval; supersedes compositions of any previously selected artwork. */
export async function selectArtwork(deps: GiftDeps, userId: string, sessionId: string, previewId: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof previewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(previewId)) throw new GiftError('preview_not_ready')
  if (finalizedAt(rec)) throw new GiftError('order_not_awaiting_artwork')                   // the customer's final approval is recorded: the artwork is fixed
  try { await deps.store.selectArtwork(rec.id, userId, previewId) } catch (e) { fromStoreError(e) }
  return getSessionView(deps, userId, sessionId)
}

interface GroupFiles {
  image: string; preview: string; width: number; height: number; fit: 'exact' | 'resample' | 'extend'; outpainted: boolean
  generationMode: CompositionRec['generation_mode']; nb21Calls: number
  /** SHA-256 of the composed (clean) file: the immutable identity of this artwork revision, used by the mockup cache. */
  sha256: string
}
type LineInfo = { line_id: string; product_id: string }

/**
 * The PURCHASED products, from the geometry frozen on the order at checkout (frozen.ts), never from today's catalog. An order that predates
 * snapshots resolves from the catalog only while its SKU still matches; anything else is refused rather than reinterpreted.
 */
function frozenProducts(order: { items: Array<{ sku: string; frozen?: unknown }> }, lines: OrderLineRec[]): Map<string, CanonicalProduct> {
  const m = new Map<string, CanonicalProduct>()
  for (const l of lines) {
    const r = resolveFrozenProduct(order.items, l)
    if (!r.ok) throw new GiftError(r.reason)
    m.set(l.line_id, r.product)
  }
  return m
}
const ctxOf = (rec: SessionRec): PlanContext => planContextFor(rec)
const planOf = (rec: SessionRec, product: CanonicalProduct): CompositionPlan => {
  const plan = planFor(product, ctxOf(rec))
  if (!plan) throw new GiftError('product_not_available_for_artwork')
  return plan
}

/**
 * Compose ONE picture for a composition requirement and store its clean file and its watermarked preview. The expensive step
 * (a deterministic adaptation, or an NB2.1 generation plus bounded extension) runs here, once per requirement, never per line.
 *   deterministic  the selected artwork is adapted to the product's shape
 *   generated      the same effect is generated again from the customer's own photograph at the nearest supported ratio, then
 *                  bounded extension finishes the exact shape (the customer approves what they actually see)
 * `slot` names the files: a shared group uses the key, a line's own correction uses its line id, so a correction can never
 * overwrite what other lines share.
 */
/** Which step of a composition threw, kept on the error so an operator's log says "generate" or "upscale", never just "composition_failed". Messages only: no keys, no image data. */
async function stage<T>(name: 'generate' | 'store_generation' | 'compose' | 'watermark' | 'store', fn: () => Promise<T>): Promise<T> {
  try { return await fn() } catch (e) { if (e && typeof e === 'object' && !(e as { stage?: string }).stage) (e as { stage?: string }).stage = name; throw e }
}
/** The failing stage and message of an error from composeGroup, as one log line (no secrets: provider messages only). */
export const composeFailure = (e: unknown) => ({ stage: (e as { stage?: string } | null)?.stage ?? 'unknown', code: e instanceof GiftError ? e.code : undefined, message: String(e instanceof Error ? e.message : e).slice(0, 300) })

async function composeGroup(deps: GiftDeps, rec: SessionRec, preview: PreviewRec, product: CanonicalProduct, plan: CompositionPlan, master: Buffer, slot: string): Promise<GroupFiles> {
  if (!deps.compose) throw new GiftError('composition_failed')
  let source = master
  let generationMode: GroupFiles['generationMode'] = 'none'
  const base = `gift/${rec.id}/compositions/${preview.id}-${slot}`
  if (plan.method === 'generated') {
    if (!rec.source_path || !rec.series) throw new GiftError('generation_unavailable')
    const photo = await deps.storage.get(rec.source_path)
    if (!photo) throw new GiftError('generation_unavailable')
    // The customer's approved artwork goes along as a reference wherever the series' route can take one (Portraits, Pets); Groups
    // regenerates from the photograph alone. Either way the result is a NEW generation that the customer sees and approves.
    const useReference = supportsFavoriteReference(rec.series)
    // A generation that was paid for and then lost to a later step is never paid for twice: the raw output is kept beside the composition and reused by the next attempt.
    const kept = await deps.storage.get(`${base}.gen.png`).catch(() => null)
    if (kept) source = kept
    else {
      const out = await stage('generate', () => generateGated(deps, {
        series: rec.series!, sourceB64: photo.toString('base64'), effectId: preview.effect_id, aspect: plan.generationAspect!, userId: rec.user_id,
        peopleCount: rec.analysis.peopleCount ?? null, productComposition: true, ...(useReference ? { referenceB64: master.toString('base64') } : {}),
      }))
      source = Buffer.from(out.imageB64, 'base64')
      await stage('store_generation', () => deps.storage.put(`${base}.gen.png`, source, 'image/png'))
    }
    generationMode = useReference ? 'favorite_reference' : 'photo_regeneration'
  }
  const made = await stage('compose', () => deps.compose!({ masterB64: source.toString('base64'), size: product.size as PrintSize, finish: product.family as PrintFinish }))
  if (!compositionFitsProduct(made, product)) throw new GiftError('composition_geometry_mismatch')      // never store a file of the wrong shape for what was bought
  const marked = await stage('watermark', () => deps.watermark(made.image.toString('base64')))              // the customer's view of a clean composition: watermarked, fails closed
  await stage('store', async () => { await deps.storage.put(`${base}.png`, made.image, 'image/png'); await deps.storage.put(`${base}.jpg`, marked, 'image/jpeg') })
  if (generationMode !== 'none') await deps.storage.remove([`${base}.gen.png`]).catch(() => {})                 // the composition is stored: the kept raw generation has done its job
  return { image: `${base}.png`, preview: `${base}.jpg`, width: made.width, height: made.height, fit: made.fit, outpainted: made.outpainted, generationMode, nb21Calls: generationMode === 'none' ? 0 : 1, sha256: createHash('sha256').update(made.image).digest('hex') }
}

/** The finish the customer selected for a frame line, recorded WITH its composition so the approval is for that finish (checkout and the print source compare it). Nothing for products with no finish. */
const finishOf = (rec: SessionRec, product: CanonicalProduct, lineId: string): { frameColor?: string } => {
  if (!frameColorsFor(product)) return {}
  const line = rec.lines.find(l => l.lineId === lineId)
  const color = line ? lineFrameColor(product, line) : null
  return color ? { frameColor: color } : {}
}

/** `paid` is true only for the row that CREATED the files: rows that reuse a shared composition cost nothing of their own. */
const recordFor = (rec: SessionRec, preview: PreviewRec, line: LineInfo, attempt: 1 | 2, plan: CompositionPlan, f: GroupFiles, sourceId: string | null, paid: boolean, extra?: Record<string, unknown>) => {
  const nb21 = paid ? f.nb21Calls : 0, outpaint = paid && f.outpainted ? 1 : 0
  return {
    session_id: rec.id, line_id: line.line_id, preview_id: preview.id, attempt, status: 'ready' as const, composed_path: f.image, preview_path: f.preview,
    width: f.width, height: f.height, geometry_key: plan.geometryKey, method: plan.method, source_composition_id: sourceId,
    generation_mode: f.generationMode, generation_aspect: plan.method === 'generated' ? plan.generationAspect : null,
    nb21_calls: nb21, outpaint_calls: outpaint, cost_usd_est: estimateCompositionCost({ nb21, outpaint }),
    plan: { fit: f.fit, outpainted: f.outpainted, method: plan.method, geometryKey: plan.geometryKey, generationAspect: plan.generationAspect, targetAspect: plan.targetAspect,
            generationMode: f.generationMode, sourceArtworkId: preview.id, correction: attempt === 2, ...(f.sha256 ? { artworkSha256: f.sha256 } : {}), ...(extra ?? {}) } as Record<string, unknown>,
  }
}

/**
 * One composition RECORD per purchased line, but one COMPOSITION per distinct requirement: products whose picture shapes match
 * share files (a 12 x 18 print and a 12 x 18 frame cost one composition), while each line keeps its own approval, its own free
 * correction and its own print job. Idempotent and resumable: a requirement that already has files is reused, a failed one is
 * retried on its own, and nothing that succeeded is made twice.
 */
export async function ensureCompositions(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const scope = await scopeOf(deps, rec); requireOpen(scope)            // a DRAFT (reviewed before payment) or a paid order still awaiting artwork approval
  const preview = await selectedPreview(deps, rec)
  const lines = scope.lines.map(x => x.line)
  if (!lines.length) throw new GiftError('order_has_no_lines')
  const comps = await deps.store.listCompositions(rec.id)
  const missing = lines.filter(l => !active(comps, l.line_id, preview.id))
  if (!missing.length) return getSessionView(deps, userId, sessionId)
  if (rec.flow === 'generations') throw new GiftError('compositions_not_approved')          // the product-first journey never composes after payment: every line is an accepted generation, bound before checkout

  const products = new Map(scope.lines.map(x => [x.line.line_id, x.product]))
  const groups = groupLines(missing.map(l => ({ line: l, product: products.get(l.line_id)! })), ctxOf(rec))
  const master = await deps.storage.get(preview.master_path!)
  if (!master) throw new GiftError('generation_unavailable')
  let failed = 0
  for (const g of groups) {
    // Files already made for this requirement and this artwork (by another line, or an earlier call) are reused.
    const existing = comps.find(c => c.preview_id === preview.id && c.geometry_key === g.geometryKey && c.attempt === 1 && c.composed_path && c.preview_path && c.status !== 'failed' && compositionFitsProduct(c, g.items[0].product))
    let files: GroupFiles | null = existing ? { image: existing.composed_path!, preview: existing.preview_path!, width: existing.width ?? 0, height: existing.height ?? 0, fit: ((existing.plan as { fit?: GroupFiles['fit'] }).fit ?? 'exact'), outpainted: !!(existing.plan as { outpainted?: boolean }).outpainted, generationMode: existing.generation_mode, nb21Calls: 0, sha256: typeof (existing.plan as { artworkSha256?: unknown }).artworkSha256 === 'string' ? (existing.plan as { artworkSha256: string }).artworkSha256 : '' } : null
    let claim: CompositionJobKey | null = null
    if (!files) {
      // THE DURABLE GUARD (055): one process prepares a requirement at a time. A second request, a second tab or a retry while it runs generates NOTHING and returns the current view
      // (the line reads 'preparing'); a request that died leaves a lapsed job the next call takes over (the line read 'stalled'); a failure stays recorded with its code.
      const c = await deps.store.claimComposition({ sessionId: rec.id, previewId: preview.id, geometryKey: g.geometryKey, lineIds: g.items.map(it => it.line.line_id), method: g.plan.method, ttlMs: COMPOSITION_LEASE_MS, maxAttempts: COMPOSITION_MAX_ATTEMPTS, nowMs: (deps.clock ?? Date.now)() })
      if (!c.token) { if (c.reason !== 'in_progress') failed++; continue }
      claim = { sessionId: rec.id, previewId: preview.id, geometryKey: g.geometryKey, token: c.token }
      try { files = await composeGroup(deps, rec, preview, g.items[0].product, g.plan, master, g.geometryKey) }
      catch (e) { await deps.store.failComposition({ ...claim, code: e instanceof GiftError ? e.code : 'composition_error' }).catch(() => {}); if (e instanceof GiftError && e.code === 'age_restricted') throw e; failed++; continue }
    }
    let creatorId: string | null = existing?.id ?? null
    for (const it of g.items) {
      try {
        // A superseded first attempt for this line and artwork may exist (the favorite was switched away and back, or the product changed): the new row takes the next repair_seq.
        const priorSeq = comps.filter(c => c.line_id === it.line.line_id && c.preview_id === preview.id && c.attempt === 1).map(c => c.repair_seq ?? 0)
        const row = await deps.store.insertComposition({ ...recordFor(rec, preview, it.line, 1, g.plan, files, creatorId, creatorId === null, { sku: it.product.sku, ...finishOf(rec, it.product, it.line.line_id) }), ...(priorSeq.length ? { repair_seq: Math.max(...priorSeq) + 1 } : {}) })
        creatorId ??= row.id
      } catch { /* a concurrent call already recorded this line: the unique key makes the repeat harmless */ }
    }
    if (claim) await deps.store.finishComposition(claim).catch(() => {})            // the rows are the record now; the job is dropped
  }
  if (failed) throw new GiftError('composition_failed')                  // finished groups are kept; calling again fills only the rest
  return getSessionView(deps, userId, sessionId)
}

/** The ONE free correction for a line: a new composition of its own (never touching what other lines share) that replaces its first. */
export async function correctLine(deps: GiftDeps, userId: string, sessionId: string, lineId: string): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const scope = await scopeOf(deps, rec); requireOpen(scope)            // before payment (a draft) or after it, while the order awaits approval
  const preview = await selectedPreview(deps, rec)
  const ls = scope.lines.find(x => x.line.line_id === lineId)
  if (!ls) throw new GiftError('line_not_found')
  const line = ls.line
  const comps = await deps.store.listCompositions(rec.id)
  const current = active(comps, lineId, preview.id)
  if (!current) throw new GiftError('composition_not_found')
  if (correctionUsed(comps, line) || current.attempt >= 2) throw new GiftError('correction_limit')       // ONE per product, counted across the purchase boundary; the rest goes to Concierge
  if (current.generation_id || rec.flow === 'generations') {
    // Product-first: the correction is a new generation of the same shape (outside the allowance), never a composition with extension.
    await correctGenerationLine(deps, userId, rec, ls.line, current, scope.phase === 'purchased' ? 'purchased' : 'draft')
    if (scope.phase === 'purchased') { try { await deps.store.useCorrection(rec.id, userId, lineId) } catch (e) { fromStoreError(e) } }
    await deps.store.patchComposition(current.id, { status: 'superseded' })
    await removeMockupFile(deps, current)
    return getSessionView(deps, userId, sessionId)
  }
  const master = await deps.storage.get(preview.master_path!)
  if (!master) throw new GiftError('generation_unavailable')
  const product = ls.product
  const basePlan = planOf(rec, product)
  const plan = correctionPlanFor(product, ctxOf(rec), basePlan) ?? basePlan                // a deterministic line gets one generated adaptation when one is reachable
  const fallback = basePlan.method === 'deterministic' && plan.method === 'generated'
  let files: GroupFiles
  try { files = await composeGroup(deps, rec, preview, product, plan, master, `${lineId}-2`) } catch (e) { if (e instanceof GiftError) throw e; throw new GiftError('composition_failed') }
  try { await deps.store.insertComposition(recordFor(rec, preview, line, 2, plan, files, null, true, { sku: product.sku, ...finishOf(rec, product, lineId), ...(fallback ? { correctionFallbackFrom: 'deterministic' } : {}) })) } catch (e) { fromStoreError(e); throw new GiftError('composition_failed') }
  if (scope.phase === 'purchased') { try { await deps.store.useCorrection(rec.id, userId, lineId) } catch (e) { fromStoreError(e) } }        // a draft has no order line; its attempt-2 row is the record
  await deps.store.patchComposition(current.id, { status: 'superseded' })
  await removeMockupFile(deps, current)                          // the superseded composition's mockup is stale: its file goes, a new identity renders the new one
  return getSessionView(deps, userId, sessionId)
}

export async function approveComposition(deps: GiftDeps, userId: string, sessionId: string, compositionId: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')
  const comp = (await deps.store.listCompositions(rec.id)).find(c => c.id === compositionId)
  if (!comp || comp.preview_id !== rec.artwork_preview_id || comp.status === 'superseded' || comp.status === 'failed') throw new GiftError('composition_not_found')
  const scope = await scopeOf(deps, rec); requireOpen(scope)                // approving a reviewed composition works before payment and after it, never once the order is approved
  const ls = scope.lines.find(x => x.line.line_id === comp.line_id)
  if (!ls) throw new GiftError('line_not_found')
  if (!compositionFitsProduct(comp, ls.product)) throw new GiftError('composition_geometry_mismatch')
  if (comp.generation_id) { try { await deps.store.acceptGeneration(rec.id, userId, comp.generation_id) } catch (e) { fromStoreError(e) } }       // approving the picture is accepting it
  if (comp.status === 'ready') await deps.store.patchComposition(comp.id, { status: 'approved', approved_at: new Date((deps.clock ?? Date.now)()).toISOString() })
  return getSessionView(deps, userId, sessionId)
}

/**
 * The customer's FINAL ORDER APPROVAL (POST /api/v1/gift/sessions/{id}/finalize). Requires a paid order, the selected artwork, and an APPROVED composition of the right shape for
 * every purchased line. The artwork becomes the customer's unlocked My Collection piece (one per order, no credit consumed) and the approval is recorded durably. It does NOT release
 * anything to manufacturing: see releaseOrder. Idempotent and safe to race (the database locks the session; a repeat returns the same state).
 */
export async function finalizeOrder(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (finalizedAt(rec)) return getSessionView(deps, userId, sessionId)             // idempotent: a repeat, a refresh and a second tab all get the same answer
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const preview = await selectedPreview(deps, rec)
  const lines = await deps.store.orderLines(rec.order_id)
  if (!lines.length) throw new GiftError('order_has_no_lines')
  const comps = await deps.store.listCompositions(rec.id)
  if (lines.some(l => active(comps, l.line_id, preview.id)?.status !== 'approved')) throw new GiftError('compositions_not_approved')
  const orderRow = await deps.store.getOrder(rec.order_id)
  if (orderRow) for (const l of lines) {                          // nothing of the wrong shape for the purchased product is ever approved for the lab
    const r = resolveFrozenProduct(orderRow.items, l), c = active(comps, l.line_id, preview.id)
    if (r.ok && c && !compositionFitsProduct(c, r.product)) throw new GiftError('composition_geometry_mismatch')
  }   // checked again, atomically, in the database

  // Generations flow: every line must still be exactly the picture the customer accepted and paid for (same sha256 as accepted, as pinned at checkout, as stored now).
  const genComps = lines.map(l => active(comps, l.line_id, preview.id)).filter((c): c is CompositionRec => !!c && !!c.generation_id)
  for (const c of genComps) await verifyGenerationComposition(deps, rec, c, orderRow)
  // The piece must outlive the session, so the clean master and its watermarked view are copied to where My Collection reads them. In the generations flow it is the first line's accepted picture.
  const series = rec.series!
  const master = await deps.storage.get(genComps[0]?.composed_path ?? preview.master_path!)
  const watermarked = genComps[0]?.preview_path ? await deps.storage.get(genComps[0].preview_path) : preview.preview_path ? await deps.storage.get(preview.preview_path) : null
  const source = rec.source_path ? await deps.storage.get(rec.source_path) : null
  if (!master || !watermarked || (!source && !rec.collection_preview_id)) throw new GiftError('generation_unavailable')          // an owned artwork's photograph is optional: it may be gone (60-day retention), and the owned piece already exists
  const cleanPath = `${series}/${preview.id}.png`
  // A My Collection session already owns its piece (unlock_portfolio_id was set when it started, so the database creates no second one): nothing is copied into My Collection.
  if (!rec.collection_preview_id) {
    await deps.storage.put(cleanPath, master, 'image/png')
    await deps.storage.put(lockedPreviewPath(series, preview.id), watermarked, 'image/jpeg')
  }

  // The customer's FINAL APPROVAL ONLY. Nothing below can reach manufacturing: the store records final_approved_at and does not touch the order's status
  // (it stays 'awaiting_artwork', which the fulfilment pipeline cannot see), deps.kick is not called, and the Prodigi client is not imported here.
  try { await deps.store.finalizeOrder({ sessionId: rec.id, userId, portfolioId: (deps.newId ?? randomUUID)(), cleanPath, sourceImage: source ? source.toString('base64') : '' }) } catch (e) { fromStoreError(e) }
  return getSessionView(deps, userId, sessionId)
}

/**
 * RELEASE TO MANUFACTURING: a separate, explicit, operator-only step (scripts/gift-release-order.ts). No customer route, handler or button calls it. It requires the
 * customer's final approval (recorded by finalizeOrder), then moves the order from 'awaiting_artwork' to 'paid' (the state the existing fulfilment pipeline acts on, which
 * still runs its own account, payment, refund, upscale, QA and Prodigi checks) and asks the pipeline to start now. Idempotent.
 */
export async function releaseOrder(deps: GiftDeps, input: { operator: string; userId: string; sessionId: string; dryRun?: boolean }): Promise<{ status: 'would_release' | 'released' | 'already'; orderId: string }> {
  if (typeof input.operator !== 'string' || !input.operator.trim() || input.operator.length > 100) throw new Error('operator_required')
  const rec = await owned(deps, input.userId, input.sessionId)
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (rec.approved_at) return { status: 'already', orderId: rec.order_id }
  if (!finalizedAt(rec)) throw new GiftError('final_approval_required')
  if (input.dryRun) return { status: 'would_release', orderId: rec.order_id }
  let result: 'released' | 'already'
  try { result = await deps.store.releaseOrder(rec.id) } catch (e) { fromStoreError(e) }
  if (result === 'released' && deps.kick) await deps.kick(rec.order_id).catch(e => console.error('[gift/release] start deferred (the poller will pick it up):', e instanceof Error ? e.message : e))
  return { status: result, orderId: rec.order_id }
}

/**
 * @deprecated Legacy combined step (final approval AND release), kept so older tests and fixtures still read the same. No route, handler or script calls it: the customer's
 * final button is finalizeOrder, and release is releaseOrder. A test pins that nothing outside tests imports it.
 */
export async function approveOrder(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  const view = await finalizeOrder(deps, userId, sessionId)
  const rec = await owned(deps, userId, sessionId)
  if (!rec.approved_at) await releaseOrder(deps, { operator: 'legacy-approveOrder', userId, sessionId })
  void view
  return getSessionView(deps, userId, sessionId)
}

/** A real composition, via the existing Print Shop step: extends by outpaint or mirror inside geometry.ts limits, never crops. */
export async function composeWithPrintShop(i: { masterB64: string; size: PrintSize; finish: PrintFinish }) {
  if (i.finish === 'mug' || i.finish === 'card') return composePanelWithPrintShop(i)
  const { prepareComposition } = await import('../print/asset-pipeline')
  const original = await sharp(Buffer.from(i.masterB64, 'base64')).rotate().metadata()
  const c = await prepareComposition({ imageB64: i.masterB64, size: i.size, finish: i.finish })
  const image = await sharp(c.working).png().toBuffer()
  const fit = c.plan.composition.compatibility === 'extension' ? 'extend' : c.width === original.width && c.height === original.height ? 'exact' : 'resample'
  return { image, width: c.width, height: c.height, fit: fit as 'exact' | 'resample' | 'extend', outpainted: c.outpainted }
}

// ── OPERATOR REPAIR ────────────────────────────────────────────────────────────────────────────────────────────────────────────

export type RepairResult =
  | { status: 'not_needed'; lineId: string; compositionId: string }
  | { status: 'in_progress'; lineId: string; compositionId: string }
  | { status: 'would_repair'; lineId: string; compositionId: string; plan: { method: CompositionPlan['method']; generationAspect: string | null; fit: CompositionPlan['fit'] }; nb21Calls: number; repairSeq: number }
  | { status: 'repaired'; lineId: string; supersededCompositionId: string; compositionId: string; repairSeq: number; nb21Calls: number; reusedFiles: boolean }

export const REPAIR_CLAIM_MS = 15 * 60 * 1000

/**
 * OPERATOR-ONLY (no route, handler or page calls this; scripts/gift-repair-line.ts runs it, as a dry run unless told otherwise). Replaces ONE
 * line's composition when, and only when, the stored file fails the frozen-product shape check (a LITEN-side geometry defect). Targeted: it
 * never looks at, changes or repairs any other line.
 *   - inputs are the saved favorite and the frozen purchased product; the order, lines, prices, correction counts and other compositions are untouched
 *   - the defective row is SUPERSEDED in the same database transaction that releases the claim (gift_complete_repair): its files and plan stay
 *     for audit. The replacement is a new row, same attempt, repair_seq n + 1, 'ready' (never 'approved'): the customer approves what they now see
 *   - the claim is the database's (gift_claim_repair): one live claim per line across every serverless process, expiring after 15 minutes. After
 *     winning it the state is re-read, so a repair that finished a moment earlier is not repeated
 *   - interruption: the replacement's files have a fixed path, so a retry after a crash REUSES them instead of paying for a second generation; a
 *     replacement stored but not yet completed is finished by the next call (the old row is retired) without generating anything
 *   - allowed only while the order awaits artwork approval; completion re-checks that inside the transaction
 *   - dryRun reports the plan and the paid calls it would make, and changes nothing
 */
export async function repairLine(deps: GiftDeps, input: { operator: string; userId: string; sessionId: string; lineId: string; dryRun?: boolean }): Promise<RepairResult> {
  if (typeof input.operator !== 'string' || !input.operator.trim() || input.operator.length > 100) throw new Error('operator_required')
  const rec = await owned(deps, input.userId, input.sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (finalizedAt(rec)) throw new GiftError('order_not_awaiting_artwork')
  const scope = await scopeOf(deps, rec); requireOpen(scope)                // a DRAFT composition (before payment) or a purchased one still awaiting approval
  const preview = await selectedPreview(deps, rec)
  const ls = scope.lines.find(x => x.line.line_id === input.lineId)
  if (!ls) throw new GiftError('line_not_found')
  const line = ls.line, product = ls.product
  const mineOf = async () => (await deps.store.listCompositions(rec.id)).filter(c => c.line_id === line.line_id && c.preview_id === preview.id)
  const liveOf = (rows: CompositionRec[]) => rows.filter(c => c.status === 'ready' || c.status === 'approved').sort(byNewest)
  const now = () => (deps.clock ?? Date.now)()
  const claimFor = (c: CompositionRec) => deps.store.claimRepair({ sessionId: rec.id, lineId: line.line_id, compositionId: c.id, operator: input.operator, ttlMs: REPAIR_CLAIM_MS, nowMs: now() })
  const ids = { sessionId: rec.id, lineId: line.line_id }

  const rows = await mineOf(), live = liveOf(rows), current = live[0]
  if (!current) throw new GiftError('composition_not_found')

  if (compositionFitsProduct(current, product)) {
    // A repair interrupted after its replacement was stored: finish retiring the defective rows. Nothing is generated.
    if (!input.dryRun) for (const stale of live.slice(1).filter(c => !compositionFitsProduct(c, product))) {
      const token = await claimFor(stale); if (!token) continue
      try { await deps.store.completeRepair({ ...ids, token, oldId: stale.id, newId: current.id, note: { finishedBy: input.operator }, nowMs: now() }); await removeMockupFile(deps, stale) }
      catch (e) { await deps.store.releaseRepair(ids.sessionId, ids.lineId, token); fromStoreError(e) }
    }
    return { status: 'not_needed', lineId: line.line_id, compositionId: current.id }
  }

  const plan = planOf(rec, product)
  const nb21Calls = plan.method === 'generated' ? 1 : 0
  const seqOf = (all: CompositionRec[]) => Math.max(0, ...all.map(c => c.repair_seq ?? 0)) + 1
  if (input.dryRun) return { status: 'would_repair', lineId: line.line_id, compositionId: current.id, plan: { method: plan.method, generationAspect: plan.generationAspect, fit: plan.fit }, nb21Calls, repairSeq: seqOf(rows) }

  let token: string | null
  try { token = await claimFor(current) }
  catch (e) {                                                  // the row we read was retired by a repair that finished meanwhile: that is the answer, not an error
    const latest = e instanceof StoreError && e.code === 'composition_not_found' ? liveOf(await mineOf())[0] : undefined
    if (latest && compositionFitsProduct(latest, product)) return { status: 'not_needed', lineId: line.line_id, compositionId: latest.id }
    fromStoreError(e)
  }
  if (!token) return { status: 'in_progress', lineId: line.line_id, compositionId: current.id }
  try {
    // Won the claim: look again. Another process may have finished (and released) between our first read and our claim.
    const again = await mineOf(), now2 = liveOf(again)[0]
    if (!now2) throw new GiftError('composition_not_found')
    if (now2.id !== current.id && compositionFitsProduct(now2, product)) { await deps.store.releaseRepair(ids.sessionId, ids.lineId, token); return { status: 'not_needed', lineId: line.line_id, compositionId: now2.id } }
    const seq = seqOf(again), slot = `${line.line_id}-r${seq}`, base = `gift/${rec.id}/compositions/${preview.id}-${slot}`

    // A previous attempt may have stored the replacement's files and died before recording them: reuse them, do not pay again.
    let files: GroupFiles | null = null
    const [img, prv] = [await deps.storage.get(base + '.png'), await deps.storage.get(base + '.jpg')]
    if (img && prv) {
      const m = await sharp(img).metadata()
      if (m.width && m.height && compositionFitsProduct({ width: m.width, height: m.height }, product)) {
        files = { image: base + '.png', preview: base + '.jpg', width: m.width, height: m.height, fit: plan.fit, outpainted: false, nb21Calls: 0, sha256: createHash('sha256').update(img).digest('hex'),
                  generationMode: plan.method === 'generated' ? (supportsFavoriteReference(rec.series!) ? 'favorite_reference' : 'photo_regeneration') : 'none' }
      }
    }
    const reusedFiles = !!files
    if (!files) {
      const master = await deps.storage.get(preview.master_path!)
      if (!master) throw new GiftError('generation_unavailable')
      try { files = await composeGroup(deps, rec, preview, product, plan, master, slot) } catch (e) { console.error('gift_repair_compose_failed', JSON.stringify({ sessionId: rec.id, lineId: line.line_id, ...composeFailure(e) })); if (e instanceof GiftError) throw e; throw new GiftError('composition_failed') }
    }
    const row = await deps.store.insertComposition({
      ...recordFor(rec, preview, line, current.attempt, plan, files, null, true, { sku: product.sku, repair: { of: current.id, seq, operator: input.operator, reason: 'geometry_mismatch', at: new Date(now()).toISOString(), ...(reusedFiles ? { reusedFiles: true } : {}) } }),
      repair_seq: seq,
    })
    await deps.store.completeRepair({ ...ids, token, oldId: current.id, newId: row.id, note: { repairedBy: input.operator }, nowMs: now() })
    await removeMockupFile(deps, current)
    return { status: 'repaired', lineId: line.line_id, supersededCompositionId: current.id, compositionId: row.id, repairSeq: seq, nb21Calls: files.nb21Calls, reusedFiles }
  } catch (e) {
    // Drop the claim so a retry need not wait for it to expire. A stored replacement is never undone: the next call retires the old row.
    try { await deps.store.releaseRepair(ids.sessionId, ids.lineId, token) } catch { /* it expires on its own */ }
    fromStoreError(e)
  }
}

/**
 * The mug and the card: the composition is the PANEL picture (a 1:1 face panel, or the 5:7 card front), at the panel's exact shape, extended by outpaint inside the
 * approved bound or by reflection and never cropped. The wrap and the spread are built around it later (print file and mockup both use product-layout.ts).
 */
async function composePanelWithPrintShop(i: { masterB64: string; size: PrintSize; finish: PrintFinish }) {
  const { preparePanelComposition } = await import('../print/asset-pipeline')
  const { CARD, MUG } = await import('../print/production-profiles')
  const panel = i.finish === 'mug' ? { w: MUG.panel.w, h: MUG.panel.h } : { w: CARD.frontTrim.w, h: CARD.frontTrim.h }
  const c = await preparePanelComposition({ imageB64: i.masterB64, panel })
  return { image: await sharp(c.working).png().toBuffer(), width: c.width, height: c.height, fit: c.fit, outpainted: c.outpainted }
}

/**
 * IDENTITY CHECK for a composition that is an accepted generation: the generation is delivered and accepted, its recorded sha256 is the composition's pinned artwork sha256 and the checkout pin, and the
 * stored file still hashes to it. Anything else means the picture is not the one the customer approved: refused (generation_changed), never printed.
 */
export async function verifyGenerationComposition(deps: GiftDeps, rec: SessionRec, c: CompositionRec, order?: { items: Array<{ frozen?: unknown }> } | null): Promise<void> {
  const g = c.generation_id ? await deps.store.getGeneration(rec.id, c.generation_id).catch(() => null) : null
  const pinned = (c.plan as { artworkSha256?: string }).artworkSha256
  if (!g || g.status !== 'ready' || !g.accepted_at || !g.sha256 || !pinned || g.sha256 !== pinned || !c.composed_path || c.composed_path !== g.master_path) throw new GiftError('generation_changed')
  const item = order?.items.find(i => (i.frozen as { composition?: { compositionId?: string } } | undefined)?.composition?.compositionId === c.id)
  const frozen = (item?.frozen as { composition?: { artworkSha256?: string | null; frameColor?: string | null }; product?: { attributes?: Record<string, string> } } | undefined)
  if (frozen?.composition?.artworkSha256 && frozen.composition.artworkSha256 !== g.sha256) throw new GiftError('generation_changed')
  // THE FINISH IS PART OF WHAT WAS APPROVED: the colour the composition was approved for, the colour pinned at checkout and the colour sold (frozen into the order) must all be the same.
  const pinnedLayout = (frozen?.composition as { layout?: string | null } | undefined)?.layout          // the layout the line was sold in is the layout approved (never reinterpreted with another version's sizes)
  if (pinnedLayout && (c.plan as { layout?: string }).layout !== pinnedLayout) throw new GiftError('generation_changed')
  const approvedColor = (c.plan as { frameColor?: string }).frameColor
  if (approvedColor !== undefined && (frozen?.composition?.frameColor ?? approvedColor) !== approvedColor || (approvedColor !== undefined && frozen?.product?.attributes?.color !== undefined && frozen.product.attributes.color !== approvedColor)) throw new GiftError('finish_not_accepted')
  const bytes = await deps.storage.get(c.composed_path)
  if (!bytes || createHash('sha256').update(bytes).digest('hex') !== g.sha256) throw new GiftError('generation_changed')
}
