// app/api/v1/community/comments/[id]/route.ts
//
// DELETE - remove a comment.
//
// TWO PEOPLE MAY DO IT: whoever wrote it, and whoever owns the post it sits
// under. The second is the single most effective moderation tool there is and
// it costs nothing to run - somebody who does not want a particular remark
// under a portrait of their own face should not have to wait for a digest.

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

    const { data: c } = await db
      .from('community_comments')
      .select('id, owner_key, post_id')
      .eq('id', id)
      .maybeSingle()

    if (!c) return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })

    let allowed = c.owner_key === me

    if (!allowed && c.post_id) {
      const { data: p } = await db
        .from('community_posts')
        .select('owner_key')
        .eq('id', c.post_id)
        .maybeSingle()
      allowed = p?.owner_key === me
    }

    // 404 rather than 403 for somebody who is neither. A 403 confirms the
    // comment exists, which is a way to probe ids.
    if (!allowed) {
      return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
    }

    const { error } = await db
      .from('community_comments')
      .update({ state: 'removed' })
      .eq('id', id)

    if (error) {
      console.error('[community/comments/:id] remove failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    // SILENT. The author is not told, and no reason is recorded for them to
    // read. A note explaining why a comment was removed is an invitation to
    // argue about it, and the argument would land in the same inbox.
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[community/comments/:id] DELETE threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
