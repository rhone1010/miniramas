// store/checkout.ts
// lib/store/checkout.ts
//
// Orchestrates Stripe Checkout session creation, purchase row creation,
// and (per the optimistic flow) entitlement creation. Generation kickoff
// is wired in step 8 — for now stubbed via the GenerationKickoff
// interface so the application chat can plug in lib/v1/* later without
// changing call sites.
//
// Shape of work for `createCheckout`:
//   1. Look up SKU; assert it's active.
//   2. Create Stripe Checkout session.
//   3. Insert purchase row (status='pending').
//   4. For singles: insert 1 entitlement (locked_style/variant set).
//      For bundles: insert N entitlements (locked_*=null), require userId.
//   5. (Step 8) For singles: kick off generation, reserveEntitlement.
//   6. Return checkoutUrl + purchaseId + (optional) jobId.
//
// If any DB write fails after the Stripe session was created we DON'T
// try to roll the session back — Stripe sessions auto-expire and a
// purchase with no row simply cannot be confirmed by the webhook.

import { getStripe, getAppUrl }   from './stripe'
import { supabaseAdmin }          from '@/lib/supabase'
import { getSku }                 from './skus'
import { reserveEntitlement }     from './entitlements'
import type { GenerationKickoff } from './types'
import { defaultGenerationKickoff } from './generation-kickoff'
import crypto from 'crypto'

export interface CreateCheckoutArgs {
  skuId:           string
  userId?:         string
  guestEmail?:     string
  // Required for singles only:
  style?:          string
  variant?:        string
  // Source image data the application chat passes through:
  sourceImageRef?: string
}

export interface CreateCheckoutResult {
  checkoutUrl: string
  purchaseId:  string
  jobId?:      string  // present only for singles once optimistic kickoff is wired
}

export async function createCheckout(
  args:    CreateCheckoutArgs,
  kickoff: GenerationKickoff = defaultGenerationKickoff,
): Promise<CreateCheckoutResult> {
  // ── 1. SKU lookup ────────────────────────────────────────────
  const sku = await getSku(args.skuId)
  if (!sku) throw new Error(`sku_not_found: ${args.skuId}`)
  if (!sku.active) throw new Error(`sku_inactive: ${args.skuId}`)

  // ── 0. Identity / argument shape ─────────────────────────────
  if (sku.kind === 'bundle') {
    if (!args.userId) throw new Error('bundle_purchase_requires_user')
  } else {
    if (!args.style || !args.variant) {
      throw new Error('single_purchase_requires_style_and_variant')
    }
    if (!args.userId && !args.guestEmail) {
      throw new Error('single_purchase_requires_user_or_email')
    }
  }

  // ── 2. Stripe Checkout session ───────────────────────────────
  const appUrl = getAppUrl()
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode:        'payment',
    line_items:  [{ price: sku.stripePriceId, quantity: 1 }],
    success_url: `${appUrl}/store/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/store/cancel?session_id={CHECKOUT_SESSION_ID}`,
    customer_email: args.guestEmail && !args.userId ? args.guestEmail : undefined,
    metadata: {
      skuId:       sku.id,
      kind:        sku.kind,
      userId:      args.userId     ?? '',
      guestEmail:  args.guestEmail ?? '',
      ...(sku.kind === 'single'
        ? { style: args.style!, variant: args.variant! }
        : {}),
    },
  })

  if (!session.url) throw new Error('stripe_session_missing_url')

  // ── 3. Purchase row ──────────────────────────────────────────
  const { data: purchaseRow, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id:           args.userId     ?? null,
      guest_email:       args.guestEmail ?? null,
      sku_id:            sku.id,
      stripe_session_id: session.id,
      amount_cents:      sku.priceCents,
      status:            'pending',
    })
    .select()
    .single()
  if (purchaseErr) throw new Error(`purchase_insert_failed: ${purchaseErr.message}`)
  const purchaseId: string = purchaseRow.id

  // ── 4. Entitlement rows ──────────────────────────────────────
  const entitlementRows = Array.from({ length: sku.count }, () => ({
    purchase_id:    purchaseId,
    user_id:        args.userId     ?? null,
    guest_email:    args.guestEmail ?? null,
    locked_style:   sku.kind === 'single' ? args.style!   : null,
    locked_variant: sku.kind === 'single' ? args.variant! : null,
    status:         'available',
  }))
  const { data: entitlements, error: entErr } = await supabaseAdmin
    .from('entitlements')
    .insert(entitlementRows)
    .select('id')
  if (entErr) throw new Error(`entitlement_insert_failed: ${entErr.message}`)

  // ── 5. Optimistic generation kickoff (singles only) ──────────
  // Wired in step 8. The defaultGenerationKickoff is a stub that just
  // logs; the application chat replaces it with the real call into
  // lib/v1/* when it integrates.
  let jobId: string | undefined
  if (sku.kind === 'single' && entitlements && entitlements.length > 0 && args.sourceImageRef) {
    const ent = entitlements[0]
    jobId = crypto.randomUUID()
    const reserved = await reserveEntitlement({ entitlementId: ent.id, jobId })
    if (reserved.ok) {
      // Fire-and-forget — generation runs concurrently with Stripe
      // checkout. We don't await it.
      void kickoff.start({
        jobId,
        entitlementId:  ent.id,
        style:          args.style!,
        variant:        args.variant!,
        sourceImageRef: args.sourceImageRef,
      }).catch((err) => {
        console.error('[createCheckout] kickoff.start threw', err)
      })
    } else {
      console.warn('[createCheckout] reserveEntitlement not_available — skipping kickoff')
      jobId = undefined
    }
  }

  return {
    checkoutUrl: session.url,
    purchaseId,
    jobId,
  }
}
