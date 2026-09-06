// lib/store/collection-pieces.ts
//
// The persist half of /api/v1/portraits/pieces, lifted out of the route so a
// server-side caller can write the same row without forging a cookie.
//
// Ruled 2026-09-06: a Discovery single lands in `collection_pieces` — the same
// table portraits.html already reads — not a new table and not a portfolio of
// one. The route had the only copy of the write, and the only way in was an
// authenticated request, so the single-purchase render had nowhere to put a
// finished piece.
//
// This is a MOVE, not a rewrite. The bytes below came out of
// app/api/v1/portraits/pieces/route.ts POST (66-126) unchanged apart from
// taking the resolved owner as an argument instead of reading it from cookies.
// The route still owns identity; this owns the row.

import { randomUUID }   from 'crypto'
import sharp            from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { PRESET_LABELS } from '@/lib/v1/portraits/portraits-shared'

export const BUCKET = 'collection'
export const SIGNED_URL_TTL = 60 * 60 * 24   // 24h — a browsing session's worth

// Service-role client for the WRITE — instantiated here (server-side only) with
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, the exact pair the generate route
// uses to write. The write model is service-role-only: never grant insert to
// anon, never add an anon RLS insert policy.
export function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

async function toJpeg(b64: string): Promise<Buffer> {
  return sharp(Buffer.from(b64, 'base64'))
    .toColourspace('srgb')
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer()
}

export interface SavePieceArgs {
  ownerKey:  string
  userId:    string | null
  userEmail: string | null
  imageB64:  string
  series?:   unknown
  preset?:   unknown
  mode?:     unknown
  meta?:     unknown
}

export type SavePieceResult =
  | { ok: true; piece: {
        id: string; series: string; preset: string | null; label: string
        mode: string | null; archived: boolean
        image_url: string | null; created_at: string
      } }
  | { ok: false; reason: string }

export async function savePiece(args: SavePieceArgs): Promise<SavePieceResult> {
  const db = svc()
  if (!db) return { ok: false, reason: 'not_configured' }
  if (!args.ownerKey) return { ok: false, reason: 'no_owner' }
  if (!args.imageB64 || typeof args.imageB64 !== 'string') {
    return { ok: false, reason: 'image_b64 required' }
  }

  // Auto-naming (2026-07-23): the label is generated at persist time (below),
  // not supplied by the customer — no free text, so no moderation gate.
  const pieceId   = randomUUID()
  const imagePath = `${args.ownerKey}/${pieceId}.jpg`
  const imageJpeg = await toJpeg(args.imageB64)

  const { error: upErr } = await db.storage
    .from(BUCKET)
    .upload(imagePath, imageJpeg, { contentType: 'image/jpeg', upsert: true })
  if (upErr) return { ok: false, reason: `upload_failed: ${upErr.message}` }

  // Auto-naming — generate the label at persist time (after a successful upload,
  // so a failed craft never burns a sequence number):
  //   [Series] - [Effect] - [User Name] - [###]
  const SERIES_LABEL: Record<string, string> = {
    portraits: 'Portraits', pets: 'Pets', groups: 'Groups',
    actionmini: 'Action', action: 'Action', wallpapers: 'Wallpapers',
  }
  const seriesKey  = typeof args.series === 'string' ? args.series : 'portraits'
  const presetKey  = typeof args.preset === 'string' ? args.preset : ''
  const seriesName = SERIES_LABEL[seriesKey] || 'Portraits'
  const effectName = (PRESET_LABELS as Record<string, string>)[presetKey] || presetKey
  const userName   = args.userEmail ? args.userEmail.split('@')[0] : ''
  const { data: seqNum } = await db.rpc('next_label_seq', { p_owner: args.ownerKey })
  const seqStr     = String(typeof seqNum === 'number' ? seqNum : 1).padStart(3, '0')
  const generatedLabel = [seriesName, effectName, userName, seqStr].filter(Boolean).join(' - ')

  // We store ONLY the crafted piece — never the customer's source photo.
  const row = {
    id:         pieceId,
    owner_key:  args.ownerKey,
    user_id:    args.userId,
    series:     seriesKey,
    preset:     presetKey || null,
    label:      generatedLabel,
    mode:       typeof args.mode === 'string' ? args.mode : null,
    image_path: imagePath,
    source_path: null,
    meta:       args.meta && typeof args.meta === 'object' ? args.meta : {},
  }
  const { error: insErr } = await db.from('collection_pieces').insert(row)
  if (insErr) return { ok: false, reason: `insert_failed: ${insErr.message}` }

  const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(imagePath, SIGNED_URL_TTL)
  return {
    ok: true,
    piece: { id: pieceId, series: row.series, preset: row.preset, label: row.label,
             mode: row.mode, archived: false,
             image_url: signed?.signedUrl ?? null, created_at: new Date().toISOString() },
  }
}
