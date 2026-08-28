// app/api/v1/discovery/sessions/[sessionId]/select/route.ts
// This is the endpoint a click on an effect card's "+" actually calls.
// body: { effectId: string, action?: 'select' | 'remove' | 'toggle' }
// action defaults to 'toggle' - matches a single button that adds or
// removes depending on current state, which is the more common UI shape
// for this kind of card.
import { NextRequest, NextResponse } from 'next/server'
import { selectEffect, removeEffect, toggleEffect } from '@/lib/store/discovery-session'

const VALID_ACTIONS = new Set(['select', 'remove', 'toggle'])

export async function POST(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
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
    if (action === 'select') result = await selectEffect(params.sessionId, effectId)
    else if (action === 'remove') result = await removeEffect(params.sessionId, effectId)
    else result = await toggleEffect(params.sessionId, effectId)

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
