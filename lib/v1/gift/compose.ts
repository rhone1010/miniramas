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
import { GiftError, fromStoreError, getSessionView, owned, type GiftDeps } from './service'
import type { CompositionRec, PreviewRec, SessionRec } from './store'
import type { SessionView } from './types'

const compositionPaths = (sessionId: string, previewId: string, lineId: string, attempt: number) => ({
  image: `gift/${sessionId}/compositions/${previewId}-${lineId}-${attempt}.png`,
  preview: `gift/${sessionId}/compositions/${previewId}-${lineId}-${attempt}.jpg`,
})

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

async function composeOne(deps: GiftDeps, rec: SessionRec, preview: PreviewRec, line: { line_id: string; product_id: string }, attempt: 1 | 2, master: Buffer): Promise<CompositionRec> {
  if (!deps.compose) throw new GiftError('composition_failed')
  const [family, size] = line.product_id.split(':')
  const made = await deps.compose({ masterB64: master.toString('base64'), size: size as PrintSize, finish: family as PrintFinish })
  const marked = await deps.watermark(made.image.toString('base64'))                // customer view of a clean composition: watermarked, fails closed
  const paths = compositionPaths(rec.id, preview.id, line.line_id, attempt)
  await deps.storage.put(paths.image, made.image, 'image/png')
  await deps.storage.put(paths.preview, marked, 'image/jpeg')
  return deps.store.insertComposition({
    session_id: rec.id, line_id: line.line_id, preview_id: preview.id, attempt, status: 'ready', composed_path: paths.image, preview_path: paths.preview,
    width: made.width, height: made.height, plan: { fit: made.fit, outpainted: made.outpainted },
  })
}

/** One composition per purchased line, from the selected artwork. Idempotent: lines that already have one are untouched. */
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
  if (missing.length) {
    const master = await deps.storage.get(preview.master_path!)
    if (!master) throw new GiftError('generation_unavailable')
    let failed = 0
    for (const l of missing) {
      try { await composeOne(deps, rec, preview, l, 1, master) } catch { failed++ }
    }
    if (failed) throw new GiftError('composition_failed')                  // the ones that worked are kept; calling again fills only the rest
  }
  return getSessionView(deps, userId, sessionId)
}

/** The ONE free correction for a line: another composition of the same artwork, which replaces the first. */
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
  try { await composeOne(deps, rec, preview, line, 2, master) } catch (e) { if (e instanceof GiftError) throw e; throw new GiftError('composition_failed') }
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
