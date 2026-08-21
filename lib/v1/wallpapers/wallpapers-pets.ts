// lib/v1/wallpapers/wallpapers-pets.ts
//
// PETS WALLPAPERS. 9:16, download only.
//
// The same thirty-four effects as lib/v1/pets/pets-catalog-35.ts, at a
// phone shape. Not a second catalog — the bodies are imported and one
// paragraph is swapped.
//
// ── WHY A SWAP AND NOT THIRTY-FOUR REWRITES ────────────────────────────
//
// Every one of the thirty-four ends with the same tail: full body nose to
// tail, head and neck for a horse, markings are the likeness, head at 20%.
// That paragraph is the ONLY part that is wrong on a phone.
//
// So it is replaced and nothing else is touched. A change to what Bronze
// or Clown looks like happens in one place and reaches both rooms, which
// is the whole reason the tail was made identical across the set.
//
// If a body ever stops carrying that tail, this file will refuse to build
// it rather than silently ship a print composition to a phone. See below.
//
// ── WHAT A PHONE NEEDS THAT A PRINT DOES NOT ───────────────────────────
//
// A wallpaper is a picture with a clock across the top quarter and an icon
// grid over the bottom half. A render that centres the animal — correct
// for a print — puts it exactly where the icons land.
//
// THE TOP THIRD MUST BE OCCUPIED, NOT EMPTY. The first neon test in the
// Portraits room came back with clean sky and was dead. What works is dim
// material-appropriate content up there: something quiet that belongs to
// the same piece.
//
// THE FACE IS BIGGER HERE. Rich's rule for wallpapers is 20-30% of the
// image, against 20% for a print. A phone is looked at from arm's length
// for two seconds at a time; a print is looked at properly.
//
// AND THE ANIMAL IS CUT AT THE BOTTOM. Rich's finding in the Portraits
// room: it stops the render composing as a photographed object on a
// plinth and makes it fill the screen. That is the opposite of the print
// instruction, which asks for the whole animal including its paws.
//
// ── HORSES STILL GET HEAD AND NECK ─────────────────────────────────────
//
// More so here. A whole horse in a tall narrow frame is a small animal in
// a large field, and the nine horse renders of 20 August proved it at 1:1
// where there was more room than a phone gives.

import { PETS_35, PETS_35_IDS } from '../pets/pets-catalog-35'
import type { WallpaperEffect } from './wallpapers-shared'

/** The paragraph every print body ends with. Matched, not assumed — see
 *  the throw below. */
const PRINT_TAIL_MARK = 'Complete full-body sculpture'

/**
 * What replaces it.
 *
 * Deliberately not a superset of the print tail. Three of its instructions
 * are reversed here — the animal is cut at the bottom rather than whole,
 * the head is larger, and the space above the animal has a job rather than
 * being clean.
 */
const PHONE_TAIL =
  'Composed for a phone screen. The animal fills the lower two-thirds of ' +
  'the tall frame and is CUT OFF at the bottom edge rather than standing ' +
  'complete — it fills the screen instead of sitting on a plinth. Its head ' +
  'occupies 20-30% of the image. IF THE ANIMAL IS A HORSE OR OTHER LARGE ' +
  'ANIMAL, the head and neck only. The top third is OCCUPIED but quiet: ' +
  'dim, material-appropriate content belonging to the same piece, never ' +
  'empty sky. THE MARKINGS ARE THE LIKENESS — preserve their pattern, ' +
  'placement and proportion exactly. A collar and tags carry through in ' +
  'the same material and are welcome; they are identity, not props. ' +
  'Preserve breed, build, age and natural asymmetry. Add nothing that is ' +
  'not in the source.'

function toPhone(body: string): string {
  const i = body.indexOf(PRINT_TAIL_MARK)
  if (i < 0) {
    // Loud, at module load, rather than a silently print-shaped wallpaper.
    // A body that has lost its tail has been edited by hand, and the edit
    // needs looking at before it reaches a phone.
    throw new Error(
      'wallpapers-pets: a body in pets-catalog-35 no longer carries the ' +
      'standard tail, so its phone composition cannot be derived. Fix the ' +
      'body or give this room its own copy.',
    )
  }
  return body.slice(0, i) + PHONE_TAIL
}

export const PETS_WALLPAPERS: Record<string, WallpaperEffect> =
  Object.fromEntries(
    PETS_35_IDS.map(id => {
      const fx = PETS_35[id]
      return [id, {
        id,
        label: fx.label,
        silo:  'pets' as const,
        body:  toPhone(fx.body),
        avoid: fx.avoid,
      }]
    }),
  )

export const PETS_WALLPAPER_IDS = Object.keys(PETS_WALLPAPERS)
