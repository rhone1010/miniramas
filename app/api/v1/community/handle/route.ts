// app/api/v1/community/handle/route.ts
//
// GET - mine, and a suggestion if I have none
// PUT - set or change it
//
// SET AT FIRST POST, NOT AT SIGNUP. Somebody who never posts is never asked
// to invent a name for themselves, and a signup form with one more field on
// it is a signup form fewer people finish.

import { NextRequest, NextResponse } from 'next/server'
import { svc, owner } from '@/lib/community/db'
import { moderateText, handleShapeError } from '@/lib/v1/_core/text-moderation'
import { getUser } from '@/lib/store/auth'

export const runtime = 'nodejs'

// Thirty days before a released handle can be taken by somebody else, so a
// name people know somebody by cannot be grabbed the instant they edit it.
const HOLD_DAYS = 30

export async function GET() {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: true, handle: null })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: true, handle: null, signed_in: false })

    const { data } = await db
      .from('community_handles').select('handle').eq('owner_key', me).maybeSingle()

    // A suggestion, not a reservation. The part of the email before the @ is
    // what people already call themselves, and offering it means most people
    // press one button instead of inventing a persona at the exact moment
    // they were trying to post a picture.
    let suggestion: string | null = null
    if (!data?.handle) {
      const user = await getUser().catch(() => null)
      const local = (user?.email || '').split('@')[0] || ''
      const clean = local.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20)
      if (clean.length >= 3 && !handleShapeError(clean)) {
        const { data: taken } = await db
          .from('community_handles').select('owner_key')
          .ilike('handle', clean).maybeSingle()
        if (!taken) suggestion = clean
      }
    }

    return NextResponse.json({
      ok: true,
      handle: data?.handle ?? null,
      suggestion,
      signed_in: true,
    })
  } catch (e) {
    console.error('[community/handle] GET threw:', (e as Error).message)
    return NextResponse.json({ ok: true, handle: null })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 503 })

    const me = await owner()
    if (!me) return NextResponse.json({ ok: false, reason: 'signed_out' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const handle = String(body?.handle || '').trim()

    // Shape and the reserved list first - both are free, and there is no
    // sense spending a network call to find out somebody typed two letters.
    const shape = handleShapeError(handle)
    if (shape) return NextResponse.json({ ok: false, reason: 'shape', message: shape }, { status: 400 })

    // A handle appears on EVERY post that person ever makes, so it is worth
    // classifying even though a comment is not. One bad handle is bad on a
    // hundred cards at once.
    const verdict = await moderateText({ text: handle })
    if (verdict.verdict !== 'live') {
      return NextResponse.json({
        ok: false, reason: 'refused',
        message: 'That one will not do. Try another.',
      }, { status: 400 })
    }

    const { data: mine } = await db
      .from('community_handles').select('handle').eq('owner_key', me).maybeSingle()

    // Taken by somebody else - unless it was released more than thirty days
    // ago, in which case it is genuinely free.
    const { data: held } = await db
      .from('community_handles')
      .select('owner_key, released_at')
      .ilike('handle', handle)
      .maybeSingle()

    if (held && held.owner_key !== me) {
      const freed = held.released_at &&
        (Date.now() - new Date(held.released_at).getTime()) > HOLD_DAYS * 864e5
      if (!freed) {
        return NextResponse.json({ ok: false, reason: 'taken' }, { status: 409 })
      }
    }

    const now = new Date().toISOString()
    const { error } = await db
      .from('community_handles')
      .upsert({
        owner_key:  me,
        handle,
        changed_at: mine ? now : null,
        // Their OLD name goes on hold from this moment. Stored on their own
        // row because that row is the only record the old name existed.
        released_at: mine && mine.handle !== handle ? now : null,
      }, { onConflict: 'owner_key' })

    if (error) {
      if ((error as { code?: string }).code === '23505') {
        return NextResponse.json({ ok: false, reason: 'taken' }, { status: 409 })
      }
      console.error('[community/handle] upsert failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, handle })
  } catch (e) {
    console.error('[community/handle] PUT threw:', (e as Error).message)
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
}
