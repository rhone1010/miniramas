// app/api/v1/auth/signin/route.ts
//
// Thin server-initiated magic-link sign-in. The workshop (static
// public/portraits.html) POSTs { email } here; we call signInWithOtp with a
// writable @supabase/ssr client so the PKCE code-verifier cookie is set on the
// response. The existing app/auth/callback route then exchanges the ?code for a
// session (reading that same verifier cookie). New emails create a user
// (signInWithOtp defaults shouldCreateUser: true) — that is the "user row
// appears in Supabase" step of the cold walk.
//
// Mirrors app/auth/callback/route.ts's cookie adapter: in a Route Handler the
// next/headers cookies() store is writable and its mutations propagate to the
// response as Set-Cookie.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'
import { getAppUrl }                 from '@/lib/store/stripe'

export async function POST(req: NextRequest) {
  let email = ''
  let next  = '/portraits.html'
  try {
    const body = await req.json()
    email = typeof body.email === 'string' ? body.email.trim() : ''
    if (typeof body.next === 'string' && body.next.startsWith('/')) next = body.next
  } catch {
    // fall through to validation
  }

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ ok: false, reason: 'invalid_email' }, { status: 400 })
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.json({ ok: false, reason: 'server_misconfigured' }, { status: 500 })
  }

  const store = await cookies()
  const supabase = createServerClient(supabaseUrl, supabaseAnon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        for (const c of toSet) store.set(c.name, c.value, c.options)
      },
    },
  })

  // Use getAppUrl() (prefers VERCEL_URL) rather than req.url origin.
  // Supabase validates emailRedirectTo against its Redirect URL allowlist;
  // the preview domain must be listed there or Supabase silently redirects
  // to the first matching entry (typically the production domain).
  const appUrl           = getAppUrl()
  const emailRedirectTo  = `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
  if (error) {
    return NextResponse.json({ ok: false, reason: 'otp_failed', message: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
