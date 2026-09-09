// lib/store/preview.ts
//
// Free-preview system (item 2): ledger enforcement, baked watermark,
// clean-original retention, and unlock delivery.
//
// Semantics (locked with Rich, 2026-06-12):
//   • One free preview per email AND per IP — both unique in preview_ledger.
//   • The preview is SPENT only when a piece actually renders. Gate bounces
//     and render failures never write a ledger row.
//   • Enforcement vs. generosity: a CONFIRMED prior use blocks (enforced);
//     an infrastructure error on the check lets the preview proceed with a
//     loud log (the free preview is the conversion engine — be generous).
//   • The watermark is BAKED into the preview bytes (sharp composite). If
//     baking fails the preview FAILS CLOSED — we never ship a clean file
//     for free. The UI overlay is presentation only.
//   • The clean original is retained in the private 'previews' bucket keyed
//     by preview id. The unlock purchase re-delivers it (portraits/unlock).

import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

export const PREVIEW_BUCKET = 'previews'

// ── Identity helpers ─────────────────────────────────────────────

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  // Light shape check — Stripe re-validates at checkout.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null
  return e
}

export function clientIpHash(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  const ip  = (fwd ? fwd.split(',')[0] : req.headers.get('x-real-ip') || 'unknown').trim()
  return createHash('sha256').update(ip).digest('hex')
}

// ── Ledger ───────────────────────────────────────────────────────

export type PreviewGate =
  | { allowed: true }
  | { allowed: false; reason: 'email_used' | 'ip_used' }

/** Confirmed prior use blocks; infra errors allow (logged loudly). */
export async function checkPreviewAllowed(
  sb: SupabaseClient,
  email: string,
  ipHash: string,
): Promise<PreviewGate> {
  try {
    const { data, error } = await sb
      .from('preview_ledger')
      .select('id, email, ip_hash')
      .or(`email.eq.${email},ip_hash.eq.${ipHash}`)
      .limit(1)
    if (error) throw new Error(error.message)
    if (data && data.length > 0) {
      return { allowed: false, reason: data[0].email === email ? 'email_used' : 'ip_used' }
    }
    return { allowed: true }
  } catch (e: any) {
    console.warn(`[preview] ledger check errored — allowing (generous): ${e?.message}`)
    return { allowed: true }
  }
}

/** Write the ledger row. Returns false on failure (logged; preview already shipped). */
export async function recordPreview(
  sb: SupabaseClient,
  args: {
    previewId:   string
    email:       string
    ipHash:      string
    series?:     string
    preset?:     string
    resolution?: string
    storagePath: string | null
    /* SET AT INSERT FOR A PIECE THAT WAS BOUGHT OUTRIGHT. unlocked_at is
       normally stamped by the unlock route when an entitlement is spent, and
       a null here is what makes a piece locked. A purchased portfolio (size
       1) has no unlock step and no entitlement to spend, so its one piece is
       born unlocked -- and /status then serves the clean master rather than
       a derivative, with no special case anywhere but this argument. */
    unlockedAt?: string | null
  },
): Promise<boolean> {
  const { error } = await sb.from('preview_ledger').insert({
    id:           args.previewId,
    email:        args.email,
    ip_hash:      args.ipHash,
    series:       args.series ?? 'portraits',
    preset:       args.preset ?? null,
    resolution:   args.resolution ?? null,
    storage_path: args.storagePath,
    unlocked_at:  args.unlockedAt ?? null,
  })
  if (error) {
    console.error(`[preview] ledger record FAILED for ${args.previewId}: ${error.message}`)
    return false
  }
  return true
}

// ── Clean-original storage ───────────────────────────────────────

/** Store the clean original; returns the storage path, or null on failure
 *  (preview still ships watermarked; unlock can re-render per spec). */
export async function storeCleanOriginal(
  sb: SupabaseClient,
  previewId: string,
  imageB64: string,
  series: string = 'portraits', // default preserves every existing caller's behavior
): Promise<string | null> {
  try {
    const path = `${series}/${previewId}.png`
    const { error } = await sb.storage
      .from(PREVIEW_BUCKET)
      .upload(path, Buffer.from(imageB64, 'base64'), {
        contentType: 'image/png',
        upsert:      true,
      })
    if (error) throw new Error(error.message)
    return path
  } catch (e: any) {
    console.error(`[preview] clean-original store FAILED for ${previewId}: ${e?.message}`)
    return null
  }
}

/** Fetch the clean original as base64, or null if missing/unreadable. */
export async function fetchCleanOriginal(
  sb: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  try {
    const { data, error } = await sb.storage.from(PREVIEW_BUCKET).download(storagePath)
    if (error || !data) return null
    return Buffer.from(await data.arrayBuffer()).toString('base64')
  } catch {
    return null
  }
}

// ── Locked-preview derivative ────────────────────────────────────
//
// What a LOCKED piece is allowed to be shown. Not the clean master at a
// smaller size by accident — a deliberately reduced file that is pleasant to
// look at and not worth keeping.
//
// This replaces the baked watermark as the protection for locked pieces. The
// bake put the mark in the pixels, which was strong, but it cost: the master
// arrives from NB2 as a ~180-207 KB JPEG and came back out as a 1.9-2.5 MB
// PNG, so a locked four-pack pushed roughly 8 MB of tile art at the browser.
// Measured against live storage 2026-09-09.
//
// PRODUCT-IMPACTING CONSTANTS. Both are named here rather than chosen
// silently, because both are visible to the customer.

/* 512 of the master's 1024 — half on each edge, a quarter of the pixels.
   Enough to judge the piece and to fill the tile at 2x on a phone; not
   enough to print or to pass off as the bought file. */
export const LOCKED_PREVIEW_PX = 512

/* The master is itself a JPEG, so this re-encodes rather than converting a
   lossless source: 82 holds the tonal transitions a portrait lives on
   without a visible artefact at tile size, and lands near 45-60 KB — around
   a fortieth of what the baked PNG cost. */
export const LOCKED_PREVIEW_QUALITY = 82

/** Where a locked piece's derivative lives. Separate prefix from both the
 *  clean master ({series}/) and the retired bake (watermarked/{series}/), so
 *  the three never collide and the old assets stay readable as a fallback. */
export function lockedPreviewPath(series: string, previewId: string): string {
  return `locked/${series}/${previewId}.jpg`
}

/** Build the locked derivative from clean master bytes.
 *
 *  Throws on failure. Callers MUST treat that as a failed item, exactly as a
 *  failed bake was treated: without a derivative there is nothing a locked
 *  browser is allowed to be shown, and the clean master is never the answer. */
export async function makeLockedPreview(imageB64: string): Promise<Buffer> {
  return sharp(Buffer.from(imageB64, 'base64'))
    .resize({ width: LOCKED_PREVIEW_PX, height: LOCKED_PREVIEW_PX, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: LOCKED_PREVIEW_QUALITY })
    .toBuffer()
}

// ── Baked watermark ──────────────────────────────────────────────
//
// STILL LIVE, on a narrower path than before. As of 2026-09-09 the portfolio
// render path no longer bakes — the locked derivative above replaced it there
// — but the FREE PREVIEW still does (portraits/generate/route.ts:596), and
// that has not changed. A free preview is given away to someone who has not
// bought anything and may never have an account, so the mark stays in its
// pixels; a portfolio piece is already behind payment and an owner check.
//
// The assets this wrote for portfolio pieces stay in place as the fallback
// for any preview whose derivative is missing, which is what the reader in
// portfolios/[portfolioId]/status looks for second.

//
// The Liten & Co watermark pattern, repeated across the preview and
// composited into the pixels. Throws on failure — callers must treat a bake
// failure as a failed preview (fail-closed), never ship the clean image.

/* The canonical design asset is public/icons/litenco_watermark.svg. This is
   a copy, because public/ is served statically and is not guaranteed to be
   in the serverless bundle, while lib/ is — the same reason style-refs.ts
   keeps its images under lib/. If the design changes, change it there and
   copy it here.

   The asset is a FINISHED PATTERN, not a logo: a 440-unit box showing an
   SVG <pattern> whose period is 300 user units. Nothing here rotates,
   re-spaces or otherwise rearranges it — the arrangement is the designer's. */
const WATERMARK_SVG_PATH = path.join(
  process.cwd(), 'lib', 'store', 'assets', 'litenco_watermark.svg',
)

/* Read off the asset: <svg viewBox="0 0 440 440"> containing
   <pattern width="300" height="300" patternUnits="userSpaceOnUse">. */
const PATTERN_BOX    = 440
const PATTERN_PERIOD = 300

const WM_COLOR     = '#ffffff'
const WM_OPACITY   = 0.25
const WM_TILE_RATIO = 0.32   // one pattern period, as a fraction of image width
const WM_TILE_MIN   = 160
const WM_TILE_MAX   = 520

let wmSvgCache: string | null = null

/* Read once, then recolour by splicing two presentation attributes onto the
   root <svg>. Deliberately NOT a rule that touches individual paths: the
   asset carries `.cls-1 { fill: url(#New_Pattern_3) }` on the rect and
   `.cls-2 { fill: none }` on the counters, and a CSS declaration beats an
   inherited presentation attribute — so the pattern fill and the hollow
   counters both survive, and only the artwork takes the white. */
function watermarkSvg(): Buffer {
  if (wmSvgCache === null) wmSvgCache = readFileSync(WATERMARK_SVG_PATH, 'utf8')
  return Buffer.from(
    wmSvgCache.replace('<svg ', `<svg fill="${WM_COLOR}" opacity="${WM_OPACITY}" `),
  )
}

/* ONE PERIOD, NOT THE WHOLE BOX. composite({ tile: true }) repeats its input
   edge to edge, so the input has to be a whole number of pattern periods or
   the phase jumps at every tile boundary. The box is 440 units against a
   300-unit period — 1.467 periods — and tiling it visibly clusters the marks
   in pairs with gaps between them. Rendering the box and taking one period
   out of it repeats seamlessly, and takes the spacing from the asset rather
   than inventing any. Cached: a portfolio bakes four to sixteen images at
   one size. */
const tileCache = new Map<number, Buffer>()

async function watermarkTile(tilePx: number): Promise<Buffer> {
  const hit = tileCache.get(tilePx)
  if (hit) return hit

  const renderPx = Math.round(tilePx * (PATTERN_BOX / PATTERN_PERIOD))
  const tile = await sharp(watermarkSvg())
    .resize({ width: renderPx })
    .extract({ left: 0, top: 0, width: tilePx, height: tilePx })
    .png()
    .toBuffer()

  tileCache.set(tilePx, tile)
  return tile
}

export async function bakeWatermark(imageB64: string): Promise<string> {
  const src = Buffer.from(imageB64, 'base64')

  /* Sized against the finished image so the pattern reads at the same
     density whether NB2 returns 1024 square or something wider. */
  const { width } = await sharp(src).metadata()
  const tilePx = Math.max(
    WM_TILE_MIN,
    Math.min(WM_TILE_MAX, Math.round((width ?? 1024) * WM_TILE_RATIO)),
  )

  const out = await sharp(src)
    .composite([{ input: await watermarkTile(tilePx), tile: true }])
    .png()
    .toBuffer()
  return out.toString('base64')
}
