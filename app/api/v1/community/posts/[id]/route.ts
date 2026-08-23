// app/api/v1/community/posts/[id]/route.ts
//
// DELETE - take it down.
//
// WITHDRAWAL IS NEVER NEGOTIATED. No review, no cooling-off, no "are you
// sure" beyond the one confirm in the glass. Somebody who wants their face
// off a public page gets it off the page, and the studio does not get a say.

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner } from '@/lib/community/db'

export const runtime = 'nodejs'

const PUBLIC_BUCKET = 'community'

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 503 })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })

    const { id } = await ctx.params
    if (!id) return NextResponse.json({ ok: false, reason: 'no_id' }, { status: 400 })

    // SOFT, NOT DROPPED. The hearts and comments hang off this row; deleting
    // it would orphan them, and a re-post later would inherit a stranger's
    // conversation. Nothing renders either way - community_board filters on
    // state = 'live'.
    //
    // public_path comes back from the same statement. Reading it separately
    // first would be a fetch followed by an update that a later refactor can
    // put a gap between, and in that gap sits a post somebody has already
    // asked to take down.
    const { data, error } = await db
      .from('community_posts')
      .update({ state: 'withdrawn', withdrawn_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_key', me)          // ownership in the query, not after it
      .eq('state', 'live')
      .select('id, public_path')

    if (error) {
      console.error('[community/posts/:id] withdraw failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    // Nothing updated means it was not theirs, or it was already down. Same
    // answer for both - the alternative tells somebody whether a post id
    // they guessed belongs to a real person.
    if (!data || !data.length) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    // ── THE PUBLIC COPY GOES TOO. 2026-08-23. ────────────────────────────
    //
    // Since 23 August a posted piece also has a permanent, unsigned copy in
    // the public `community` bucket, so that a board image pasted into a
    // message keeps working. That copy is the whole reason withdrawal now
    // has to do more than flip a state: leaving it up means somebody who
    // took their piece down still has a live public URL of their own face,
    // and the link they shared last week still resolves.
    //
    // Best effort, and deliberately so. If the delete fails the WITHDRAWAL
    // STILL SUCCEEDS - the post is off the board either way, and refusing
    // the withdrawal because storage was slow would be telling somebody they
    // cannot take their own picture down. The failure is logged with the
    // path so the orphan can be removed by hand.
    const publicPath = (data[0] as { public_path?: string | null }).public_path
    if (publicPath) {
      const { error: rmErr } = await db.storage
        .from(PUBLIC_BUCKET)
        .remove([publicPath])

      if (rmErr) {
        console.error(
          '[community/posts/:id] public copy NOT deleted, still live at',
          publicPath, ':', rmErr.message,
        )
      } else {
        // Cleared so nothing later reads a path to a file that is gone. A
        // failure here is harmless: the file is already deleted, and the
        // stale path resolves to nothing.
        await db
          .from('community_posts')
          .update({ public_path: null })
          .eq('id', id)
      }
    }

    // NO CLAWBACK. A withdrawn post no longer counts toward the ten, so the
    // NEXT threshold is further away - but a credit already granted stays
    // granted. Taking a credit back because somebody exercised the right we
    // gave them is the kind of thing that ends up screenshotted.
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[community/posts/:id] DELETE threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
