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

    /* ── CLAIM THE UNLOCK BEFORE SPENDING ANYTHING ─────────────────
       unlocked_at was selected above and never read, so a retry, a
       double-click or a refresh consumed a SECOND entitlement for an image
       the customer had already paid to unlock. A plain `if (unlocked_at)`
       read would still lose a true race, so this is a conditional update:
       exactly one caller flips NULL -> now() and only that caller goes on
       to spend an entitlement.

       Claiming before consuming, rather than stamping after, is the safe
       order: if the consume then fails the stamp is rolled back below, so
       the two never disagree. */
    const { data: claimedLedger, error: claimErr } = await sb
      .from('preview_ledger')
      .update({ unlocked_at: new Date().toISOString() })
      .eq('id', previewId)
      .is('unlocked_at', null)
      .select('id')
    if (claimErr) return NextResponse.json({ error: claimErr.message }, { status: 500 })

    if (!claimedLedger || claimedLedger.length === 0) {
      /* Already unlocked. Downloading a piece you have already paid for is
         the same act as the first download, and this route is the only way
         to the clean bytes — so redeliver rather than charge again.

         A signed-in caller had no ownership check at all before this,
         because holding the entitlement was the whole guard. No entitlement
         is spent on this path, so one is needed here. */
      const owns = await ownsPreview(sb, ledger.email, user?.id ?? null, guestEmail)
      if (!owns) return NextResponse.json({ error: 'wrong_owner' }, { status: 403 })
      console.log(`[portraits/unlock] redelivered preview=${previewId} (already unlocked)`)
      return NextResponse.json({ image_b64: cleanB64, preview_id: previewId, redelivered: true })
    }

    /* ── WHICH PURCHASE MAY PAY FOR THIS ─────────────────────────
       AN ENTITLEMENT HAS SCOPE. Owning one is not permission to spend it
       anywhere. This query used to take the OLDEST available entitlement the
       account held, from any purchase, and that is exactly what it did in
       production on 2026-09-09: three previews of portfolio 935148c0 were
       unlocked while that portfolio's own included unlock sat untouched at
       'available', each one paid for by a leftover entitlement from an
       unrelated purchase. The account had fourteen of those, so unlocking
       was effectively unlimited, and includedRemaining never moved — which
       is why the button kept inviting another click.

       An unlock included with a portfolio may only unlock a preview of that
       portfolio. The preview names its portfolio in the ledger email the
       render route writes, `portfolio:{portfolioId}:{slot}`, and the
       portfolio names the purchase that paid for it. Nothing falls through
       to the rest of the account. */
    const scopedPortfolioId = portfolioIdFromLedgerEmail(ledger.email)
    if (!scopedPortfolioId) {
      /* A preview with no portfolio behind it has no included unlock to
         spend. Paid additional unlocks are not built yet, so this is the
         honest answer rather than reaching for an unrelated entitlement. */
      await releaseClaim(sb, previewId)
      return NextResponse.json({ error: 'no_entitlement' }, { status: 409 })
    }

    const { data: scopedPortfolio, error: scopedErr } = await sb
      .from('portfolios')
      .select('id, purchase_id')
      .eq('id', scopedPortfolioId)
      .maybeSingle()
    if (scopedErr) {
      await releaseClaim(sb, previewId)
      return NextResponse.json({ error: scopedErr.message }, { status: 500 })
    }
    if (!scopedPortfolio?.purchase_id) {
      await releaseClaim(sb, previewId)
      return NextResponse.json({ error: 'no_entitlement' }, { status: 409 })
    }

    // ── Find a redeemable entitlement (purchase must be PAID) ────
    let entQuery = sb
      .from('entitlements')
      .select('id, locked_style, locked_variant, purchase_id, purchases!inner(status)')
      .eq('status', 'available')
      .eq('purchases.status', 'paid')
      .eq('purchase_id', scopedPortfolio.purchase_id)
      .order('created_at', { ascending: true })
      .limit(1)
    entQuery = user
      ? entQuery.eq('user_id', user.id)
      : entQuery.eq('guest_email', guestEmail!)

    const { data: ents, error: entErr } = await entQuery
    if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 })

    if (!ents || ents.length === 0) {
      // Disambiguate: pending payment vs. nothing at all — same scope.
      let pendQuery = sb
        .from('entitlements')
        .select('id, purchases!inner(status)')
        .eq('status', 'available')
        .eq('purchases.status', 'pending')
        .eq('purchase_id', scopedPortfolio.purchase_id)
        .limit(1)
      pendQuery = user
        ? pendQuery.eq('user_id', user.id)
        : pendQuery.eq('guest_email', guestEmail!)
      const { data: pending } = await pendQuery
      /* Claimed but nothing to spend — give the claim back so a later
         attempt, once the payment lands, is not treated as a redelivery. */
      await releaseClaim(sb, previewId)
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
      /* THE 500 WAS HERE. This built `unlock-<previewId>-<8 hex>`, and
         consume_entitlement_atomic declares p_job_id as UUID
         (003_store_commerce.sql:109), writing it into entitlements.job_id,
         also uuid. Postgres refused the cast — 22P02, invalid input syntax
         for type uuid — consumeEntitlement threw, and the catch below
         turned it into a 500.

         A FRESH UUID PER ATTEMPT, not the previewId. job_id identifies the
         generation attempt, not the thing being unlocked, and the schema is
         consistent about it: reserveEntitlement stamps it beside
         generation_started_at, restoreEntitlement nulls it when an attempt
         is abandoned, /result/[jobId] addresses one by it, and every other
         writer mints crypto.randomUUID() per attempt (checkout.ts:140,
         basket-checkout.ts:260). Reusing previewId would give two
         entitlements the same job_id whenever a claim is released and
         retried.

         Which preview was unlocked is already recorded, by
         preview_ledger.unlocked_at, set atomically by the claim above. */
      jobId:         randomUUID(),
      style:         ent.locked_style   ?? 'portrait_unlock',
      variant:       ent.locked_variant ?? '1k',
      userId:        user?.id,
      guestEmail:    guestEmail ?? undefined,
    })
    if (!consumed.ok) {
      /* Nothing was spent, so the image is not unlocked — put the claim back
         or the customer would be locked out of an unlock they still own. */
      await releaseClaim(sb, previewId)
      return NextResponse.json({ error: `consume_failed_${consumed.reason}` }, { status: 409 })
    }

    /* The ledger was already stamped by the claim above. */

    console.log(`[portraits/unlock] delivered preview=${previewId} entitlement=${ent.id}`)
    return NextResponse.json({ image_b64: cleanB64, preview_id: previewId })

  } catch (e: any) {
    console.error(`[portraits/unlock] failed: ${e?.message}`)
    return NextResponse.json({ error: e?.message || 'unlock_failed' }, { status: 500 })
  }
}

/* Undo the claim. Used on every path that claims and then cannot spend, so
   a failed attempt never leaves an image looking unlocked. */
async function releaseClaim(sb: any, previewId: string): Promise<void> {
  const { error } = await sb
    .from('preview_ledger')
    .update({ unlocked_at: null })
    .eq('id', previewId)
  if (error) console.error(`[portraits/unlock] claim release FAILED for ${previewId}: ${error.message}`)
}

/* True when this caller is the one the preview was made for. A guest matches
   on the email the ledger row carries. A signed-in customer matches through
   the portfolio the preview belongs to — `portfolio:{id}:{slot}` is the
   ledger email the render route writes, and the portfolio row holds the
   owner. */
/* `portfolio:{portfolioId}:{slot}` is the ledger email portfolio-render.ts
   writes. Returns the portfolio id, or null for a preview that did not come
   from a portfolio. One parser, so scoping and ownership can never disagree
   about which portfolio a preview belongs to. */
function portfolioIdFromLedgerEmail(ledgerEmail: string | null): string | null {
  if (!ledgerEmail || !ledgerEmail.startsWith('portfolio:')) return null
  const id = ledgerEmail.slice('portfolio:'.length).split(':')[0]
  return id || null
}

async function ownsPreview(
  sb: any, ledgerEmail: string | null, userId: string | null, guestEmail: string | null,
): Promise<boolean> {
  if (guestEmail) return ledgerEmail === guestEmail
  if (!userId) return false
  const portfolioId = portfolioIdFromLedgerEmail(ledgerEmail)
  if (!portfolioId) return false
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
