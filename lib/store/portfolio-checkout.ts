// lib/store/portfolio-checkout.ts
// Renamed from basket-checkout.ts. Portfolio purchase is dynamic-count
// pricing (resolveSelectionOffer), not a fixed-size SKU. Matches
// CENG_DISCOVERY_ENGINE_SPEC.md section 6.

import { getStripe, getAppUrl } from './stripe'
import { supabaseAdmin } from '@/lib/supabase'
import crypto from 'crypto'

export type PortfolioSeries = 'portraits' | 'halloween' | 'groups' | 'pets'

export type Tier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' | 'complete'

export interface SelectionOffer {
  count: number
  tier: Tier | null
  priceUsd: number
  nextThreshold: number | null
  capacityAtCurrentPrice: number
  remainingAtCurrentPrice: number
  includedUnlocks: number
}

// Table from LITEN_DISCOVERY_PRODUCT_SPEC.md section 8/9. Single source
// of truth - change here, nowhere else.
const TIERS: Array<{ min: number; max: number; tier: Tier; priceUsd: number; unlocks: number }> = [
  { min: 1,  max: 4,  tier: 'tier_1',  priceUsd: 2.99,  unlocks: 0 },
  { min: 5,  max: 9,  tier: 'tier_2',  priceUsd: 4.99,  unlocks: 1 },
  { min: 10, max: 19, tier: 'tier_3',  priceUsd: 7.99,  unlocks: 1 },
  { min: 20, max: 39, tier: 'tier_4',  priceUsd: 12.99, unlocks: 2 },
  { min: 40, max: 56, tier: 'complete', priceUsd: 24.99, unlocks: 3 },
]

export function resolveSelectionOffer(count: number): SelectionOffer {
  if (count <= 0) {
    return {
      count, tier: null, priceUsd: 0, nextThreshold: 1,
      capacityAtCurrentPrice: 0, remainingAtCurrentPrice: 0, includedUnlocks: 0,
    }
  }
  const row = TIERS.find((t) => count >= t.min && count <= t.max) ?? TIERS[TIERS.length - 1]
  const idx = TIERS.indexOf(row)
  const next = TIERS[idx + 1]
  return {
    count,
    tier: row.tier,
    priceUsd: row.priceUsd,
    nextThreshold: next ? next.min : null,
    capacityAtCurrentPrice: row.max,
    remainingAtCurrentPrice: Math.max(0, row.max - count),
    includedUnlocks: row.unlocks,
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
  if (args.selectedEffectIds.length > 56) throw new Error('portfolio_over_capacity')
  if (!args.sourceImageRef) throw new Error('portfolio_source_image_required')

  const offer = resolveSelectionOffer(args.selectedEffectIds.length)
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

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{
      price_data: {
        currency: 'usd',
        unit_amount: serverCents,
        product_data: { name: `Create My Collection - ${offer.count} effects` },
      },
      quantity: 1,
    }],
    success_url: success,
    cancel_url: cancel,
    metadata: {
      kind: 'portfolio',
      series: args.series,
      userId: args.userId,
      count: String(offer.count),
      tier: offer.tier ?? '',
    },
  })
  if (!session.url) throw new Error('stripe_session_missing_url')

  const { data: purchaseRow, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id: args.userId,
      guest_email: null,
      sku_id: null,
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

  console.log(`[createPortfolioCheckout] ${args.series} ${offer.count}pc tier=${offer.tier} portfolio=${portfolioId}`)
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
