// lib/store/basket-checkout.ts
//
// Discovery Collections purchase path ("Basket of Twenty" and its Groups/
// Pets siblings). Deliberately NOT built on createCartCheckout — that
// function prices per-piece off a volume ladder (VOLUME_LADDER in
// checkout.ts), and this model is flat: one SKU price for the whole
// basket, one free unlock included, additional unlocks priced separately.
// Reusing the ladder here was the "engine gap" flagged against the
// styled draft (basket-styled.html, panel 7) — this file exists so that
// gap doesn't get inherited instead of closed.
//
// Two entitlement concepts already exist in this codebase and this
// model needs a third distinct one, not a variant of the other two:
//   • createCheckout (bundle)    → N entitlements, one per generation
//   • createCartCheckout (cart)  → N entitlements, one per paid unlock
//   • createBasketCheckout (new) → N RENDERS (not entitlements) + 1
//     generic entitlement (the included free unlock), reusing exactly
//     the locked_style=null / locked_variant=null shape checkEntitlement
//     already treats as a generic, redeemable-against-anything token.
//
// Renders are tracked in new tables (baskets / basket_items — migration
// below, not yet applied). They are NOT entitlement rows: an entitlement
// is something a customer redeems, a basket_item is something that gets
// rendered whether or not it's ever redeemed. Conflating the two would
// mean 20 redeemable-looking rows per $12.99 purchase, which is wrong —
// only 1 of the 20 is actually owed to the customer as a clean file.
//
// ── WHAT THIS FILE DOES NOT DO ─────────────────────────────────────
// It does not kick off generation. Payment-first, not preview-first (the
// customer hasn't seen anything yet, unlike the cart model), so — same
// as the existing bundle path — generation waits for the Stripe webhook
// to confirm payment, not an optimistic pre-payment start. That's
// `activateBasket`, called from confirmPurchase's caller (the webhook
// route). THIS FILE HAS NOT SEEN THE WEBHOOK ROUTE — activateBasket is
// written to the same call shape as the existing optimistic kickoff in
// checkout.ts (kickoff.start per item, fire-and-forget), but wiring it
// into the actual webhook handler needs that file, which wasn't
// supplied. Flagging rather than guessing at it.
//
// It also does not write render results back (job completion → status
// update on the basket_item row). That's a callback the generator calls
// when a piece finishes — same open gap, same reason: no visibility into
// how the existing single-craft path marks a job done.

import { getStripe, getAppUrl }     from './stripe'
import { supabaseAdmin }            from '@/lib/supabase'
import { getSku }                   from './skus'
import type { GenerationKickoff }   from './types'
import { defaultGenerationKickoff } from './generation-kickoff'
import crypto from 'crypto'

// ── Types ────────────────────────────────────────────────────────

export type BasketSeries = 'portraits' | 'halloween' | 'groups' | 'pets'

export interface CreateBasketCheckoutArgs {
  skuId:          string   // e.g. 'basket_portraits_20', 'basket_pets_15'
  userId:         string   // baskets require an account — same rule as bundles
  series:         BasketSeries
  // Either the client's own picks (picker path) or the curator's picks
  // (client-computed today, per basket-styled.html panel 2/4 — server
  // does not currently select effects itself). Length MUST equal
  // sku.count or the purchase is rejected; no silent truncation/padding.
  presets:        string[]
  sourceImageRef: string
  returnUrl:      string
}

export interface CreateBasketCheckoutResult {
  checkoutUrl: string
  purchaseId:  string
  basketId:    string
}

// Same-origin guard as createCartCheckout — copied rather than imported
// to keep this file's failure modes independent of the cart path.
function safeReturnBase(returnUrl: string | undefined, appUrl: string): string {
  if (!returnUrl) return `${appUrl}/collections`
  try {
    const u   = new URL(returnUrl)
    const app = new URL(appUrl)
    if (u.origin !== app.origin) return `${appUrl}/collections`
    return `${u.origin}${u.pathname}`
  } catch {
    return `${appUrl}/collections`
  }
}

function appendQuery(url: string, query: string): string {
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}

// ── createBasketCheckout ────────────────────────────────────────

export async function createBasketCheckout(
  args: CreateBasketCheckoutArgs,
): Promise<CreateBasketCheckoutResult> {
  if (!args.userId) throw new Error('basket_purchase_requires_user')

  // ── SKU lookup ───────────────────────────────────────────────
  // Assumes a `count` column (already used by checkout.ts for bundle
  // entitlement fan-out) doubles as basket size here. If the skus table
  // doesn't carry a basket-specific free-unlock count, this defaults to
  // 1 — matching the ruled model ("one unlock is included, flat, not
  // scaled by series") — rather than reading a column that may not
  // exist. Confirm the schema has (or doesn't need) a separate column
  // before trusting this default past the first basket kind.
  const sku = await getSku(args.skuId)
  if (!sku) throw new Error(`sku_not_found: ${args.skuId}`)
  if (!sku.active) throw new Error(`sku_inactive: ${args.skuId}`)
  if (sku.kind !== 'basket') throw new Error(`sku_wrong_kind: ${args.skuId} is ${sku.kind}`)

  const freeUnlocks = (sku as any).freeUnlocks ?? 1

  // ── Validate the basket ──────────────────────────────────────
  if (!Array.isArray(args.presets) || args.presets.length !== sku.count) {
    throw new Error(`basket_wrong_size: expected ${sku.count} got ${args.presets?.length ?? 0}`)
  }
  if (args.presets.some((p) => typeof p !== 'string' || !p)) {
    throw new Error('basket_invalid_preset')
  }
  if (!args.sourceImageRef) throw new Error('basket_source_image_required')

  // ── Stripe session — flat price, one line item ───────────────
  const appUrl  = getAppUrl()
  const stripe  = getStripe()
  const base    = safeReturnBase(args.returnUrl, appUrl)
  const success = appendQuery(base, 'basket_paid=1&session_id={CHECKOUT_SESSION_ID}')
  const cancel  = appendQuery(base, 'basket_canceled=1')

  const session = await stripe.checkout.sessions.create({
    mode:        'payment',
    line_items:  [{ price: sku.stripePriceId, quantity: 1 }],
    success_url: success,
    cancel_url:  cancel,
    metadata: {
      skuId:   sku.id,
      kind:    'basket',
      series:  args.series,
      userId:  args.userId,
      count:   String(sku.count),
    },
  })
  if (!session.url) throw new Error('stripe_session_missing_url')

  // ── Purchase row (existing shape, unchanged) ─────────────────
  const { data: purchaseRow, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id:           args.userId,
      guest_email:        null,
      sku_id:            sku.id,
      stripe_session_id: session.id,
      amount_cents:      sku.priceCents,
      status:            'pending',
    })
    .select()
    .single()
  if (purchaseErr) throw new Error(`purchase_insert_failed: ${purchaseErr.message}`)
  const purchaseId: string = purchaseRow.id

  // ── Basket row ────────────────────────────────────────────────
  // NEW TABLE — not yet migrated. See migration sketch below the code.
  const { data: basketRow, error: basketErr } = await supabaseAdmin
    .from('baskets')
    .insert({
      purchase_id:   purchaseId,
      user_id:       args.userId,
      series:        args.series,
      size:          sku.count,
      status:        'pending', // flips to 'generating' in activateBasket, on payment
      free_unlocks:  freeUnlocks,
      source_image:  args.sourceImageRef,
    })
    .select()
    .single()
  if (basketErr) throw new Error(`basket_insert_failed: ${basketErr.message}`)
  const basketId: string = basketRow.id

  // ── Basket item rows — one per slot, NOT entitlements ────────
  const itemRows = args.presets.map((preset, slot) => ({
    basket_id: basketId,
    slot,
    preset,
    status:    'pending',
  }))
  const { error: itemErr } = await supabaseAdmin.from('basket_items').insert(itemRows)
  if (itemErr) throw new Error(`basket_item_insert_failed: ${itemErr.message}`)

  console.log(
    `[createBasketCheckout] ${args.series} ${sku.count}pc basket=${basketId} purchase=${purchaseId}`,
  )
  return { checkoutUrl: session.url, purchaseId, basketId }
}

// ── activateBasket ───────────────────────────────────────────────
//
// Called from the webhook path, AFTER confirmPurchase flips the
// purchase to 'paid' — same ordering the existing bundle path implies
// (bundles get their entitlements at checkout time but no kickoff;
// nothing in checkout.ts kicks off a bundle's generation optimistically,
// only singles). Baskets follow that same rule for the same reason:
// abandoned carts shouldn't cost 20 renders.
//
// NOT WIRED to the webhook route — that file wasn't supplied. The call
// site needs: `await activateBasket(purchaseId)` placed right after
// `confirmPurchase(...)` resolves for a basket-kind purchase, inside
// whatever route currently calls confirmPurchase.

export async function activateBasket(
  purchaseId: string,
  kickoff: GenerationKickoff = defaultGenerationKickoff,
): Promise<void> {
  const { data: basket, error: basketErr } = await supabaseAdmin
    .from('baskets')
    .select('id, user_id, series, size, free_unlocks, source_image, status')
    .eq('purchase_id', purchaseId)
    .maybeSingle()
  if (basketErr) throw new Error(`basket_activate_read_failed: ${basketErr.message}`)
  if (!basket) return // not a basket purchase — nothing to do
  if (basket.status !== 'pending') return // already activated (webhook replay)

  // ── The one free unlock, as a generic entitlement ─────────────
  // locked_style/locked_variant = null, matching checkEntitlement's
  // generic-match pass exactly. Redeeming it against a chosen piece is
  // item 2's job (locking style/variant at consume time) — not
  // duplicated here.
  const entitlementRows = Array.from({ length: basket.free_unlocks }, () => ({
    purchase_id:    purchaseId,
    user_id:        basket.user_id,
    guest_email:    null,
    locked_style:   null,
    locked_variant: null,
    status:         'available',
  }))
  const { error: entErr } = await supabaseAdmin.from('entitlements').insert(entitlementRows)
  if (entErr) throw new Error(`basket_entitlement_insert_failed: ${entErr.message}`)

  // ── Flip basket to generating ──────────────────────────────────
  const { error: flipErr } = await supabaseAdmin
    .from('baskets')
    .update({ status: 'generating' })
    .eq('id', basket.id)
  if (flipErr) throw new Error(`basket_activate_flip_failed: ${flipErr.message}`)

  // ── Fire N generation jobs, fire-and-forget ─────────────────────
  // Job-completion write-back (marking a basket_item 'done'/'failed' and
  // triggering the auto-replace-on-failure rule) is NOT implemented
  // here — it needs whatever mechanism the existing single-craft path
  // uses to learn a job finished, which wasn't supplied. Each item is
  // left 'pending' → the caller of kickoff.start is on the hook for
  // wiring the callback; this function only starts the jobs.
  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('basket_items')
    .select('id, slot, preset')
    .eq('basket_id', basket.id)
  if (itemsErr) throw new Error(`basket_items_read_failed: ${itemsErr.message}`)

  for (const item of items ?? []) {
    const jobId = crypto.randomUUID()
    void supabaseAdmin
      .from('basket_items')
      .update({ status: 'rendering', job_id: jobId })
      .eq('id', item.id)
      .then(() => {
        void kickoff
          .start({
            jobId,
            entitlementId:  '', // no entitlement backs an individual render — basket_item.id is the handle
            style:          item.preset,
            variant:        basket.series,
            sourceImageRef: basket.source_image,
          })
          .catch((err) => {
            console.error(`[activateBasket] kickoff.start threw for item ${item.id}`, err)
          })
      })
  }

  console.log(`[activateBasket] basket=${basket.id} fired ${items?.length ?? 0} jobs`)
}
