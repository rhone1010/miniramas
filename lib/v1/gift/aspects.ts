// lib/v1/gift/aspects.ts
//
// Which aspect ratios a product-specific NB2.1 generation can actually be asked for.
//
// Two layers, and the second is the one that binds:
//   1. THE MODEL. google/nano-banana-2.1 accepts exactly the ratios below. Verified 2026-10-17 by reading the model's published
//      input schema from Replicate (a read-only metadata request, no prediction, no cost). 21:9 is supported.
//   2. THE ROUTE. Gift generations go through the existing series generate routes (the same prompts, gates and secrets):
//        portraits  Discovery's four ratios (1:1, 3:4, 4:3, 9:16) PLUS 2:3, 3:2, 4:5, 5:4, 16:9 and 21:9 for product compositions
//                   only: the route accepts those solely from the server's internal call that says product_composition: true.
//                   Discovery's own choices, and the route's answer to everyone else, are unchanged.
//        groups     GROUPS_FORMATS limited by head count (groupsFormatAllowed)
//        pets       passes any ratio the model knows through (no route-level list)

import { GROUPS_FORMATS, groupsFormatAllowed } from '../groups/groups-effects'
import { PORTRAIT_PRODUCT_ASPECTS } from '../portraits/portraits-shared'
import type { Series } from './types'

/** NB2.1's aspect_ratio enum (verified 2026-10-17), without 'match_input_image'. */
export const NB21_ASPECTS = ['1:1', '1:4', '1:8', '2:3', '3:2', '3:4', '4:1', '4:3', '4:5', '5:4', '8:1', '9:16', '16:9', '21:9'] as const
export const NB21_RESOLUTIONS = ['1K', '2K', '4K'] as const
/** Pets: every ratio the model knows except the four extreme strips, which no print product wants. */
const PETS_ASPECTS: readonly string[] = NB21_ASPECTS.filter(a => !['1:4', '1:8', '4:1', '8:1'].includes(a))

/** Largest background extension the Print Shop will apply to an artwork (geometry.ts: 20%). */
export const MAX_EXTENSION = 0.20

export const ratioOf = (aspect: string): number => { const [w, h] = aspect.split(':').map(Number); return w / h }
/** How much background must be added to turn one shape into the other: 0 for identical, 0.5 for a square into 2:3. */
export const extensionBetween = (a: number, b: number): number => Math.max(a / b, b / a) - 1

/**
 * Whether the customer's approved artwork can ride along as a reference image for a product-specific generation.
 *   portraits, pets  yes: the routes already forward additional images to NB2.1's image_input, and the adaptation clause says what they are
 *   groups           no: the Groups route and generator require exactly ONE source image (and count people across sources), so a
 *                    second image would be refused or counted as another person. Groups regenerate from the customer's photograph.
 */
export const supportsFavoriteReference = (series: Series): boolean => series === 'portraits' || series === 'pets'

/** The ratios a generation for this series (and head count, for Groups) may request through the existing routes. */
export function routeAspects(series: Series, peopleCount: number | null): string[] {
  if (series === 'portraits') return [...PORTRAIT_PRODUCT_ASPECTS]
  if (series === 'groups') return GROUPS_FORMATS.filter(f => peopleCount !== null ? groupsFormatAllowed(peopleCount, f) : ['1:1', '2:3', '3:2', '4:3'].includes(f))
  return [...PETS_ASPECTS]
}

/** The supported ratio that needs the least extension to reach the product's shape; null when none is within the bounded 20%. */
export function generationAspectFor(series: Series, peopleCount: number | null, targetRatio: number): { aspect: string; extensionFraction: number } | null {
  let best: { aspect: string; extensionFraction: number } | null = null
  for (const a of routeAspects(series, peopleCount)) {
    const e = extensionBetween(ratioOf(a), targetRatio)
    if (!best || e < best.extensionFraction - 1e-9) best = { aspect: a, extensionFraction: e }
  }
  return best && best.extensionFraction <= MAX_EXTENSION + 1e-10 ? { aspect: best.aspect, extensionFraction: Math.round(best.extensionFraction * 1e4) / 1e4 } : null
}

/**
 * How a composition of a given shape lands in a lab print area WITHOUT distortion or cropping: scale to the limiting axis, then the
 * remainder is background added on the other axis (inside the 20% bound). Used to verify the 21:9 mug mapping; it enables nothing.
 */
export function mapCompositionToArea(compositionAspect: number, area: { w: number; h: number }) {
  const areaRatio = area.w / area.h
  const fitsByHeight = compositionAspect <= areaRatio                       // too narrow for the area: fix height, add width
  const content = fitsByHeight ? { w: Math.round(area.h * compositionAspect), h: area.h } : { w: area.w, h: Math.round(area.w / compositionAspect) }
  const padding = { w: area.w - content.w, h: area.h - content.h }
  const extensionFraction = extensionBetween(compositionAspect, areaRatio)
  return { scaledBy: fitsByHeight ? 'height' as const : 'width' as const, content, padding, extensionFraction: Math.round(extensionFraction * 1e4) / 1e4,
           distorted: false as const, cropped: padding.w < 0 || padding.h < 0, withinBound: extensionFraction <= MAX_EXTENSION + 1e-10 }
}
