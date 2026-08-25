// app/api/v1/portraits/pieces/route.ts
//
// Durable "My Collection" persistence (migration 006).
//
//   POST  — persist one finished crafted piece: upload its JPEG to the private
//           'collection' bucket and insert a collection_pieces row scoped to the
//           caller's owner_key. Returns the new piece with a signed image URL.
//   GET   — list the caller's pieces (newest first) as signed URLs.
//           ?archived=1 returns the archive instead of the wall.
//           ?all=1      returns both, for the Print Shop.
//   PATCH — put a piece away, or bring it back.
//
// Failure is soft on purpose: if Supabase isn't configured the endpoints degrade
// to a no-op / empty list so the in-session workshop keeps working. Persistence
// is additive to the client's live state, never a gate on crafting.
//
// CUI V25 · 2026-08-03 · ARCHIVING (migration 014)
//
//   A customer with dozens of pieces needs to tidy the wall. Ruled: archive,
//   not delete.
//
//   NOTHING HERE DESTROYS ANYTHING. There is no DELETE handler and there
//   should not be one — a Crafted Image cost ten credits, and a click must
//   not be able to throw the customer's work away.
//
//   AN ARCHIVED PIECE IS STILL PRINTABLE. Ruled 2026-08-03. Archiving is
//   tidying a wall, not discarding work, so the Print Shop asks for ?all=1
//   and sees everything. Only the collection view filters.

import { NextResponse } from 'next/server'
import { randomUUID }   from 'crypto'
import sharp            from 'sharp'
import { createClient } from '@supabase/supabase-js'
import { getUser }      from '@/lib/store/auth'
import { PRESET_LABELS } from '@/lib/v1/portraits/portraits-shared'

const BUCKET = 'collection'
const SIGNED_URL_TTL = 60 * 60 * 24   // 24h — a browsing session's worth

// Service-role client for the WRITE — instantiated here (server-side only) with
// SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, the exact pair the generate route
// uses to write. The write model is service-role-only: never grant insert to
// anon, never add an anon RLS insert policy.
function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// owner_key = auth user id (durable, cross-device) OR the browser guest token.
async function resolveOwner(guestKey: unknown): Promise<{ ownerKey: string | null; userId: string | null; userEmail: string | null }> {
  const user = await getUser().catch(() => null)
  if (user?.id) return { ownerKey: user.id, userId: user.id, userEmail: user.email ?? null }
  const gk = typeof guestKey === 'string' && guestKey.trim() ? guestKey.trim() : null
  return { ownerKey: gk, userId: null, userEmail: null }
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
    const { ownerKey, userId, userEmail } = await resolveOwner(body.guest_key)
    if (!ownerKey) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 400 })
    if (!body.image_b64 || typeof body.image_b64 !== 'string') {
      return NextResponse.json({ ok: false, reason: 'image_b64 required' }, { status: 400 })
    }

    // Auto-naming (2026-07-23): the label is generated at persist time (below),
    // not supplied by the customer — no free text, so no moderation gate.
    const pieceId   = randomUUID()
    const imagePath = `${ownerKey}/${pieceId}.jpg`
    const imageJpeg = await toJpeg(body.image_b64)

    const { error: upErr } = await db.storage
      .from(BUCKET)
      .upload(imagePath, imageJpeg, { contentType: 'image/jpeg', upsert: true })
    if (upErr) return NextResponse.json({ ok: false, reason: `upload_failed: ${upErr.message}` }, { status: 500 })

    // Auto-naming — generate the label at persist time (after a successful upload,
    // so a failed craft never burns a sequence number):
    //   [Series] - [Effect] - [User Name] - [###]
    const SERIES_LABEL: Record<string, string> = {
      portraits: 'Portraits', pets: 'Pets', groups: 'Groups',
      actionmini: 'Action', action: 'Action', wallpapers: 'Wallpapers',
    }
    const seriesKey  = typeof body.series === 'string' ? body.series : 'portraits'
    const presetKey  = typeof body.preset === 'string' ? body.preset : ''
    const seriesName = SERIES_LABEL[seriesKey] || 'Portraits'
    const effectName = (PRESET_LABELS as Record<string, string>)[presetKey] || presetKey
    const userName   = userEmail ? userEmail.split('@')[0] : ''
    const { data: seqNum } = await db.rpc('next_label_seq', { p_owner: ownerKey })
    const seqStr     = String(typeof seqNum === 'number' ? seqNum : 1).padStart(3, '0')
    const generatedLabel = [seriesName, effectName, userName, seqStr].filter(Boolean).join(' - ')

    // We store ONLY the crafted piece — never the customer's source photo.
    const row = {
      id:         pieceId,
      owner_key:  ownerKey,
      user_id:    userId,
      series:     seriesKey,
      preset:     presetKey || null,
      label:      generatedLabel,
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
               mode: row.mode, archived: false,
               image_url: signed?.signedUrl ?? null, created_at: new Date().toISOString() },
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

    // Three views of the same shelf:
    //   default    the wall — what the customer has not put away
    //   ?archived=1 the archive
    //   ?all=1     everything, which is what the Print Shop asks for, because
    //              an archived piece is still printable (ruled 2026-08-03)
    const wantAll      = url.searchParams.get('all') === '1'
    const wantArchived = url.searchParams.get('archived') === '1'

    let q = db
      .from('collection_pieces')
      .select('id, series, preset, label, mode, image_path, source_path, meta, created_at, archived, archived_at')
      .eq('owner_key', ownerKey)

    if (!wantAll) q = q.eq('archived', wantArchived)

    const { data, error } = await q.order('created_at', { ascending: false })
    if (error || !data) {
      // A missing column means migration 014 has not been applied. Say so
      // once rather than returning an empty collection to a customer who has
      // fifty pieces.
      if (error) console.error('[pieces] read failed:', error.message)
      return NextResponse.json({ pieces: [] })
    }

    const pieces = await Promise.all(data.map(async (r: any) => {
      // PURCHASED STORE WALLPAPERS live in the PUBLIC 'wallpapers'
      // bucket (studio/<section>/<file>), not the private collection
      // bucket - signing there fails and the piece rendered
      // src="null". Public bucket, public URL, no signing needed.
      // CUI 42, 25 Aug 2026.
      let imageUrl: string | null = null
      if (typeof r.image_path === 'string' && r.image_path.startsWith('studio/')) {
        imageUrl = db.storage.from('wallpapers').getPublicUrl(r.image_path).data.publicUrl ?? null
      } else {
        const { data: sImg } = await db.storage.from(BUCKET).createSignedUrl(r.image_path, SIGNED_URL_TTL)
        imageUrl = sImg?.signedUrl ?? null
      }
      let sourceUrl: string | null = null
      if (r.source_path) {
        const { data: sSrc } = await db.storage.from(BUCKET).createSignedUrl(r.source_path, SIGNED_URL_TTL)
        sourceUrl = sSrc?.signedUrl ?? null
      }
      return {
        id: r.id, series: r.series, preset: r.preset, label: r.label, mode: r.mode,
        archived: !!r.archived, archived_at: r.archived_at ?? null,
        image_url: imageUrl, source_url: sourceUrl,
        meta: r.meta, created_at: r.created_at,
      }
    }))
    return NextResponse.json({ pieces })
  } catch {
    return NextResponse.json({ pieces: [] })
  }
}

/**
 * PATCH — put a piece away, or bring it back.
 *
 * { id: '<piece id>', archived: true | false }
 *
 * Scoped to the caller's owner_key in the WHERE clause, not checked first
 * and updated after: a read-then-write here would let a crafted id from one
 * account touch a row in another between the two statements.
 */
export async function PATCH(req: Request) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 })

    const body = await req.json().catch(() => ({}))
    const { ownerKey } = await resolveOwner(body.guest_key)
    if (!ownerKey) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 401 })

    const id = typeof body.id === 'string' ? body.id.trim() : ''
    if (!id) return NextResponse.json({ ok: false, reason: 'id required' }, { status: 400 })
    if (typeof body.archived !== 'boolean') {
      return NextResponse.json({ ok: false, reason: 'archived must be true or false' }, { status: 400 })
    }

    // The two columns move together — migration 014 has a CHECK that refuses
    // any other combination.
    const { data, error } = await db
      .from('collection_pieces')
      .update({
        archived:    body.archived,
        archived_at: body.archived ? new Date().toISOString() : null,
      })
      .eq('id', id)
      .eq('owner_key', ownerKey)
      .select('id, archived')

    if (error) {
      console.error('[pieces] archive failed:', error.message)
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
    }
    if (!data || !data.length) {
      // Either no such piece, or it belongs to somebody else. The customer
      // gets the same answer for both; which one it was is not their business
      // and telling them would confirm the id exists.
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true, id: data[0].id, archived: data[0].archived })
  } catch (e: any) {
    return NextResponse.json({ ok: false, reason: e?.message || 'error' }, { status: 500 })
  }
}
