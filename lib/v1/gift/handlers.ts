// lib/v1/gift/handlers.ts
//
// The HTTP layer of the Gift Wizard API, kept out of the route files so it is tested with injected dependencies.
// Every handler needs a signed-in user; every response is no-store; errors are the stable codes in types.ts.

import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { createSession, createSessionFromCollection, deleteSessionNow, getBatchView, getSessionView, purgeExpired, restoreSession, retryBatch, setLines, startBatch, GiftError, type GiftDeps } from './service'
import { PackError, createPackCheckout, fulfillPack, packReturnUrl } from './pack'
import { PACK_PRICE_CENTS } from './policy'
import { createGiftCheckout, confirmGiftOrder, type GiftOrderDeps } from './orders'
import { approveComposition, finalizeOrder, correctLine, ensureCompositions, selectArtwork } from './compose'
import { requestRefund, type ConciergePort } from './refund'
import { getLineMockup } from './mockup'
import { getProductPreview } from './product-preview'
import { getProductAvailability } from './availability'
import { acceptGeneration, chooseEffect, getGeneration, listGenerations, startGeneration } from './generations'

const NO_STORE = { 'Cache-Control': 'no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: NO_STORE })
export type Authed = { id: string }

export function fail(e: unknown): NextResponse {
  if (e instanceof GiftError) {
    return json(e.code === 'payment_required' ? { error: e.code, amountCents: PACK_PRICE_CENTS, currency: 'USD' } : { error: e.code, ...(e.details ?? {}) }, e.status)
  }
  if (e instanceof PackError) return json({ error: e.code }, e.code === 'invalid_return_path' ? 400 : e.code === 'pack_purchase_not_found' ? 404 : e.code === 'pack_payment_mismatch' ? 409 : 503)
  console.error('[gift] unexpected failure:', e instanceof Error ? e.message : e)
  return json({ error: 'gift_unavailable' }, 500)
}
export const signInRequired = () => json({ error: 'sign_in_required' }, 401)
const body = async (req: Request) => { try { return await req.json() } catch { return null } }

export async function createSessionH(req: Request, user: Authed, deps: GiftDeps) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await createSession(deps, { userId: user.id, imageB64: b.image_b64 }), 201) } catch (e) { return fail(e) }
}
/** POST /api/v1/gift/sessions/from-collection { previewId } -> 201 SessionView (new) or 200 SessionView (the same piece again: the same live session). Contract: lib/v1/gift/types.ts (entrance, collection). */
export async function createCollectionSessionH(req: Request, user: Authed, deps: GiftDeps) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { const r = await createSessionFromCollection(deps, { userId: user.id, previewId: b.previewId }); return json(r.view, r.created ? 201 : 200) } catch (e) { return fail(e) }
}
export async function restoreSessionH(user: Authed, deps: GiftDeps) {
  try { return json(await restoreSession(deps, user.id)) } catch (e) { return fail(e) }
}
export async function getSessionH(user: Authed, deps: GiftDeps, id: string) {
  try { return json(await getSessionView(deps, user.id, id)) } catch (e) { return fail(e) }
}
export async function setLinesH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await setLines(deps, user.id, id, b.lines)) } catch (e) { return fail(e) }
}
export async function startBatchH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try {
    const out = await startBatch(deps, user.id, id, { idempotencyKey: b.idempotencyKey, effectIds: b.effectIds })
    return json(out.complete ? { status: 'ok', batch: out.batch, session: out.session } : { status: 'partial', batch: out.batch, session: out.session, retryAfterSeconds: 5 }, out.complete ? 200 : 202)
  } catch (e) { return fail(e) }
}
export async function getBatchH(user: Authed, deps: GiftDeps, id: string, n: string) {
  try { return json(await getBatchView(deps, user.id, id, Number(n))) } catch (e) { return fail(e) }
}
export async function retryBatchH(user: Authed, deps: GiftDeps, id: string, n: string) {
  try {
    const out = await retryBatch(deps, user.id, id, Number(n))
    return json(out.complete ? { status: 'ok', batch: out.batch, session: out.session } : { status: 'partial', batch: out.batch, session: out.session, retryAfterSeconds: 5 }, out.complete ? 200 : 202)
  } catch (e) { return fail(e) }
}
export async function deleteSessionH(user: Authed, deps: GiftDeps, id: string) {
  try { await deleteSessionNow(deps, user.id, id); return new NextResponse(null, { status: 204, headers: NO_STORE }) } catch (e) { return fail(e) }
}
export async function packCheckoutH(req: Request, user: Authed, stripe: Stripe, publishableKey: string | undefined) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try {
    if (!publishableKey) throw new PackError('pack_payment_unavailable')
    const out = await createPackCheckout(stripe, user.id, packReturnUrl(new URL(req.url).origin, b.returnPath))
    return json({ ...out, publishableKey })
  } catch (e) { return fail(e) }
}
export async function packConfirmH(req: Request, user: Authed, deps: { stripe: Stripe; store: GiftDeps['store'] }) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await fulfillPack(deps, b.stripeSessionId, user.id)) } catch (e) { return fail(e) }
}
export async function cleanupH(deps: GiftDeps) {
  try { return json(await purgeExpired(deps)) } catch (e) { return fail(e) }
}

// ── purchase before generation ─────────────────────────────────────────

export async function checkoutH(req: Request, user: Authed, deps: GiftOrderDeps & { gift: GiftDeps }, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await createGiftCheckout(deps, { user, sessionId: id, origin: new URL(req.url).origin, body: b })) } catch (e) { return fail(e) }
}
export async function orderConfirmH(req: Request, user: Authed, deps: { stripe: Stripe; store: GiftDeps['store'] }, gift: GiftDeps) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try {
    const out = await confirmGiftOrder(deps, b.stripeSessionId, user.id)
    return json({ confirmed: out.confirmed, ...(out.sessionId ? { session: await getSessionView(gift, user.id, out.sessionId) } : {}) })
  } catch (e) { return fail(e) }
}
export async function selectArtworkH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await selectArtwork(deps, user.id, id, b.previewId)) } catch (e) { return fail(e) }
}
export async function compositionsH(user: Authed, deps: GiftDeps, id: string) {
  try { return json(await ensureCompositions(deps, user.id, id)) } catch (e) { return fail(e) }
}
export async function correctH(user: Authed, deps: GiftDeps, id: string, lineId: string) {
  try { return json(await correctLine(deps, user.id, id, lineId)) } catch (e) { return fail(e) }
}
export async function approveCompositionH(user: Authed, deps: GiftDeps, id: string, compositionId: string) {
  try { return json(await approveComposition(deps, user.id, id, compositionId)) } catch (e) { return fail(e) }
}
/** POST /api/v1/gift/sessions/{id}/finalize -> SessionView. The customer's final approval ONLY; never manufacturing (see finalizeOrder / releaseOrder in compose.ts). */
export async function finalizeOrderH(user: Authed, deps: GiftDeps, id: string) {
  try { return json(await finalizeOrder(deps, user.id, id)) } catch (e) { return fail(e) }
}
/** POST /api/v1/gift/sessions/{id}/approve: kept for clients written before the split. It is now the SAME approval-only operation as /finalize, so no customer request can release an order. */
export const approveOrderH = finalizeOrderH
export async function refundRequestH(req: Request, user: Authed, deps: GiftDeps & { concierge: ConciergePort }, id: string) {
  const b = (await body(req)) ?? {}
  try { return json(await requestRefund(deps, user.id, id, b.reason), 201) } catch (e) { return fail(e) }
}

// GET /api/v1/gift/sessions/{id}/lines/{lineId}/mockup?compositionId=...  (see MockupView in types.ts)
/** GET /api/v1/gift/sessions/{id}/availability -> AvailabilityView: per product, purchasable / adaptation / preview / approval basis for this session's artwork (lib/v1/gift/availability.ts). */
export async function availabilityH(user: Authed, deps: GiftDeps, id: string) {
  try { return json(await getProductAvailability(deps, user.id, id)) } catch (e) { return fail(e) }
}
export async function productPreviewH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  try { return json(await getProductPreview(deps, user.id, id, new URL(req.url).searchParams.get('productId'), { provisional: new URL(req.url).searchParams.get('provisional') === '1', generationId: new URL(req.url).searchParams.get('generationId'), frameColor: new URL(req.url).searchParams.get('frameColor') })) } catch (e) { return fail(e) }
}
export async function mockupH(req: Request, user: Authed, deps: GiftDeps, id: string, lineId: string) {
  try { return json(await getLineMockup(deps, user.id, id, lineId, new URL(req.url).searchParams.get('compositionId') ?? undefined)) } catch (e) { return fail(e) }
}

// ── product-first generations (migration 059). Contract: lib/v1/gift/types.ts (GenerationView, GenerationsView) and docs/GOVERNANCE/GIFT-GENERATION-CONTRACT-*.md ──
/** POST /api/v1/gift/sessions/{id}/effect { effectId } -> SessionView. Chooses (or changes) the ONE effect. */
export async function chooseEffectH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { return json(await chooseEffect(deps, user.id, id, b.effectId)) } catch (e) { return fail(e) }
}
/** POST /api/v1/gift/sessions/{id}/generations { productId, idempotencyKey, mode? } -> 200 { status:'ok' } when delivered, 202 { status:'partial' } while in progress (poll or repeat the same key). */
export async function startGenerationH(req: Request, user: Authed, deps: GiftDeps, id: string) {
  const b = await body(req); if (!b) return json({ error: 'invalid_json' }, 400)
  try { const out = await startGeneration(deps, user.id, id, { productId: b.productId, idempotencyKey: b.idempotencyKey, mode: b.mode, composition: b.composition }); return json(out, out.status === 'ok' ? 200 : 202) } catch (e) { return fail(e) }
}
export async function listGenerationsH(user: Authed, deps: GiftDeps, id: string) {
  try { return json(await listGenerations(deps, user.id, id)) } catch (e) { return fail(e) }
}
export async function getGenerationH(user: Authed, deps: GiftDeps, id: string, gid: string) {
  try { return json(await getGeneration(deps, user.id, id, gid)) } catch (e) { return fail(e) }
}
/** POST /api/v1/gift/sessions/{id}/generations/{gid}/accept -> { generation, session }. Accepting is the pre-checkout approval of that exact picture. */
export async function acceptGenerationH(user: Authed, deps: GiftDeps, id: string, gid: string) {
  try { return json(await acceptGeneration(deps, user.id, id, gid)) } catch (e) { return fail(e) }
}
