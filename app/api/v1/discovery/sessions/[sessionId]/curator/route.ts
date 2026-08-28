// app/api/v1/discovery/sessions/[sessionId]/curator/route.ts
// Per spec section 18: "If Curator fails: gallery remains fully usable."
// This route returns a clean 501 (not implemented) rather than a 500 -
// the frontend can treat 501 as "Curator is off right now" and continue
// without it, which is the correct failure mode per spec, not an error
// state to alarm the user with.
import { NextRequest, NextResponse } from 'next/server'
import { getCuratorRecommendation } from '@/lib/store/curator'
import { getSession } from '@/lib/store/discovery-session'

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

  try {
    const session = await getSession(params.sessionId)
    if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })

    const result = await getCuratorRecommendation({
      sessionId: params.sessionId,
      visitedEffectIds: session.visitedEffectIds,
      selectedEffectIds: session.selectedEffectIds,
      userIntentText: typeof body.userIntentText === 'string' ? body.userIntentText : undefined,
      quickChoice: typeof body.quickChoice === 'string' ? body.quickChoice : undefined,
    })
    return NextResponse.json(result)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.warn('[api/v1/discovery/sessions/:id/curator] not available:', msg)
    return NextResponse.json({ error: 'curator_unavailable' }, { status: 501 })
  }
}
