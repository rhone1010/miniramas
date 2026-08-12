// lib/v1/wallpapers/wallpapers-shared.ts
//
// MOBILE WALLPAPERS. 9:16, download only, no print path.
//
// Four silos: Portraits, Pets, Halloween, Studio.
//
// Halloween took the slot originally scoped for Groups, and it carries 28
// effects rather than 14 — the floor is 5 across and 3 down, so that room
// needs a toggle to flip between halves of its catalog.
// $2.99 a piece, bulk discounts on top of the credit discounts. Volume
// product — the thing that decides whether it works is composition, not
// effect count.
//
// ── THE COMPOSITION PROBLEM ────────────────────────────────────────────
//
// A phone wallpaper is not a small picture. It is a picture with a clock
// and date printed across the top quarter and an icon grid covering the
// bottom half. A render that centres the face — which is what every
// Portraits and Groups body does, correctly, for a print — puts the
// subject exactly where the icons land.
//
// So every wallpaper body carries its own framing: subject low, legs cut
// at the image bottom so it fills the screen rather than sitting on a
// plinth, and the top third OCCUPIED but quiet — dim material-appropriate
// content, not empty sky. An early neon test came back with clean sky and
// was dead.
//
// That framing belongs in the body and nowhere else. WALLPAPER_COMPOSITION
// used to restate it and contradicted every body it was appended to — it
// asked for clean space up top and nothing cropped at the edges, which is
// the opposite of both findings above, and it ran last where it would have
// won. Stripped 2026-08-11 to the phone-elements clause alone.
//
// ── OUTPAINT IS THE FALLBACK, NOT THE PLAN ─────────────────────────────
//
// NB2 renders 9:16 natively and a native render costs nothing extra, so
// the composition clause should be doing the work. outpaintToPhone runs
// only when a render comes back shorter than the phone aspect, and is a
// no-op when it does not — see lib/v1/shared/outpaint.ts, which returns
// `already_tall_enough` untouched.
//
// Outpainting invents what was never generated. On a wallpaper that
// usually means empty ceiling, which is harmless; on a face it means a
// second chin. Prompting for the shape is always the better answer.

export const WALLPAPER_ASPECT = '9:16'

/**
 * Appended to every wallpaper body.
 *
 * Framing is NOT here. It lives in the bodies, where it was tuned against
 * a render. All 42 were written and shot at 9:16 with their own framing
 * sentence; a second framing instruction appended after them would be the
 * later of two on the same axis, and the later one wins.
 *
 * What survives is the one clause that costs nothing at any aspect and
 * that NB2 needs — left alone it draws its own clock and status bar. It
 * produced "Trnday, Nep 26" on an early Portraits shot and a full
 * wifi-and-battery row on The Ferryman.
 */
export const WALLPAPER_COMPOSITION = 'Do not include phone elements.'

export type WallpaperSiloId =
  | 'portraits'
  | 'pets'
  | 'halloween'
  | 'studio'

export interface WallpaperSilo {
  id:    WallpaperSiloId
  label: string
  /** Studio has no catalog — the prompt is built from four dropdowns and
   *  a slider, and it runs a different model. See note below. */
  freeform?: boolean
  /** Rotates. Halloween through October, Christmas from November. Wants a
   *  date the glass can read rather than a deploy. */
  seasonal?: boolean
}

export const WALLPAPER_SILOS: Record<WallpaperSiloId, WallpaperSilo> = {
  portraits: { id: 'portraits', label: 'Portraits' },
  pets:      { id: 'pets',      label: 'Pets' },
  halloween: { id: 'halloween', label: 'Halloween', seasonal: true },
  studio:    { id: 'studio',    label: 'Studio', freeform: true },
}

export interface WallpaperEffect {
  id:    string
  label: string
  silo:  WallpaperSiloId
  /** Body only. WALLPAPER_COMPOSITION is appended at build time — never
   *  bake framing into a body, or the two instructions fight. */
  body:  string
  avoid?: string
}

// The catalog itself lives in one file per silo and is merged in
// wallpapers-registry.ts, which also owns buildWallpaperPrompt. Keeping the
// merge and the builder out of this file means a silo can be added without
// touching the shared types.

// ═══════════════════════════════════════════════════════════════
// OPEN STUDIO — OPEN QUESTION FOR RICH, NOT A BUILD DECISION
// ═══════════════════════════════════════════════════════════════
//
// Open Studio lets the customer write their own prompt, assisted by the
// prompt builder and the Curator. Every other silo in the product ships
// text Rich approved against a render; this one ships text a stranger
// wrote, at $2.99, at volume.
//
// That makes the prompt builder the moderation surface, and it is the only
// place in the product where one exists. Nothing here yet — a ruling on
// what it refuses has to come before the silo ships, not after.
//
// Worth deciding at the same time: whether an uploaded photograph is even
// allowed in Open Studio, or whether it is text-to-image only. A freeform
// prompt plus a real person's face is a materially different risk from a
// freeform prompt alone.
