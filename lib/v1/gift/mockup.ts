// lib/v1/gift/mockup.ts
//
// THE SERVER-OWNED PRODUCT MOCKUP BOUNDARY. One authenticated call turns a purchased line's CURRENT composition into a watermarked
// product mockup, using the existing Node/Sharp compositor (Codex's tools/product-mockup adapter) behind the MockupRenderer port.
//
//   * The browser sends a session id and a line id, and optionally the composition id it is currently showing. Nothing else: no
//     composition id to render, no URL, no product id, no geometry. Everything is resolved here from records the customer owns.
//   * The CLEAN composed artwork is read from private storage inside this function and handed to the renderer in memory. It is never
//     returned, never given a URL, and never written next to the mockup. Only the WATERMARKED mockup is stored and signed.
//   * Geometry and configuration come from the order's frozen snapshot (frozen.ts), not from today's catalog.
//   * The mockup is a visualization. It authorizes nothing: no purchase, no approval, no fulfilment (the view says so explicitly).
//
// CACHE IDENTITY (never a signed URL): sha256 of the purchased order and line, the current composition id and attempt, the selected
// artwork, the SHA-256 of the composed artwork bytes, the template id and its revision, the frozen product configuration and finish,
// and the geometry snapshot's source and version. Anything that changes any of those (a correction, a different favorite, a revised
// template) produces a different identity, so the old mockup is never served for the new situation. The identity is stored with the
// mockup's file path on the composition row (plan.mockup), so a repeat call with an unchanged identity re-signs the stored file and
// renders nothing. Rendering is deterministic per identity and writes to a path derived from the identity, so a retry or a concurrent
// call writes the same file and cannot corrupt another line's mockup.
//
// SIGNED URLS expire in MOCKUP_URL_SECONDS (15 minutes). A page that needs a fresh URL calls this endpoint again; with an unchanged
// identity that costs one storage signature, not a render.

import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { GiftError, owned, type GiftDeps } from './service'
import { resolveFrozenProduct } from './frozen'
import type { CanonicalProduct } from '../print/catalog'
import type { CompositionRec, SessionRec } from './store'
import type { MockupView } from './types'

export const MOCKUP_CONTRACT_VERSION = 1
export const MOCKUP_URL_SECONDS = 900

/** The renderer port. The real one wraps the existing adapter (mockup-real.ts); tests inject a fake. */
export interface MockupRenderer {
  /** A string that changes whenever the renderer code, the template manifest or any template asset changes. */
  revision(templateId: string): Promise<string>
  render(input: { templateId: string; productFamily: string; size: string; sku: string; artworkId: string; artwork: Buffer }): Promise<{
    png: Buffer; width: number; height: number; visualizationKey: string
    /** Echoed by the renderer's own catalog so a mismatch with the frozen snapshot is caught. */
    configuration: { sku: string; requiredPx: { w: number; h: number } }
    crop: Record<string, unknown> | null
  }>
}

/** The approved template for a purchased product, or null when none exists (mugs, cards and every disabled family have none). */
export function templateFor(p: CanonicalProduct): string | null {
  const square = p.requirements.picturePx.w === p.requirements.picturePx.h
  switch (p.family) {
    case 'fine_art': return 'fine-art'
    case 'premium': return 'premium-fine-art'
    case 'framed': return p.attributes.color === 'black' ? (square ? 'square-framed' : 'classic-framed') : null     // black only; other finishes are visual tests
    case 'canvas': return p.attributes.wrap === 'MirrorWrap' ? (square ? 'gallery-canvas-square' : 'gallery-canvas') : null
    default: return null
  }
}

/**
 * What the renderer is shown. A composed file is the product's whole lab file; for a canvas that includes the mirrored wrap margin
 * (wrapPx) around the picture, and the compositor builds its own wrap from the PICTURE, so it must be given the picture area only
 * (found on a real run: a 12 x 18 canvas file, 3654 x 5454, is refused as the wrong shape, 3600 x 5400 is exact). The margin is not
 * subject matter: it is removed, nothing inside the picture is cropped or resampled. Products without wrap pass through untouched.
 * A composed file at a different scale than finalPx (a preview-size file) has its margins scaled by the same factor.
 */
export async function pictureArea(artwork: Buffer, product: CanonicalProduct): Promise<Buffer> {
  const { wrapPx, finalPx, picturePx } = product.requirements
  if (!wrapPx.left && !wrapPx.right && !wrapPx.top && !wrapPx.bottom) return artwork
  const meta = await sharp(artwork).metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable_artwork')
  const k = meta.width / finalPx.w
  if (Math.abs(meta.height / finalPx.h - k) > 0.01) throw new Error('artwork_shape_mismatch')               // not the shape this product's file has: never guess
  const left = Math.round(wrapPx.left * k), top = Math.round(wrapPx.top * k)
  const width = Math.min(meta.width - left, Math.round(picturePx.w * k)), height = Math.min(meta.height - top, Math.round(picturePx.h * k))
  return sharp(artwork).extract({ left, top, width, height }).png().toBuffer()
}

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

export interface MockupIdentityInput {
  orderId: string; lineId: string; lineIndex: number; compositionId: string; attempt: number; sourceArtworkId: string; artworkSha256: string
  templateId: string; templateRevision: string; product: CanonicalProduct; geometrySource: string; frozenCatalogVersion: string | null
}
/** The stable rendering identity. Key order is fixed, so the same inputs always give the same key. */
export function mockupIdentityKey(i: MockupIdentityInput): string {
  const r = i.product.requirements
  return sha(JSON.stringify({
    v: MOCKUP_CONTRACT_VERSION, orderId: i.orderId, lineId: i.lineId, lineIndex: i.lineIndex, compositionId: i.compositionId, attempt: i.attempt,
    sourceArtworkId: i.sourceArtworkId, artworkSha256: i.artworkSha256, templateId: i.templateId, templateRevision: i.templateRevision,
    productId: i.product.productId, sku: i.product.sku, finalPx: r.finalPx, picturePx: r.picturePx, wrapPx: r.wrapPx, orientation: r.skuOrientation,
    attributes: Object.fromEntries(Object.entries(i.product.attributes).sort()), geometrySource: i.geometrySource, frozenCatalogVersion: i.frozenCatalogVersion,
  }))
}

interface StoredMockup { identityKey: string; path: string; templateId: string; templateRevision: string; visualizationKey: string; width: number; height: number; crop: Record<string, unknown> | null; createdAt: string }
const storedOf = (c: CompositionRec): StoredMockup | null => {
  const m = (c.plan as { mockup?: StoredMockup }).mockup
  return m && typeof m.identityKey === 'string' && typeof m.path === 'string' ? m : null
}
const mockupPath = (sessionId: string, key: string) => `gift/${sessionId}/mockups/${key}.jpg`

/** Log the real cause of a mockup failure (server log only: never in the response, never any artwork, only the error text and ids). */
function fail(stage: string, e: unknown, ctx: { templateId?: string; sku?: string; lineId?: string }): GiftError {
  const err = e as { name?: string; code?: string; message?: string }
  console.error(`[gift/mockup] ${stage} failed template=${ctx.templateId ?? '-'} sku=${ctx.sku ?? '-'} line=${ctx.lineId ?? '-'}: ${err?.name ?? 'Error'}${err?.code ? ' ' + err.code : ''}: ${String(err?.message ?? e).slice(0, 500)}`)
  return new GiftError('mockup_failed')
}

/** Remove a composition's stored mockup file (best effort): used when a correction supersedes it. The rows are kept; the file is only a cache. */
export async function removeMockupFile(deps: GiftDeps, c: CompositionRec): Promise<void> {
  const m = storedOf(c)
  if (m) { try { await deps.storage.remove([m.path]) } catch { /* cleanup removes it with the session */ } }
}

/** Paths of every stored mockup of these compositions, for retention cleanup. */
export const mockupPaths = (comps: CompositionRec[]): string[] => comps.flatMap(c => { const m = storedOf(c); return m ? [m.path] : [] })

/**
 * The mockup for one purchased line's current composition. 404 session_not_found for anyone else's session, 404 line_not_found for a
 * line that is not on this order, 409 for refunded orders, unpaid orders, a stale expected composition, or no composition yet.
 */
export async function getLineMockup(deps: GiftDeps, userId: string, sessionId: string, lineId: unknown, expectCompositionId?: unknown): Promise<MockupView> {
  const rec: SessionRec = await owned(deps, userId, sessionId)
  if (typeof lineId !== 'string' || !lineId || lineId.length > 64) throw new GiftError('line_not_found')
  if (!rec.order_id) throw new GiftError('order_payment_required')
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (!deps.mockup) throw new GiftError('mockup_renderer_unavailable')
  const order = await deps.store.getOrder(rec.order_id)
  if (!order || !order.paid_at || order.status === 'created' || order.status === 'cancelled') throw new GiftError('order_not_paid')
  const line = (await deps.store.orderLines(rec.order_id)).find(l => l.line_id === lineId && l.order_id === rec.order_id && l.session_id === rec.id)
  if (!line) throw new GiftError('line_not_found')
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')

  const comp = (await deps.store.listCompositions(rec.id))
    .filter(c => c.line_id === line.line_id && c.preview_id === rec.artwork_preview_id && (c.status === 'ready' || c.status === 'approved') && c.composed_path)
    .sort((a, b) => b.attempt - a.attempt)[0]
  if (!comp) throw new GiftError('composition_not_found')
  // A page that is showing an older composition (before a correction or a new favorite) is told so, and is given the current one in the error.
  if (typeof expectCompositionId === 'string' && expectCompositionId && expectCompositionId !== comp.id) throw new GiftError('stale_composition')

  const resolved = resolveFrozenProduct(order.items, line)
  if (!resolved.ok) throw new GiftError(resolved.reason)
  const product = resolved.product
  const templateId = templateFor(product)
  if (!templateId) throw new GiftError('product_not_available')

  const artworkSha256 = typeof (comp.plan as { artworkSha256?: unknown }).artworkSha256 === 'string' ? (comp.plan as { artworkSha256: string }).artworkSha256 : null
  const clean = artworkSha256 ? null : await deps.storage.get(comp.composed_path!)         // an older row without a recorded hash: hash it once, then remember
  if (!artworkSha256 && !clean) throw new GiftError('generation_unavailable')
  const sourceHash = artworkSha256 ?? sha(clean!)
  const templateRevision = await deps.mockup.revision(templateId)
  const identityKey = mockupIdentityKey({
    orderId: rec.order_id, lineId: line.line_id, lineIndex: line.line_index, compositionId: comp.id, attempt: comp.attempt, sourceArtworkId: comp.preview_id, artworkSha256: sourceHash,
    templateId, templateRevision, product, geometrySource: resolved.source, frozenCatalogVersion: resolved.catalogVersion,
  })

  const base = {
    contractVersion: MOCKUP_CONTRACT_VERSION as typeof MOCKUP_CONTRACT_VERSION, sessionId: rec.id, lineId: line.line_id, productId: product.productId, sku: product.sku,
    compositionId: comp.id, attempt: comp.attempt, compositionStatus: comp.status as 'ready' | 'approved', sourceArtworkId: comp.preview_id,
    templateId, templateRevision, identityKey, geometrySource: resolved.source, frozenCatalogVersion: resolved.catalogVersion,
    watermarked: true as const, productionPrintFile: false as const, purchaseAuthorization: false as const,
  }
  const sign = async (path: string) => {
    const url = await deps.storage.signedUrl(path, MOCKUP_URL_SECONDS)
    return url ? { url, urlExpiresAt: new Date((deps.clock ?? Date.now)() + MOCKUP_URL_SECONDS * 1000).toISOString() } : null
  }

  const hit = storedOf(comp)
  if (hit && hit.identityKey === identityKey) {
    const signed = await sign(hit.path)
    if (signed) return { ...base, ...signed, width: hit.width, height: hit.height, cached: true, crop: hit.crop }
  }

  const artwork = clean ?? await deps.storage.get(comp.composed_path!)                       // CLEAN: memory only, handed to the renderer, never returned
  if (!artwork) throw new GiftError('generation_unavailable')
  let out: Awaited<ReturnType<MockupRenderer['render']>>
  try { out = await deps.mockup.render({ templateId, productFamily: product.family, size: product.size, sku: product.sku, artworkId: comp.id, artwork: await pictureArea(artwork, product) }) }
  catch (e) { throw fail('renderer', e, { templateId, sku: product.sku, lineId: line.line_id }) }
  // The renderer reads its own catalog; if that disagrees with what was purchased, the mockup would show the wrong product. Refuse it.
  if (out.configuration.sku !== product.sku || out.configuration.requiredPx.w !== product.requirements.finalPx.w || out.configuration.requiredPx.h !== product.requirements.finalPx.h) throw new GiftError('mockup_configuration_mismatch')
  let marked: Buffer
  try { marked = await deps.watermark(out.png.toString('base64')) } catch (e) { throw fail('watermark', e, { templateId, sku: product.sku, lineId: line.line_id }) }        // fails closed: no unmarked mockup is ever stored
  const path = mockupPath(rec.id, identityKey)
  await deps.storage.put(path, marked, 'image/jpeg')
  const stored: StoredMockup = { identityKey, path, templateId, templateRevision, visualizationKey: out.visualizationKey, width: out.width, height: out.height, crop: out.crop, createdAt: new Date((deps.clock ?? Date.now)()).toISOString() }
  await deps.store.patchComposition(comp.id, { plan: { ...comp.plan, artworkSha256: sourceHash, mockup: stored } })
  if (hit && hit.path !== path) { try { await deps.storage.remove([hit.path]) } catch { /* cleanup removes it with the session */ } }
  const signed = await sign(path)
  if (!signed) throw fail('sign', new Error('signed_url_unavailable'), { templateId, sku: product.sku, lineId: line.line_id })
  return { ...base, ...signed, width: out.width, height: out.height, cached: false, crop: out.crop }
}
