// app/api/v1/portraits/unlock/route.ts
//
// Unlock redemption (item 2, delivery side). A paid unlock re-delivers the
// CLEAN original retained at preview time, keyed by preview id.
//
// POST { preview_id, email? }   (logged-in users come via Supabase cookies)
//   → 200 { image_b64, preview_id }
//   → 402 payment_pending      entitlement exists but purchase not yet 'paid'
//   → 403 wrong_owner          email doesn't match the preview's ledger row
//   → 404 preview_not_found / clean_unavailable
//   → 409 no_entitlement       nothing available to consume
//
// Order is deliberate: fetch the clean image FIRST, consume the entitlement
// only once delivery is certain — a consume against a missing file would
// burn the customer's unlock for nothing. consumeEntitlement is the atomic
// guard (migration 003), so double-redeems can't both succeed.
//
// Stricter than the optimistic single/bundle flow on purpose: this hands
// over the actual product file, so the purchase must be 'paid' (the
// customer returns on ?paid=1; the webhook usually lands first).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

import { getUser } from '@/lib/store/auth'
import { consumeEntitlement } from '@/lib/store/entitlements'
import { normalizeEmail, fetchCleanOriginal } from '@/lib/store/preview'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const previewId = typeof body.preview_id === 'string' ? body.preview_id : ''
    if (!previewId) {
      return NextResponse.json({ error: 'preview_id required' }, { status: 400 })
    }

    const sb = supaOrNull()
    if (!sb) return NextResponse.json({ error: 'supabase not configured' }, { status: 500 })

    // ── Identity ─────────────────────────────────────────────────
    const user = await getUser()
    const guestEmail = !user ? normalizeEmail(body.email) : null
    if (!user && !guestEmail) {
      return NextResponse.json({ error: 'email required' }, { status: 400 })
    }

    // ── Ledger row ───────────────────────────────────────────────
    const { data: ledger, error: ledErr } = await sb
      .from('preview_ledger')
      .select('id, email, storage_path, unlocked_at')
      .eq('id', previewId)
      .maybeSingle()
    if (ledErr) return NextResponse.json({ error: ledErr.message }, { status: 500 })
    if (!ledger) return NextResponse.json({ error: 'preview_not_found' }, { status: 404 })

    // Guests must match the email the preview was claimed under.
    if (guestEmail && ledger.email !== guestEmail) {
      return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })
    }

    if (!ledger.storage_path) {
      // Clean original wasn't retained (storage failed at preview time).
      // Spec allows re-render as the fallback — that path isn't built, so
      // surface it honestly rather than consuming the unlock.
      return NextResponse.json({ error: 'clean_unavailable' }, { status: 404 })
    }

    // ── Fetch the clean image BEFORE consuming anything ──────────
    const cleanB64 = await fetchCleanOriginal(sb, ledger.storage_path)
    if (!cleanB64) {
      return NextResponse.json({ error: 'clean_unavailable' }, { status: 404 })
    }

    /* ── Already unlocked: redeliver, never charge twice ──────────
       Added 2026-09-06 with the Discovery download. Downloading a piece you
       have already unlocked is the same act as the first download, and this
       route is the only way to the clean bytes — so without this branch a
       reload turned "save my picture again" into "spend another unlock".

       A signed-in caller had no ownership check at all before this (the
       entitlement being theirs was the whole guard), so one is needed here
       where no entitlement is consumed. Portfolio previews are recorded with
       email `portfolio:{portfolioId}` (portfolios/items/render/route.ts:138),
       which is what ties the preview back to an owner. */
    if (ledger.unlocked_at) {
      const owns = await ownsPreview(sb, ledger.email, user?.id ?? null, guestEmail)
      if (!owns) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })
      console.log(`[portraits/unlock] redelivered preview=${previewId} (already unlocked)`)
      return NextResponse.json({ image_b64: cleanB64, preview_id: previewId, redelivered: true })
    }

    // ── Find a redeemable entitlement (purchase must be PAID) ────
    let entQuery = sb
      .from('entitlements')
      .select('id, locked_style, locked_variant, purchase_id, purchases!inner(status)')
      .eq('status', 'available')
      .eq('purchases.status', 'paid')
      .order('created_at', { ascending: true })
      .limit(1)
    entQuery = user
      ? entQuery.eq('user_id', user.id)
      : entQuery.eq('guest_email', guestEmail!)

    const { data: ents, error: entErr } = await entQuery
    if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 })

    if (!ents || ents.length === 0) {
      // Disambiguate: pending payment vs. nothing at all.
      let pendQuery = sb
        .from('entitlements')
        .select('id, purchases!inner(status)')
        .eq('status', 'available')
        .eq('purchases.status', 'pending')
        .limit(1)
      pendQuery = user
        ? pendQuery.eq('user_id', user.id)
        : pendQuery.eq('guest_email', guestEmail!)
      const { data: pending } = await pendQuery
      if (pending && pending.length > 0) {
        return NextResponse.json({ error: 'payment_pending' }, { status: 402 })
      }
      return NextResponse.json({ error: 'no_entitlement' }, { status: 409 })
    }

    const ent = ents[0] as any

    // ── Consume atomically (style/variant echo the row's own locks
    //    so the guard in consume_entitlement_atomic always matches) ──
    const consumed = await consumeEntitlement({
      entitlementId: ent.id,
      jobId:         `unlock-${previewId}-${randomUUID().slice(0, 8)}`,
      style:         ent.locked_style   ?? 'portrait_unlock',
      variant:       ent.locked_variant ?? '1k',
      userId:        user?.id,
      guestEmail:    guestEmail ?? undefined,
    })
    if (!consumed.ok) {
      return NextResponse.json({ error: `consume_failed_${consumed.reason}` }, { status: 409 })
    }

    // Stamp the ledger (idempotent-ish; informational).
    await sb.from('preview_ledger')
      .update({ unlocked_at: new Date().toISOString() })
      .eq('id', previewId)

    console.log(`[portraits/unlock] delivered preview=${previewId} entitlement=${ent.id}`)
    return NextResponse.json({ image_b64: cleanB64, preview_id: previewId })

  } catch (e: any) {
    console.error(`[portraits/unlock] failed: ${e?.message}`)
    return NextResponse.json({ error: e?.message || 'unlock_failed' }, { status: 500 })
  }
}

/* True when this caller is the one the preview was made for. A guest matches
   on the email the ledger row carries. A signed-in customer matches through
   the portfolio the preview belongs to — `portfolio:{id}` is the ledger email
   the render route writes, and the portfolio row holds the owner. */
async function ownsPreview(
  sb: any, ledgerEmail: string | null, userId: string | null, guestEmail: string | null,
): Promise<boolean> {
  if (guestEmail) return ledgerEmail === guestEmail
  if (!userId) return false
  if (!ledgerEmail || !ledgerEmail.startsWith('portfolio:')) return false
  const portfolioId = ledgerEmail.slice('portfolio:'.length)
  const { data } = await sb
    .from('portfolios')
    .select('user_id')
    .eq('id', portfolioId)
    .maybeSingle()
  return !!data && data.user_id === userId
}

function supaOrNull() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
}
