import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { foyerDb } from '@/lib/v1/foyer/foyer-source'
import { foyerSecret } from '@/lib/v1/foyer/foyer-identity'
import { RESULT_COOKIE_PREFIX, verifyResultClaim } from '@/lib/v1/foyer/foyer-result-claim'

export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) {
    return NextResponse.json({ error: 'origin_required' }, { status: 403 })
  }
  const user = await getUser()
  if (!user) return NextResponse.json({ error: 'signin_required' }, { status: 401 })
  const sb = foyerDb(), secret = foyerSecret()
  if (!sb || !secret) return NextResponse.json({ error: 'unavailable' }, { status: 503 })
  const portfolios: string[] = [], completed: string[] = []
  let status = 200
  for (const cookie of req.cookies.getAll().filter(c => c.name.startsWith(RESULT_COOKIE_PREFIX)).slice(0, 12)) {
    const id = verifyResultClaim(secret, cookie.value)
    if (!id) { completed.push(cookie.name); continue }
    const { data, error } = await sb.rpc('adopt_foyer_result', { p_claim: id, p_user: user.id })
    if (error) {
      if (error.message.includes('owner_mismatch')) { status = 409; continue }
      if (/claim_expired|claim_not_found/.test(error.message)) { completed.push(cookie.name); continue }
      status = 503 // Retain cookie for a transient failure, never pretend it succeeded.
      continue
    }
    portfolios.push(data)
    completed.push(cookie.name)
  }
  const response = NextResponse.json({ portfolios, ...(status !== 200 ? { error: status === 409 ? 'claim_owner_mismatch' : 'adoption_unavailable' } : {}) },
    { status, headers: { 'Cache-Control': 'no-store' } })
  for (const name of completed) response.cookies.set(name, '', { path: '/', maxAge: 0, httpOnly: true, secure: true, sameSite: 'lax' })
  return response
}
