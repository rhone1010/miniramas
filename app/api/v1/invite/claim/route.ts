// app/api/v1/invite/claim/route.ts
//
// PAYING THE LAUNCH GRANT.
//
// /api/v1/invite records an address at the passcode gate and holds 80
// credits against it. At that moment there is no account, so there is no
// balance to pay into. This route is where the promise becomes real: the
// first time that person is signed in, the credits land.
//
// SAFE TO CALL ON EVERY LOAD. It is called by the workshop on boot and
// does nothing at all in the common case. Two guards, deliberately
// overlapping:
//
//   1. claimed_at on the invite row — the fast path, one indexed read.
//   2. grant_credits is idempotent by p_ref, and the ref is derived from
//      the email. Even if two tabs race past the first guard, the ledger
//      grants once.
//
// The second guard is the one that matters. The first is only there to
// keep the common case to a single read.
//
// WHY NOT IN auth/me
//   auth/me answers "who is this" on a hot path and should stay a read.
//   A write hidden inside it is a write nobody expects to be there.

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getUser } from '@/lib/store/auth'

export const runtime = 'nodejs'

/* Kept in step with app/api/v1/invite/route.ts by hand. Two files, one
   number: if the grant or the cap changes, change it in both. */
const GRANT_CREDITS = 80
const MAX_INVITES   = 40

export async function POST() {
  try {
    const user = await getUser().catch(() => null)
    /* Not signed in is the normal case for most of the session — the
       workshop calls this on every boot. Not an error. */
    if (!user?.id || !user.email) {
      return NextResponse.json({ ok: true, claimed: false, reason: 'no_account' })
    }

    const email = user.email.trim().toLowerCase()

    let { data: invite, error: readErr } = await supabaseAdmin
      .from('launch_invites')
      .select('email, credits_granted, claimed_at')
      .eq('email', email)
      .maybeSingle()

    if (readErr) {
      console.error('[invite/claim] read failed:', readErr.message)
      return NextResponse.json({ ok: false, reason: 'read_failed' }, { status: 500 })
    }

    /* SIGNED IN WITHOUT AN INVITE ROW. This is the common case, not the
       edge one — corrected 2026-08-09 after it caught Rich.
       
       The gate is per-browser. Somebody who came through it once is
       through it for good, so the next person to sign in on that machine
       never types an address at the door, and the address they sign in
       with is one this table has never seen. Keying the grant to the door
       meant they got nothing.
       
       The grant belongs to whoever signs in. The address at the door is a
       record of who accepted the invitation; it is not the thing being
       paid. So a first sign-in with no row writes its own, subject to the
       same cap, and is paid immediately. */
    if (!invite) {
      const { count } = await supabaseAdmin
        .from('launch_invites')
        .select('email', { count: 'exact', head: true })

      const within = (count ?? 0) < MAX_INVITES

      const { error: insErr } = await supabaseAdmin
        .from('launch_invites')
        .insert({
          email,
          credits_granted: within ? GRANT_CREDITS : 0,
          over_cap: !within,
        })

      if (insErr) {
        /* A duplicate here means two tabs arrived together and the other
           one won. Nothing is wrong; let it fall through and be claimed
           on the next call rather than granting twice. */
        console.warn('[invite/claim] self-insert:', insErr.message)
        return NextResponse.json({ ok: true, claimed: false, reason: 'raced' })
      }

      if (!within) {
        return NextResponse.json({ ok: true, claimed: false, reason: 'over_cap' })
      }

      invite = { email, credits_granted: GRANT_CREDITS, claimed_at: null }
    }

    if (invite.claimed_at) {
      return NextResponse.json({ ok: true, claimed: false, reason: 'already' })
    }

    /* Came in over the forty-account cap. Recorded, welcomed, no grant. */
    if (!invite.credits_granted) {
      return NextResponse.json({ ok: true, claimed: false, reason: 'over_cap' })
    }

    /* The ref is the email, not a timestamp or a uuid. grant_credits is
       idempotent on it, so this exact grant can only ever land once no
       matter how many callers arrive together. */
    const { data: balance, error: grantErr } = await supabaseAdmin.rpc('grant_credits', {
      p_owner:  user.id,
      p_n:      invite.credits_granted,
      p_reason: 'launch_grant',
      p_ref:    `launch:${email}`,
    })

    if (grantErr) {
      /* The stamp below has not happened, so a retry will try again — which
         is right, and safe, because the ref makes it idempotent. */
      console.error('[invite/claim] grant failed:', grantErr.message)
      return NextResponse.json({ ok: false, reason: 'grant_failed' }, { status: 500 })
    }

    /* Stamp second. If this fails the credits are already in and the ref
       guard stops a double grant, so the worst case is a row that looks
       unclaimed and a claim that quietly does nothing next time. */
    const { error: stampErr } = await supabaseAdmin
      .from('launch_invites')
      .update({ claimed_at: new Date().toISOString(), claimed_by: user.id })
      .eq('email', email)
      .is('claimed_at', null)

    if (stampErr) {
      console.error('[invite/claim] stamp failed (credits are in):', stampErr.message)
    }

    console.log(
      `[invite/claim] launch grant +${invite.credits_granted} owner=${user.id} balance=${balance}`,
    )

    return NextResponse.json({
      ok: true,
      claimed: true,
      credits: invite.credits_granted,
      balance,
    })
  } catch (e: any) {
    console.error('[invite/claim] fatal:', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
