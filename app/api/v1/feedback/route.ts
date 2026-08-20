// app/api/v1/feedback/route.ts
//
// Bug reports and site feedback. PRIVATE. Never public.
//
// ── WHY THIS NEEDS NO MODERATION GATE ──────────────────────────────────
//
// Because it has no rendering path. It goes to a table Rich reads and it
// appears nowhere on the site, so there is no audience to protect.
//
// This is the ONLY place in the product where a customer's own words are
// stored, and they are stored where nobody but the studio can read them.
// That is deliberate: comments and captions were both dropped so that no
// user-generated text is ever public on litenco.com, which is one sentence
// to a lawyer and one sentence to a customer.
//
// ── SIGNED OUT IS ALLOWED ──────────────────────────────────────────────
//
// Somebody who cannot sign in is exactly the person most likely to have
// something worth reporting, and requiring an account to say "this is
// broken" loses the reports that matter most.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'

export const runtime = 'nodejs'

/** Rich's to rename. Kept loose on purpose — a category list that does not
 *  fit what somebody wants to say sends them away rather than narrowing
 *  them down. */
const CATEGORIES = ['broken', 'looks_wrong', 'idea', 'other'] as const

const MAX_BODY = 4000

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))

    const category = typeof body.category === 'string' &&
      (CATEGORIES as readonly string[]).includes(body.category)
        ? body.category
        : 'other'

    const text = typeof body.body === 'string' ? body.body.trim().slice(0, MAX_BODY) : ''
    if (!text) {
      return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 })
    }

    // Which page they were on. Worth more than the category for a bug
    // report, and it costs the customer nothing to supply.
    const page = typeof body.page === 'string' ? body.page.slice(0, 200) : null

    const url = process.env.SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      return NextResponse.json({ ok: false, reason: 'not_configured' }, { status: 500 })
    }

    const db   = createClient(url, key, { auth: { persistSession: false } })
    const user = await getUser().catch(() => null)

    const { error } = await db.from('feedback').insert({
      owner_key: user?.id ?? null,
      category,
      body:      text,
      page,
    })

    if (error) {
      console.error(`[feedback] insert failed: ${error.message}`)
      return NextResponse.json({ ok: false, reason: 'send_failed' }, { status: 500 })
    }

    console.log(`[feedback] received category=${category} signed_in=${!!user?.id}`)

    return NextResponse.json({ ok: true })

  } catch (e: any) {
    console.error(`[feedback] ${e?.message}`)
    return NextResponse.json({ ok: false, reason: 'error' }, { status: 500 })
  }
}
