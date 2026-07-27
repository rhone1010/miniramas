// app/api/v1/portraits/pieces/route.ts
//
// Durable "My Collection" persistence (migration 006).
//
//   POST — persist one finished crafted piece: upload its JPEG to the private
//          'collection' bucket and insert a collection_pieces row scoped to the
//          caller's owner_key (auth user id when signed in, else a browser guest
//          token). Returns the new piece with a signed image URL.
//   GET  — list the caller's pieces (newest first) as signed URLs.
//
// Failure is soft on purpose: if Supabase isn't configured the endpoints degrade
// to a no-op / empty list so the in-session workshop keeps working. Persistence
// is additive to the client's live state.queue, never a gate on crafting.

import { NextResponse } from 'next/server'
import { randomUUID }   from 'crypto'
import sharp            from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'
import { resolveLabel } from '@/lib/v1/_core/name-moderation'

const BUCKET = 'collection'
const SIGNED_URL_TTL = 60 * 60 * 24   // 24h — a browsing session's worth

// Service-role client for the WRITE — instantiated here (server-side only) with
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, the exact pair the generate route
// uses to write. The write model is service-role-only: never grant insert to
// anon, never add an anon RLS insert policy. (The shared @/lib/supabase admin is
// built from NEXT_PUBLIC_SUPABASE_URL; when that origin differs from SUPABASE_URL
// the service JWT is rejected and the insert falls back to anon → 42501.)
function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// owner_key = auth user id (durable, cross-device) OR the browser guest token.
async function resolveOwner(guestKey: unknown): Promise<{ ownerKey: string | null; userId: string | null }> {
  const user = await getUser().catch(() => null)
  if (user?.id) return { ownerKey: user.id, userId: user.id }
  const gk = typeof guestKey === 'string' && guestKey.trim() ? guestKey.trim() : null
  return { ownerKey: gk, userId: null }
}

async function toJpeg(b64: string): Promise<Buffer> {
  return sharp(Buffer.from(b64, 'base64'))
    .toColourspace('srgb')
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer()
}

export async function POST(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' })
    const body = await req.json().catch(() => ({}))
    const { ownerKey, userId } = await resolveOwner(body.guest_key)
    if (!ownerKey) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 400 })
    if (!body.image_b64 || typeof body.image_b64 !== 'string') {
      return NextResponse.json({ ok: false, reason: 'image_b64 required' }, { status: 400 })
    }

    // Piece-name gate (REQUIRED — the label sits beside images of real people,
    // often families and children). Empty → neutral fallback; a moderation hit →
    // reject, store nothing, return a neutral message (never name the word).
    // Runs BEFORE the image upload so a bad name fails fast and costs nothing.
    const labelResult = resolveLabel(body.label)
    if ('rejected' in labelResult) {
      return NextResponse.json(
        { ok: false, reason: 'name_rejected', message: 'Please choose a different name' },
        { status: 400 },
      )
    }

    const pieceId   = randomUUID()
    const imagePath = `${ownerKey}/${pieceId}.jpg`
    const imageJpeg = await toJpeg(body.image_b64)

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(imagePath, imageJpeg, { contentType: 'image/jpeg', upsert: true })
    if (upErr) return NextResponse.json({ ok: false, reason: `upload_failed: ${upErr.message}` }, { status: 500 })

    // We store ONLY the crafted piece — never the customer's source photo.
    const row = {
      id:         pieceId,
      owner_key:  ownerKey,
      user_id:    userId,
      series:     typeof body.series === 'string' ? body.series : 'portraits',
      preset:     typeof body.preset === 'string' ? body.preset : null,
      label:      labelResult.label,
      mode:       typeof body.mode === 'string' ? body.mode : null,
      image_path: imagePath,
      source_path: null,
      meta:       body.meta && typeof body.meta === 'object' ? body.meta : {},
    }
    const { error: insErr } = await db.from('collection_pieces').insert(row)
    if (insErr) return NextResponse.json({ ok: false, reason: `insert_failed: ${insErr.message}` }, { status: 500 })

    const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(imagePath, SIGNED_URL_TTL)
    return NextResponse.json({
      ok: true,
      piece: { id: pieceId, series: row.series, preset: row.preset, label: row.label,
               mode: row.mode, image_url: signed?.signedUrl ?? null, created_at: new Date().toISOString() },
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message || 'error' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ pieces: [] })
    const url = new URL(req.url)
    const { ownerKey } = await resolveOwner(url.searchParams.get('guest_key'))
    if (!ownerKey) return NextResponse.json({ pieces: [] })

    const { data, error } = await db
      .from('collection_pieces')
      .select('id, series, preset, label, mode, image_path, source_path, meta, created_at')
      .eq('owner_key', ownerKey)
      .order('created_at', { ascending: false })
    if (error || !data) return NextResponse.json({ pieces: [] })

    const pieces = await Promise.all(data.map(async (r) => {
      const { data: sImg } = await db.storage.from(BUCKET).createSignedUrl(r.image_path, SIGNED_URL_TTL)
      let sourceUrl: string | null = null
      if (r.source_path) {
        const { data: sSrc } = await db.storage.from(BUCKET).createSignedUrl(r.source_path, SIGNED_URL_TTL)
        sourceUrl = sSrc?.signedUrl ?? null
      }
      return {
        id: r.id, series: r.series, preset: r.preset, label: r.label, mode: r.mode,
        image_url: sImg?.signedUrl ?? null, source_url: sourceUrl, meta: r.meta, created_at: r.created_at,
      }
    }))
    return NextResponse.json({ pieces })
  } catch {
    return NextResponse.json({ pieces: [] })
  }
}
