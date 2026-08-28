// app/api/v1/discovery/sessions/[sessionId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/store/discovery-session'
import { resolveSelectionOffer } from '@/lib/store/portfolio-checkout'

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const session = await getSession(params.sessionId)
    if (!session) return NextResponse.json({ error: 'session_not_found' }, { status: 404 })
    const offer = resolveSelectionOffer(session.selectedEffectIds.length)
    return NextResponse.json({ session, offer })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/discovery/sessions/:id] failed', msg)
    return NextResponse.json({ error: 'session_read_failed', message: msg }, { status: 500 })
  }
}
