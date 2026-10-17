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
import { randomUUID } from 'node:crypto'
import { lockedPreviewPath } from '@/lib/store/preview'
import type { PrintFinish, PrintSize } from '../print/sku-map'
import { allProducts, type CanonicalProduct } from '../print/catalog'
import { groupLines, planFor, type CompositionPlan, type PlanContext } from './composition-plan'
import { supportsFavoriteReference } from './aspects'
import { estimateCompositionCost } from './policy'
import { GiftError, fromStoreError, getSessionView, owned, type GiftDeps } from './service'
import type { CompositionRec, PreviewRec, SessionRec } from './store'
import type { SessionView } from './types'

async function selectedPreview(deps: GiftDeps, rec: SessionRec): Promise<PreviewRec> {
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')
  const all = await deps.store.listBatches(rec.id)
  const p = all.flatMap(b => b.previews).find(x => x.id === rec.artwork_preview_id && x.status === 'ready' && x.master_path)
  if (!p) throw new GiftError('preview_not_ready')
  return p
}

const active = (comps: CompositionRec[], lineId: string, previewId: string) =>
  comps.filter(c => c.line_id === lineId && c.preview_id === previewId && (c.status === 'ready' || c.status === 'approved')).sort((a, b) => b.attempt - a.attempt)[0]

/** Pick THE artwork. Allowed until approval; supersedes compositions of any previously selected artwork. */
export async function selectArtwork(deps: GiftDeps, userId: string, sessionId: string, previewId: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (typeof previewId !== 'string' || !/^[0-9a-f-]{36}$/i.test(previewId)) throw new GiftError('preview_not_ready')
  try { await deps.store.selectArtwork(rec.id, userId, previewId) } catch (e) { fromStoreError(e) }
  return getSessionView(deps, userId, sessionId)
}

interface GroupFiles {
  image: string; preview: string; width: number; height: number; fit: 'exact' | 'resample' | 'extend'; outpainted: boolean
  generationMode: CompositionRec['generation_mode']; nb21Calls: number
}
type LineInfo = { line_id: string; product_id: string }

const productOf = (line: LineInfo): CanonicalProduct => {
  const p = allProducts().find(x => x.productId === line.product_id)
  if (!p) throw new GiftError('product_not_available')
  return p
}
const ctxOf = (rec: SessionRec): PlanContext => ({ series: rec.series!, peopleCount: rec.analysis.peopleCount ?? null, masterAspect: rec.master_aspect ?? '1:1' })
const planOf = (rec: SessionRec, line: LineInfo): CompositionPlan => {
  const plan = planFor(productOf(line), ctxOf(rec))
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
async function composeGroup(deps: GiftDeps, rec: SessionRec, preview: PreviewRec, representative: LineInfo, plan: CompositionPlan, master: Buffer, slot: string): Promise<GroupFiles> {
  if (!deps.compose) throw new GiftError('composition_failed')
  const product = productOf(representative)
  let source = master
  let generationMode: GroupFiles['generationMode'] = 'none'
  if (plan.method === 'generated') {
    if (!rec.source_path || !rec.series) throw new GiftError('generation_unavailable')
    const photo = await deps.storage.get(rec.source_path)
    if (!photo) throw new GiftError('generation_unavailable')
    // The customer's approved artwork goes along as a reference wherever the series' route can take one (Portraits, Pets); Groups
    // regenerates from the photograph alone. Either way the result is a NEW generation that the customer sees and approves.
    const useReference = supportsFavoriteReference(rec.series)
    const out = await deps.generate({
      series: rec.series, sourceB64: photo.toString('base64'), effectId: preview.effect_id, aspect: plan.generationAspect!, userId: rec.user_id,
      peopleCount: rec.analysis.peopleCount ?? null, productComposition: true, ...(useReference ? { referenceB64: master.toString('base64') } : {}),
    })
    source = Buffer.from(out.imageB64, 'base64')
    generationMode = useReference ? 'favorite_reference' : 'photo_regeneration'
  }
  const made = await deps.compose({ masterB64: source.toString('base64'), size: product.size as PrintSize, finish: product.family as PrintFinish })
  const marked = await deps.watermark(made.image.toString('base64'))              // the customer's view of a clean composition: watermarked, fails closed
  const base = `gift/${rec.id}/compositions/${preview.id}-${slot}`
  await deps.storage.put(`${base}.png`, made.image, 'image/png')
  await deps.storage.put(`${base}.jpg`, marked, 'image/jpeg')
  return { image: `${base}.png`, preview: `${base}.jpg`, width: made.width, height: made.height, fit: made.fit, outpainted: made.outpainted, generationMode, nb21Calls: generationMode === 'none' ? 0 : 1 }
}

/** `paid` is true only for the row that CREATED the files: rows that reuse a shared composition cost nothing of their own. */
const recordFor = (rec: SessionRec, preview: PreviewRec, line: LineInfo, attempt: 1 | 2, plan: CompositionPlan, f: GroupFiles, sourceId: string | null, paid: boolean) => {
  const nb21 = paid ? f.nb21Calls : 0, outpaint = paid && f.outpainted ? 1 : 0
  return {
    session_id: rec.id, line_id: line.line_id, preview_id: preview.id, attempt, status: 'ready' as const, composed_path: f.image, preview_path: f.preview,
    width: f.width, height: f.height, geometry_key: plan.geometryKey, method: plan.method, source_composition_id: sourceId,
    generation_mode: f.generationMode, generation_aspect: plan.method === 'generated' ? plan.generationAspect : null,
    nb21_calls: nb21, outpaint_calls: outpaint, cost_usd_est: estimateCompositionCost({ nb21, outpaint }),
    plan: { fit: f.fit, outpainted: f.outpainted, method: plan.method, geometryKey: plan.geometryKey, generationAspect: plan.generationAspect, targetAspect: plan.targetAspect,
            generationMode: f.generationMode, sourceArtworkId: preview.id, correction: attempt === 2 } as Record<string, unknown>,
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
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const order = await deps.store.getOrder(rec.order_id)
  if (!order || order.status !== 'awaiting_artwork') throw new GiftError('order_not_awaiting_artwork')
  const preview = await selectedPreview(deps, rec)
  const lines = await deps.store.orderLines(rec.order_id)
  if (!lines.length) throw new GiftError('order_has_no_lines')
  const comps = await deps.store.listCompositions(rec.id)
  const missing = lines.filter(l => !active(comps, l.line_id, preview.id))
  if (!missing.length) return getSessionView(deps, userId, sessionId)

  const groups = groupLines(missing.map(l => ({ line: l, product: productOf(l) })), ctxOf(rec))
  const master = await deps.storage.get(preview.master_path!)
  if (!master) throw new GiftError('generation_unavailable')
  let failed = 0
  for (const g of groups) {
    // Files already made for this requirement and this artwork (by another line, or an earlier call) are reused.
    const existing = comps.find(c => c.preview_id === preview.id && c.geometry_key === g.geometryKey && c.attempt === 1 && c.composed_path && c.preview_path && c.status !== 'failed')
    let files: GroupFiles | null = existing ? { image: existing.composed_path!, preview: existing.preview_path!, width: existing.width ?? 0, height: existing.height ?? 0, fit: ((existing.plan as { fit?: GroupFiles['fit'] }).fit ?? 'exact'), outpainted: !!(existing.plan as { outpainted?: boolean }).outpainted, generationMode: existing.generation_mode, nb21Calls: 0 } : null
    if (!files) {
      try { files = await composeGroup(deps, rec, preview, g.items[0].line, g.plan, master, g.geometryKey) } catch { failed++; continue }
    }
    let creatorId: string | null = existing?.id ?? null
    for (const it of g.items) {
      try {
        const row = await deps.store.insertComposition(recordFor(rec, preview, it.line, 1, g.plan, files, creatorId, creatorId === null))
        creatorId ??= row.id
      } catch { /* a concurrent call already recorded this line: the unique key makes the repeat harmless */ }
    }
  }
  if (failed) throw new GiftError('composition_failed')                  // finished groups are kept; calling again fills only the rest
  return getSessionView(deps, userId, sessionId)
}

/** The ONE free correction for a line: a new composition of its own (never touching what other lines share) that replaces its first. */
export async function correctLine(deps: GiftDeps, userId: string, sessionId: string, lineId: string): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const order = await deps.store.getOrder(rec.order_id)
  if (!order || order.status !== 'awaiting_artwork') throw new GiftError('order_not_awaiting_artwork')
  const preview = await selectedPreview(deps, rec)
  const line = (await deps.store.orderLines(rec.order_id)).find(l => l.line_id === lineId)
  if (!line) throw new GiftError('line_not_found')
  const current = active(await deps.store.listCompositions(rec.id), lineId, preview.id)
  if (!current) throw new GiftError('composition_not_found')
  if (line.corrections_used >= 1 || current.attempt >= 2) throw new GiftError('correction_limit')       // the rest goes to Concierge
  const master = await deps.storage.get(preview.master_path!)
  if (!master) throw new GiftError('generation_unavailable')
  const plan = planOf(rec, line)
  let files: GroupFiles
  try { files = await composeGroup(deps, rec, preview, line, plan, master, `${lineId}-2`) } catch (e) { if (e instanceof GiftError) throw e; throw new GiftError('composition_failed') }
  try { await deps.store.insertComposition(recordFor(rec, preview, line, 2, plan, files, null, true)) } catch (e) { fromStoreError(e); throw new GiftError('composition_failed') }
  try { await deps.store.useCorrection(rec.id, userId, lineId) } catch (e) { fromStoreError(e) }
  await deps.store.patchComposition(current.id, { status: 'superseded' })
  return getSessionView(deps, userId, sessionId)
}

export async function approveComposition(deps: GiftDeps, userId: string, sessionId: string, compositionId: unknown): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')
  const comp = (await deps.store.listCompositions(rec.id)).find(c => c.id === compositionId)
  if (!comp || comp.preview_id !== rec.artwork_preview_id || comp.status === 'superseded' || comp.status === 'failed') throw new GiftError('composition_not_found')
  if (comp.status === 'ready') await deps.store.patchComposition(comp.id, { status: 'approved', approved_at: new Date((deps.clock ?? Date.now)()).toISOString() })
  return getSessionView(deps, userId, sessionId)
}

/**
 * Approve the order. The artwork becomes the customer's unlocked My Collection piece (one per order, no credit consumed), and
 * the order is released to the existing fulfilment pipeline, which still runs its own account, payment, upscale, QA and
 * Prodigi safeguards. Idempotent.
 */
export async function approveOrder(deps: GiftDeps, userId: string, sessionId: string): Promise<SessionView> {
  const rec = await owned(deps, userId, sessionId)
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (rec.approved_at) return getSessionView(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  const preview = await selectedPreview(deps, rec)
  const lines = await deps.store.orderLines(rec.order_id)
  if (!lines.length) throw new GiftError('order_has_no_lines')
  const comps = await deps.store.listCompositions(rec.id)
  if (lines.some(l => active(comps, l.line_id, preview.id)?.status !== 'approved')) throw new GiftError('compositions_not_approved')   // checked again, atomically, in the database

  // The piece must outlive the session, so the clean master and its watermarked view are copied to where My Collection reads them.
  const series = rec.series!
  const master = await deps.storage.get(preview.master_path!)
  const watermarked = preview.preview_path ? await deps.storage.get(preview.preview_path) : null
  const source = rec.source_path ? await deps.storage.get(rec.source_path) : null
  if (!master || !watermarked || !source) throw new GiftError('generation_unavailable')
  const cleanPath = `${series}/${preview.id}.png`
  await deps.storage.put(cleanPath, master, 'image/png')
  await deps.storage.put(lockedPreviewPath(series, preview.id), watermarked, 'image/jpeg')

  let result: 'approved' | 'already'
  try {
    result = await deps.store.approveOrder({ sessionId: rec.id, userId, portfolioId: (deps.newId ?? randomUUID)(), cleanPath, sourceImage: source.toString('base64') })
  } catch (e) { fromStoreError(e) }
  if (result === 'approved' && deps.kick) await deps.kick(rec.order_id).catch(e => console.error('[gift/approve] release to fulfilment deferred:', e instanceof Error ? e.message : e))
  return getSessionView(deps, userId, sessionId)
}

/** A real composition, via the existing Print Shop step: extends by outpaint or mirror inside geometry.ts limits, never crops. */
export async function composeWithPrintShop(i: { masterB64: string; size: PrintSize; finish: PrintFinish }) {
  const { prepareComposition } = await import('../print/asset-pipeline')
  const original = await sharp(Buffer.from(i.masterB64, 'base64')).rotate().metadata()
  const c = await prepareComposition({ imageB64: i.masterB64, size: i.size, finish: i.finish })
  const image = await sharp(c.working).png().toBuffer()
  const fit = c.plan.composition.compatibility === 'extension' ? 'extend' : c.width === original.width && c.height === original.height ? 'exact' : 'resample'
  return { image, width: c.width, height: c.height, fit: fit as 'exact' | 'resample' | 'extend', outpainted: c.outpainted }
}
