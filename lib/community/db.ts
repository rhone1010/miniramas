// lib/community/db.ts
//
// The handful of things every community route needs. Kept in one file so the
// rate limits and the ownership rule have ONE definition - nine routes each
// carrying their own copy of "three an hour" is nine places for it to drift.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { getUser } from '@/lib/store/auth'

// Same shape as credits/balance and the rest of v1: SUPABASE_URL, not
// NEXT_PUBLIC_SUPABASE_URL. lib/supabase.ts still uses the public one; do not
// follow it here, the two are not always the same value.
export function svc(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}

// owner_key IS the auth user id. Guest is retired (LOCKED-DECISIONS, USERS &
// AUTH) - a signed-out caller has no owner rather than a second identity.
export async function owner(): Promise<string | null> {
  const user = await getUser().catch(() => null)
  return user?.id ?? null
}

// ── RATE LIMITS ────────────────────────────────────────────────────────────
// There is NO monthly cap on posting. Posting already costs a craft, so the
// ceiling is economic and the customer has paid it. Somebody who crafted
// thirty pieces and wants to show fifteen is the best marketing this studio
// will get, and "you have posted enough this month" is a strange thing for a
// shop to say to somebody spending money.
//
// These are burst brakes. The comment limit is the one that matters: a
// comment is free, which makes it the only surface a bored person can flood.
export const LIMITS = {
  postsPerHour:    3,
  commentsPerHour: 10,
}

export async function tooMany(
  db: SupabaseClient,
  table: 'community_posts' | 'community_comments',
  ownerKey: string,
  perHour: number,
): Promise<boolean> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count } = await db
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('owner_key', ownerKey)
    .gte('created_at', since)
  return (count ?? 0) >= perHour
}

// ── THE CONSENT WORDING ────────────────────────────────────────────────────
// Stored on every post as typed here, so what somebody agreed to can be read
// back a year later without archaeology on a git history. CHANGING THIS
// STRING DOES NOT CHANGE WHAT ANYONE ALREADY AGREED TO - old rows keep their
// own copy, which is the entire point of storing it.
export const CONSENT_TEXT_V1 =
  'This is my own photograph, or I have the permission of the person in it. ' +
  'I understand it will be visible to anyone who visits Liten & Co, with my ' +
  'handle beneath it, and that I can take it down at any time.'

// ── AUTO-REPORT THRESHOLD ──────────────────────────────────────────────────
// Three distinct reporters pulls an item pending review. A small number of
// people can therefore hide something briefly, which is accepted: the
// alternative is that abuse stands until the next digest.
export const REPORTS_TO_PULL = 3
