// lib/store/portfolio-checkout.ts
// Fixed-size Portfolio pricing. Reuses four live Stripe SKUs
// (single, basket_discover_5, basket_discover_10, basket_discover_20)
// with updated effect counts: 1, 4, 8, 16.
//
// SIZE 1 IS A PORTFOLIO OF ONE, as of 2026-09-09. It used to route through
// the original single-craft checkout (/api/v1/checkout, skuId:'single'),
// which is where the 13 historical paid singles went: 10 of their
// entitlements are still stranded at 'pending' and the return page 404s.
// It now uses the same payment -> activation -> dispatch -> render
// machinery as 4/8/16, and differs in exactly one recorded fact --
// portfolios.delivery = 'purchased' -- which means its piece is bought
// outright and renders already unlocked. It still buys the SAME 'single'
// SKU at the same 299, so nothing changes in Stripe. The historical rows
// stay distinguishable because they have no portfolios row at all; this
// PR does not touch them.
//
// Hard cap: 16 effects max per purchase this release.
// Checkout requires selectedEffectIds.length to exactly match one of
// {4, 8, 16} — no rounding, no padding. CUI/Curator fills any
// remainder before checkout fires.
//
// resolveSelectionOffer works for ANY count (used during browsing to
// show tier context). Only createPortfolioCheckout rejects non-exact.

import { getStripe, getAppUrl } from './stripe'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export type PortfolioSeries = 'portraits' | 'halloween' | 'groups' | 'pets'

export type Tier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'

export type Delivery = 'preview' | 'purchased'

export interface SelectionOffer {
  count: number
  tier: Tier | null
  skuId: string | null
  priceUsd: number
  includedUnlocks: number
  delivery: Delivery
}

/* Fixed purchase sizes, mapped to live SKU rows. Stripe prices are unchanged.
   DELIVERY IS DATA HERE, not a conditional. This table is the single place
   where a size decides what kind of product it is; every reader downstream
   asks portfolios.delivery instead of counting items. That is the whole point
   of the column -- one boundary, no `size === 1` scattered through the
   activation, render, status and client paths.

   Size 1 carries no included unlocks because there is nothing to unlock: the
   piece is bought outright, so activatePortfolio mints zero entitlements and
   the render stamps it unlocked from the start. */
const PORTFOLIO_SIZES: Array<{
  count: number; tier: Tier; skuId: string; priceCents: number; unlocks: number; delivery: Delivery
}> = [
  { count: 1,  tier: 'tier_1', skuId: 'single',              priceCents: 299,  unlocks: 0, delivery: 'purchased' },
  { count: 4,  tier: 'tier_2', skuId: 'basket_discover_5',   priceCents: 499,  unlocks: 1, delivery: 'preview'   },
  { count: 8,  tier: 'tier_3', skuId: 'basket_discover_10',  priceCents: 799,  unlocks: 1, delivery: 'preview'   },
  { count: 16, tier: 'tier_4', skuId: 'basket_discover_20',  priceCents: 1299, unlocks: 2, delivery: 'preview'   },
]

/* COMPOSITION: FRAMING, NOT ASPECT. portraits/generate:319 derives the aspect
   ratio from framing and ignores whatever aspect the client sent --
   ASPECT_FOR_FRAMING is bust 1:1, signature 1:1, statuesque 3:4. So carrying
   the customer's aspect choice means choosing the framing that produces it.

   1:1 maps to bust rather than signature because bust is what
   renderOnePortfolioItem has always hardcoded; picking signature here would
   change the look of every square piece, which is not what was asked for.

   4:3 HAS NO FRAMING. The generator's vocabulary produces 1:1 and 3:4 and
   nothing else, so the Landscape option in the aspect step cannot be
   honoured. It falls back to bust -- today's behaviour for every piece of
   every size, so nothing regresses -- and says so in the log. Reported to
   Rich 2026-09-09 as an unmet term of the size-1 contract; the fix is a
   product decision about the framing vocabulary, not a mapping to invent
   here. */
export function framingForAspect(aspectRatio: string | null | undefined): string {
  if (aspectRatio === '3:4') return 'statuesque'
  if (aspectRatio === '1:1') return 'bust'
  if (aspectRatio) {
    console.warn(`[portfolio-checkout] no framing produces aspect ${aspectRatio} — falling back to bust (1:1)`)
  }
  return 'bust'
}

const VALID_COUNTS = new Set(PORTFOLIO_SIZES.map((s) => s.count))

/**
 * Returns the offer for a given selection count. Works for any count
 * (browsing context). For counts between fixed sizes, returns the tier
 * the user would reach if they filled up to the next size. For count 0,
 * returns a null-tier empty offer.
 */
export function resolveSelectionOffer(count: number): SelectionOffer {
  if (count <= 0) {
    return { count, tier: null, skuId: null, priceUsd: 0, includedUnlocks: 0, delivery: 'preview' }
  }

  // Exact match — the purchase sizes
  const exact = PORTFOLIO_SIZES.find((s) => s.count === count)
  if (exact) {
    return {
      count: exact.count,
      tier: exact.tier,
      skuId: exact.skuId,
      priceUsd: exact.priceCents / 100,
      includedUnlocks: exact.unlocks,
      delivery: exact.delivery,
    }
  }

  // Between sizes — find the next size up (the tier the user is working toward)
  const nextUp = PORTFOLIO_SIZES.find((s) => s.count > count)
  if (nextUp) {
    return {
      count,
      tier: nextUp.tier,
      skuId: nextUp.skuId,
      priceUsd: nextUp.priceCents / 100,
      includedUnlocks: nextUp.unlocks,
      /* A browsing offer for an in-between count describes the bundle the
         customer would reach by filling up, so it takes that bundle's
         delivery -- never 'purchased', which belongs to an exact size of 1. */
      delivery: nextUp.delivery,
    }
  }

  // Above max (shouldn't happen with cap at 16, but be safe)
  const last = PORTFOLIO_SIZES[PORTFOLIO_SIZES.length - 1]
  return {
    count,
    tier: last.tier,
    skuId: last.skuId,
    priceUsd: last.priceCents / 100,
    includedUnlocks: last.unlocks,
    delivery: last.delivery,
  }
}

export interface CreatePortfolioCheckoutArgs {
  userId: string
  series: PortfolioSeries
  selectedEffectIds: string[]
  sourceImageRef: string
  returnUrl: string
  clientPriceUsd: number // never trusted, checked against server resolve
  /* The composition steps. The client has always sent these and this
     function has always ignored them; they are now recorded on the
     portfolio. Optional because a caller that omits them is not an error --
     null records "not captured", which is the honest state. */
  pose?: string | null
  aspectRatio?: string | null
  subject?: string | null
}

export interface CreatePortfolioCheckoutResult {
  checkoutUrl: string
  purchaseId: string
  portfolioId: string
}

/* Where Stripe sends the customer back to.
 *
 * OPEN-REDIRECT GUARD. returnUrl arrives from the browser, so an attacker
 * who can set it must not be able to point our success_url at a host they
 * control. Anything that is not ours falls back to APP_URL.
 *
 * "Ours" includes subdomains as of 2026-09-08. Discovery is served from
 * discovery.litenco.com while APP_URL is litenco.com, so exact-origin
 * matching rejected every Discovery return and sent the customer to
 * APP_URL/collections instead — a path that does not exist, on a host that
 * is not Discovery. The portfolio rendered and was never shown, because
 * nothing on that page knows how to look for it.
 *
 * The subdomain test requires the leading dot, which is the whole of the
 * protection: litenco.com.evil.com ends with ".evil.com" and evillitenco.com
 * ends with nothing of ours, so both fail. Protocol must match as well, so
 * an https deployment cannot be talked into returning over http.
 *
 * Exported for test only.
 */
export function safeReturnBase(returnUrl: string | undefined, appUrl: string): string {
  if (!returnUrl) return `${appUrl}/collections`
  try {
    const u = new URL(returnUrl)
    const app = new URL(appUrl)
    if (u.protocol !== app.protocol) return `${appUrl}/collections`
    const sameHost  = u.host === app.host
    const subdomain = u.hostname.endsWith(`.${app.hostname}`)
    if (!sameHost && !subdomain) return `${appUrl}/collections`
    return `${u.origin}${u.pathname}`
  } catch {
    return `${appUrl}/collections`
  }
}

function appendQuery(url: string, query: string): string {
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}

export async function createPortfolioCheckout(
  args: CreatePortfolioCheckoutArgs,
): Promise<CreatePortfolioCheckoutResult> {
  if (!args.userId) throw new Error('portfolio_purchase_requires_user')
  if (!Array.isArray(args.selectedEffectIds) || args.selectedEffectIds.length === 0) {
    throw new Error('portfolio_empty_selection')
  }
  if (!args.sourceImageRef) throw new Error('portfolio_source_image_required')

  const count = args.selectedEffectIds.length
  if (!VALID_COUNTS.has(count)) {
    throw new Error(`portfolio_invalid_size: got ${count}, must be one of ${[...VALID_COUNTS].join(', ')}`)
  }

  const offer = resolveSelectionOffer(count)
  const serverCents = Math.round(offer.priceUsd * 100)
  const clientCents = Math.round(args.clientPriceUsd * 100)
  if (clientCents !== serverCents) {
    throw new Error(`price_mismatch: client=${clientCents} server=${serverCents}`)
  }

  const appUrl = getAppUrl()
  const stripe = getStripe()
  const base = safeReturnBase(args.returnUrl, appUrl)
  const success = appendQuery(base, 'portfolio_paid=1&session_id={CHECKOUT_SESSION_ID}')
  const cancel = appendQuery(base, 'portfolio_canceled=1')

  // Look up the live Stripe price ID from the SKU row.
  const { data: sku, error: skuErr } = await supabaseAdmin
    .from('skus')
    .select('stripe_price_id')
    .eq('id', offer.skuId!)
    .single()
  if (skuErr || !sku?.stripe_price_id) {
    throw new Error(`sku_lookup_failed: ${offer.skuId} ${skuErr?.message ?? 'no stripe_price_id'}`)
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price: sku.stripe_price_id,
      quantity: 1,
    }],
    success_url: success,
    cancel_url: cancel,
    metadata: {
      kind: 'portfolio',
      series: args.series,
      userId: args.userId,
      count: String(offer.count),
      skuId: offer.skuId!,
    },
  })
  if (!session.url) throw new Error('stripe_session_missing_url')

  const { data: purchaseRow, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id: args.userId,
      guest_email: null,
      sku_id: offer.skuId,
      stripe_session_id: session.id,
      amount_cents: serverCents,
      status: 'pending',
    })
    .select()
    .single()
  if (purchaseErr) throw new Error(`purchase_insert_failed: ${purchaseErr.message}`)
  const purchaseId: string = purchaseRow.id

  const { data: portfolioRow, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .insert({
      purchase_id: purchaseId,
      user_id: args.userId,
      series: args.series,
      size: offer.count,
      status: 'pending',
      free_unlocks: offer.includedUnlocks,
      source_image: args.sourceImageRef,
      /* The one place a size becomes a kind. Everything downstream reads
         this column instead of counting items. */
      delivery: offer.delivery,
      pose: args.pose ?? null,
      framing: framingForAspect(args.aspectRatio),
      subject: args.subject ?? null,
    })
    .select()
    .single()
  if (portfolioErr) throw new Error(`portfolio_insert_failed: ${portfolioErr.message}`)
  const portfolioId: string = portfolioRow.id

  const itemRows = args.selectedEffectIds.map((effectId, slot) => ({
    portfolio_id: portfolioId,
    slot,
    preset: effectId,
    status: 'pending',
  }))
  const { error: itemErr } = await supabaseAdmin.from('portfolio_items').insert(itemRows)
  if (itemErr) throw new Error(`portfolio_item_insert_failed: ${itemErr.message}`)

  console.log(
    `[createPortfolioCheckout] ${args.series} ${offer.count}pc sku=${offer.skuId} ` +
    `delivery=${offer.delivery} framing=${framingForAspect(args.aspectRatio)} ` +
    `pose=${args.pose ?? 'none'} portfolio=${portfolioId}`,
  )
  return { checkoutUrl: session.url, purchaseId, portfolioId }
}

export async function activatePortfolio(purchaseId: string): Promise<void> {
  const { data: portfolio, error: portfolioErr } = await supabaseAdmin
    .from('portfolios')
    .select('id, user_id, series, size, free_unlocks, source_image, status')
    .eq('purchase_id', purchaseId)
    .maybeSingle()
  if (portfolioErr) throw new Error(`portfolio_activate_read_failed: ${portfolioErr.message}`)
  if (!portfolio) return
  if (portfolio.status !== 'pending') return

  const entitlementRows = Array.from({ length: portfolio.free_unlocks }, () => ({
    purchase_id: purchaseId,
    user_id: portfolio.user_id,
    guest_email: null,
    locked_style: null,
    locked_variant: null,
    status: 'available',
  }))
  if (entitlementRows.length > 0) {
    const { error: entErr } = await supabaseAdmin.from('entitlements').insert(entitlementRows)
    if (entErr) throw new Error(`portfolio_entitlement_insert_failed: ${entErr.message}`)
  }

  const { error: flipErr } = await supabaseAdmin
    .from('portfolios')
    .update({ status: 'generating' })
    .eq('id', portfolio.id)
  if (flipErr) throw new Error(`portfolio_activate_flip_failed: ${flipErr.message}`)

  /* ACTIVATION SETS STATE. IT DOES NOT SCHEDULE.
     A per-item dispatch loop used to sit here, firing one unawaited POST per
     item from inside the Stripe webhook. It had stopped working twice over:
     items/render is secret-gated and the loop sent no Authorization, so every
     request answered 401 — and a 401 is a response rather than a throw, so
     the .catch() never fired and nothing was logged. Underneath that, the
     webhook has no maxDuration and may be frozen once its response is sent,
     so requests it does not await are not requests that get made.

     It is removed rather than repaired. The authenticated client dispatch
     route (/portfolios/[portfolioId]/dispatch) is the primary scheduler and
     the cron poller is recovery; giving this its Authorization header back
     would make a second primary scheduler out of the least reliable caller in
     the system. Anything the client misses is what cron is for.

     'generating' is the whole contract: it is what dispatch and the poller
     both select on, and it is the proof the purchase was confirmed. */
  console.log(`[activatePortfolio] portfolio=${portfolio.id} activated`)
}
