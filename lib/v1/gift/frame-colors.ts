// lib/v1/gift/frame-colors.ts
//
// CUSTOMER-SELECTED FRAME COLOUR (Gift Shop only). The colours are Prodigi's own attribute values for each SKU family (checked per SKU: scripts/check-prodigi-frame-colors.ts), the default is black, and the
// selection is validated here, on the server, never trusted from the browser. The selected colour becomes the line's `color` attribute everywhere the product is sold (quote, frozen order snapshot, the
// Prodigi order) and is part of the composition identity, so an approval can never carry over to a different finish. The Print Shop is untouched: its Classic Frame stays black.

import { GiftError } from './service'
import type { CanonicalProduct } from '../print/catalog'

/** Classic Frame and Matted Frame (Prodigi values, in the order they are offered). */
export const CLASSIC_FRAME_COLORS = ['black', 'white', 'natural', 'brown', 'dark grey', 'light grey', 'gold', 'silver'] as const
/** Framed Canvas. */
export const FRAMED_CANVAS_COLORS = ['black', 'white', 'natural', 'brown', 'gold', 'silver'] as const
export const FRAME_COLOR_DEFAULT = 'black'

/**
 * Colours Prodigi lists for a SKU but with a DIFFERENT print area than the rest of that SKU (so the catalog's geometry would be wrong for them): excluded, never guessed. Found by
 * scripts/check-prodigi-frame-colors.ts (sandbox, 2026-10-24): the matted 8x12 in dark grey and light grey prints a 1500 x 2700 picture, every other colour 1800 x 3000.
 */
export const FRAME_COLOR_EXCLUSIONS: Readonly<Record<string, readonly string[]>> = { 'matted:8x12': ['dark grey', 'light grey'] }

/** The colours this product may be sold in, or null when the product has no frame colour (prints, canvas, mug, card). */
export function frameColorsFor(p: Pick<CanonicalProduct, 'family'> & { productId?: string }): readonly string[] | null {
  const all = p.family === 'framed' || p.family === 'matted' ? CLASSIC_FRAME_COLORS : p.family === 'framed_canvas' ? FRAMED_CANVAS_COLORS : null
  const out = all && p.productId ? FRAME_COLOR_EXCLUSIONS[p.productId] : undefined
  return all && out ? all.filter(c => !out.includes(c)) : all
}

/** Validate a requested colour for a product: undefined/null = the default (black) for a frame product; anything else must be one of its exact values. A colour on a product that has none is refused. */
export function resolveFrameColor(p: Pick<CanonicalProduct, 'family'> & { productId?: string }, requested: unknown): string | null {
  const allowed = frameColorsFor(p)
  if (requested === undefined || requested === null || requested === '') return allowed ? FRAME_COLOR_DEFAULT : null
  if (!allowed || typeof requested !== 'string' || !allowed.includes(requested)) throw new GiftError('invalid_frame_color', allowed ? { supported: [...allowed] } : undefined)
  return requested
}

/** The product as it will be SOLD in a colour: the catalog product with its `color` attribute set. Products without a frame colour are returned unchanged (same object). */
export function withFrameColor<T extends CanonicalProduct>(p: T, color: string | null): T {
  if (!frameColorsFor(p) || !color) return p
  return { ...p, attributes: { ...p.attributes, color } }
}

/** The colour a stored line has: its own, or the default for lines saved before colours existed. null for products with no frame colour. */
export const lineFrameColor = (p: Pick<CanonicalProduct, 'family'> & { productId?: string }, line: { frameColor?: string | null }): string | null => (frameColorsFor(p) ? (line.frameColor && frameColorsFor(p)!.includes(line.frameColor) ? line.frameColor : FRAME_COLOR_DEFAULT) : null)
