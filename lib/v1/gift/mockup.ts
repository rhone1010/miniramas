// lib/v1/gift/mockup.ts
//
// THE SERVER-OWNED PRODUCT MOCKUP BOUNDARY. One authenticated call turns a purchased line's CURRENT composition into a CLEAN (paid) or watermarked
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
import { compositionFitsProduct } from './frozen'
import { scopeOf } from './scope'
import { mockupInputFor } from '../print/product-layout'
import { getProductBySku, type CanonicalProduct } from '../print/catalog'
import { resolveScene, prepareSceneArtwork, sceneRepresentationId, SCENE_REPRESENTATION_VERSION, type SceneRenderer } from './scenes'
import { byNewest, type CompositionRec, type SessionRec } from './store'
import type { MockupView } from './types'

export const MOCKUP_CONTRACT_VERSION = 1
/** GIFT_SCENE_MOCKUPS=0 turns the photographic customer scenes off (every line then uses the calibrated renderer, exactly as before). */
const scenesEnabled = () => process.env.GIFT_SCENE_MOCKUPS !== '0'
export const MOCKUP_URL_SECONDS = 900
/** The longest edge of a delivered mockup. A mockup is a picture of the product in a scene, never the production file; this keeps it so. */
export const MOCKUP_MAX_EDGE = 1800

/**
 * The customer's view after VERIFIED payment: the rendered product scene, clean (no watermark), as a JPEG no larger than MOCKUP_MAX_EDGE. It is derived
 * from the renderer's scene image only; the clean composition, the master and the print file are never returned, linked or stored under this path.
 * The 6+6 free artistic previews and every unpaid view stay watermarked (deps.watermark).
 */
export async function cleanMockupJpeg(png: Buffer): Promise<Buffer> {
  return sharp(png).resize({ width: MOCKUP_MAX_EDGE, height: MOCKUP_MAX_EDGE, fit: 'inside', withoutEnlargement: true }).toColourspace('srgb').jpeg({ quality: 90 }).toBuffer()
}

/** The renderer port. The real one wraps the existing adapter (mockup-real.ts); tests inject a fake. */
export interface MockupRenderer {
  /** The photographic customer scenes (Codex's tools/product-scenes). Absent: every line uses the calibrated renderer below. */
  scenes?: SceneRenderer
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
    case 'mug': return p.sku === 'GLOBAL-MUG-W' ? 'ceramic-mug' : null               // Codex's calibrated visual-test templates (handle on the right, front-facing portrait card); approval is tracked in gift-enablement.ts
    case 'card': return p.sku === 'GLOBAL-GRE-MOH-7X5-BLA' ? 'greeting-card' : null            // only the launch variant: the other card SKUs have no template
    // matted frame and framed canvas: no template exists yet, so there is no mockup and the product cannot be reviewed (see the contract document)
    default: return null
  }
}

/**
 * What the renderer is shown: the product's whole FRONT. A composed file is one of two shapes for a wrapped product (a canvas):
 *   the front picture alone        what the composition step produces (picturePx's shape): the whole file is the front, nothing is removed. A SQUARE
 *                                  product's two shapes are the same shape, so a square file is always taken as the whole front: never remove subject
 *                                  matter on a guess (a few pixels of mirrored margin is the lesser error).
 *   the whole lab file             picture plus the mirrored wrap margin (finalPx's shape): the margin is not subject matter and the compositor builds its
 *                                  own wrap from the PICTURE, so it is removed (a 12 x 18 canvas file, 3654 x 5454, becomes 3600 x 5400 exactly).
 * The nearer shape decides; a file near neither is refused, never guessed. Nothing inside the picture is ever cropped or resampled. Products without wrap
 * pass through untouched. A file at a different scale than finalPx (a preview-size file) has its margins scaled by the same factor.
 */
export async function pictureArea(artwork: Buffer, product: CanonicalProduct): Promise<Buffer> {
  const { wrapPx, finalPx, picturePx } = product.requirements
  if (!wrapPx.left && !wrapPx.right && !wrapPx.top && !wrapPx.bottom) return artwork
  const meta = await sharp(artwork).metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable_artwork')
  const aspect = meta.width / meta.height, nearPicture = Math.abs(aspect / (picturePx.w / picturePx.h) - 1), nearLab = Math.abs(aspect / (finalPx.w / finalPx.h) - 1)
  if (Math.min(nearPicture, nearLab) > 0.01) throw new Error('artwork_shape_mismatch')                      // not a shape this product's file has: never guess
  if (nearPicture <= nearLab) return artwork                                                                // the front alone (or a square): the whole file is the front
  const k = meta.width / finalPx.w
  const left = Math.round(wrapPx.left * k), top = Math.round(wrapPx.top * k)
  const width = Math.min(meta.width - left, Math.round(picturePx.w * k)), height = Math.min(meta.height - top, Math.round(picturePx.h * k))
  return sharp(artwork).extract({ left, top, width, height }).png().toBuffer()
}

/** What the renderer is shown: the picture area of a flat or wrapped product, the full wrap for the mug, the front picture for the card. */
export async function mockupArtwork(artwork: Buffer, product: CanonicalProduct): Promise<Buffer> {
  if (product.family === 'mug' || product.family === 'card') return mockupInputFor(product.family, artwork)
  return pictureArea(artwork, product)
}

const sha = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')

export interface MockupIdentityInput {
  orderId: string; lineId: string; lineIndex: number; compositionId: string; attempt: number; sourceArtworkId: string; artworkSha256: string
  templateId: string; templateRevision: string; product: CanonicalProduct; geometrySource: string; frozenCatalogVersion: string | null
  /** clean (paid) and watermarked (unpaid) are different files: a payment must never be served the cached watermarked one, nor the reverse. */
  clean: boolean
  /** Set only when the photographic scene renderer made the picture. representationId covers the production artwork hash, the composition and attempt, the favorite, the scene, its revision and the derivation. */
  scene?: { sceneId: string; revision: string; representationId: string } | null
}
/** The stable rendering identity. Key order is fixed, so the same inputs always give the same key. */
export function mockupIdentityKey(i: MockupIdentityInput): string {
  const r = i.product.requirements
  return sha(JSON.stringify({
    v: MOCKUP_CONTRACT_VERSION, orderId: i.orderId, lineId: i.lineId, lineIndex: i.lineIndex, compositionId: i.compositionId, attempt: i.attempt,
    sourceArtworkId: i.sourceArtworkId, artworkSha256: i.artworkSha256, templateId: i.templateId, templateRevision: i.templateRevision,
    productId: i.product.productId, sku: i.product.sku, finalPx: r.finalPx, picturePx: r.picturePx, wrapPx: r.wrapPx, orientation: r.skuOrientation,
    attributes: Object.fromEntries(Object.entries(i.product.attributes).sort()), geometrySource: i.geometrySource, frozenCatalogVersion: i.frozenCatalogVersion, variant: i.clean ? 'clean' : 'watermarked',
    // Added ONLY for a scene render, so every calibrated mockup keeps the identity it already has (and its cached file keeps being re-signed, not re-rendered).
    ...(i.scene ? { scene: { sceneId: i.scene.sceneId, revision: i.scene.revision, representationId: i.scene.representationId, representation: SCENE_REPRESENTATION_VERSION } } : {}),
  }))
}

interface StoredScene { sceneId: string; revision: string; fit: 'exact' | 'resample'; representationId: string }
interface StoredMockup { identityKey: string; path: string; templateId: string; templateRevision: string; visualizationKey: string; width: number; height: number; crop: Record<string, unknown> | null; createdAt: string; renderer?: 'scene' | 'calibrated'; scene?: StoredScene | null }
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
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (!deps.mockup) throw new GiftError('mockup_renderer_unavailable')
  // Before payment (a draft) the mockup shows the reviewed composition on the product as the catalog describes it now; after payment, on the frozen purchased product.
  const scope = await scopeOf(deps, rec)
  if (scope.phase === 'purchased' && (!scope.order!.paid_at || scope.order!.status === 'cancelled')) throw new GiftError('order_not_paid')
  const ls = scope.lines.find(x => x.line.line_id === lineId)
  if (!ls) throw new GiftError('line_not_found')
  const line = ls.line
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')

  const comp = (await deps.store.listCompositions(rec.id))
    .filter(c => c.line_id === line.line_id && c.preview_id === rec.artwork_preview_id && (c.status === 'ready' || c.status === 'approved') && c.composed_path)
    .sort(byNewest)[0]
  if (!comp) throw new GiftError('composition_not_found')
  // A page that is showing an older composition (before a correction or a new favorite) is told so, and is given the current one in the error.
  if (typeof expectCompositionId === 'string' && expectCompositionId && expectCompositionId !== comp.id) throw new GiftError('stale_composition')

  const resolved = { source: ls.source, catalogVersion: ls.catalogVersion }
  const product = ls.product
  const templateId = templateFor(product)
  if (!templateId) throw new GiftError('product_not_available')                               // availability is unchanged: a scene never makes a product reviewable by itself
  if (!compositionFitsProduct(comp, product)) throw new GiftError('composition_geometry_mismatch')       // e.g. a landscape file for a portrait product: refused before any rendering

  const paid = scope.phase === 'purchased' && !!scope.order!.paid_at && scope.order!.status !== 'cancelled'        // verified payment: a draft (no paid order) is watermarked; a purchased line gets the clean mockup
  const artworkSha256 = typeof (comp.plan as { artworkSha256?: unknown }).artworkSha256 === 'string' ? (comp.plan as { artworkSha256: string }).artworkSha256 : null
  const clean = artworkSha256 ? null : await deps.storage.get(comp.composed_path!)         // an older row without a recorded hash: hash it once, then remember
  if (!artworkSha256 && !clean) throw new GiftError('generation_unavailable')
  const sourceHash = artworkSha256 ?? sha(clean!)
  const identityBase = { orderId: rec.order_id ?? `draft:${rec.id}`, lineId: line.line_id, lineIndex: line.line_index, compositionId: comp.id, attempt: comp.attempt, sourceArtworkId: comp.preview_id, artworkSha256: sourceHash, product, geometrySource: resolved.source, frozenCatalogVersion: resolved.catalogVersion, clean: paid }

  // The two ways to picture this line. The photographic scene is preferred WHEN one truthfully shows the frozen configuration (scenes.ts); the calibrated
  // template renderer is the existing, approved fallback for every configuration no scene shows, and for a scene that cannot be rendered.
  const scenes = scenesEnabled() ? deps.mockup.scenes : undefined
  const choice = scenes ? resolveScene(product, id => scenes.describe(id)) : null
  let sceneCand: { sceneId: string; revision: string; representationId: string; templateId: string; identityKey: string } | null = null
  if (scenes && choice?.scene) {
    try {
      const revision = await scenes.revision(choice.scene.sceneId)
      const representationId = sceneRepresentationId({ artworkSha256: sourceHash, sceneId: choice.scene.sceneId, sceneRevision: revision, compositionId: comp.id, attempt: comp.attempt, favoriteId: comp.preview_id })
      const sceneTemplateId = 'scene:' + choice.scene.sceneId
      sceneCand = { sceneId: choice.scene.sceneId, revision, representationId, templateId: sceneTemplateId,
        identityKey: mockupIdentityKey({ ...identityBase, templateId: sceneTemplateId, templateRevision: revision, scene: { sceneId: choice.scene.sceneId, revision, representationId } }) }
    } catch (e) { console.error(`[gift/mockup] scene unavailable scene=${choice.scene.sceneId} sku=${product.sku} line=${line.line_id}: ${String((e as Error)?.message ?? e).slice(0, 300)} (calibrated renderer used)`) }
  }
  const calibratedRevision = await deps.mockup.revision(templateId)
  const calibratedKey = mockupIdentityKey({ ...identityBase, templateId, templateRevision: calibratedRevision })

  const baseFor = (c: { templateId: string; templateRevision: string; identityKey: string }) => ({
    contractVersion: MOCKUP_CONTRACT_VERSION as typeof MOCKUP_CONTRACT_VERSION, sessionId: rec.id, lineId: line.line_id, productId: product.productId, sku: product.sku,
    compositionId: comp.id, attempt: comp.attempt, compositionStatus: comp.status as 'ready' | 'approved', sourceArtworkId: comp.preview_id,
    templateId: c.templateId, templateRevision: c.templateRevision, identityKey: c.identityKey, geometrySource: resolved.source, frozenCatalogVersion: resolved.catalogVersion,
    watermarked: !paid, productionPrintFile: false as const, purchaseAuthorization: false as const,
  })
  const sign = async (path: string) => {
    const url = await deps.storage.signedUrl(path, MOCKUP_URL_SECONDS)
    return url ? { url, urlExpiresAt: new Date((deps.clock ?? Date.now)() + MOCKUP_URL_SECONDS * 1000).toISOString() } : null
  }
  const hit = storedOf(comp)
  const viewOfHit = async (c: { templateId: string; templateRevision: string; identityKey: string }, h: StoredMockup): Promise<MockupView | null> => {
    const signed = await sign(h.path)
    return signed ? { ...baseFor(c), ...signed, width: h.width, height: h.height, cached: true, crop: h.crop, renderer: h.renderer ?? 'calibrated', scene: h.scene ?? null } : null
  }
  const sceneCandView = sceneCand ? { templateId: sceneCand.templateId, templateRevision: sceneCand.revision, identityKey: sceneCand.identityKey } : null
  const calibratedView = { templateId, templateRevision: calibratedRevision, identityKey: calibratedKey }

  // An unchanged identity re-signs the stored file and renders nothing. With a scene available only the scene's own identity counts: a calibrated file left by an earlier
  // scene failure is not served while the scene can be tried again.
  if (hit && sceneCandView && hit.identityKey === sceneCandView.identityKey) { const v = await viewOfHit(sceneCandView, hit); if (v) return v }
  if (hit && !sceneCandView && hit.identityKey === calibratedKey) { const v = await viewOfHit(calibratedView, hit); if (v) return v }

  const artwork = clean ?? await deps.storage.get(comp.composed_path!)                       // CLEAN: memory only, handed to the renderer, never returned
  if (!artwork) throw new GiftError('generation_unavailable')
  // The renderer reads its own catalog; if that disagrees with what was purchased, the mockup would show the wrong product. Refuse it.
  const catalogEntry = getProductBySku(product.sku)
  const configurationMatches = (sku: string, px: { w: number; h: number }) => sku === product.sku && px.w === product.requirements.finalPx.w && px.h === product.requirements.finalPx.h

  let image!: { png: Buffer; width: number; height: number; visualizationKey: string; crop: Record<string, unknown> | null }
  let used!: { templateId: string; templateRevision: string; identityKey: string }
  let sceneRecord: (StoredScene & { sha256: string; artworkSha256: string; compositionId: string; attempt: number; favoriteId: string; source: { w: number; h: number }; prepared: { w: number; h: number }; addedPx: { w: number; h: number }; createdAt: string }) | null = null
  if (scenes && sceneCand) {
    try {
      const flat = await mockupArtwork(artwork, product)                                      // the production picture (the whole front, the rolled mug wrap): derived from, never replaced
      const rep = await prepareSceneArtwork(flat, scenes.describe(sceneCand.sceneId))
      const out = await scenes.render({ sceneId: sceneCand.sceneId, productFamily: product.family, artworkId: comp.id, artwork: rep.bytes })
      // The scene renderer deliberately does not echo a physical configuration: the frozen purchase is validated here, independently, against the catalog's own entry for that SKU.
      if (!catalogEntry || !configurationMatches(catalogEntry.sku, catalogEntry.requirements.finalPx)) throw new GiftError('mockup_configuration_mismatch')
      if (out.templateRevision !== sceneCand.revision) throw new Error('scene_revision_changed_during_render')                // the files changed under a running render: never store a mixed result
      const m = out.metadata as { fit?: string }
      image = { png: out.png, width: out.width, height: out.height, visualizationKey: out.visualizationKey, crop: { fit: m.fit ?? null, allowCrop: false, croppedPixels: 0, sceneFit: rep.fit, scenePrepared: rep.prepared, sceneAddedPx: rep.addedPx } }
      used = { templateId: sceneCand.templateId, templateRevision: sceneCand.revision, identityKey: sceneCand.identityKey }
      sceneRecord = { sceneId: sceneCand.sceneId, revision: sceneCand.revision, fit: rep.fit, representationId: sceneCand.representationId, sha256: rep.sha256, artworkSha256: sourceHash, compositionId: comp.id, attempt: comp.attempt,
        favoriteId: comp.preview_id, source: rep.source, prepared: rep.prepared, addedPx: rep.addedPx, createdAt: new Date((deps.clock ?? Date.now)()).toISOString() }
    } catch (e) {
      if (e instanceof GiftError) throw e
      console.error(`[gift/mockup] scene failed scene=${sceneCand.sceneId} sku=${product.sku} line=${line.line_id}: ${(e as Error)?.name ?? 'Error'}: ${String((e as Error)?.message ?? e).slice(0, 300)} (calibrated renderer used)`)
    }
  }
  if (!sceneRecord) {
    if (hit && hit.identityKey === calibratedKey) { const v = await viewOfHit(calibratedView, hit); if (v) return v }
    let out: Awaited<ReturnType<MockupRenderer['render']>>
    try { out = await deps.mockup.render({ templateId, productFamily: product.family, size: product.size, sku: product.sku, artworkId: comp.id, artwork: await mockupArtwork(artwork, product) }) }
    catch (e) { throw fail('renderer', e, { templateId, sku: product.sku, lineId: line.line_id }) }
    if (!configurationMatches(out.configuration.sku, out.configuration.requiredPx)) throw new GiftError('mockup_configuration_mismatch')
    image = { png: out.png, width: out.width, height: out.height, visualizationKey: out.visualizationKey, crop: out.crop }
    used = calibratedView
  }

  let marked: Buffer
  try { marked = paid ? await cleanMockupJpeg(image.png) : await deps.watermark(image.png.toString('base64')) } catch (e) { throw fail(paid ? 'encode' : 'watermark', e, { templateId: used.templateId, sku: product.sku, lineId: line.line_id }) }        // fails closed: no unmarked mockup is ever stored
  const path = mockupPath(rec.id, used.identityKey)
  await deps.storage.put(path, marked, 'image/jpeg')
  const stored: StoredMockup = { identityKey: used.identityKey, path, templateId: used.templateId, templateRevision: used.templateRevision, visualizationKey: image.visualizationKey, width: image.width, height: image.height, crop: image.crop,
    createdAt: new Date((deps.clock ?? Date.now)()).toISOString(), renderer: sceneRecord ? 'scene' : 'calibrated', scene: sceneRecord ? { sceneId: sceneRecord.sceneId, revision: sceneRecord.revision, fit: sceneRecord.fit, representationId: sceneRecord.representationId } : null }
  // Only plan.mockup, plan.sceneRepresentation and the artwork hash are written: the composition's status, attempt, file, approval and corrections are never touched (a scene is technical, not a correction).
  const { sceneRepresentation: _previous, ...planRest } = comp.plan as Record<string, unknown>
  await deps.store.patchComposition(comp.id, { plan: { ...planRest, artworkSha256: sourceHash, mockup: stored, ...(sceneRecord ? { sceneRepresentation: sceneRecord } : {}) } })
  if (hit && hit.path !== path) { try { await deps.storage.remove([hit.path]) } catch { /* cleanup removes it with the session */ } }
  const signed = await sign(path)
  if (!signed) throw fail('sign', new Error('signed_url_unavailable'), { templateId: used.templateId, sku: product.sku, lineId: line.line_id })
  return { ...baseFor(used), ...signed, width: image.width, height: image.height, cached: false, crop: image.crop, renderer: stored.renderer, scene: stored.scene ?? null }
}
