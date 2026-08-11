// app/api/v1/community/comments/route.ts
//
// GET  ?post=<id>   comments on one post
// GET  ?ideas=1     the What are your ideas? board
// POST              leave one of either
//
// ONE TABLE FOR BOTH. An idea is a comment with nothing attached: same
// classifier, same digest, same handles. Two tables would drift the week
// somebody changes a moderation rule in one of them.

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner, tooMany, LIMITS } from '@/lib/community/db'
import { moderateText } from '@/lib/v1/_core/text-moderation'

export const runtime = 'nodejs'

const PAGE = 100

// ---------------------------------------------------------------------------
// GET
//
// Only 'live' rows, ever. A held comment is invisible to everybody including
// the person who wrote it - showing it to its author with a "pending" badge
// tells somebody testing the filter exactly when they have got past it.
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: true, comments: [] })

    const postId = req.nextUrl.searchParams.get('post')
    const ideas  = req.nextUrl.searchParams.get('ideas')

    let q = db
      .from('community_comments')
      .select('id, post_id, body, kind, built, created_at, owner_key')
      .eq('state', 'live')
      .limit(PAGE)

    if (ideas) {
      // Newest first on the ideas board - it is a suggestion box, and the
      // thing somebody just thought of is the thing they want to see land.
      q = q.eq('kind', 'idea').order('created_at', { ascending: false })
    } else if (postId) {
      // Oldest first under a post, because it reads as a conversation.
      q = q.eq('kind', 'comment').eq('post_id', postId).order('created_at', { ascending: true })
    } else {
      return NextResponse.json({ ok: false, reason: 'no_target' }, { status: 400 })
    }

    const { data, error } = await q
    if (error) {
      console.error('[community/comments] read failed:', error.message)
      return NextResponse.json({ ok: true, comments: [] })
    }

    const rows = data ?? []

    // Handles are joined here rather than in a view because a comment row
    // must keep its owner_key for the delete check below, and a view that
    // dropped it would need a second query to put it back.
    const keys = Array.from(new Set(rows.map((r: { owner_key: string }) => r.owner_key)))
    const names: Record<string, string> = {}
    if (keys.length) {
      const { data: hs } = await db
        .from('community_handles').select('owner_key, handle').in('owner_key', keys)
      for (const h of hs ?? []) names[h.owner_key] = h.handle
    }

    const me = await owner()

    // owner_key NEVER leaves this route. `mine` is the only thing the glass
    // needs to know, and it is a boolean rather than an identity.
    const comments = rows.map((r: {
      id: string; post_id: string | null; body: string; kind: string;
      built: boolean; created_at: string; owner_key: string;
    }) => ({
      id:         r.id,
      post_id:    r.post_id,
      body:       r.body,
      kind:       r.kind,
      built:      r.built,
      created_at: r.created_at,
      handle:     names[r.owner_key] ?? null,
      mine:       !!me && r.owner_key === me,
    }))

    return NextResponse.json({ ok: true, comments, signed_in: !!me })
  } catch (e) {
    console.error('[community/comments] GET threw:', (e as Error).message)
    return NextResponse.json({ ok: true, comments: [] })
  }
}

// ---------------------------------------------------------------------------
// POST   { post_id?, body, kind: 'comment' | 'idea' }
//
// Classified on write. The classifier FAILS CLOSED - anything it could not
// judge is held for the digest rather than published. Nobody is blocked from
// something they paid for; they wait a few hours.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 503 })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const text: string = String(body?.body || '').trim()
    const kind: string = body?.kind === 'idea' ? 'idea' : 'comment'
    const postId: string | null = kind === 'comment' ? String(body?.post_id || '') : null

    if (!text || text.length > 500) {
      return NextResponse.json({ ok: false, reason: 'bad_body' }, { status: 400 })
    }
    if (kind === 'comment' && !postId) {
      return NextResponse.json({ ok: false, reason: 'no_post' }, { status: 400 })
    }

    const { data: handleRow } = await db
      .from('community_handles').select('handle').eq('owner_key', me).maybeSingle()
    if (!handleRow?.handle) {
      return NextResponse.json({ ok: false, reason: 'need_handle' }, { status: 400 })
    }

    // The limit that actually matters. A comment is free, which makes it the
    // only surface here a bored person can flood.
    if (await tooMany(db, 'community_comments', me, LIMITS.commentsPerHour)) {
      return NextResponse.json({ ok: false, reason: 'slow_down' }, { status: 429 })
    }

    const verdict = await moderateText({ text })

    const { data: row, error } = await db
      .from('community_comments')
      .insert({
        post_id:     postId || null,
        owner_key:   me,
        body:        text,
        kind,
        state:       verdict.verdict,
        held_reason: verdict.category ?? verdict.reason,
      })
      .select('id, state')
      .single()

    if (error) {
      console.error('[community/comments] insert failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    // THE SAME ANSWER EITHER WAY, and no mention of a classifier. Somebody
    // told their comment is "awaiting review" knows there is a filter and can
    // sit there rewording until they find its edge. Somebody told it has been
    // left simply sees it appear later, or not.
    //
    // It is also the honest answer for the far more common case: a held
    // comment is usually a false positive that Rich will release within
    // hours, and telling a normal customer they have been flagged for a
    // comment about a bronze finish would be worse than saying nothing.
    return NextResponse.json({
      ok: true,
      id: row.id,
      live: row.state === 'live',
    })
  } catch (e) {
    console.error('[community/comments] POST threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
