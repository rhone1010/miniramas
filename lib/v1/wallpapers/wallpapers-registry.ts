// lib/v1/wallpapers/wallpapers-registry.ts
//
// Joins the per-silo effect files into one catalog and builds the prompt.
//
// Each silo keeps its own file so a Pets change cannot touch a Portraits
// body, and so the port from each source catalog stays traceable to the
// file it came from. This is the only place they are merged.
//
// Portraits carries 14, Halloween 28, Pets Halloween 27, Pets 34, and
// Studio has no catalog. 103 ids live today.

import {
  WALLPAPER_COMPOSITION,
  WALLPAPER_ASPECT,
  WALLPAPER_SILOS,
  type WallpaperEffect,
  type WallpaperSiloId,
} from './wallpapers-shared'
import { PORTRAITS_WALLPAPERS } from './wallpapers-portraits'
import { HALLOWEEN_WALLPAPERS } from './wallpapers-halloween'
import { PETS_HALLOWEEN_WALLPAPERS } from './wallpapers-pets-halloween'
import { PETS_WALLPAPERS } from './wallpapers-pets'

export { WALLPAPER_ASPECT, WALLPAPER_SILOS, WALLPAPER_COMPOSITION }
export type { WallpaperEffect, WallpaperSiloId }

export const WALLPAPER_EFFECTS: Record<string, WallpaperEffect> = {
  ...PORTRAITS_WALLPAPERS,
  ...HALLOWEEN_WALLPAPERS,
  ...PETS_HALLOWEEN_WALLPAPERS,
  // Derived from the thirty-four print bodies with the composition
  // paragraph swapped — see wallpapers-pets.ts. Not a second catalog.
  ...PETS_WALLPAPERS,
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
 * The pet Halloween effects, which share the 'halloween' silo with the 28
 * human ones.
 *
 * Halloween is a season rather than a room — it holds the photo effects,
 * the pets and the Studio — so both catalogs answer to the same silo id.
 * But the two are a different register: the human 28 are gothic horror on
 * a person's face, and these twenty turn an animal into an epic dark
 * fantasy creature. A grid mixing them reads as a mistake rather than as
 * range.
 *
 * The `pethw_` prefix is the separator, and this is the only place that
 * knows it. The glass should call these rather than test the prefix
 * itself.
 */
export function isPetHalloweenId(id: string): boolean {
  return id.startsWith('pethw_')
}

export function halloweenBySubject(subject: 'person' | 'pet'): WallpaperEffect[] {
  return wallpapersBySilo('halloween')
    .filter(e => isPetHalloweenId(e.id) === (subject === 'pet'))
}

/**
 * Where an effect's 9:16 preview plate lives.
 *
 * DERIVED, NEVER STORED. A `preview` field on each row would be a filename
 * string that can drift from the file it names, with nothing to report the
 * drift — the plate simply stops loading, in a grid, in production.
 *
 * The pet Halloween plates sit in their own folder and drop the `pethw_`
 * prefix, because the folder already says what the prefix says. That is the
 * one place the prefix is stripped.
 *
 * NOTE the extension. The rest of the repo uses `.jpg`; these were shot as
 * `.jpeg`. Rather than rename 27 files, the exception is stated here where
 * it can be seen. If they are ever re-shot, shoot them as `.jpg` and delete
 * this branch.
 */
export function wallpaperPlatePath(id: string): string {
  if (isPetHalloweenId(id)) {
    return `previews/wallpapers/halloween-pets/${id.slice('pethw_'.length)}.jpeg`
  }
  const effect = WALLPAPER_EFFECTS[id]
  return `previews/wallpapers/${effect?.silo ?? 'portraits'}/${id}.jpg`
}

/**
 * Assemble the string NB2 receives.
 *
 * body -> avoid -> composition.
 *
 * WHAT COMPOSITION IS, AND WHAT IT IS NOT. It carries the phone-elements
 * clause and nothing else. Framing lives in the bodies, where it was tuned
 * against a render, and it is stated differently in different rooms on
 * purpose — the human Halloween room says "Keep subject in lower 2/3", the
 * pet Halloween room says "Exclude the subject from the upper 1/3". Same
 * intent, different words, not interchangeable.
 *
 * Composition still runs last, because whatever is appended after a body
 * is the later instruction and the later one wins. That is the lesson that
 * cost a session when goofy's lighting sentence cancelled stained_glass's,
 * and it is why the old composition constant — which restated framing —
 * had to be stripped rather than reworded.
 */
export function buildWallpaperPrompt(input: {
  effectId?: string
}): string {
  const parts: string[] = []

  const effect = input.effectId ? WALLPAPER_EFFECTS[input.effectId] : undefined
  if (!effect) {
    throw new Error(`unknown wallpaper effect: ${input.effectId}`)
  }

  parts.push(effect.body)
  if (effect.avoid) parts.push(effect.avoid)

  parts.push(WALLPAPER_COMPOSITION)

  return parts.join('\n')
}
