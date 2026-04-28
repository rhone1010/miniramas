// store/auth.ts
// lib/store/auth.ts
//
// Server-side Supabase Auth helpers for App Router. Uses @supabase/ssr to
// read the auth cookies and resolve the current user. Magic-link sign-in
// is initiated client-side from <SigninModal /> (Supabase JS handles the
// SMTP / email link); the /auth/callback route exchanges the code for
// a session.

import { createServerClient } from '@supabase/ssr'
import { cookies }            from 'next/headers'
import { redirect }           from 'next/navigation'

function getEnv(): { url: string; anon: string } {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  }
  return { url, anon }
}

// Builds a Supabase client bound to the request's cookie jar. Read-only
// in Server Components; getUser() works in Server Components, Route
// Handlers, and Server Actions.
export async function getServerSupabase() {
  const { url, anon } = getEnv()
  const store = await cookies()
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (toSet) => {
        // Server Components can't set cookies. Route Handlers and Server
        // Actions can; if cookies.setAll is called from a Server Component
        // Next.js will throw — we swallow that to keep getUser() usable
        // there. The auth callback route (which actually sets cookies)
        // gets its own writable client (createWriteableServerSupabase).
        try {
          for (const c of toSet) store.set(c.name, c.value, c.options)
        } catch {
          // ignore — read-only context
        }
      },
    },
  })
}

export interface AuthUser {
  id:    string
  email: string | null
}

export async function getUser(): Promise<AuthUser | null> {
  try {
    const supabase = await getServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    return { id: user.id, email: user.email ?? null }
  } catch (e) {
    console.warn('[store/auth] getUser failed:', (e as Error).message)
    return null
  }
}

export async function requireUser(redirectTo = '/account'): Promise<AuthUser> {
  const user = await getUser()
  if (!user) {
    const next = encodeURIComponent(redirectTo)
    redirect(`/?signin=1&next=${next}`)
  }
  return user
}
