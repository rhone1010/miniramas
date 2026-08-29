// lib/store/portfolio-checkout.ts
// Fixed-size Portfolio pricing. Reuses the four live Stripe SKUs
// (single, basket_discover_5, basket_discover_10, basket_discover_20)
// with updated effect counts: 1, 4, 8, 16.
//
// Hard cap: 16 effects max per purchase this release.
// Checkout requires selectedEffectIds.length to exactly match one of
// {1, 4, 8, 16} — no rounding, no padding. CUI/Curator fills any
// remainder before checkout fires.
//
// resolveSelectionOffer works for ANY count (used during browsing to
// show tier context). Only createPortfolioCheckout rejects non-exact.

import { getStripe, getAppUrl } from './stripe'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export type PortfolioSeries = 'portraits' | 'halloween' | 'groups' | 'pets'

export type Tier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4'

export interface SelectionOffer {
  count: number
  tier: Tier | null
  skuId: string | null
  priceUsd: number
  includedUnlocks: number
}

// Fixed purchase sizes, mapped to live SKU rows.
// Stripe prices are unchanged — only the count column was updated.
const PORTFOLIO_SIZES: Array<{
  count: number; tier: Tier; skuId: string; priceCents: number; unlocks: number
}> = [
  { count: 1,  tier: 'tier_1', skuId: 'single',             priceCents: 299,  unlocks: 0 },
  { count: 4,  tier: 'tier_2', skuId: 'basket_discover_5',   priceCents: 499,  unlocks: 1 },
  { count: 8,  tier: 'tier_3', skuId: 'basket_discover_10',  priceCents: 799,  unlocks: 1 },
  { count: 16, tier: 'tier_4', skuId: 'basket_discover_20',  priceCents: 1299, unlocks: 2 },
]

const VALID_COUNTS = new Set(PORTFOLIO_SIZES.map((s) => s.count))

/**
 * Returns the offer for a given selection count. Works for any count
 * (browsing context). For counts between fixed sizes, returns the tier
 * the user would reach if they filled up to the next size. For count 0,
 * returns a null-tier empty offer.
 */
export function resolveSelectionOffer(count: number): SelectionOffer {
  if (count <= 0) {
    return { count, tier: null, skuId: null, priceUsd: 0, includedUnlocks: 0 }
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
  }
}

export interface CreatePortfolioCheckoutArgs {
  userId: string
  series: PortfolioSeries
  selectedEffectIds: string[]
  sourceImageRef: string
  returnUrl: string
  clientPriceUsd: number // never trusted, checked against server resolve
}

export interface CreatePortfolioCheckoutResult {
  checkoutUrl: string
  purchaseId: string
  portfolioId: string
}

function safeReturnBase(returnUrl: string | undefined, appUrl: string): string {
  if (!returnUrl) return `${appUrl}/collections`
  try {
    const u = new URL(returnUrl)
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

  console.log(`[createPortfolioCheckout] ${args.series} ${offer.count}pc sku=${offer.skuId} portfolio=${portfolioId}`)
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

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('portfolio_items')
    .select('id, slot, preset')
    .eq('portfolio_id', portfolio.id)
  if (itemsErr) throw new Error(`portfolio_items_read_failed: ${itemsErr.message}`)

  const appUrl = getAppUrl()
  for (const item of items ?? []) {
    fetch(`${appUrl}/api/v1/portfolios/items/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioItemId: item.id }),
    }).catch((err) => {
      console.error(`[activatePortfolio] render fetch failed for item ${item.id}`, err)
    })
  }

  console.log(`[activatePortfolio] portfolio=${portfolio.id} fired ${items?.length ?? 0} jobs`)
}
