// app/api/v1/discovery/sessions/[sessionId]/select/route.ts
// This is the endpoint a click on an effect card's "+" actually calls.
// body: { effectId: string, action?: 'select' | 'remove' | 'toggle' | 'clear' }
// 'clear' drops the whole collection in one write and is the one action
// that takes no effectId.
// action defaults to 'toggle' - matches a single button that adds or
// removes depending on current state, which is the more common UI shape
// for this kind of card.
import { NextRequest, NextResponse } from 'next/server'
import { selectEffect, removeEffect, toggleEffect, clearEffects } from '@/lib/store/discovery-session'

const VALID_ACTIONS = new Set(['select', 'remove', 'toggle', 'clear'])

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ sessionId: string }> },
) {
  /* params is a Promise in this Next.js -- read it as a plain object
     and every segment is undefined, which reached Postgres as the
     literal string "undefined". Same shape checkout/[sessionId]
     already uses. */
  const { sessionId } = await ctx.params
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const effectId = typeof body.effectId === 'string' ? body.effectId : ''
  const action = VALID_ACTIONS.has(body.action) ? body.action : 'toggle'

  try {
    let result
    if (action === 'clear') result = await clearEffects(sessionId)
    else if (action === 'select') result = await selectEffect(sessionId, effectId)
    else if (action === 'remove') result = await removeEffect(sessionId, effectId)
    else result = await toggleEffect(sessionId, effectId)

    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/discovery/sessions/:id/select] failed', msg)
    if (msg.startsWith('discovery_effect_id_required')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    if (msg.startsWith('discovery_session_not_found')) {
      return NextResponse.json({ error: msg }, { status: 404 })
    }
    return NextResponse.json({ error: 'select_failed', message: msg }, { status: 500 })
  }
}
