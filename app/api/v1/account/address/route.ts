// app/api/v1/account/address/route.ts
//
// The saved fulfilment address.
//
//   GET — the caller's address, or null.
//   PUT — save or replace it.
//
// CUI V25 · 2026-08-05 · migration 015
//
//   A customer typed their address in full at every print order and nothing
//   kept it. This is the store, and the Print Shop pre-fills from it.
//
// THE OWNER COMES FROM THE SESSION, NEVER THE BODY.
//   /credits/purchase takes ownerKey from the request body and that is a
//   known fault — anyone can post another account's id. This route does not
//   repeat it. The body carries an address and nothing else; whose it is
//   is not the client's to say.
//
// NOTHING SENSITIVE LIVES HERE.
//   No email — it is on the auth record and a second copy is a second thing
//   to keep true. No phone — Prodigi does not need one for these SKUs and an
//   unnecessary personal detail is a liability. No card details, ever.

import { NextResponse } from 'next/server'
import { getUser } from '@/lib/store/auth'
import { supabaseAdmin } from '@/lib/supabase'

const TABLE = 'account_addresses'

/** Longest anything here has any business being. Prodigi's own limits are
 *  shorter; this is a floor against a pasted essay, not a validation. */
const MAX = 120

type Body = {
  full_name?:    unknown
  line1?:        unknown
  line2?:        unknown
  city?:         unknown
  region?:       unknown
  postcode?:     unknown
  country_code?: unknown
}

function clean(v: unknown): string {
  return typeof v === 'string' ? v.trim().slice(0, MAX) : ''
}

export async function GET() {
  const user = await getUser()
  if (!user) return NextResponse.json({ address: null }, { status: 401 })

  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE)
      .select('full_name, line1, line2, city, region, postcode, country_code, updated_at')
      .eq('owner_key', user.id)
      .maybeSingle()

    if (error) {
      // A missing table means migration 015 has not been applied. Say so in
      // the log and return null — an address we cannot read is the same as
      // no address as far as the form is concerned.
      console.warn('[account/address] read failed:', error.message)
      return NextResponse.json({ address: null })
    }
    return NextResponse.json({ address: data ?? null })
  } catch (e) {
    console.warn('[account/address] read threw:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ address: null })
  }
}

export async function PUT(req: Request) {
  const user = await getUser()
  if (!user) return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 })

  let body: Body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }

  const row = {
    owner_key:    user.id,          // from the session. Never from the body.
    full_name:    clean(body.full_name),
    line1:        clean(body.line1),
    line2:        clean(body.line2) || null,
    city:         clean(body.city),
    region:       clean(body.region) || null,
    postcode:     clean(body.postcode),
    country_code: clean(body.country_code).toUpperCase(),
  }

  // The database has the same checks, and they are the ones that matter.
  // These are here so a customer gets a sentence instead of a constraint
  // violation.
  const missing = (['full_name', 'line1', 'city', 'postcode', 'country_code'] as const)
    .filter((k) => !row[k])
  if (missing.length) {
    return NextResponse.json(
      { ok: false, reason: 'missing', fields: missing },
      { status: 400 },
    )
  }
  if (!/^[A-Z]{2}$/.test(row.country_code)) {
    return NextResponse.json({ ok: false, reason: 'bad_country' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin
      .from(TABLE)
      .upsert(row, { onConflict: 'owner_key' })

    if (error) {
      console.error('[account/address] save failed:', error.message)
      return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, address: row })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[account/address] save threw:', msg)
    return NextResponse.json({ ok: false, reason: msg }, { status: 500 })
  }
}
