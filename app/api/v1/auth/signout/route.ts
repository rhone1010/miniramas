// app/api/v1/auth/signout/route.ts
//
// SIGNING OUT, PROPERLY.
//
// /logout in the middleware clears the passcode cookie only. The Supabase
// session survives it, so the person is back on the passcode card while
// still signed in as themselves — which is not what anybody means by
// "sign out", and is useless for testing a second account.
//
// This ends the account session. The passcode is left alone: it is the
// door to the building, not the door to the account, and a tester who
// signs out to try another address should not have to type it again.
// /logout is still there for the person who wants to close the building.
//
// POST, NOT GET. A GET sign-out gets fired by link prefetchers and image
// scanners, and people find themselves signed out for no reason.

import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const runtime = 'nodejs'

export async function POST() {
  try {
    const url  = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anon) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 503 })
    }

    const store = await cookies()

    /* A WRITEABLE client. The shared getServerSupabase() swallows cookie
       writes so it stays usable from Server Components — which is right
       there and wrong here, because clearing the cookies IS the job. */
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (toSet) => {
          for (const c of toSet) store.set(c.name, c.value, c.options)
        },
      },
    })

    await supabase.auth.signOut()

    /* Belt and braces. signOut() expires the cookies it knows about, but a
       stale project ref or a half-written session can leave one behind,
       and one surviving sb- cookie is a session that comes back. */
    for (const c of store.getAll()) {
      if (c.name.startsWith('sb-')) {
        store.set(c.name, '', { path: '/', maxAge: 0 })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    console.error('[auth/signout]', e?.message || e)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
