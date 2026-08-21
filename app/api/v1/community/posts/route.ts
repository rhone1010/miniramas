// app/api/v1/community/posts/route.ts
//
// GET  - the board. Public, signed out, no account needed.
// POST - put a piece on it. Account, handle and consent required.
//
// Spec: docs/GOVERNANCE/COMMUNITY-BOARD-SPEC-2026-08-10.md

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner, tooMany, LIMITS, CONSENT_TEXT_V1 } from '@/lib/community/db'

export const runtime = 'nodejs'

const PAGE = 24

// The pieces live in the private `collection` bucket, written by
// /api/v1/portraits/pieces. Same bucket, same 24h signature that route
// hands the workshop.
//
// A signed URL is not shareable past its window, so a board image pasted
// into a message dies within the day. If the board is ever meant to be
// hotlinked, embedded, or cached by a CDN, the answer is a PUBLIC COPY
// MADE AT POST TIME - not a longer signature.
const BOARD_BUCKET   = 'collection'
const SIGNED_URL_TTL = 60 * 60 * 24

// ---------------------------------------------------------------------------
// EVERY GET RETURN IS THE SAME SHAPE. Corrected 2026-08-20.
//
// There are four exits from the board read - no database, a read error, the
// catch, and success - and the first three answered { ok, posts, more }
// while success answered { ok, posts, more, hearted, signed_in }.
//
// A caller reading signed_in off one of the short answers gets undefined,
// which is falsy, so A SIGNED-IN CUSTOMER LOOKS SIGNED OUT the moment the
// database hiccups. `hearted` has the worse version of the same fault: the
// glass iterates it, and undefined is not an empty array.
//
// The glass now guards against both, which is correct of it and is not a
// reason for the route to keep answering inconsistently. A caller should
// never have to know which branch produced its answer.
// ---------------------------------------------------------------------------
function emptyBoard(signedIn: boolean) {
  return NextResponse.json({
    ok:        true,
    posts:     [],
    more:      false,
    hearted:   [],
    signed_in: signedIn,
  })
}

// ---------------------------------------------------------------------------
// GET /api/v1/community/posts?before=<iso>
//
// THE BOARD IS VISIBLE SIGNED OUT. Ruled 2026-08-10 - it is the only page on
// this site that could bring a stranger in, and a marketing surface behind a
// sign-in wall is a locked shop window. Hearting and commenting still need an
// account; looking does not.
//
// Reads the community_board VIEW rather than the table. The view carries the
// handle and cannot carry the owner_key or the email, which makes that
// guarantee a property of the schema instead of a thing every route has to
// remember to do.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    // Read BEFORE the database check, so every exit below can report it
    // honestly. It is a session read rather than a query, and does not
    // depend on the board being available.
    const me = await owner()

    const db = svc()
    if (!db) return emptyBoard(!!me)

    const before = req.nextUrl.searchParams.get('before')

    let q = db
      .from('community_board')
      .select('id, effect_id, series, image_path, heart_count, comment_count, handle, created_at')
      .order('created_at', { ascending: false })
      .limit(PAGE + 1)

    if (before) q = q.lt('created_at', before)

    const { data, error } = await q
    if (error) {
      console.error('[community/posts] read failed:', error.message)
      return emptyBoard(!!me)
    }

    const rows = data ?? []
    const more = rows.length > PAGE
    const posts = rows.slice(0, PAGE)

    // One call for the whole page. createSignedUrls answers in the order it
    // was asked but is keyed by path here anyway - an answer that silently
    // shifted by one would put a stranger's face under somebody's handle.
    const paths = posts
      .map((p: { image_path: string | null }) => p.image_path)
      .filter((s: string | null): s is string => !!s)

    const urls: Record<string, string> = {}
    if (paths.length) {
      const { data: signed, error: sErr } = await db.storage
        .from(BOARD_BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL)
      if (sErr) console.error('[community/posts] sign failed:', sErr.message)
      for (const s of signed ?? []) {
        if (s.path && s.signedUrl) urls[s.path] = s.signedUrl
      }
    }

    // Which of these has the caller already hearted. One query, not one per
    // card, and it simply comes back empty when nobody is signed in.
    let hearted: string[] = []
    if (me && posts.length) {
      const { data: h } = await db
        .from('community_hearts')
        .select('post_id')
        .eq('owner_key', me)
        .in('post_id', posts.map((p: { id: string }) => p.id))
      hearted = (h ?? []).map((r: { post_id: string }) => r.post_id)
    }

    return NextResponse.json({
      ok: true,
      // Built by hand rather than spread. image_path must not leave this
      // route, and a spread that drops it is one refactor away from not
      // dropping it.
      posts: posts.map((p: {
        id: string; effect_id: string; series: string; image_path: string | null;
        heart_count: number; comment_count: number; handle: string | null;
        created_at: string;
      }) => ({
        id:            p.id,
        effect_id:     p.effect_id,
        series:        p.series,
        heart_count:   p.heart_count,
        comment_count: p.comment_count,
        handle:        p.handle,
        created_at:    p.created_at,
        // null rather than absent. A card whose signature failed shows the
        // empty state and keeps its handle and its hearts; it does not
        // vanish out of somebody's board because storage was slow.
        image_url:     p.image_path ? (urls[p.image_path] ?? null) : null,
      })),
      more,
      hearted,
      signed_in: !!me,
    })
  } catch (e) {
    console.error('[community/posts] GET threw:', (e as Error).message)
    // The one exit that cannot report sign-in honestly: the throw may have
    // come from owner() itself. Stated rather than hidden - a customer who
    // sees a signed-out board here has hit a real fault, and the log line
    // above is where it will be found.
    return emptyBoard(false)
  }
}

// ---------------------------------------------------------------------------
// POST /api/v1/community/posts   { piece_id, consent: true }
//
// CONSENT IS CHECKED HERE AND NOT ONLY IN THE MODAL. A tick in a browser is a
// statement about a browser. The row is what we would have to stand behind.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 503 })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const pieceId: string = String(body?.piece_id || '')
    const consent = body?.consent === true

    if (!pieceId) {
      return NextResponse.json({ ok: false, reason: 'no_piece' }, { status: 400 })
    }
    if (!consent) {
      return NextResponse.json({ ok: false, reason: 'no_consent' }, { status: 400 })
    }

    // A handle is required before anything appears with a name under it.
    const { data: handleRow } = await db
      .from('community_handles')
      .select('handle')
      .eq('owner_key', me)
      .maybeSingle()

    if (!handleRow?.handle) {
      return NextResponse.json({ ok: false, reason: 'need_handle' }, { status: 400 })
    }

    // THE PIECE MUST BE THEIRS. Scoped in the query itself rather than read
    // and then checked - a fetch followed by an if is two steps that can be
    // separated by a refactor, and this one must not be.
    const { data: piece } = await db
      .from('collection_pieces')
      .select('id, owner_key, series, preset, image_path, archived')
      .eq('id', pieceId)
      .eq('owner_key', me)
      .maybeSingle()

    if (!piece) {
      // Deliberately the same answer as a piece that does not exist. Telling
      // somebody a piece is real but not theirs is a way to enumerate other
      // people's work.
      return NextResponse.json({ ok: false, reason: 'no_piece' }, { status: 404 })
    }
    if (piece.archived) {
      return NextResponse.json({ ok: false, reason: 'archived' }, { status: 400 })
    }

    if (await tooMany(db, 'community_posts', me, LIMITS.postsPerHour)) {
      return NextResponse.json({ ok: false, reason: 'slow_down' }, { status: 429 })
    }

    // effect_id, series and image_path are copied onto the post on purpose.
    // The board has to survive this piece being archived later, and the deep
    // link out of a post needs the effect without a join to a table the
    // poster may since have emptied.
    const { data: post, error } = await db
      .from('community_posts')
      .insert({
        piece_id:     piece.id,
        owner_key:    me,
        effect_id:    piece.preset ?? '',
        series:       piece.series ?? 'portraits',
        image_path:   piece.image_path,
        consent_text: CONSENT_TEXT_V1,
        state:        'live',
      })
      .select('id')
      .single()

    if (error) {
      // The unique constraint on piece_id is the once-ever rule. Hitting it
      // is not an error the customer caused twice; it is a piece already on
      // the board.
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ ok: false, reason: 'already_posted' }, { status: 409 })
      }
      console.error('[community/posts] insert failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    // Ten live pieces earns a craft. The function is idempotent per threshold
    // and returns 0 almost every time, so it is safe to call after every
    // post rather than counting in here and getting it wrong.
    let earned = 0
    const { data: award } = await db.rpc('community_award_posts', { p_owner: me })
    if (typeof award === 'number') earned = award

    return NextResponse.json({ ok: true, id: post.id, earned })
  } catch (e) {
    console.error('[community/posts] POST threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
