// app/api/v1/discovery/sessions/[sessionId]/curator/route.ts
// Per spec section 18: "If Curator fails: gallery remains fully usable."
// On failure, returns 503 (service unavailable) — the frontend treats this
// as "Curator is off right now" and continues without it.
import { NextRequest, NextResponse } from 'next/server'
import { getCuratorRecommendation } from '@/lib/store/curator'
import { getSession } from '@/lib/store/discovery-session'

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

  try {
    const session = await getSession(sessionId)
    if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })

    const result = await getCuratorRecommendation({
      sessionId: sessionId,
      sourceImageB64: typeof body.sourceImageB64 === 'string' ? body.sourceImageB64 : undefined,
      visitedEffectIds: session.visitedEffectIds,
      selectedEffectIds: session.selectedEffectIds,
      userIntentText: typeof body.userIntentText === 'string' ? body.userIntentText : undefined,
      quickChoice: typeof body.quickChoice === 'string' ? body.quickChoice : undefined,
      targetCount: typeof body.targetCount === 'number' ? body.targetCount : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[api/v1/discovery/sessions/:id/curator] failed:', msg)
    return NextResponse.json({ error: 'curator_unavailable', message: msg }, { status: 503 })
  }
}
