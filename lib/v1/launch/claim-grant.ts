// lib/v1/launch/claim-grant.ts
//
// THE OTHER HALF OF THE INVITE.
//
// /api/v1/invite records a promise: an email and the credits it was
// promised, in launch_invites. Its header says the grant "is claimed on
// first sign-in by claimLaunchGrant() at the bottom of this file" - and
// that function was never written. The file ended. Every invited person
// signed in to a balance of zero.
//
// This is that function. It lives here rather than at the bottom of the
// invite route because App Router route files may only export HTTP
// handlers, and the claim is called from a different route (/auth/me).
//
// ── WHY /auth/me CALLS IT ──────────────────────────────────────────────
//
// The claim must fire no matter HOW somebody arrives at being signed in -
// magic link, restored session, a browser from three weeks ago. /auth/me
// is the read every surface makes on boot, so hooking it there makes the
// grant SELF-HEALING: if it did not pay on the first visit it pays on the
// next, and nobody has to remember anything.
//
// ── WHY IT CANNOT DOUBLE-PAY ───────────────────────────────────────────
//
// The idempotency is NOT the claimed_at stamp. It is grant_credits itself,
// which refuses to write a second ledger row for the same
// (owner, reason, ref) - built for Stripe webhooks that retry for three
// days. The ref here is stable per person and carries no timestamp, no
// session, no code:
//
//     invite_<email>
//
// Two /auth/me calls racing both reach the RPC; one writes, the other
// returns the balance unchanged. claimed_at is stamped afterwards for
// Rich's GET counts, and nothing depends on it for correctness.
//
// ── TIERS, IF THEY EVER EXIST ──────────────────────────────────────────
//
// Today every row holds the same grant. If tiered codes arrive, the rule
// is: a higher tier TOPS UP - grant the difference under
// invite_<email>_topup - never a second full grant. The shape of this
// function does not change; a caller computes the difference.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface ClaimResult {
  claimed: boolean
  credits: number
  reason?: string
}

/** Pays the launch grant promised to this user's email, once, ever.
 *  Safe to call on every request. Never throws - a claim that cannot
 *  happen must not take the session down with it. */
export async function claimLaunchGrant(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<ClaimResult> {
  try {
    const email = (user.email || '').trim().toLowerCase()
    if (!email) return { claimed: false, credits: 0, reason: 'no_email' }

    const { data: row, error } = await db
      .from('launch_invites')
      .select('email, credits_granted, claimed_at')
      .eq('email', email)
      .maybeSingle()

    if (error) {
      console.warn('[launch] invite lookup failed:', error.message)
      return { claimed: false, credits: 0, reason: 'lookup_failed' }
    }
    if (!row) return { claimed: false, credits: 0, reason: 'not_invited' }
    if (row.claimed_at) return { claimed: false, credits: 0, reason: 'already_claimed' }

    // Over-cap rows hold 0 by design - recorded at the door, granted
    // nothing. Stamp them claimed so the lookup stops running for them,
    // but there is nothing to pay.
    const credits = Math.floor(Number(row.credits_granted)) || 0
    if (credits > 0) {
      const { error: grantErr } = await db.rpc('grant_credits', {
        p_owner:  user.id,
        p_n:      credits,
        p_reason: 'launch_grant',
        p_ref:    `invite_${email}`,
      })
      if (grantErr) {
        // NOT stamped claimed - the next /auth/me retries, which is the
        // self-healing this hook exists for.
        console.error('[launch] grant_credits failed:', grantErr.message)
        return { claimed: false, credits: 0, reason: 'grant_failed' }
      }
    }

    const { error: stampErr } = await db
      .from('launch_invites')
      .update({ claimed_at: new Date().toISOString() })
      .eq('email', email)
      .is('claimed_at', null)
    if (stampErr) console.warn('[launch] claimed_at stamp failed:', stampErr.message)

    if (credits > 0) console.log(`[launch] granted ${credits} to ${email}`)
    return { claimed: credits > 0, credits }
  } catch (e) {
    console.warn('[launch] claim threw:', e instanceof Error ? e.message : String(e))
    return { claimed: false, credits: 0, reason: 'threw' }
  }
}
