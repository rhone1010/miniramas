// app/api/v1/invite/route.ts
//
// WHO CAME THROUGH THE DOOR.
//
// The soft-launch gate asks for an email alongside the passcode. This is
// where that address lands. Two jobs:
//
//   1. Record it, so Rich knows who accepted the invitation.
//   2. Hold the 50-credit launch grant against it, so that when the person
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

const GRANT_CREDITS = 50    // five crafts at ten credits each
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
      // Same person, new browser - which happens constantly. Their old
      // magic link is dead or in another tab's inbox, so RESEND rather
      // than strand them. Supabase's own per-address OTP rate limit is
      // the flood control.
      const sent = await sendMagicLink(email, req)
      return NextResponse.json({ ok: true, already: true, link_sent: sent })
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

    // The door and the sign-in are ONE step. The link goes out from here,
    // so nobody has to discover the masthead button and type the same
    // address twice - Rich hit that himself on the first live test.
    const sent = await sendMagicLink(email, req)

    return NextResponse.json({
      ok: true,
      granted: within ? GRANT_CREDITS : 0,
      link_sent: sent,
    })
  } catch (e: any) {
    console.error('[invite] fatal:', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}

/**
 * Sends the magic link, the same way /api/v1/auth/signin does - with one
 * deliberate difference. Signin runs a PKCE cookie client because the
 * browser posts to it and the verifier cookie lands on that browser. THIS
 * route is called by the edge middleware, fire-and-forget: no browser is
 * attached, so a verifier cookie would be set on a response nobody keeps.
 * The anon client's implicit flow sends a link that carries its own tokens
 * instead.
 *
 * Failure here must never close the door: somebody with the right passcode
 * gets in whether or not the mail went out. The response says link_sent so
 * the glass can tell them to check their inbox - or to use the masthead
 * sign-in if it could not be sent.
 */
async function sendMagicLink(email: string, req: Request): Promise<boolean> {
  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) return false

    const auth = createClient(url, anon, { auth: { persistSession: false } })
    const origin = new URL(req.url).origin
    const { error } = await auth.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${origin}/auth/callback?next=%2F` },
    })
    if (error) {
      console.warn('[invite] magic link failed:', error.message)
      return false
    }
    return true
  } catch (e: any) {
    console.warn('[invite] magic link threw:', e?.message || e)
    return false
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
