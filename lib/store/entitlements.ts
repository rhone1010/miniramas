// store/entitlements.ts
// lib/store/entitlements.ts
//
// All five entitlement-life-cycle functions. The application chat imports
// from here. Signatures are a stable contract — don't change them without
// coordinating with the application chat.
//
// Atomicity: consumeEntitlement uses a Postgres function (defined in
// migration 003) to do a guarded UPDATE in a single statement, so two
// concurrent callers can't both succeed.

import { supabaseAdmin } from '@/lib/supabase'
import type { Entitlement, EntitlementStatus } from './types'

const REFUND_DAILY_CAP = 10

// ─── DB row → camelCase translator ───────────────────────────────

interface EntitlementRow {
  id:                    string
  purchase_id:           string
  user_id:               string | null
  guest_email:           string | null
  locked_style:          string | null
  locked_variant:        string | null
  status:                EntitlementStatus
  job_id:                string | null
  generation_started_at: string | null
  consumed_at:           string | null
  restored_at:           string | null
  created_at:            string
}

function rowToEntitlement(row: EntitlementRow): Entitlement {
  return {
    id:                  row.id,
    purchaseId:          row.purchase_id,
    userId:              row.user_id,
    guestEmail:          row.guest_email,
    lockedStyle:         row.locked_style,
    lockedVariant:       row.locked_variant,
    status:              row.status,
    jobId:               row.job_id,
    generationStartedAt: row.generation_started_at,
    consumedAt:          row.consumed_at,
    restoredAt:          row.restored_at,
    createdAt:           row.created_at,
  }
}

// ─── checkEntitlement ────────────────────────────────────────────

export type EntitlementCheck =
  | { available: true; entitlementId: string }
  | { available: false }

/**
 * Does this user (logged-in or guest) have an entitlement available
 * for the given style+variant?
 *
 * Match precedence: a single locked to (style, variant) wins over a
 * generic credit (locked_*=null). This way users don't burn a generic
 * credit when they have a single sitting in the same style.
 */
export async function checkEntitlement(args: {
  userId?:     string
  guestEmail?: string
  style:       string
  variant:     string
}): Promise<EntitlementCheck> {
  if (!args.userId && !args.guestEmail) return { available: false }

  let query = supabaseAdmin
    .from('entitlements')
    .select('id, locked_style, locked_variant, created_at')
    .eq('status', 'available')
    .order('locked_style', { ascending: false, nullsFirst: false }) // locked first
    .order('created_at',    { ascending: true })                    // FIFO within tier
    .limit(1)

  if (args.userId)     query = query.eq('user_id', args.userId)
  if (args.guestEmail) query = query.eq('guest_email', args.guestEmail)

  // First pass: locked match.
  const { data: locked, error: lockedErr } = await query
    .eq('locked_style', args.style)
    .eq('locked_variant', args.variant)
  if (lockedErr) throw new Error(`entitlement_check_failed: ${lockedErr.message}`)
  if (locked && locked.length > 0) {
    return { available: true, entitlementId: locked[0].id }
  }

  // Second pass: generic credit (locked_style is null).
  let genericQuery = supabaseAdmin
    .from('entitlements')
    .select('id')
    .eq('status', 'available')
    .is('locked_style', null)
    .is('locked_variant', null)
    .order('created_at', { ascending: true })
    .limit(1)
  if (args.userId)     genericQuery = genericQuery.eq('user_id', args.userId)
  if (args.guestEmail) genericQuery = genericQuery.eq('guest_email', args.guestEmail)

  const { data: generic, error: genericErr } = await genericQuery
  if (genericErr) throw new Error(`entitlement_check_failed: ${genericErr.message}`)
  if (generic && generic.length > 0) {
    return { available: true, entitlementId: generic[0].id }
  }

  return { available: false }
}

// ─── consumeEntitlement (atomic) ─────────────────────────────────

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: 'already_consumed' | 'not_found' | 'wrong_owner' }

/**
 * Atomically transition 'available' or 'pending' → 'consumed', binding
 * to a job_id and locking style/variant. Backed by the
 * consume_entitlement_atomic SQL function so concurrent callers can't
 * both succeed.
 */
export async function consumeEntitlement(args: {
  entitlementId: string
  jobId:         string
  style:         string
  variant:       string
  userId?:       string
  guestEmail?:   string
}): Promise<ConsumeResult> {
  if (!args.userId && !args.guestEmail) return { ok: false, reason: 'wrong_owner' }

  const { data, error } = await supabaseAdmin.rpc('consume_entitlement_atomic', {
    p_entitlement_id: args.entitlementId,
    p_job_id:         args.jobId,
    p_style:          args.style,
    p_variant:        args.variant,
    p_user_id:        args.userId     ?? null,
    p_guest_email:    args.guestEmail ?? null,
  })
  if (error) throw new Error(`entitlement_consume_failed: ${error.message}`)

  // The SQL function returns the updated row, or zero rows if the guard
  // failed. supabase-js returns the row object directly (not an array)
  // for a function returning a single row.
  if (data) return { ok: true }

  // Disambiguate: was the row already consumed, or does it not match the
  // caller's identity / not exist?
  const { data: existing } = await supabaseAdmin
    .from('entitlements')
    .select('id, status, user_id, guest_email')
    .eq('id', args.entitlementId)
    .maybeSingle()
  if (!existing) return { ok: false, reason: 'not_found' }
  if (existing.status === 'consumed') return { ok: false, reason: 'already_consumed' }
  const ownerMatches =
    (args.userId     && existing.user_id     === args.userId) ||
    (args.guestEmail && existing.guest_email === args.guestEmail)
  if (!ownerMatches) return { ok: false, reason: 'wrong_owner' }
  // Race we lost — most likely consumed between our function call and the
  // disambiguation query.
  return { ok: false, reason: 'already_consumed' }
}

// ─── reserveEntitlement ──────────────────────────────────────────

/**
 * Mark 'available' → 'pending' and stamp job_id + generation_started_at.
 * Used by the optimistic flow when generation starts before payment
 * confirms. Bundle credits stay at locked_*=null until the eventual
 * consumeEntitlement call locks them.
 */
export async function reserveEntitlement(args: {
  entitlementId: string
  jobId:         string
}): Promise<{ ok: true } | { ok: false; reason: 'not_available' }> {
  const { data, error } = await supabaseAdmin
    .from('entitlements')
    .update({
      status:                'pending',
      job_id:                args.jobId,
      generation_started_at: new Date().toISOString(),
    })
    .eq('id', args.entitlementId)
    .eq('status', 'available')
    .select()
  if (error) throw new Error(`entitlement_reserve_failed: ${error.message}`)
  if (!data || data.length === 0) return { ok: false, reason: 'not_available' }
  return { ok: true }
}

// ─── restoreEntitlement ──────────────────────────────────────────

/**
 * Roll a consumed/pending entitlement back to 'available' after a
 * terminal generation failure. Logs the refund for the daily-cap.
 *
 * Throws if:
 *  - the entitlement doesn't exist
 *  - the caller doesn't own it
 *  - the caller has hit the 10/day refund cap
 */
export async function restoreEntitlement(args: {
  entitlementId: string
  reason:        string
  userId?:       string
  guestEmail?:   string
}): Promise<void> {
  if (!args.userId && !args.guestEmail) throw new Error('entitlement_restore: identity required')

  // Cap check (rolling 24h).
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  let capQuery = supabaseAdmin
    .from('refund_log')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', since)
  capQuery = args.userId
    ? capQuery.eq('user_id', args.userId)
    : capQuery.eq('guest_email', args.guestEmail!)
  const { count: refundsToday, error: capErr } = await capQuery
  if (capErr) throw new Error(`entitlement_restore_cap_check_failed: ${capErr.message}`)
  if ((refundsToday ?? 0) >= REFUND_DAILY_CAP) {
    throw new Error('entitlement_restore_cap_exceeded')
  }

  // Verify ownership and fetch the row.
  const { data: ent, error: readErr } = await supabaseAdmin
    .from('entitlements')
    .select('id, user_id, guest_email, status')
    .eq('id', args.entitlementId)
    .maybeSingle()
  if (readErr) throw new Error(`entitlement_restore_read_failed: ${readErr.message}`)
  if (!ent) throw new Error('entitlement_restore_not_found')
  const ownerMatches =
    (args.userId     && ent.user_id     === args.userId) ||
    (args.guestEmail && ent.guest_email === args.guestEmail)
  if (!ownerMatches) throw new Error('entitlement_restore_wrong_owner')
  if (ent.status === 'restored') return // idempotent — already restored

  // Flip back to available, drop the job binding.
  const { error: updErr } = await supabaseAdmin
    .from('entitlements')
    .update({
      status:      'restored',
      job_id:      null,
      restored_at: new Date().toISOString(),
    })
    .eq('id', args.entitlementId)
  if (updErr) throw new Error(`entitlement_restore_update_failed: ${updErr.message}`)

  // Re-create as a fresh available entitlement attached to the same purchase
  // so the user's "credits remaining" count stays right.
  const { data: src, error: srcErr } = await supabaseAdmin
    .from('entitlements')
    .select('purchase_id, user_id, guest_email, locked_style, locked_variant')
    .eq('id', args.entitlementId)
    .single()
  if (srcErr) throw new Error(`entitlement_restore_resrc_failed: ${srcErr.message}`)

  const { error: insErr } = await supabaseAdmin
    .from('entitlements')
    .insert({
      purchase_id:    src.purchase_id,
      user_id:        src.user_id,
      guest_email:    src.guest_email,
      locked_style:   src.locked_style,
      locked_variant: src.locked_variant,
      status:         'available',
    })
  if (insErr) throw new Error(`entitlement_restore_insert_failed: ${insErr.message}`)

  const { error: logErr } = await supabaseAdmin
    .from('refund_log')
    .insert({
      user_id:        args.userId     ?? null,
      guest_email:    args.guestEmail ?? null,
      entitlement_id: args.entitlementId,
      reason:         args.reason,
    })
  if (logErr) throw new Error(`refund_log_insert_failed: ${logErr.message}`)
}

// ─── confirmPurchase (idempotent on stripe_charge_id) ────────────

/**
 * Stripe webhook calls this on checkout.session.completed. Idempotent
 * — a duplicate event with the same charge id is a no-op.
 *
 * Entitlement rows were already created at session creation time
 * (see lib/store/checkout.ts), so we don't create them here. We just
 * flip the purchase status.
 */
export async function confirmPurchase(args: {
  stripeSessionId: string
  stripeChargeId:  string
}): Promise<{ purchaseId: string; entitlementIds: string[] }> {
  const { data: existing, error: readErr } = await supabaseAdmin
    .from('purchases')
    .select('id, status, stripe_charge_id')
    .eq('stripe_session_id', args.stripeSessionId)
    .maybeSingle()
  if (readErr) throw new Error(`purchase_read_failed: ${readErr.message}`)
  if (!existing) throw new Error(`purchase_not_found: ${args.stripeSessionId}`)

  if (existing.status === 'paid' && existing.stripe_charge_id === args.stripeChargeId) {
    // Already confirmed — return entitlements for the response shape
    const { data: ents } = await supabaseAdmin
      .from('entitlements')
      .select('id')
      .eq('purchase_id', existing.id)
    return { purchaseId: existing.id, entitlementIds: (ents ?? []).map((e) => e.id) }
  }

  const { error: updErr } = await supabaseAdmin
    .from('purchases')
    .update({
      status:           'paid',
      stripe_charge_id: args.stripeChargeId,
      paid_at:          new Date().toISOString(),
    })
    .eq('id', existing.id)
  if (updErr) throw new Error(`purchase_confirm_failed: ${updErr.message}`)

  const { data: ents, error: entsErr } = await supabaseAdmin
    .from('entitlements')
    .select('id')
    .eq('purchase_id', existing.id)
  if (entsErr) throw new Error(`purchase_confirm_ent_query_failed: ${entsErr.message}`)

  return { purchaseId: existing.id, entitlementIds: (ents ?? []).map((e) => e.id) }
}

// ─── handlePaymentFailure ────────────────────────────────────────

/**
 * Stripe reported a terminal payment failure (expired session, charge
 * failed). Mark the purchase 'failed' and void any non-consumed
 * entitlements. If a generation already finished against an entitlement
 * before payment died, log loudly — that's the cost of optimistic
 * generation and we want to track the rate.
 */
export async function handlePaymentFailure(args: {
  stripeSessionId: string
  reason:          string
}): Promise<void> {
  const { data: purchase, error: readErr } = await supabaseAdmin
    .from('purchases')
    .select('id, status')
    .eq('stripe_session_id', args.stripeSessionId)
    .maybeSingle()
  if (readErr) throw new Error(`purchase_read_failed: ${readErr.message}`)
  if (!purchase) {
    console.warn('[handlePaymentFailure] no purchase for session', args.stripeSessionId)
    return
  }
  if (purchase.status === 'paid') {
    console.warn(
      '[handlePaymentFailure] payment_failure_after_paid',
      args.stripeSessionId,
      'reason=' + args.reason,
    )
    // Unusual; we don't auto-refund here. Leave it to manual review.
    return
  }

  // Find any entitlements that already consumed (orphan-result case).
  const { data: ents } = await supabaseAdmin
    .from('entitlements')
    .select('id, status, job_id')
    .eq('purchase_id', purchase.id)
  for (const ent of (ents ?? [])) {
    if (ent.status === 'consumed') {
      console.warn(
        '[metric] orphan_result',
        'sessionId=' + args.stripeSessionId,
        'entitlementId=' + ent.id,
        'jobId=' + ent.job_id,
        'reason=' + args.reason,
      )
    }
  }

  // Mark the purchase failed.
  const { error: pUpdErr } = await supabaseAdmin
    .from('purchases')
    .update({ status: 'failed' })
    .eq('id', purchase.id)
  if (pUpdErr) throw new Error(`purchase_fail_update_failed: ${pUpdErr.message}`)

  // Void non-consumed entitlements: delete pending/available rows. Leave
  // consumed ones in place (the result is preserved but inaccessible to
  // the user — they were never paid for).
  const { error: delErr } = await supabaseAdmin
    .from('entitlements')
    .delete()
    .eq('purchase_id', purchase.id)
    .in('status', ['available', 'pending'])
  if (delErr) throw new Error(`entitlement_void_failed: ${delErr.message}`)
}

// ─── helpers used by /account ────────────────────────────────────

export async function listEntitlementsForUser(userId: string): Promise<Entitlement[]> {
  const { data, error } = await supabaseAdmin
    .from('entitlements')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(`entitlements_query_failed: ${error.message}`)
  return ((data ?? []) as EntitlementRow[]).map(rowToEntitlement)
}
