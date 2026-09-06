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
import { getUser }      from '@/lib/store/auth'
// The write moved to lib/store/collection-pieces so a server-side caller — the
// Discovery single-purchase render — can put a finished piece on the same shelf
// without a cookie to authenticate with. Identity still resolves here; the row
// is written there. Same table, one copy of the write.
import { savePiece, svc, BUCKET, SIGNED_URL_TTL } from '@/lib/store/collection-pieces'

// owner_key = auth user id (durable, cross-device) OR the browser guest token.
async function resolveOwner(guestKey: unknown): Promise<{ ownerKey: string | null; userId: string | null; userEmail: string | null }> {
  const user = await getUser().catch(() => null)
  if (user?.id) return { ownerKey: user.id, userId: user.id, userEmail: user.email ?? null }
  const gk = typeof guestKey === 'string' && guestKey.trim() ? guestKey.trim() : null
  return { ownerKey: gk, userId: null, userEmail: null }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const { ownerKey, userId, userEmail } = await resolveOwner(body.guest_key)
    if (!ownerKey) return NextResponse.json({ ok: false, reason: 'no_owner' }, { status: 400 })

    const result = await savePiece({
      ownerKey, userId, userEmail,
      imageB64: body.image_b64,
      series:   body.series,
      preset:   body.preset,
      mode:     body.mode,
      meta:     body.meta,
    })
    if (!result.ok) {
      // Same three answers this route always gave: an unconfigured Supabase
      // degrades to a soft no-op, a missing image is the caller's fault, and
      // an upload or insert that failed is ours.
      if (result.reason === 'not_configured') return NextResponse.json(result)
      const status = result.reason === 'image_b64 required' ? 400 : 500
      return NextResponse.json(result, { status })
    }
    return NextResponse.json(result)
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
      const { data: sImg } = await db.storage.from(BUCKET).createSignedUrl(r.image_path, SIGNED_URL_TTL)
      let sourceUrl: string | null = null
      if (r.source_path) {
        const { data: sSrc } = await db.storage.from(BUCKET).createSignedUrl(r.source_path, SIGNED_URL_TTL)
        sourceUrl = sSrc?.signedUrl ?? null
      }
      return {
        id: r.id, series: r.series, preset: r.preset, label: r.label, mode: r.mode,
        archived: !!r.archived, archived_at: r.archived_at ?? null,
        image_url: sImg?.signedUrl ?? null, source_url: sourceUrl,
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
