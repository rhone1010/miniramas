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
): Promise<string | null> {
  try {
    const path = `portraits/${previewId}.png`
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
// Tiled diagonal "Liten & Co · preview" composited into the pixels.
// Throws on failure — callers must treat a bake failure as a failed
// preview (fail-closed), never ship the clean image.

export async function bakeWatermark(imageB64: string): Promise<string> {
  const tile = Buffer.from(
    `<svg width="420" height="280" xmlns="http://www.w3.org/2000/svg">` +
      `<text x="210" y="140" text-anchor="middle" ` +
      `font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-size="30" ` +
      `fill="rgba(255,255,255,0.32)" stroke="rgba(42,36,30,0.22)" stroke-width="0.75" ` +
      `transform="rotate(-30 210 140)">Liten &amp; Co \u00B7 preview</text>` +
    `</svg>`,
  )
  const out = await sharp(Buffer.from(imageB64, 'base64'))
    .composite([{ input: tile, tile: true }])
    .png()
    .toBuffer()
  return out.toString('base64')
}
