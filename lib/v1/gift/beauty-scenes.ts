// lib/v1/gift/beauty-scenes.ts
//
// THE BEAUTY SCENES (Codex 1's display photographs, public/gift-wizard/beauty-scenes/manifest.next.json, 17 scenes, 2026-10-24): which configuration each one may show, and exactly what artwork the
// browser must give it. These scenes are DISPLAY-ONLY and composited in the browser (productionPrintFile: false); the backend never renders them and never lets them near manufacturing. They are
// separate from the older server-rendered scenes in scenes.ts, which keep working unchanged for paid-line mockups.
//
// A configuration is routed to a beauty scene only when ALL of these hold (nothing is routed on a guess):
//   family     the scene's family, or a family it declares it shares with (Fine Art and Premium share beauty photography and keep separate SKUs, specifications and prices)
//   finish     the photographed finish equals what Prodigi will print (frame colour; the wrap is not visible from the front, so it is not a condition)
//   opening    the photographed opening has the shape of the picture the customer approved (within 0.5%): the browser never crops, extends or squeezes the artwork to fit
// The picture the browser composites is `input`: the customer's own generated composition for that product (flat products, the card), or for the mug the full-wrap VIEW (the 2670:1110 wrap rolled
// so the primary face is in the middle, same unprinted rim and base bands as the print file). It is never the mug's raw 2670:1034 band, never a rendered photograph, never the print file.

import type { CanonicalProduct } from '../print/catalog'
import { generationAspectOf } from './generations'
import { frameColorsFor, FRAME_COLOR_DEFAULT } from './frame-colors'

export type BeautyInputKind = 'generation_picture' | 'mug_full_wrap_view'
export interface BeautyScene {
  id: string
  /** Folder under public/gift-wizard/beauty-scenes/ (the manifest id without the 'beauty-' prefix; the wrapped canvas square folder is spelled 'sqaure' there). */
  folder: string
  family: CanonicalProduct['family']
  /** Families whose product looks the same in this photograph. */
  serves?: ReadonlyArray<CanonicalProduct['family']>
  orientation: 'square' | 'portrait' | 'landscape' | 'wrap'
  /** The photographed opening's width / height (manifest surfaceAspectRatio). */
  openingAspect: number
  /** The finish the photograph really shows, as Prodigi attribute values. Only what was LOOKED AT; null = not verified (never routed). */
  finish: Record<string, string> | null
  /** Frame scenes: the photographed frame colour, and that the supplied frame mask lets the browser recolour it to any colour the product is sold in (the mat, the glass and the picture are untouched). */
  recolorFrame?: { photographedColor: string }
  inputKind: BeautyInputKind
  note: string
}

// All frames in the supplied photographs are natural oak (checked 2026-10-24 by looking at the frame corners).
const RECOLOR = { photographedColor: 'natural' }
export const BEAUTY_SCENES: ReadonlyArray<BeautyScene> = [
  { id: 'beauty-fine_art_print_square', folder: 'fine_art_print_square', family: 'fine_art', serves: ['premium'], orientation: 'square', openingAspect: 1, finish: {}, inputKind: 'generation_picture', note: 'unframed print on a white border (shared with Premium)' },
  { id: 'beauty-fine_art_print_portrait', folder: 'fine_art_print_portrait', family: 'fine_art', serves: ['premium'], orientation: 'portrait', openingAspect: 2 / 3, finish: {}, inputKind: 'generation_picture', note: 'unframed portrait print (shared with Premium)' },
  { id: 'beauty-fine_art_print_landscape', folder: 'fine_art_print_landscape', family: 'fine_art', serves: ['premium'], orientation: 'landscape', openingAspect: 1.5, finish: {}, inputKind: 'generation_picture', note: 'unframed landscape print; the catalog sells none' },
  { id: 'beauty-matted_frame_square', folder: 'matted_frame_square', family: 'matted', orientation: 'square', openingAspect: 1, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'natural oak frame, white mat' },
  { id: 'beauty-matted_frame_portrait', folder: 'matted_frame_portrait', family: 'matted', orientation: 'portrait', openingAspect: 2 / 3, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'natural oak frame, white mat; the matted rectangles\' mount openings are not 2:3' },
  { id: 'beauty-matted_frame_landscape', folder: 'matted_frame_landscape', family: 'matted', orientation: 'landscape', openingAspect: 1.5, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'natural oak frame, white mat; the catalog sells no landscape matted frame' },
  { id: 'beauty-framed_canvas_square', folder: 'framed_canvas_square', family: 'framed_canvas', orientation: 'square', openingAspect: 1, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'floating frame, natural oak' },
  { id: 'beauty-framed_canvas_portrait', folder: 'framed_canvas_portrait', family: 'framed_canvas', orientation: 'portrait', openingAspect: 2 / 3, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'floating frame, natural oak' },
  { id: 'beauty-framed_canvas_landscape', folder: 'framed_canvas_landscape', family: 'framed_canvas', orientation: 'landscape', openingAspect: 1.5, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'floating frame, natural oak (the 12 x 8)' },
  { id: 'beauty-framed_print_square', folder: 'framed_print_square', family: 'framed', orientation: 'square', openingAspect: 1, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'classic frame, natural oak; the catalog classic frame is black (it is a Print Shop product)' },
  { id: 'beauty-framed_print_portrait', folder: 'framed_print_portrait', family: 'framed', orientation: 'portrait', openingAspect: 2 / 3, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'classic frame, natural oak; the catalog classic frame is black' },
  { id: 'beauty-framed_print_landscape', folder: 'framed_print_landscape', family: 'framed', orientation: 'landscape', openingAspect: 1.5, finish: {}, recolorFrame: RECOLOR, inputKind: 'generation_picture', note: 'classic frame, natural oak; the catalog sells no landscape classic frame' },
  { id: 'beauty-wrapped_canvas_sqaure', folder: 'wrapped_canvas_sqaure', family: 'canvas', orientation: 'square', openingAspect: 1, finish: {}, inputKind: 'generation_picture', note: 'stretched canvas, picture around the edge (the wrap is not visible from the front)' },
  { id: 'beauty-wrapped_canvas_portrait', folder: 'wrapped_canvas_portrait', family: 'canvas', orientation: 'portrait', openingAspect: 2 / 3, finish: {}, inputKind: 'generation_picture', note: 'stretched canvas, portrait' },
  { id: 'beauty-wrapped_canvas_landscape', folder: 'wrapped_canvas_landscape', family: 'canvas', orientation: 'landscape', openingAspect: 1.5, finish: {}, inputKind: 'generation_picture', note: 'stretched canvas, landscape; the catalog sells no landscape canvas' },
  { id: 'beauty-greeting_card', folder: 'greeting_card', family: 'card', orientation: 'portrait', openingAspect: 5 / 7, finish: {}, inputKind: 'generation_picture', note: 'upright 5 x 7 card front' },
  { id: 'beauty-mug', folder: 'mug', family: 'mug', orientation: 'wrap', openingAspect: 2670 / 1110, finish: {}, inputKind: 'mug_full_wrap_view', note: 'white 11 oz mug, full wrap, handle right' },
]

const orientationOf = (p: CanonicalProduct): BeautyScene['orientation'] => {
  if (p.family === 'mug') return 'wrap'
  const a = generationAspectOf(p)
  return Math.abs(a - 1) <= 0.005 ? 'square' : a > 1 ? 'landscape' : 'portrait'
}
/** How far a photographed opening is from a shape: 0 identical (the same measure the rest of the backend uses). */
const extensionBetween = (a: number, b: number) => Math.max(a / b, b / a) - 1
export const BEAUTY_MAX_EXTENSION = 0.005

export type BeautyRefusal = 'no_beauty_scene_for_family' | 'orientation_not_photographed' | 'finish_not_photographed' | 'shape_not_photographed'
/** Frame scenes only: the colour the customer selected, every colour this product is sold in, and how the browser shows it (recolour the supplied frame mask from the photographed colour; nothing else changes). */
export interface BeautyFrame { selected: string; supported: string[]; recolor: { mask: 'frame-mask.svg'; folder: string; photographedColor: string; toColor: string; needed: boolean } }
export type BeautyRouting =
  | { sceneId: string; family: string; folder: string; openingAspect: number; extension: number; input: { kind: BeautyInputKind; aspect: number }; displayOnly: true; productionPrintFile: false; reason: null; frame?: BeautyFrame }
  | { sceneId: null; reason: BeautyRefusal; nearest?: { sceneId: string; openingAspect: number; productAspect: number; extension: number } }

/** `frameColor`: the colour the line is sold in (defaults to the product's own `color` attribute, then black). The product passed may already carry it. */
export function resolveBeautyScene(p: CanonicalProduct, frameColor?: string | null): BeautyRouting {
  const candidates = BEAUTY_SCENES.filter(s => s.family === p.family || s.serves?.includes(p.family))
  if (!candidates.length) return { sceneId: null, reason: 'no_beauty_scene_for_family' }
  const o = orientationOf(p), productAspect = p.family === 'mug' ? 2670 / 1110 : generationAspectOf(p)
  const saw = { orientation: false, finish: false }
  let best: { s: BeautyScene; ext: number } | null = null, nearest: { sceneId: string; openingAspect: number; productAspect: number; extension: number } | undefined
  for (const s of candidates) {
    if (s.orientation !== o) { saw.orientation = true; continue }
    if (!s.finish || !Object.entries(s.finish).every(([k, v]) => p.attributes[k] === v)) { saw.finish = true; continue }
    const ext = extensionBetween(s.openingAspect, productAspect)
    if (ext <= BEAUTY_MAX_EXTENSION + 1e-10) { if (!best || ext < best.ext - 1e-9 || (Math.abs(ext - best.ext) <= 1e-9 && s.family === p.family && best.s.family !== p.family)) best = { s, ext } }
    else if (!nearest || ext < nearest.extension) nearest = { sceneId: s.id, openingAspect: Math.round(s.openingAspect * 1e4) / 1e4, productAspect: Math.round(productAspect * 1e4) / 1e4, extension: Math.round(ext * 1e4) / 1e4 }
  }
  const supported = frameColorsFor(p), selected = frameColor ?? p.attributes.color ?? FRAME_COLOR_DEFAULT
  const frame: BeautyFrame | undefined = best?.s.recolorFrame && supported ? { selected, supported: [...supported], recolor: { mask: 'frame-mask.svg', folder: best.s.folder, photographedColor: best.s.recolorFrame.photographedColor, toColor: selected, needed: selected !== best.s.recolorFrame.photographedColor } } : undefined
  if (best) return { sceneId: best.s.id, family: best.s.family, folder: best.s.folder, openingAspect: Math.round(best.s.openingAspect * 1e6) / 1e6, extension: Math.round(best.ext * 1e6) / 1e6, input: { kind: best.s.inputKind, aspect: Math.round(productAspect * 1e6) / 1e6 }, displayOnly: true, productionPrintFile: false, reason: null, ...(frame ? { frame } : {}) }
  const reason: BeautyRefusal = nearest ? 'shape_not_photographed' : saw.finish ? 'finish_not_photographed' : 'orientation_not_photographed'
  return { sceneId: null, reason, ...(nearest ? { nearest } : {}) }
}
