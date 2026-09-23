// app/tester/route.ts
//
// TEMPORARY — PREVIEW-ONLY TESTER IDENTITY. REMOVE WITH A5, BEFORE A6.
// Tracked in docs/GOVERNANCE/PHASE1-MAINTENANCE-LEDGER.md.
//
// THE PROBLEM THIS SOLVES. A signed-out visitor can enter Discovery, choose
// effects and reach a valid 4 / $4.99 state -- and then Review Collection
// opens the Curator's Note magic-link modal (discovery-consolidated-draft.html
// :4125), as Craft does at :6279. Both are plain `ME` checks. On a fresh
// BrowserStack device, and for an invited weekend tester, that modal is the
// end of the journey: nobody is going to check email on a rented handset.
//
// WHAT THIS IS NOT. It does not disable those checks, suppress the modal, or
// teach the client about a test mode. Not one line of product code knows this
// route exists. It mints a GENUINE Supabase session for a GENUINE user and
// sets the ordinary auth cookies, so getUser() returns a real user, RLS
// applies, portfolio ownership applies, entitlement binding applies and
// payment verification is untouched. The gates do not fall; they are simply
// never asked, because ME is real. The tester just never typed an email.
//
// IDEMPOTENT PER DEVICE, in three layers, and only the last one writes:
//   1. a live session already belonging to a tester -> reuse it
//   2. the marker cookie names an existing tester    -> re-mint for THAT user
//   3. neither                                       -> create one
// Layer 2 is what makes this idempotent across session EXPIRY rather than
// merely across page loads. Without it every expired session would quietly
// mint another auth.users row for the same browser, and Preview shares the
// production database -- those rows are real.
//
// FAILS CLOSED, AND SILENTLY. Both guards answer 404 rather than 403: in
// Production this route must not exist, and a 403 would confirm that it does.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomUUID, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/* The namespace IS the cleanup predicate. A5 deletes these by
   `email like 'tester+%@preview.litenco.test'` and nothing else, so the
   prefix and the domain both have to stay recognisable and unused
   elsewhere. The domain is deliberately not routable; nothing is ever
   sent to it (see email_confirm below). */
const TESTER_PREFIX = 'tester+'
const TESTER_DOMAIN = 'preview.litenco.test'
const MARKER        = 'liten_tester_id'
const MARKER_MAX_AGE = 60 * 60 * 24 * 365

/** Where a tester lands: the ordinary customer entry, nothing preloaded.
 *
 *  THE FOYER, NOT DISCOVERY (Rich, 2026-09-19). This sent testers straight to
 *  /discovery, which skipped the front door every real customer comes through
 *  -- so a fresh Preview opened halfway into the product. `/` is already the
 *  Foyer (middleware PAGES: '/' -> '/foyer.html'); this just stops jumping
 *  over it. The Foyer itself is untouched. */
const ENTRY = '/'

function notFound() {
  return new NextResponse('Not found', { status: 404 })
}

function isTesterEmail(email: string | null | undefined): boolean {
  return !!email && email.startsWith(TESTER_PREFIX) && email.endsWith('@' + TESTER_DOMAIN)
}

/** Constant-time, and length-safe: timingSafeEqual throws on a length
 *  mismatch, which would itself be an oracle. */
function keyMatches(supplied: string, expected: string): boolean {
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(req: NextRequest) {
  /* GUARD 1. VERCEL_ENV is set by the platform and cannot be influenced by
     any request, header or cookie, so Production is structurally unreachable
     from here rather than merely guarded against. */
  if (process.env.VERCEL_ENV !== 'preview') return notFound()

  /* GUARD 2. Without a key this route hands an authenticated identity to
     anyone who guesses the path -- and once deployment protection is lowered
     for BrowserStack, the path is all that is left. */
  const expected = process.env.TESTER_ACCESS_KEY || ''
  // Read-only capability for preserving work at the existing Preview auth boundary.
  // Does not mint a session or disclose the access key. Production already returned 404.
  if (new URL(req.url).searchParams.get('status') === '1') {
    return NextResponse.json({ available: !!expected }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const supplied = new URL(req.url).searchParams.get('k') || ''
  if (!expected || !supplied || !keyMatches(supplied, expected)) return notFound()

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    console.error('[tester] Supabase env missing — cannot mint a tester session')
    return new NextResponse('tester_unavailable', { status: 500 })
  }

  const store = await cookies()
  /* The writeable client. verifyOtp below sets the auth cookies through
     this setAll, which is the same mechanism app/auth/callback/route.ts
     uses after a real magic link -- deliberately, so the cookies a tester
     carries are indistinguishable from a customer's. */
  const sb = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        for (const c of toSet) store.set(c.name, c.value, c.options)
      },
    },
  })

  // ── 1. A tester session already on this device ────────────────
  try {
    const { data: { user } } = await sb.auth.getUser()
    if (user && isTesterEmail(user.email)) {
      console.log(`[tester] reusing session for ${user.email}`)
      return NextResponse.redirect(new URL(ENTRY, req.url))
    }
  } catch {
    /* An unreadable session is not an error here -- it just means we fall
       through and resolve an identity the other way. */
  }

  // ── 2. The marker names a tester we made earlier ──────────────
  let email: string | null = null
  let userId: string | null = null

  const marked = store.get(MARKER)?.value
  if (marked) {
    try {
      const { data } = await supabaseAdmin.auth.admin.getUserById(marked)
      if (data?.user && isTesterEmail(data.user.email)) {
        email  = data.user.email ?? null
        userId = data.user.id
        console.log(`[tester] re-minting session for known tester ${email}`)
      }
    } catch (e) {
      console.warn(`[tester] marker ${marked} did not resolve: ${(e as Error).message}`)
    }
  }

  // ── 3. Nothing to recover: a new tester ───────────────────────
  if (!email) {
    email = TESTER_PREFIX + randomUUID() + '@' + TESTER_DOMAIN
    /* email_confirm short-circuits verification, so no mail is sent and the
       domain never needs to exist. */
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { liten_tester: true, created_for: 'preview-testing' },
    })
    if (error || !data?.user) {
      console.error(`[tester] createUser failed: ${error?.message}`)
      return new NextResponse('tester_create_failed', { status: 500 })
    }
    userId = data.user.id
    console.log(`[tester] created ${email}`)
  }

  /* MINTING THE SESSION WITHOUT A PASSWORD. generateLink produces the same
     token a magic-link email would carry; verifyOtp redeems it against the
     cookie-writing client above. Nothing is emailed and nothing is shown to
     the tester -- the token exists for the length of this request. */
  const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  const tokenHash = link?.properties?.hashed_token
  if (linkErr || !tokenHash) {
    console.error(`[tester] generateLink failed for ${email}: ${linkErr?.message}`)
    return new NextResponse('tester_link_failed', { status: 500 })
  }

  const { error: otpErr } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' })
  if (otpErr) {
    console.error(`[tester] verifyOtp failed for ${email}: ${otpErr.message}`)
    return new NextResponse('tester_session_failed', { status: 500 })
  }

  /* The marker outlives the session on purpose: when the session expires,
     layer 2 finds this and re-mints for the SAME user instead of creating a
     second one. httpOnly because nothing in the page has any business
     reading it. */
  if (userId) {
    store.set(MARKER, userId, {
      path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: MARKER_MAX_AGE,
    })
  }

  console.log(`[tester] session ready for ${email} -> ${ENTRY}`)
  return NextResponse.redirect(new URL(ENTRY, req.url))
}
