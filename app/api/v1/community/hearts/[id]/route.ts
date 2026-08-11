// app/api/v1/community/hearts/[id]/route.ts
//
// POST - heart a post. Once, ever.
//
// There is no DELETE. Un-hearting exists so people can manage how they look
// to others, which is a feed problem, and this is not a feed. It also keeps
// the count a stable number rather than something that can be toggled.
//
// HEARTS BUY NOTHING. Considered and refused on 2026-08-10: hearting is free
// to the person doing it, so the moment twenty hearts is worth a craft,
// twenty hearts is a thing to manufacture. Posting earns instead, because a
// post costs a craft. See community_award_posts in 020.

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner } from '@/lib/community/db'

export const runtime = 'nodejs'

export async function POST(
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

    const { error } = await db
      .from('community_hearts')
      .insert({ post_id: id, owner_key: me })

    if (error) {
      // 23505 is the primary key doing its job: they have already hearted
      // this. A SECOND PRESS IS NOT AN ERROR - a double-tap on a phone, a
      // page restored from the back button, a flaky connection retried.
      // Return the count and let the glass settle on the truth.
      if ((error as { code?: string }).code === '23505') {
        const { data } = await db
          .from('community_posts').select('heart_count').eq('id', id).maybeSingle()
        return NextResponse.json({ ok: true, already: true, hearts: data?.heart_count ?? 0 })
      }
      // 23503 is a foreign key: the post is gone.
      if ((error as { code?: string }).code === '23503') {
        return NextResponse.json({ ok: false, reason: 'not_found' }, { status: 404 })
      }
      console.error('[community/hearts] insert failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    // heart_count is maintained by trigger, so this reads the number rather
    // than computing a second one beside it.
    const { data } = await db
      .from('community_posts').select('heart_count').eq('id', id).maybeSingle()

    return NextResponse.json({ ok: true, hearts: data?.heart_count ?? 1 })
  } catch (e) {
    console.error('[community/hearts] POST threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
