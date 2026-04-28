// auth-callback-route.ts
// app/auth/callback/route.ts
//
// Supabase's magic-link email points the user here with ?code=…
// We exchange the code for a session (which sets the auth cookies),
// then redirect to ?next=… or /account.

import { NextRequest, NextResponse } from 'next/server'
import { createServerClient }        from '@supabase/ssr'
import { cookies }                   from 'next/headers'

export async function GET(req: NextRequest) {
  const url  = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') || '/account'

  if (!code) {
    return NextResponse.redirect(new URL('/?signin_error=missing_code', req.url))
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseAnon) {
    return NextResponse.redirect(new URL('/?signin_error=server_misconfigured', req.url))
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

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    console.error('[auth/callback] exchange failed', error.message)
    return NextResponse.redirect(new URL('/?signin_error=exchange_failed', req.url))
  }

  return NextResponse.redirect(new URL(next, req.url))
}
