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
//
// ── createCartCheckout (preview-first cart/unlock) ───────────────
// The Portraits workshop runs a preview-then-unlock model, NOT
// pay-then-generate. createCartCheckout serves that path: dynamic
// ladder pricing, a server-authoritative total (the client total is
// never trusted), one entitlement per cart piece, and NO optimistic
// generation kickoff — the preview already exists; payment unlocks the
// clean file. confirmPurchase needs no change: it fulfils by flipping
// the purchase to 'paid' and the per-piece entitlements are already in
// place. Binding an unlocked entitlement to its clean file (keyed by
// preview id) is item 2's redemption side.

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
  // The signed-in customer's email, for the piece label the shelf generates.
  userEmail?:      string | null
  /* One pose, one shape — the same block the portfolio path stores on the
     portfolio row (portfolio-checkout.ts PortfolioComposition). A single has
     no portfolio to hang it on, so it travels straight to the kickoff. */
  composition?: {
    pose?:         string
    aspect_ratio?: string
    subject?:      string | null
    framing?:      string
    scale?:        string
  }
  // Return URL after Stripe — mirrors cart/portfolio pattern.
  returnUrl?:      string
}

export interface CreateCheckoutResult {
  clientSecret:   string
  publishableKey: string
  sessionId:      string
  purchaseId:     string
  jobId?:         string  // present only for singles once optimistic kickoff is wired
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
  const base   = safeReturnBase(args.returnUrl, appUrl)
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode:        'payment',
    ui_mode:     'embedded',
    line_items:  [{ price: sku.stripePriceId, quantity: 1 }],
    return_url:  appendQuery(base, 'paid=1&session_id={CHECKOUT_SESSION_ID}'),
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

  if (!session.client_secret) throw new Error('stripe_session_missing_secret')

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
        userId:         args.userId,
        guestEmail:     args.guestEmail,
        userEmail:      args.userEmail ?? null,
        composition:    args.composition,
      }).catch((err) => {
        console.error('[createCheckout] kickoff.start threw', err)
      })
    } else {
      console.warn('[createCheckout] reserveEntitlement not_available — skipping kickoff')
      jobId = undefined
    }
  }

  return {
    clientSecret:   session.client_secret!,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
    sessionId:      session.id,
    purchaseId,
    jobId,
  }
}

// ═══════════════════════════════════════════════════════════════
//  Cart / unlock checkout (preview-first commercial model)
// ═══════════════════════════════════════════════════════════════

export type CartResolution = '1k' | '2k' | '4k'

export interface CartPiece {
  id?:        number | string
  preset:     string
  resolution: CartResolution
}

export interface CreateCartCheckoutArgs {
  skuId:            string                 // 'portrait_pieces_cart' | 'portrait_unlock_web'
  userId?:          string
  guestEmail?:      string
  kind:             'pieces' | 'unlock'
  pieces:           CartPiece[]
  clientTotalCents: number                 // validated against the server total
  returnUrl:        string                 // success → ?paid=1, cancel → ?canceled=1
}

export interface CreateCartCheckoutResult {
  clientSecret:   string
  publishableKey: string
  sessionId:      string
  purchaseId:     string
}

// Volume ladder: per-piece unit price chosen by TOTAL piece count.
const VOLUME_LADDER: ReadonlyArray<{ min: number; cents: number }> = [
  { min: 10, cents: 279 },
  { min: 5,  cents: 299 },
  { min: 2,  cents: 339 },
  { min: 1,  cents: 399 },
]

// Quality upcharge by resolution. Web (1k) is included.
// ⚠ PLACEHOLDER amounts — Rich has not set Print / Collector pricing.
//    This is the single source of truth; change here and both the line
//    item and the server price-check move together.
const QUALITY_UPCHARGE_CENTS: Record<CartResolution, number> = {
  '1k': 0,
  '2k': 200, // PLACEHOLDER
  '4k': 500, // PLACEHOLDER
}

const MAX_CART_PIECES = 50

function unitCentsForCount(count: number): number {
  for (const tier of VOLUME_LADDER) if (count >= tier.min) return tier.cents
  return 399
}

function qualityLabel(res: CartResolution): string {
  return res === '4k' ? 'Collector Print Quality'
       : res === '2k' ? 'Print Quality'
       :                'Web Quality'
}

function presetLabel(preset: string): string {
  return preset.charAt(0).toUpperCase() + preset.slice(1)
}

// Same-origin return URL only (prevents redirecting to arbitrary hosts).
// Existing query/hash is stripped; we append our own status params.
function safeReturnBase(returnUrl: string | undefined, appUrl: string): string {
  if (!returnUrl) return `${appUrl}/portraits`
  try {
    const u   = new URL(returnUrl)
    const app = new URL(appUrl)
    if (u.origin !== app.origin) return `${appUrl}/portraits`
    return `${u.origin}${u.pathname}`
  } catch {
    return `${appUrl}/portraits`
  }
}

function appendQuery(url: string, query: string): string {
  return url.includes('?') ? `${url}&${query}` : `${url}?${query}`
}

export async function createCartCheckout(
  args: CreateCartCheckoutArgs,
): Promise<CreateCartCheckoutResult> {
  // ── Identity ─────────────────────────────────────────────────
  if (!args.userId && !args.guestEmail) throw new Error('cart_identity_required')

  // ── Validate the cart ────────────────────────────────────────
  const pieces = args.pieces
  if (!Array.isArray(pieces) || pieces.length === 0) throw new Error('cart_empty')
  if (pieces.length > MAX_CART_PIECES)               throw new Error('cart_too_large')
  for (const p of pieces) {
    if (!p || typeof p.preset !== 'string' || !p.preset) throw new Error('cart_invalid_piece')
    if (!(p.resolution in QUALITY_UPCHARGE_CENTS))       throw new Error('cart_invalid_resolution')
  }

  // ── Server-authoritative total (never trust the client) ──────
  const unit        = unitCentsForCount(pieces.length)
  const lineAmounts = pieces.map((p) => unit + QUALITY_UPCHARGE_CENTS[p.resolution])
  const serverTotal = lineAmounts.reduce((a, b) => a + b, 0)

  if (!Number.isInteger(args.clientTotalCents) || args.clientTotalCents !== serverTotal) {
    throw new Error(`price_mismatch: client=${args.clientTotalCents} server=${serverTotal}`)
  }

  // ── Return URL ──────────────────────────────────────────────
  const appUrl  = getAppUrl()
  const base    = safeReturnBase(args.returnUrl, appUrl)

  // ── Stripe session (dynamic price_data per piece) ────────────
  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    ui_mode: 'embedded',
    line_items: pieces.map((p, i) => ({
      price_data: {
        currency:     'usd',
        unit_amount:  lineAmounts[i],
        product_data: { name: `Crafted Portrait — ${presetLabel(p.preset)} · ${qualityLabel(p.resolution)}` },
      },
      quantity: 1,
    })),
    return_url:     appendQuery(base, 'paid=1&session_id={CHECKOUT_SESSION_ID}'),
    customer_email: args.guestEmail && !args.userId ? args.guestEmail : undefined,
    metadata: {
      skuId:      args.skuId,
      cartKind:   args.kind,
      pieceCount: String(pieces.length),
      userId:     args.userId     ?? '',
      guestEmail: args.guestEmail ?? '',
    },
  })
  if (!session.client_secret) throw new Error('stripe_session_missing_secret')

  // ── Purchase row ─────────────────────────────────────────────
  // sku_id is a NOT NULL FK to skus(id); the two cart SKUs are seeded
  // (inactive) purely to satisfy it. amount_cents is the server total.
  const { data: purchaseRow, error: purchaseErr } = await supabaseAdmin
    .from('purchases')
    .insert({
      user_id:           args.userId     ?? null,
      guest_email:       args.guestEmail ?? null,
      sku_id:            args.skuId,
      stripe_session_id: session.id,
      amount_cents:      serverTotal,
      status:            'pending',
    })
    .select()
    .single()
  if (purchaseErr) throw new Error(`purchase_insert_failed: ${purchaseErr.message}`)
  const purchaseId: string = purchaseRow.id

  // ── Entitlement rows — one per cart piece ────────────────────
  // These are paid UNLOCK tokens, not generation credits: no kickoff,
  // no reserveEntitlement. locked_style=preset, locked_variant=resolution
  // so item 2's redeemer can match an available unlock to the previewed
  // piece (precise preview-id binding lives in item 2).
  const entitlementRows = pieces.map((p) => ({
    purchase_id:    purchaseId,
    user_id:        args.userId     ?? null,
    guest_email:    args.guestEmail ?? null,
    locked_style:   p.preset,
    locked_variant: p.resolution,
    status:         'available',
  }))
  const { error: entErr } = await supabaseAdmin
    .from('entitlements')
    .insert(entitlementRows)
  if (entErr) throw new Error(`entitlement_insert_failed: ${entErr.message}`)

  console.log(
    `[createCartCheckout] ${args.kind} ${pieces.length}pc total=${serverTotal}c purchase=${purchaseId}`,
  )
  return {
    clientSecret:   session.client_secret!,
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY || '',
    sessionId:      session.id,
    purchaseId,
  }
}
