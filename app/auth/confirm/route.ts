// app/auth/confirm/route.ts
//
// THE MAGIC LINK'S OTHER DOOR - and the one that works from any browser.
//
// ── WHY /auth/callback WAS NOT ENOUGH ──────────────────────────────────
//
// /auth/callback exchanges ?code= for a session. That is the PKCE flow,
// and it only works when the SAME BROWSER that will click the link also
// made the request that sent it - the verifier cookie has to be waiting.
// The masthead sign-in satisfies that. The GATE cannot: its email is sent
// by /api/v1/invite, called fire-and-forget from edge middleware, with no
// browser attached and nowhere for a verifier to land.
//
// So the gate's links authenticated at Supabase and then dropped the
// session on the floor - Rich clicked a working link on 25 August and
// /auth/me answered {"user":null}.
//
// ── THIS ROUTE NEEDS NOTHING WAITING IN THE BROWSER ────────────────────
//
// The email template is changed (see below) to link here with
// ?token_hash=...&type=email instead of tokens in a URL fragment. A
// fragment never reaches a server; a query parameter does. verifyOtp
// exchanges the hash for a session directly, and the SSR cookie adapter -
// identical to /auth/callback's - writes the session cookies onto the
// redirect. Works for a link clicked in ANY browser, PKCE or not, gate or
// masthead.
//
// ── THE TEMPLATE CHANGE THIS REQUIRES, OR NOTHING ARRIVES HERE ─────────
//
// Supabase dashboard -> Authentication -> Email Templates -> Magic Link.
// The confirmation URL in the template becomes:
//
//   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=%2F
//
// After that, every magic link - however it was requested - lands here.
// /auth/callback STAYS: any ?code link already sitting in an inbox when
// the template changes must still work, and the signin route's PKCE path
// is unharmed either way.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import type { EmailOtpType }         from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const url       = new URL(req.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type      = (url.searchParams.get('type') || 'email') as EmailOtpType
  const nextPath  = url.searchParams.get('next') || '/'

  // Only same-site relative paths - a redirect target from a clicked link
  // is attacker-reachable input.
  const next = nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/'

  if (!tokenHash) {
    return NextResponse.redirect(new URL('/?signin_error=missing_token', req.url))
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.redirect(new URL('/?signin_error=server_misconfigured', req.url))
  }

  // The same writable cookie adapter as /auth/callback: in a Route Handler
  // the next/headers store's mutations propagate to the response as
  // Set-Cookie, which is how the session reaches the browser.
  const store = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        for (const c of toSet) store.set(c.name, c.value, c.options)
      },
    },
  })

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
  if (error) {
    // Expired and already-used links land here - the commonest real-world
    // case, since mail clients prefetch and people double-click.
    console.error('[auth/confirm] verify failed:', error.message)
    return NextResponse.redirect(new URL('/?signin_error=link_expired', req.url))
  }

  return NextResponse.redirect(new URL(next, req.url))
}
