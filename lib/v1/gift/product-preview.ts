// lib/v1/gift/product-preview.ts
//
// PRE-CHECKOUT PERSONALIZED PRODUCT PREVIEW: the customer's SELECTED FAVORITE shown inside a product they are considering, before any line, order, payment or composition exists.
//
//   GET /api/v1/gift/sessions/{id}/product-preview?productId=canvas:8x8   (authenticated, owner only)
//
// It answers with an explicit status, never an unrelated sample:
//   ready                 a WATERMARKED mockup of the favorite in the product (scene renderer where a photograph truthfully shows the configuration, otherwise the calibrated renderer)
//   adaptation_required   the favorite's shape is not the product's picture shape (beyond the free 2% band), so an accurate picture needs the real composition step (a bounded
//                         extension or a new generation: paid, customer-initiated, approved by the customer). Nothing is rendered; the response carries the numbers.
//   not_available         the product is not purchasable / has no mockup template: nothing to show
//   provisional           (opt-in: ?provisional=1, and only where adaptation_required would have been returned) the favorite shown COMPLETE, in its own shape, inside the product, on a neutral
//                         surround that is plainly not artwork: never cropped, stretched or extended, no generation. It is an honest stand-in for what the customer chose, NOT the final
//                         picture: after purchase the real composition step makes the product-shaped artwork and the customer approves it. The response says so in data (finalComposition).
//
// What this is NOT: a composition (none is created or stored), a production file, an approval, a correction, an order or a purchase authorization. It reads the favorite's stored
// master in memory, shapes it to the product's picture shape ONLY by mirror-extension inside the 2% band (no outpaint, no generation, no crop, no stretch), hands that to the SAME
// renderers the purchased-line mockup uses, watermarks the result (always: nothing here is paid) and stores ONLY that watermarked JPEG under gift/{session}/product-previews/
// (removed with the session). Scene projection stays separate from manufacturing geometry: the product's frozen-style geometry comes from the catalog, the scene only shows it.

import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { GiftError, owned, type GiftDeps } from './service'
import { templateFor, mockupArtwork, MOCKUP_URL_SECONDS, MOCKUP_CONTRACT_VERSION } from './mockup'
import { resolveScene, prepareSceneArtwork, SCENE_REPRESENTATION_VERSION, SCENE_MAX_EDGE } from './scenes'
import { logSceneDiagnostic, sceneErrorDiagnostic } from './scene-diagnostics'
import { planContextFor, planFor } from './composition-plan'
import { allProducts, getProductBySku, type CanonicalProduct } from '../print/catalog'
import { aspectCompatibility } from '../print/geometry'
import { STORAGE } from './policy'
import { compositionOfKey, generationShapeOf, geometryKeysOf } from './generations'
import { MUG_SINGLE_PANEL_V2, isMugSingleLayout, mugSinglePanelPlacement, type MugSingleLayout } from '../print/production-profiles'
import { resolveBeautyScene } from './beauty-scenes'
import { resolveFrameColor, withFrameColor } from './frame-colors'
import { noScenePresentation, representationFields } from './presentation'
import { GIFT_CONTRACT_VERSION, type ProductPreviewView, type SceneRefusalView } from './types'

const pick = <T extends Record<string, unknown>>(f: T) => ({ representation: f.representation, physicalProductShown: f.physicalProductShown, previewBasis: f.previewBasis, disclosureCode: f.disclosureCode, disclosure: f.disclosure }) as any
const sha = (b: string | Buffer) => createHash('sha256').update(b).digest('hex')
const FREE_BAND = 0.02 + 1e-10
const PRODUCT_ID = /^[a-z_]+:[\w-]{1,24}$/

/** Neutral paper tone for the surround of a provisional preview: not derived from the artwork, so it can never be mistaken for artwork content. */
export const PROVISIONAL_SURROUND = '#efece6'

/**
 * PROVISIONAL picture: the WHOLE favorite, undistorted, centered on a canvas of the product's picture shape (only the missing axis is filled, with the neutral surround). Pure resize-inside and
 * composite: no crop, no stretch, no mirror, no generation. Returns how much of the picture is surround, for the response.
 */
export async function containedPicture(master: Buffer, product: CanonicalProduct): Promise<{ picture: Buffer; bars: { sides: 'top_bottom' | 'left_right'; fractionPerSide: number }; favoriteAspect: number }> {
  const meta = await sharp(master).metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable_artwork')
  const k = Math.min(1, SCENE_MAX_EDGE / Math.max(meta.width, meta.height))
  const rw = Math.round(meta.width * k), rh = Math.round(meta.height * k)
  const art = await sharp(master).rotate().resize(rw, rh, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const { w, h } = product.requirements.picturePx, pa = w / h, fa = rw / rh
  const wider = fa > pa                                                                   // the favorite is wider than the product: the surround goes above and below
  const tw = wider ? rw : Math.ceil(rh * pa), th = wider ? Math.ceil(rw / pa) : rh
  const left = Math.floor((tw - rw) / 2), top = Math.floor((th - rh) / 2)
  const picture = await sharp({ create: { width: tw, height: th, channels: 3, background: PROVISIONAL_SURROUND } }).composite([{ input: art, left, top }]).png().toBuffer()
  return { picture, bars: wider ? { sides: 'top_bottom', fractionPerSide: Math.round(((th - rh) / 2 / th) * 1e4) / 1e4 } : { sides: 'left_right', fractionPerSide: Math.round(((tw - rw) / 2 / tw) * 1e4) / 1e4 }, favoriteAspect: fa }
}

/** The favorite (a ready preview's stored master), reshaped to the product's picture shape by mirror-extension only, at mockup size. */
export async function productShapedPicture(master: Buffer, product: CanonicalProduct): Promise<{ picture: Buffer; fit: 'exact' | 'resample' }> {
  const meta = await sharp(master).metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable_artwork')
  const k = Math.min(1, SCENE_MAX_EDGE / Math.max(meta.width, meta.height))
  const rw = Math.round(meta.width * k), rh = Math.round(meta.height * k)
  const reduced = await sharp(master).rotate().resize(rw, rh, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer()
  const { w, h } = product.requirements.picturePx, pa = w / h
  const wider = rw / rh > pa
  const tw = wider ? rw : Math.ceil(rh * pa), th = wider ? Math.ceil(rw / pa) : rh
  if (tw === rw && th === rh) return { picture: reduced, fit: 'exact' }
  const dx = tw - rw, dy = th - rh
  const picture = await sharp(reduced).extend({ left: Math.floor(dx / 2), right: dx - Math.floor(dx / 2), top: Math.floor(dy / 2), bottom: dy - Math.floor(dy / 2), extendWith: 'mirror' }).png().toBuffer()
  return { picture, fit: 'resample' }
}

export async function getProductPreview(deps: GiftDeps, userId: string, sessionId: string, productIdRaw: unknown, opts: { provisional?: boolean; generationId?: string | null; frameColor?: string | null } = {}): Promise<ProductPreviewView> {
  const rec = await owned(deps, userId, sessionId)
  if (rec.refunded_at) throw new GiftError('order_refunded')
  if (rec.refund_requested_at) throw new GiftError('refund_pending')
  if (!deps.mockup) throw new GiftError('mockup_renderer_unavailable')
  if (typeof productIdRaw !== 'string' || !PRODUCT_ID.test(productIdRaw)) throw new GiftError('product_not_available')
  if (!rec.artwork_preview_id) throw new GiftError('artwork_not_selected')              // the favorite comes first: previews, then gifts
  const base = { contractVersion: GIFT_CONTRACT_VERSION, sessionId: rec.id, productId: productIdRaw, favoriteId: rec.artwork_preview_id } as const

  const catalogProduct = allProducts().find(p => p.productId === productIdRaw && p.status === 'launch')
  // Frame colour: validated against the product's exact values (null = black for a frame product). The product below IS the one in that colour, so its attributes (and so the identity and every cache key) carry it.
  const frameColor = catalogProduct ? resolveFrameColor(catalogProduct, opts.frameColor ?? undefined) : null
  const product = catalogProduct ? withFrameColor(catalogProduct, frameColor) : undefined
  const legacyCalibrated = noScenePresentation() === 'calibrated'                       // legacy template renderer for products without a scene; off by default
  const templateId = product ? templateFor(product) : null                             // only the legacy renderer needs one: a missing template never makes a product unavailable
  if (!product || (legacyCalibrated && !templateId)) return { ...base, status: 'not_available', reason: product ? 'no_mockup_template' : 'product_not_available', sku: product?.sku ?? null }

  const batches = await deps.store.listBatches(rec.id)
  const found = batches.flatMap(b => b.previews).find(p => p.id === rec.artwork_preview_id)
  if (!found || found.status !== 'ready' || !found.master_path || !found.width || !found.height) throw new GiftError('artwork_not_selected')
  let fav = found as typeof found & { master_path: string; width: number; height: number }
  // PRODUCT-FIRST: the customer's personalized composition for THIS product (a delivered generation of the current effect and of the product's shape) IS the picture shown. It is already the exact
  // shape, so nothing is adapted, extended or regenerated; the scene (or the exact product-shaped picture) is built from it, and the same generation id, size and sha256 are what is accepted and bought.
  let generation: Awaited<ReturnType<GiftDeps['store']['getGeneration']>> = null
  if (opts.generationId) {
    generation = await deps.store.getGeneration(rec.id, opts.generationId).catch(() => null)
    if (!generation) throw new GiftError('generation_not_found')
    if (generation.status !== 'ready' || !generation.master_path || !generation.width || !generation.height || !generation.sha256) throw new GiftError('generation_not_ready')
    if (generation.effect_id !== fav.effect_id) throw new GiftError('stale_composition')
    if (!geometryKeysOf(product).includes(generation.geometry_key)) throw new GiftError('composition_geometry_mismatch')
    fav = { ...fav, id: generation.id, master_path: generation.master_path, width: generation.width, height: generation.height }
  }

  const { w: pw, h: ph } = generation ? generationShapeOf(product, compositionOfKey(product, generation.geometry_key)) : product.requirements.picturePx, pictureAspect = pw / ph, favoriteAspect = fav.width / fav.height
  const { extension } = aspectCompatibility(fav.width, fav.height, pw, ph)
  const far = !generation && extension > FREE_BAND
  const plan = far && rec.series ? planFor(product, planContextFor(rec)) : null
  const provisional = far && opts.provisional === true
  if (far && rec.series && !plan) return { ...base, status: 'not_available', reason: 'product_not_available_for_artwork', sku: product.sku }       // no bounded way to make this shape from this artwork (an owned piece whose photograph is gone): never cropped, stretched or invented
  if (far && !provisional) {
    return { ...base, status: 'adaptation_required', reason: 'shape_needs_composition', sku: product.sku, favoriteAspect: Math.round(favoriteAspect * 1e4) / 1e4, pictureAspect: Math.round(pictureAspect * 1e4) / 1e4, extension: Math.round(extension * 1e4) / 1e4, method: plan?.method ?? null }
  }

  const existingLayout = generation && product.family === 'mug' ? (await deps.store.listCompositions(rec.id).catch(() => [])).find(c => c.generation_id === generation!.id)?.plan.layout : undefined
  const mugLayout: MugSingleLayout | null = generation && product.family === 'mug' ? (isMugSingleLayout(existingLayout) ? existingLayout : MUG_SINGLE_PANEL_V2) : null

  // which renderer: the photographic scene when one truthfully shows this configuration, else the calibrated renderer (scenes.ts / mockup.ts decide, exactly as for a purchased line)
  const scenes = process.env.GIFT_SCENE_MOCKUPS !== '0' ? deps.mockup.scenes : undefined
  const choice = scenes ? resolveScene(product, id => scenes.describe(id)) : null
  const sceneRefusal: SceneRefusalView | null = choice?.scene ? null : { reason: choice?.reason ?? (scenes ? 'scene_renderer_absent' : 'feature_disabled'), ...(choice && !choice.scene && choice.detail ? choice.detail : {}) }
  let sceneRevision: string | null = null
  if (scenes && choice?.scene) { try { sceneRevision = await scenes.revision(choice.scene.sceneId) } catch (e) { logSceneDiagnostic(product.sku, { sceneId: choice.scene.sceneId, stage: 'revision', reason: 'scene_revision_unavailable', ...sceneErrorDiagnostic(e) }) } }
  const calibratedRevision = legacyCalibrated && templateId ? await deps.mockup.revision(templateId) : 'artwork-v1'
  const useScene = !!(scenes && choice?.scene && sceneRevision)
  const identity = sha(JSON.stringify({
    v: 1, contract: MOCKUP_CONTRACT_VERSION, ...(mugLayout ? { mugLayout } : {}), sessionId: rec.id, favoriteId: fav.id, generationSha256: generation?.sha256 ?? null, master: fav.master_path, sku: product.sku, productId: product.productId, finalPx: product.requirements.finalPx, picturePx: product.requirements.picturePx,
    attributes: Object.fromEntries(Object.entries(product.attributes).sort()), renderer: useScene ? { scene: choice!.scene!.sceneId, revision: sceneRevision, representation: SCENE_REPRESENTATION_VERSION } : legacyCalibrated ? { template: templateId, revision: calibratedRevision } : { artwork: 'v1' }, variant: provisional ? 'provisional-contain-1:' + PROVISIONAL_SURROUND : 'watermarked',
  }))
  const path = `${STORAGE.productPreviewDir(rec.id)}${product.productId.replace(/[^\w-]/g, '_')}-${identity.slice(0, 16)}.jpg`
  const sign = async () => { const url = await deps.storage.signedUrl(path, MOCKUP_URL_SECONDS); return url ? { url, urlExpiresAt: new Date((deps.clock ?? Date.now)() + MOCKUP_URL_SECONDS * 1000).toISOString() } : null }
  const meta = { frameColor, watermarked: true as const, productionPrintFile: false as const, purchaseAuthorization: false as const }
  const bars = provisional ? (favoriteAspect > pictureAspect ? { sides: 'top_bottom' as const, fractionPerSide: Math.round(((1 - pictureAspect / favoriteAspect) / 2) * 1e4) / 1e4 } : { sides: 'left_right' as const, fractionPerSide: Math.round(((1 - favoriteAspect / pictureAspect) / 2) * 1e4) / 1e4 }) : null
  const ready = (r: { renderer: 'scene' | 'artwork' | 'calibrated'; sceneId: string | null; width: number; height: number; fit: 'exact' | 'resample'; cached: boolean }, s: { url: string; urlExpiresAt: string }): ProductPreviewView =>
    provisional
      ? { ...base, status: 'provisional', sku: product.sku, renderer: r.renderer, ...representationFields(r.renderer), sceneId: r.sceneId, fit: 'contain', width: r.width, height: r.height, cached: r.cached, ...s, ...meta, sceneRefusal: r.renderer === 'scene' ? null : sceneRefusal,
          provisional: { ...pick(representationFields(r.renderer)), exactArtworkShown: true, cropped: false, distorted: false, surround: 'neutral', bars: bars!, favoriteAspect: Math.round(favoriteAspect * 1e4) / 1e4, pictureAspect: Math.round(pictureAspect * 1e4) / 1e4, extension: Math.round(extension * 1e4) / 1e4, finalComposition: plan?.method ?? null } }
      : { ...base, status: 'ready', sku: product.sku, renderer: r.renderer, ...representationFields(r.renderer), sceneId: r.sceneId, fit: r.fit, width: r.width, height: r.height, cached: r.cached, ...s, ...meta, sceneRefusal: r.renderer === 'scene' ? null : sceneRefusal }

  // The beauty input (product-first requests only): what the browser composites into the display-only beauty photograph. Stored beside the preview under the same identity.
  const beauty = generation ? resolveBeautyScene(product, frameColor) : undefined
  const inputPath = `${STORAGE.productPreviewDir(rec.id)}${product.productId.replace(/[^\w-]/g, '_')}-input-${identity.slice(0, 16)}.jpg`
  const signInput = async (w: number, h: number) => {
    if (!generation || !beauty?.sceneId) return null
    const url = await deps.storage.signedUrl(inputPath, MOCKUP_URL_SECONDS); if (!url) return null
    return { kind: beauty.input.kind, url, urlExpiresAt: new Date((deps.clock ?? Date.now)() + MOCKUP_URL_SECONDS * 1000).toISOString(), width: w, height: h, aspect: beauty.input.aspect, generationId: generation.id, sha256: generation.sha256!, ...(product.family === 'mug' ? { placement: mugSinglePanelPlacement(compositionOfKey(product, generation.geometry_key) ?? 'square', mugLayout ?? MUG_SINGLE_PANEL_V2) } : {}) }
  }
  const withBeauty = async (v: ProductPreviewView, input: { w: number; h: number } | null): Promise<ProductPreviewView> => (generation ? { ...(v as any), beauty, beautyInput: input ? await signInput(input.w, input.h) : null } : v)
  const hit = await sign()
  if (hit) {                                                                              // an unchanged identity re-signs the stored file and renders nothing
    const stored = await deps.storage.get(path)
    const m = stored ? await sharp(stored).metadata() : null
    const storedInput = generation && beauty?.sceneId ? await deps.storage.get(inputPath) : null
    const im = storedInput ? await sharp(storedInput).metadata() : null
    if (m?.width && m.height && (!generation || !beauty?.sceneId || (im?.width && im.height))) return withBeauty(ready({ renderer: useScene ? 'scene' : legacyCalibrated ? 'calibrated' : 'artwork', sceneId: useScene ? choice!.scene!.sceneId : null, width: m.width, height: m.height, fit: useScene ? choice!.scene!.fit : 'exact', cached: true }, hit), im?.width && im.height ? { w: im.width, h: im.height } : null)
  }

  const masterBytes = await deps.storage.get(fav.master_path)                             // CLEAN master: memory only, never returned, never stored next to the preview
  if (!masterBytes) throw new GiftError('generation_unavailable')
  const shaped = generation ? { picture: await sharp(masterBytes).png().toBuffer(), fit: 'exact' as const } : provisional ? { picture: (await containedPicture(masterBytes, product)).picture, fit: 'exact' as const } : await productShapedPicture(masterBytes, product)
  const flat = await mockupArtwork(shaped.picture, product, mugLayout ? { mugLayout } : {})
  let png: Buffer | null = null, width = 0, height = 0, renderer: 'scene' | 'calibrated' | 'artwork' = legacyCalibrated ? 'calibrated' : 'artwork', sceneId: string | null = null
  if (useScene) {
    let stage = 'scene_representation'
    try {
      const rep = await prepareSceneArtwork(flat, scenes!.describe(choice!.scene!.sceneId))
      stage = 'scene_render'
      const out = await scenes!.render({ sceneId: choice!.scene!.sceneId, productFamily: choice!.scene!.sceneFamily, artworkId: fav.id, artwork: rep.bytes })
      const cat = getProductBySku(product.sku)
      if (!cat || cat.requirements.finalPx.w !== product.requirements.finalPx.w || cat.requirements.finalPx.h !== product.requirements.finalPx.h) throw new GiftError('mockup_configuration_mismatch')
      if (out.templateRevision !== sceneRevision) throw new Error('scene_revision_changed_during_render')
      png = out.png; width = out.width; height = out.height; renderer = 'scene'; sceneId = choice!.scene!.sceneId
    } catch (e) {
      if (e instanceof GiftError) throw e
      logSceneDiagnostic(product.sku, { sceneId: choice!.scene!.sceneId, stage, reason: 'scene_render_failed', ...sceneErrorDiagnostic(e) })
    }
  }
  if (!png && !legacyCalibrated) {
    // No photograph truthfully shows this configuration: the artwork EXACTLY as it will be printed, in the product's shape, with no product imagery. Reduced for display only.
    png = await sharp(flat).resize(1254, 1254, { fit: 'inside', withoutEnlargement: true }).png().toBuffer(); const m = await sharp(png).metadata(); width = m.width!; height = m.height!
  }
  if (!png) {
    let out: Awaited<ReturnType<NonNullable<GiftDeps['mockup']>['render']>>
    try { out = await deps.mockup.render({ templateId: templateId!, productFamily: product.family, size: product.size, sku: product.sku, artworkId: fav.id, artwork: flat }) }
    catch (e) { console.error(`[gift/product-preview] renderer failed template=${templateId} sku=${product.sku}: ${String((e as Error)?.message ?? e).slice(0, 200)}`); throw new GiftError('mockup_failed') }
    if (out.configuration.sku !== product.sku || out.configuration.requiredPx.w !== product.requirements.finalPx.w || out.configuration.requiredPx.h !== product.requirements.finalPx.h) throw new GiftError('mockup_configuration_mismatch')
    png = out.png; width = out.width; height = out.height
  }
  let marked: Buffer
  try { marked = await deps.watermark(png.toString('base64')) } catch { throw new GiftError('mockup_failed') }            // fails closed: nothing unmarked is ever stored or returned
  await deps.storage.put(path, marked, 'image/jpeg')
  const signed = await sign()
  if (!signed) throw new GiftError('mockup_failed')
  let inputSize: { w: number; h: number } | null = null
  if (generation && beauty?.sceneId) {
    const im = await sharp(flat).metadata(); inputSize = { w: im.width!, h: im.height! }
    let markedInput: Buffer
    try { markedInput = await deps.watermark(flat.toString('base64')) } catch { throw new GiftError('mockup_failed') }
    await deps.storage.put(inputPath, markedInput, 'image/jpeg')
  }
  return withBeauty(ready({ renderer, sceneId, width, height, fit: shaped.fit, cached: false }, signed), inputSize)
}
