import { NextRequest, NextResponse } from 'next/server'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { foyerDb } from '@/lib/v1/foyer/foyer-source'
import { cleanupFoyerResults } from '@/lib/v1/foyer/foyer-result-claim'

export const runtime = 'nodejs'
export async function GET(req: NextRequest) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const sb = foyerDb()
  if (!sb) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const removed = await cleanupFoyerResults(sb)
  return NextResponse.json({ removed }, { headers: { 'Cache-Control': 'no-store' } })
}
