// GET /api/v1/gift/cleanup (internal auth) -> { purged, failed }. Retention sweep: expired, unpinned sessions only.
import { NextResponse } from 'next/server'
import { checkInternalAuth } from '@/lib/store/internal-auth'
import { giftDeps } from '@/lib/v1/gift/real'
import { cleanupH } from '@/lib/v1/gift/handlers'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = checkInternalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  return cleanupH(giftDeps())
}
