// app/api/v1/community/reports/route.ts
//
// POST { target_kind: 'post' | 'comment', target_id }
//
// QUIET. No public count, no visible outcome, no thank-you that reveals
// whether it worked. A reporting mechanism that shows its effect is a
// reporting mechanism people learn to aim.

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner, REPORTS_TO_PULL } from '@/lib/community/db'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: true })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const kind = body?.target_kind === 'comment' ? 'comment' : 'post'
    const id   = String(body?.target_id || '')
    if (!id) return NextResponse.json({ ok: false, reason: 'no_id' }, { status: 400 })

    const { error } = await db
      .from('community_reports')
      .insert({ target_kind: kind, target_id: id, owner_key: me })

    // A second report from the same person is a no-op, and looks to them
    // exactly like the first. One person cannot become three.
    if (error && (error as { code?: string }).code !== '23505') {
      console.error('[community/reports] insert failed:', error.message)
      return NextResponse.json({ ok: true })   // still quiet
    }

    // THREE DISTINCT REPORTERS PULLS IT PENDING REVIEW. A small number of
    // people can therefore hide something briefly. That is accepted, and it
    // is the right way round: the alternative is that genuine abuse stands
    // until the next digest, which could be eleven hours.
    const { count } = await db
      .from('community_reports')
      .select('id', { count: 'exact', head: true })
      .eq('target_kind', kind)
      .eq('target_id', id)

    if ((count ?? 0) >= REPORTS_TO_PULL) {
      if (kind === 'comment') {
        await db.from('community_comments')
          .update({ state: 'held', held_reason: 'reported' })
          .eq('id', id).eq('state', 'live')
      } else {
        await db.from('community_posts')
          .update({ state: 'removed' })
          .eq('id', id).eq('state', 'live')
      }
    }

    // Always the same answer, whether it was the first report or the third,
    // whether it pulled anything or not.
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[community/reports] POST threw:', (e as Error).message)
    return NextResponse.json({ ok: true })
  }
}
