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
    const { data, error } = await db
      .from('community_posts')
      .update({ state: 'withdrawn', withdrawn_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_key', me)          // ownership in the query, not after it
      .eq('state', 'live')
      .select('id')

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
