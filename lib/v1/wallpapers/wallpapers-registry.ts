// lib/v1/wallpapers/wallpapers-registry.ts
//
// Joins the per-silo effect files into one catalog and builds the prompt.
//
// Each silo keeps its own file so a Pets change cannot touch a Portraits
// body, and so the port from each source catalog stays traceable to the
// file it came from. This is the only place they are merged.
//
// Portraits carries 14, Halloween 28, Pets is not yet ported, and Studio
// has no catalog. 42 ids live today.

import {
  WALLPAPER_COMPOSITION,
  WALLPAPER_ASPECT,
  WALLPAPER_SILOS,
  type WallpaperEffect,
  type WallpaperSiloId,
} from './wallpapers-shared'
import { PORTRAITS_WALLPAPERS } from './wallpapers-portraits'
import { HALLOWEEN_WALLPAPERS } from './wallpapers-halloween'

export { WALLPAPER_ASPECT, WALLPAPER_SILOS, WALLPAPER_COMPOSITION }
export type { WallpaperEffect, WallpaperSiloId }

export const WALLPAPER_EFFECTS: Record<string, WallpaperEffect> = {
  ...PORTRAITS_WALLPAPERS,
  ...HALLOWEEN_WALLPAPERS,
  // ...PETS_WALLPAPERS,  — needs PETS-SPEC-2026-08-02.md
  // Studio has no catalog by design: four dropdowns and a slider, and a
  // different model. It does not belong in this map.
}

export const WALLPAPER_EFFECT_IDS = Object.keys(WALLPAPER_EFFECTS)

export function getWallpaperEffect(id: string): WallpaperEffect | undefined {
  return WALLPAPER_EFFECTS[id]
}

export function isWallpaperEffectId(v: unknown): v is string {
  return typeof v === 'string' && v in WALLPAPER_EFFECTS
}

export function wallpapersBySilo(silo: WallpaperSiloId): WallpaperEffect[] {
  return WALLPAPER_EFFECT_IDS
    .map(id => WALLPAPER_EFFECTS[id])
    .filter(e => e.silo === silo)
}

/**
 * Assemble the string NB2 receives.
 *
 * body -> avoid -> composition, with composition ALWAYS last. Framing is
 * the instruction most easily overridden by an earlier one, so it goes at
 * the end where nothing follows it. This is the same lesson that cost a
 * session when goofy's lighting sentence cancelled stained_glass's.
 *
 * Open Studio passes freeformPrompt instead of an effect id. The customer's
 * text takes the body position and still gets the composition clause —
 * their prompt says what to make, not how to frame a phone screen.
 */
export function buildWallpaperPrompt(input: {
  effectId?: string
  freeformPrompt?: string
}): string {
  const parts: string[] = []

  if (input.freeformPrompt) {
    parts.push(input.freeformPrompt.trim())
  } else {
    const effect = input.effectId ? WALLPAPER_EFFECTS[input.effectId] : undefined
    if (!effect) {
      throw new Error(`unknown wallpaper effect: ${input.effectId}`)
    }
    parts.push(effect.body)
    if (effect.avoid) parts.push(effect.avoid)
  }

  parts.push(WALLPAPER_COMPOSITION)

  return parts.join('\n')
}
