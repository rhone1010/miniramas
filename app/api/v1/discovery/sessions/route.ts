// app/api/v1/discovery/sessions/route.ts
// POST creates a new session. No auth required - guest browsing.
import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/store/discovery-session'
import { resolveSelectionOffer } from '@/lib/store/portfolio-checkout'
import { getUser } from '@/lib/store/auth'

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const sourceAssetId = typeof body.sourceAssetId === 'string' ? body.sourceAssetId : ''
  const seriesId = typeof body.seriesId === 'string' ? body.seriesId : ''

  try {
    const user = await getUser().catch(() => null)
    const session = await createSession({
      userId: user?.id ?? null,
      sourceAssetId,
      seriesId,
    })
    const offer = resolveSelectionOffer(0)
    return NextResponse.json({ session, offer })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/v1/discovery/sessions] failed', msg)
    if (msg.startsWith('discovery_source_asset_required') || msg.startsWith('discovery_series_required')) {
      return NextResponse.json({ error: msg }, { status: 400 })
    }
    return NextResponse.json({ error: 'session_create_failed', message: msg }, { status: 500 })
  }
}
