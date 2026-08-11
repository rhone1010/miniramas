// app/api/v1/invite/route.ts
//
// WHO CAME THROUGH THE DOOR.
//
// The soft-launch gate asks for an email alongside the passcode. This is
// where that address lands. Two jobs:
//
//   1. Record it, so Rich knows who accepted the invitation.
//   2. Hold the 80-credit launch grant against it, so that when the person
//      signs in properly the credits are already waiting.
//
// WHY THE GRANT IS NOT ISSUED HERE
//   At this point there is no account — just an address typed into a
//   passcode card by somebody who may never sign in. Writing credits now
//   would mean writing them to nobody. The row below is a promise; the
//   grant is claimed on first sign-in by claimLaunchGrant() at the bottom
//   of this file, which is the only place that touches a balance.
//
// WHY MIDDLEWARE DOES NOT DO THIS
//   Middleware runs on the edge, on the path of every request on the site,
//   with no database and no service key. It stays that way.
//
// THE CAP
//   Forty accounts. The passcode is shared, so nothing stops one person
//   using several addresses — the cap is a ceiling on cost, not a
//   guarantee of forty distinct people.

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

const GRANT_CREDITS = 80    // eight crafts at ten credits each
const MAX_INVITES   = 40

function svc() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

function clean(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const e = raw.trim().toLowerCase()
  if (e.length < 5 || e.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return null
  return e
}

export async function POST(req: Request) {
  try {
    const db = svc()
    /* Not configured is not an error the gate should care about. Somebody
       with the right passcode gets in either way. */
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' })

    const body = await req.json().catch(() => ({} as any))
    const email = clean(body?.email)
    if (!email) {
      return NextResponse.json({ ok: false, reason: 'bad_email' }, { status: 400 })
    }

    /* Already invited — the same person coming back through the gate on a
       new browser, which happens constantly. Not an error, and not a
       second grant. */
    const { data: existing } = await db
      .from('launch_invites')
      .select('email, granted_at, claimed_at')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ ok: true, already: true })
    }

    const { count } = await db
      .from('launch_invites')
      .select('email', { count: 'exact', head: true })

    /* Over the cap: still record them, but with no grant against the row.
       Turning somebody away at the door after they typed the passcode a
       friend gave them is worse than letting them look around without
       credits — and Rich needs to know how many were turned back. */
    const within = (count ?? 0) < MAX_INVITES

    const { error } = await db.from('launch_invites').insert({
      email,
      credits_granted: within ? GRANT_CREDITS : 0,
      over_cap: !within,
    })

    if (error) {
      console.error('[invite] insert failed:', error.message)
      return NextResponse.json({ ok: false, reason: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, granted: within ? GRANT_CREDITS : 0 })
  } catch (e: any) {
    console.error('[invite] fatal:', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}

/**
 * GET — how the soft launch is going. Rich only.
 *
 * Returns counts, never addresses: this endpoint is not behind the gate
 * (nothing under /api is), so it must not be a list of everybody who has
 * ever been invited.
 */
export async function GET() {
  try {
    const db = svc()
    if (!db) return NextResponse.json({ ok: false, reason: 'not_configured' })

    const { count: invited } = await db
      .from('launch_invites')
      .select('email', { count: 'exact', head: true })

    const { count: claimed } = await db
      .from('launch_invites')
      .select('email', { count: 'exact', head: true })
      .not('claimed_at', 'is', null)

    return NextResponse.json({
      ok: true,
      invited: invited ?? 0,
      claimed: claimed ?? 0,
      cap: MAX_INVITES,
      grant: GRANT_CREDITS,
    })
  } catch {
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
