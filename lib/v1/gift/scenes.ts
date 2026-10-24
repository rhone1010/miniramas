// lib/v1/gift/scenes.ts
//
// CUSTOMER PRODUCT SCENES: which photographic scene may show a purchased configuration, and the scene-compatible picture it needs.
//
// Two different pictures exist for one purchased line, and they are never confused:
//   PRODUCTION      the composed file the customer approves and Prodigi prints (composed_path). Frozen geometry, never touched here.
//   SCENE           a server-side, in-memory derivative made ONLY to fill a photographed product opening. The photographed openings are measured
//                   projection extents, not Prodigi geometry (a 1002:671 opening is not a print ratio), so the derivative may differ from the
//                   production picture by a hair. It is derived from the SAME composed file (same favorite, same composition id and attempt),
//                   is never stored as a file, never returned, never printed and never consumes a customer correction.
//
// A scene is chosen ONLY when it truthfully shows the frozen purchase: same family, same photographed finish/wrap/SKU, same orientation, and an opening
// whose shape the existing composition rules reach WITHOUT generation (the 2% "recommended" band: exact, or a mirror-extension of a few pixels).
// Anything else (another finish, the other orientation, a shape that would need a paid outpaint or a new generation) has NO scene and keeps the existing
// calibrated renderer. A photographed product is never rotated, recoloured or stretched to fill a missing configuration.

import { createHash } from 'node:crypto'
import { sceneErrorDiagnostic, type SceneDiagnostic } from './scene-diagnostics'
import sharp from 'sharp'
import { aspectCompatibility, compositionPlan } from '../print/geometry'
import { preparePanelComposition } from '../print/asset-pipeline'
import type { CanonicalProduct } from '../print/catalog'

/** What Codex's renderer reports about a scene (tools/product-scenes/adapter.next.d.cts). */
export interface SceneDescription {
  sceneId: string; family: string; width: number; height: number
  /** width / height of the picture the renderer must be given (the photographed plane; 2670:1110 for the mug's rolled wrap). */
  inputAspect: number
  inputKind: 'rolled-full-wrap' | 'scene-composition'
  productionGeometry: false
}

/** The scene renderer port. The real one wraps tools/product-scenes/adapter.next.cjs (mockup-real.ts); tests inject a fake. */
export interface SceneRenderer {
  describe(sceneId: string): SceneDescription
  /** Changes whenever the renderer code, the compositor, the scene manifest or any scene asset changes. */
  revision(sceneId: string): Promise<string>
  render(input: { sceneId: string; productFamily: string; artworkId: string; artwork: Buffer }): Promise<{
    png: Buffer; width: number; height: number; templateRevision: string; visualizationKey: string; metadata: Record<string, unknown>
  }>
}

export type SceneOrientation = 'square' | 'portrait' | 'landscape' | 'wrap'
interface SceneFacts {
  family: CanonicalProduct['family']
  /** Other families whose physical product looks the same in this photograph (Fine Art and Premium Fine Art are both an unframed print: they share beauty photography and keep separate SKUs, specifications and prices). */
  serves?: ReadonlyArray<CanonicalProduct['family']>
  orientation: SceneOrientation
  /** The finish the photograph really shows. null = not verified, so the scene is never routed (a different finish would be a different product). */
  attributes: Record<string, string> | null
  skus?: readonly string[]
  /** Why this scene does or does not apply, for the coverage report. */
  note: string
}

/**
 * Verified photographic facts that the scene manifests do not carry. Only what was LOOKED AT is recorded; an unverified finish is null.
 * (2026-10-19: the framed canvas photograph shows a natural brown wood frame; every framed canvas in the catalog is black.)
 */
export const SCENE_FACTS: Readonly<Record<string, SceneFacts>> = {
  'ceramic-mug': { family: 'mug', orientation: 'wrap', attributes: { color: 'white' }, skus: ['GLOBAL-MUG-W'], note: 'white 11 oz mug, cylindrical full wrap (rolled 2670:1110)' },
  'greeting-card': { family: 'card', orientation: 'portrait', attributes: {}, skus: ['GLOBAL-GRE-MOH-7X5-BLA'], note: 'upright 5 x 7 front, Mohawk launch card' },
  'gallery-canvas-square': { family: 'canvas', orientation: 'square', attributes: { wrap: 'MirrorWrap' }, note: 'stretched canvas, picture continuing around the edge' },
  'gallery-canvas-landscape': { family: 'canvas', orientation: 'landscape', attributes: { wrap: 'MirrorWrap' }, note: 'landscape canvas; the catalog sells no landscape canvas' },
  'gallery-canvas-portrait': { family: 'canvas', orientation: 'portrait', attributes: { wrap: 'MirrorWrap' }, note: 'portrait stretched canvas, opening about 0.70 (the 2:3 canvases are about 4.9% away: not routed)' },
  // CORRECTED 2026-10-24: this scene is the MATTED FRAME (a mat inside a natural-wood frame), not a canvas. The catalog sells no landscape matted frame and its matted frames are black, so it routes nothing yet.
  'matted-frame-landscape': { family: 'matted', orientation: 'landscape', attributes: null, note: 'landscape matted frame, natural wood frame and white mat; the catalog sells no landscape matted frame, and its matted frames are black' },
  'matted-frame-portrait': { family: 'matted', orientation: 'portrait', attributes: null, note: 'portrait matted frame, natural wood frame and white mat (catalog matted frames are black; opening about 0.69)' },
  'fine-art-square': { family: 'fine_art', serves: ['premium'], orientation: 'square', attributes: {}, note: 'unframed square print (shared with Premium)' },
  'fine-art-portrait': { family: 'fine_art', serves: ['premium'], orientation: 'portrait', attributes: {}, note: 'unframed portrait print, opening about 2:3 (shared with Premium)' },
  'fine-art-landscape': { family: 'fine_art', serves: ['premium'], orientation: 'landscape', attributes: {}, note: 'unframed landscape print, opening about 3:2; the catalog sells no landscape fine art print (shared with Premium)' },
  'premium-square': { family: 'premium', serves: ['fine_art'], orientation: 'square', attributes: {}, note: 'unframed square premium print (shared with Fine Art)' },
  'premium-landscape': { family: 'premium', serves: ['fine_art'], orientation: 'landscape', attributes: {}, note: 'unframed landscape premium print, opening about 3:2; the catalog sells none (shared with Fine Art)' },
  'premium-fine-art': { family: 'premium', serves: ['fine_art'], orientation: 'portrait', attributes: {}, note: 'unframed print, opening about 4:5 (shared with Fine Art)' },
  'classic-framed': { family: 'framed', orientation: 'landscape', attributes: null, note: 'landscape framed print in a natural wood frame; the catalog classic frame is black' },
  'classic-framed-portrait': { family: 'framed', orientation: 'portrait', attributes: null, note: 'portrait framed print in a natural wood frame; the catalog classic frame is black' },
  'classic-framed-square': { family: 'framed', orientation: 'square', attributes: null, note: 'square framed print in a natural wood frame; the catalog classic frame is black' },
  'matted-frame-square': { family: 'matted', orientation: 'square', attributes: null, note: 'matted square frame, natural wood frame and white mat; the catalog matted frame is black' },
  'framed-canvas': { family: 'framed_canvas', orientation: 'square', attributes: { color: 'natural-brown-wood' }, note: 'framed canvas in a natural brown wood frame (the catalog sells black only)' },
  'framed-canvas-portrait': { family: 'framed_canvas', orientation: 'portrait', attributes: { color: 'natural-brown-wood' }, note: 'portrait framed canvas in a natural brown wood frame (the catalog sells black only)' },
}

export type SceneRefusal = 'no_scene_for_family' | 'configuration_not_photographed' | 'orientation_not_photographed' | 'shape_needs_extension' | 'shape_incompatible' | 'scene_unavailable'
export interface SceneChoice {
  sceneId: string
  /** The family the SCENE belongs to (the renderer requires it): equal to the product's family unless the photograph is shared (Fine Art / Premium). */
  sceneFamily: string
  /** Planned fit, for the coverage report. exact: the picture already has the opening's shape; resample: a mirror-extension of a few pixels reaches it (never a crop, never a stretch). The fit actually used is recorded from the derived picture. */
  fit: 'exact' | 'resample'
  /** Fractional difference between the production picture's shape and the opening's. */
  extension: number
  inputKind: SceneDescription['inputKind']
}
/** The measured numbers behind a shape refusal: the photographed opening's width/height, the product's picture width/height and how far apart they are (0.0709 = 7.09%). */
export interface SceneRefusalDetail { sceneId: string; openingAspect: number; productAspect: number; extension: number }
export type SceneResolution = { scene: SceneChoice; reason: null } | { scene: null; reason: SceneRefusal; detail?: SceneRefusalDetail }

/** The photographed orientation class of a purchased configuration. */
export function orientationOf(p: CanonicalProduct): SceneOrientation {
  if (p.family === 'mug') return 'wrap'
  const { w, h } = p.requirements.picturePx
  const ratio = w / h
  return Math.abs(ratio - 1) <= 0.005 ? 'square' : ratio > 1 ? 'landscape' : 'portrait'
}

const attributesMatch = (facts: SceneFacts, p: CanonicalProduct): boolean => {
  if (!facts.attributes) return false
  if (facts.skus && !facts.skus.includes(p.sku)) return false
  return Object.entries(facts.attributes).every(([k, v]) => p.attributes[k] === v)
}

/**
 * The scene that truthfully shows this frozen configuration, or why there is none. Pure: the only outside fact is the renderer's own description of a
 * scene (its photographed plane). The caller keeps the existing calibrated renderer for every refusal.
 */
export function resolveScene(product: CanonicalProduct, describe: (sceneId: string) => SceneDescription, diagnostic?: (event: SceneDiagnostic) => void): SceneResolution {
  const candidates = Object.entries(SCENE_FACTS).filter(([, f]) => f.family === product.family || f.serves?.includes(product.family))
  if (!candidates.length) return { scene: null, reason: 'no_scene_for_family' }
  const orientation = orientationOf(product)
  const saw = { orientation: false, extension: false, shape: false, unavailable: false }
  let nearest: SceneRefusalDetail | undefined                                           // the photographed opening closest to the product's shape, for the refusal
  let best: SceneChoice | null = null
  for (const [sceneId, facts] of candidates) {
    if (!attributesMatch(facts, product)) continue
    if (facts.orientation !== orientation) { saw.orientation = true; continue }
    let d: SceneDescription
    try { d = describe(sceneId) } catch (e) { diagnostic?.({ sceneId, stage: 'describe', reason: 'scene_dependency_unavailable', ...sceneErrorDiagnostic(e) }); saw.unavailable = true; continue }
    if (d.family !== facts.family || d.productionGeometry !== false) { diagnostic?.({ sceneId, stage: 'describe', reason: 'scene_descriptor_mismatch' }); saw.unavailable = true; continue }
    // The picture the renderer is given: the mug's wrap is built to its own exact ratio; every other family is shaped from the production picture.
    const extension = d.inputKind === 'rolled-full-wrap' ? 0 : aspectCompatibility(product.requirements.picturePx.w, product.requirements.picturePx.h, d.inputAspect * 1e6, 1e6).extension
    if (extension <= 0.02 + 1e-10) {
      const choice: SceneChoice = { sceneId, sceneFamily: facts.family, fit: extension <= 5e-4 ? 'exact' : 'resample', extension: Math.round(extension * 1e6) / 1e6, inputKind: d.inputKind }
      if (!best || choice.extension < best.extension - 1e-9 || (Math.abs(choice.extension - best.extension) <= 1e-9 && facts.family === product.family && best.sceneFamily !== product.family)) best = choice
    } else {
      if (extension <= 0.20 + 1e-10) saw.extension = true; else saw.shape = true
      if (!nearest || extension < nearest.extension) nearest = { sceneId, openingAspect: Math.round(d.inputAspect * 1e4) / 1e4, productAspect: Math.round(product.requirements.pictureAspect * 1e4) / 1e4, extension: Math.round(extension * 1e4) / 1e4 }
    }
  }
  if (best) return { scene: best, reason: null }
  const reason: SceneRefusal = saw.extension ? 'shape_needs_extension' : saw.shape ? 'shape_incompatible' : saw.unavailable ? 'scene_unavailable' : saw.orientation ? 'orientation_not_photographed' : 'configuration_not_photographed'
  return { scene: null, reason, ...((reason === 'shape_needs_extension' || reason === 'shape_incompatible') && nearest ? { detail: nearest } : {}) }
}

/** The longest edge of a scene picture. A mockup is 1254 px wide; the photographed plane is smaller still, so a 6000 px production file is never loaded whole into the renderer. */
export const SCENE_MAX_EDGE = 2400
/** Bump when the derivation below changes: it is part of the mockup identity. */
export const SCENE_REPRESENTATION_VERSION = 1
const sha = (b: Buffer | string) => createHash('sha256').update(b).digest('hex')

export interface SceneRepresentation {
  /** The scene-compatible picture. Memory only: never stored, never returned. */
  bytes: Buffer
  sha256: string
  fit: 'exact' | 'resample'
  /** The production picture it was derived from (the whole front, or the mug's rolled wrap) and the derivative, in pixels. */
  source: { w: number; h: number }
  prepared: { w: number; h: number }
  /** Pixels of mirror-extension added beyond the production picture's own edges (after the mockup-sized reduction). Zero for an exact fit and for the mug. */
  addedPx: { w: number; h: number }
}

/**
 * The scene-compatible picture for one opening, derived from the production picture (`input` is what mockupArtwork() gives: the whole front of a flat
 * product, the mug's rolled wrap, the card's front panel) by the EXISTING composition rules, bounded to the 2% band: no outpaint, no generation, no
 * network, no crop, no stretch. Every original pixel survives (a mirror-extension only adds outside them). Throws instead of guessing:
 *   scene_input_shape          the mug's wrap is not 2670:1110
 *   scene_extension_not_permitted  the picture is farther from the opening than the 2% band
 */
export async function prepareSceneArtwork(input: Buffer, scene: SceneDescription): Promise<SceneRepresentation> {
  const meta = await sharp(input).metadata()
  if (!meta.width || !meta.height) throw new Error('unreadable_artwork')
  const source = { w: meta.width, h: meta.height }
  if (scene.inputKind === 'rolled-full-wrap') {
    if (Math.abs(source.w / source.h / scene.inputAspect - 1) > 0.003) throw new Error('scene_input_shape')
    return { bytes: input, sha256: sha(input), fit: 'exact', source, prepared: source, addedPx: { w: 0, h: 0 } }
  }
  const compat = aspectCompatibility(source.w, source.h, scene.inputAspect * 1e6, 1e6)
  if (compat.compatibility !== 'recommended') throw new Error('scene_extension_not_permitted')
  // 1. mockup-sized: a lossless-quality reduction (never an enlargement); the aspect is preserved by rounding both edges from the same factor.
  const k = Math.min(1, SCENE_MAX_EDGE / Math.max(source.w, source.h))
  const reduced = k < 1 ? await sharp(input).resize(Math.round(source.w * k), Math.round(source.h * k), { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer() : await sharp(input).png().toBuffer()
  const rm = await sharp(reduced).metadata()
  const rw = rm.width!, rh = rm.height!
  // 2. the minimal pixel extent of the opening's shape that contains the whole picture, then the existing panel composition (mirror extension only).
  const wider = rw / rh > scene.inputAspect
  const panel = wider ? { w: rw, h: Math.ceil(rw / scene.inputAspect) } : { w: Math.ceil(rh * scene.inputAspect), h: rh }
  const plan = compositionPlan(rw, rh, panel.w, panel.h)
  if (plan.compatibility !== 'recommended') throw new Error('scene_extension_not_permitted')   // would need an outpaint (paid): never here
  const exact = Math.abs(rw / rh / scene.inputAspect - 1) <= 1 / rw + 1 / rh
  const done = exact ? { working: reduced, width: rw, height: rh } : await preparePanelComposition({ imageB64: reduced.toString('base64'), panel })
  return {
    bytes: done.working, sha256: sha(done.working), fit: exact ? 'exact' : 'resample', source,
    prepared: { w: done.width, h: done.height }, addedPx: { w: Math.max(0, done.width - rw), h: Math.max(0, done.height - rh) },
  }
}

/** Identity of the derivative BEFORE it is built: everything it is a function of. Equal inputs always give the same id, so a cached mockup is found without rebuilding the picture. */
export function sceneRepresentationId(i: { artworkSha256: string; sceneId: string; sceneRevision: string; compositionId: string; attempt: number; favoriteId: string }): string {
  return sha(JSON.stringify({ v: SCENE_REPRESENTATION_VERSION, maxEdge: SCENE_MAX_EDGE, artworkSha256: i.artworkSha256, sceneId: i.sceneId, sceneRevision: i.sceneRevision, compositionId: i.compositionId, attempt: i.attempt, favoriteId: i.favoriteId }))
}
