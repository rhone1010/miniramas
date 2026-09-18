// lib/v1/identity/touch-identity.ts
//
// Keeps public.identity_map current.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────
//
// identity_map was created by migration 014 with a one-shot backfill and no
// application writer. Nothing has written to it since. The consequence reached
// all the way to the control panel: "New customers" counts rows by first_seen,
// so it answered 0 for every window after the backfill, and the Customers tab
// described a frozen population as though it were the business today.
//
// ── WHY /auth/me CALLS IT ──────────────────────────────────────────────
//
// Same argument claim-grant.ts makes, for the same reason. /auth/me is the
// read every surface makes on boot, so hooking it there makes this
// SELF-HEALING: anyone who signed in before this shipped is recorded on their
// next visit, and nobody has to remember anything. Hooking the auth callback
// instead would miss every restored session permanently.
//
// ── OWNER_KEY IS THE AUTH USER ID ──────────────────────────────────────
//
// Guest identity is retired (credits/gate: "No owner, no craft"), so there is
// no second identity to cover. The migration 006/007 comments still describe a
// client-minted guest token; nothing has minted one for a long time, and
// identity_map.anon_id stays reserved for the events layer as 014 intended.

import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Record this user in identity_map, or refresh what is known about them.
 * Safe to call on every request. Never throws — a map that cannot be written
 * must not take the session down with it.
 */
export async function touchIdentity(
  db: SupabaseClient,
  user: { id: string; email?: string | null },
): Promise<boolean> {
  try {
    // first_seen is deliberately absent from this payload. It carries a
    // column default, so an insert stamps it once and an update leaves it
    // alone — and it must, because it is the only column "New customers"
    // reads. Including it here would reset every returning visitor's first
    // sighting to today and the metric would count the same people forever.
    const { error } = await db
      .from('identity_map')
      .upsert(
        {
          owner_key:  user.id,
          user_id:    user.id,
          email:      user.email ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'owner_key' },
      )

    if (error) {
      console.warn('[identity] touch failed:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[identity] touch threw:', e instanceof Error ? e.message : String(e))
    return false
  }
}
