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

// ── Baked watermark ──────────────────────────────────────────────
//
// The Liten & Co mark, tiled diagonally and composited into the pixels.
// Throws on failure — callers must treat a bake failure as a failed
// preview (fail-closed), never ship the clean image.
//
// The mark replaces the generated "Liten & Co · preview" text tile that
// stood here before. Same interface, same fail-closed contract.

/* The canonical design asset is public/icons/liten-and-co_watermark.svg.
   This is a copy, because public/ is served statically and is not
   guaranteed to be in the serverless bundle, while lib/ is — the same
   reason style-refs.ts keeps its images under lib/ rather than public/.
   If the design changes, change it there and copy it here. */
const WATERMARK_SVG_PATH = path.join(
  process.cwd(), 'lib', 'store', 'assets', 'liten-and-co_watermark.svg',
)

const WM_COLOR       = '#ffffff'
const WM_OPACITY     = 0.25
const WM_WIDTH_RATIO = 0.12   // of the output image's width
const WM_WIDTH_MIN   = 64
const WM_WIDTH_MAX   = 220
const WM_ROTATION    = -30
const WM_TILE_RATIO  = 2.6    // square tile edge, as a multiple of mark width

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 }

let wmSvgCache: string | null = null

/* Read once, then recolour by splicing two presentation attributes onto the
   root <svg>. Deliberately NOT a global `fill: white` rule: the file carries
   `.cls-1 { fill: none }` on ten construction paths, and a CSS rule beats an
   inherited presentation attribute — so the seventeen artwork paths take the
   white and the ten guides stay invisible. Nothing else in the file moves. */
function watermarkSvg(): Buffer {
  if (wmSvgCache === null) wmSvgCache = readFileSync(WATERMARK_SVG_PATH, 'utf8')
  return Buffer.from(
    wmSvgCache.replace('<svg ', `<svg fill="${WM_COLOR}" opacity="${WM_OPACITY}" `),
  )
}

/* One tile per mark width. composite({ tile: true }) repeats its input
   edge to edge, so the spacing between marks has to live inside the tile
   as transparent margin — a 2.6x square around a centred mark. Cached
   because a portfolio bakes four to sixteen images at the same size. */
const tileCache = new Map<number, Buffer>()

async function watermarkTile(markWidth: number): Promise<Buffer> {
  const hit = tileCache.get(markWidth)
  if (hit) return hit

  const mark = await sharp(watermarkSvg())
    .resize({ width: markWidth })            // 1:1 viewBox — ratio preserved
    .rotate(WM_ROTATION, { background: TRANSPARENT })
    .png()
    .toBuffer()

  const edge = Math.round(markWidth * WM_TILE_RATIO)
  const tile = await sharp({
    create: { width: edge, height: edge, channels: 4, background: TRANSPARENT },
  })
    .composite([{ input: mark, gravity: 'centre' }])
    .png()
    .toBuffer()

  tileCache.set(markWidth, tile)
  return tile
}

export async function bakeWatermark(imageB64: string): Promise<string> {
  const src = Buffer.from(imageB64, 'base64')

  /* Sized against the finished image, not the SVG's 3651-unit viewBox, so
     the mark reads the same whether NB2 returns 1024 square or wider. */
  const { width } = await sharp(src).metadata()
  const markWidth = Math.max(
    WM_WIDTH_MIN,
    Math.min(WM_WIDTH_MAX, Math.round((width ?? 1024) * WM_WIDTH_RATIO)),
  )

  const out = await sharp(src)
    .composite([{ input: await watermarkTile(markWidth), tile: true }])
    .png()
    .toBuffer()
  return out.toString('base64')
}
