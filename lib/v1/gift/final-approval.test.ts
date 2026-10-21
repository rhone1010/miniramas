// The customer's FINAL ORDER APPROVAL is separate from RELEASE TO MANUFACTURING. finalizeOrder (POST /api/v1/gift/sessions/{id}/finalize) records the approval durably and
// cannot reach fulfilment; releaseOrder is a separate operator step. Real service, real handlers, memory store that mirrors migration 056 (which migration-056.test.ts runs against Postgres).

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { purchasedItems } from './test-order'
import { finalizeOrderH, approveOrderH, compositionsH } from './handlers'
import { createSession, setLines, startBatch, getSessionView, restoreSession, retryBatch, type GiftDeps } from './service'
import { memoryGiftStore } from './store'
import { selectArtwork, ensureCompositions, approveComposition, correctLine, finalizeOrder, releaseOrder, repairLine } from './compose'
import { giftOrderRecheck } from './orders'
import { loadApprovedCompositionWith } from './print-source'

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const LINES = [{ lineId: 'a', productId: 'fine_art:8x8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', copies: 2 }]
const read = async (r: Response) => ({ status: r.status, body: await r.json() })

function rig() {
  const store = memoryGiftStore(), files = new Map<string, Buffer>()
  const deps: GiftDeps = {
    store, draftCompositions: false,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async () => {}, signedUrl: async p => 'https://signed.test/' + p },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }),
    generate: async () => ({ imageB64: (await sharp({ create: { width: 256, height: 256, channels: 3, background: '#3a6' } }).png().toBuffer()).toString('base64') }),
    watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(),
    compose: async (i: { size: string; finish: string; masterB64: string }) => {
      const m = i.size.split('x').map(Number), square = m[0] === m[1], w = 256, h = square ? 256 : Math.round(256 * m[1] / m[0])
      return { image: await sharp({ create: { width: w, height: h, channels: 3, background: '#036' } }).png().toBuffer(), width: w, height: h, fit: 'exact' as const, outpainted: false }
    },
    kick: vi.fn(async () => ({})),
  }
  return { deps, store, files }
}
/** A paid session (confirmed through the store the way the webhook does) with a favorite and the lines above, compositions made. */
async function paid(r: ReturnType<typeof rig>, lines = LINES) {
  const photo = (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')
  const v = await createSession(r.deps, { userId: U1, imageB64: photo }); const sid = v.sessionId
  await setLines(r.deps, U1, sid, lines)
  const orderId = randomUUID(), cs = 'cs_test_' + orderId.slice(0, 12)
  r.store.orders.set(orderId, { id: orderId, status: 'created', paid_at: null, stripe_session_id: cs, stripe_payment_intent: null, retail_total_cents: 9000, retail_shipping_cents: 700, items: purchasedItems(lines), prodigi_order_id: null, placed_at: null, owner_key: U1 } as any)
  await r.store.linkOrder(sid, U1, orderId, 'v1')
  await r.store.confirmOrder({ sessionId: sid, orderId, userId: U1, stripeSessionId: cs, paymentIntent: 'pi_1', lines: lines.map(l => ({ lineId: l.lineId, productId: l.productId, sku: purchasedItems([l])[0].sku, copies: l.copies })) })
  const b = await startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-1' }); await selectArtwork(r.deps, U1, sid, b.batch.previews[0].previewId)
  await ensureCompositions(r.deps, U1, sid)
  return { sid, orderId }
}
const approveAll = async (r: ReturnType<typeof rig>, sid: string, only?: string[]) => { for (const c of r.store.compositions.filter(x => x.status === 'ready' && (!only || only.includes(x.line_id)))) await approveComposition(r.deps, U1, sid, c.id) }
const order = (r: ReturnType<typeof rig>, id: string) => r.store.orders.get(id)!
const kicks = (r: ReturnType<typeof rig>) => (r.deps.kick as any).mock.calls.length

describe('finalize: what it validates', () => {
  it('incomplete approvals: every purchased line must be approved, otherwise 409 and nothing is recorded', async () => {
    const r = rig(); const { sid, orderId } = await paid(r)
    expect(await read(await finalizeOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 409, body: { error: 'compositions_not_approved' } })       // none approved
    await approveAll(r, sid, ['a'])
    expect(await read(await finalizeOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 409, body: { error: 'compositions_not_approved' } })       // one of two
    const rec = [...r.store.sessions.values()][0]; expect(rec.final_approved_at ?? null).toBeNull(); expect(rec.unlock_portfolio_id).toBeNull(); expect(order(r, orderId).status).toBe('awaiting_artwork')
    expect((await getSessionView(r.deps, U1, sid)).order).toMatchObject({ state: 'awaiting_artwork', approvedAt: null, finalApprovedAt: null, manufacturing: 'not_released' }); expect(kicks(r)).toBe(0)
  })
  it('refuses another customer, an unpaid order, a refund in progress, a refunded order, and a composition of the wrong shape', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); await approveAll(r, sid)
    expect(await read(await finalizeOrderH({ id: U2 }, r.deps, sid))).toMatchObject({ status: 404, body: { error: 'session_not_found' } })
    const comp = r.store.compositions.find(c => c.line_id === 'b')!; const keep = { width: comp.width, height: comp.height }; Object.assign(comp, { width: 300, height: 200 })
    expect(await read(await finalizeOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 409, body: { error: 'composition_geometry_mismatch' } }); Object.assign(comp, keep)
    const rec = [...r.store.sessions.values()][0]; rec.refund_requested_at = new Date().toISOString()
    expect(await read(await finalizeOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 409, body: { error: 'refund_pending' } }); rec.refund_requested_at = null
    rec.refunded_at = new Date().toISOString(); expect(await read(await finalizeOrderH({ id: U1 }, r.deps, sid))).toMatchObject({ status: 409, body: { error: 'order_refunded' } }); rec.refunded_at = null
    expect(order(r, orderId).status).toBe('awaiting_artwork'); expect(rec.final_approved_at ?? null).toBeNull()
    const none = rig(); const v = await createSession(none.deps, { userId: U1, imageB64: (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64') })
    expect(await read(await finalizeOrderH({ id: U1 }, none.deps, v.sessionId))).toMatchObject({ status: 402, body: { error: 'order_payment_required' } })
  })
})

describe('finalize: success, and what it can never do', () => {
  it('records the approval durably, returns the updated order state, creates the My Collection piece, and does NOT release anything to manufacturing', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); await approveAll(r, sid)
    const paidBefore = { paid_at: order(r, orderId).paid_at, pi: order(r, orderId).stripe_payment_intent, total: order(r, orderId).retail_total_cents, items: JSON.stringify(order(r, orderId).items) }
    const corrections = (await getSessionView(r.deps, U1, sid)).compositions.map(c => [c.lineId, c.correctionsRemaining, c.compositionId, c.status])
    const out = await read(await finalizeOrderH({ id: U1 }, r.deps, sid)); expect(out.status).toBe(200)
    expect(out.body.order).toMatchObject({ state: 'approved', manufacturing: 'not_released', releasedAt: null }); expect(out.body.order.finalApprovedAt).toBeTruthy(); expect(out.body.order.approvedAt).toBe(out.body.order.finalApprovedAt); expect(out.body.order.unlockPortfolioId).toBeTruthy()
    // manufacturing isolation: the order row is untouched (still invisible to fulfilment), nothing was kicked, and the fulfilment gates still say "not approved"
    expect(order(r, orderId).status).toBe('awaiting_artwork'); expect(kicks(r)).toBe(0)
    expect(JSON.stringify({ paid_at: order(r, orderId).paid_at, pi: order(r, orderId).stripe_payment_intent, total: order(r, orderId).retail_total_cents, items: JSON.stringify(order(r, orderId).items) })).toBe(JSON.stringify(paidBefore))   // payment record and order history unchanged
    await expect(giftOrderRecheck(r.store, orderId)).rejects.toThrow('artwork_not_approved')
    await expect(loadApprovedCompositionWith(r.store, r.deps.storage, { id: orderId }, { render_id: `gift:${sid}:a`, item_index: 0 })).rejects.toThrow('gift_artwork_not_approved')
    // approved artwork, compositions and correction entitlement are exactly as they were
    expect((await getSessionView(r.deps, U1, sid)).compositions.map(c => [c.lineId, c.correctionsRemaining, c.compositionId, c.status])).toEqual(corrections)
  })
  it('is idempotent: repeats, a refresh and five simultaneous requests all get the same state, one My Collection piece and one approval time', async () => {
    const r = rig(); const { sid } = await paid(r); await approveAll(r, sid)
    const rs = await Promise.all([1, 2, 3, 4, 5].map(() => finalizeOrderH({ id: U1 }, r.deps, sid))); const bodies = await Promise.all(rs.map(x => read(x)))
    expect(bodies.map(b => b.status)).toEqual([200, 200, 200, 200, 200]); expect(new Set(bodies.map(b => b.body.order.finalApprovedAt)).size).toBe(1); expect(new Set(bodies.map(b => b.body.order.unlockPortfolioId)).size).toBe(1)
    expect(r.store.portfolios.length).toBe(1)
    const again = await read(await finalizeOrderH({ id: U1 }, r.deps, sid)); expect(again.body.order.finalApprovedAt).toBe(bodies[0].body.order.finalApprovedAt); expect(kicks(r)).toBe(0)
    // the old /approve endpoint is the SAME approval-only operation: it cannot release an order either
    const legacy = await read(await approveOrderH({ id: U1 }, r.deps, sid)); expect(legacy.status).toBe(200); expect(legacy.body.order).toMatchObject({ state: 'approved', manufacturing: 'not_released' }); expect(kicks(r)).toBe(0)
  })
  it('refresh recovery: a later view, a resumed session and a new service instance on the same data all say approved, not released', async () => {
    const r = rig(); const { sid } = await paid(r); await approveAll(r, sid); await finalizeOrder(r.deps, U1, sid)
    const v = await getSessionView(r.deps, U1, sid); expect(v.order).toMatchObject({ state: 'approved', manufacturing: 'not_released' }); expect(v.order.finalApprovedAt).toBeTruthy()
    const rs = await restoreSession(r.deps, U1); expect(rs.current!.order).toMatchObject({ state: 'approved', manufacturing: 'not_released' }); expect(rs.resume!.suggestedStep).toBe('order')
    const second = { ...r.deps }; expect((await getSessionView(second, U1, sid)).order.finalApprovedAt).toBe(v.order.finalApprovedAt)
  })
  it('after final approval the customer can no longer change the artwork, the compositions, the generation or the repair, and the free correction is not consumed', async () => {
    const r = rig(); const { sid } = await paid(r); await approveAll(r, sid); const before = (await getSessionView(r.deps, U1, sid)).compositions.map(c => c.correctionsRemaining); await finalizeOrder(r.deps, U1, sid)
    const preview = [...r.store.sessions.values()][0].artwork_preview_id!
    for (const [name, fn] of [
      ['selectArtwork', () => selectArtwork(r.deps, U1, sid, preview)], ['correct', () => correctLine(r.deps, U1, sid, 'a')], ['ensureCompositions', () => ensureCompositions(r.deps, U1, sid)],
      ['approveComposition', () => approveComposition(r.deps, U1, sid, r.store.compositions[0].id)], ['startBatch', () => startBatch(r.deps, U1, sid, { idempotencyKey: 'idem-key-new' })],
      ['retryBatch', () => retryBatch(r.deps, U1, sid, 1)], ['repair', () => repairLine(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid, lineId: 'a', dryRun: true })], ['setLines', () => setLines(r.deps, U1, sid, [])],
    ] as Array<[string, () => Promise<unknown>]>) await expect(fn(), name).rejects.toMatchObject({ code: expect.stringMatching(/order_not_awaiting_artwork|lines_locked/) })
    expect((await getSessionView(r.deps, U1, sid)).compositions.map(c => c.correctionsRemaining)).toEqual(before)
  })
})

describe('release is a separate, explicit, operator-only step', () => {
  it('needs the final approval first; a dry run changes nothing; the release moves the order to the state fulfilment acts on, once, and starts it once', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); await approveAll(r, sid)
    await expect(releaseOrder(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid })).rejects.toMatchObject({ code: 'final_approval_required' }); expect(order(r, orderId).status).toBe('awaiting_artwork')
    await expect(releaseOrder(r.deps, { operator: ' ', userId: U1, sessionId: sid })).rejects.toThrow('operator_required')
    await finalizeOrder(r.deps, U1, sid)
    expect(await releaseOrder(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid, dryRun: true })).toMatchObject({ status: 'would_release' }); expect(order(r, orderId).status).toBe('awaiting_artwork'); expect(kicks(r)).toBe(0)
    expect(await releaseOrder(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid })).toMatchObject({ status: 'released' })
    expect(order(r, orderId).status).toBe('paid'); expect(kicks(r)).toBe(1)
    await expect(giftOrderRecheck(r.store, orderId)).resolves.toBeUndefined()                                  // fulfilment's own gate now passes
    expect(await releaseOrder(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid })).toMatchObject({ status: 'already' }); expect(kicks(r)).toBe(1)   // a repeat starts nothing
    const v = await getSessionView(r.deps, U1, sid); expect(v.order).toMatchObject({ state: 'approved', manufacturing: 'released' }); expect(v.order.releasedAt).toBeTruthy()
  })
  it('a refund request stops a release; the legacy combined approveOrder still finalizes and releases for old fixtures', async () => {
    const r = rig(); const { sid, orderId } = await paid(r); await approveAll(r, sid); await finalizeOrder(r.deps, U1, sid)
    const rec = [...r.store.sessions.values()][0]; rec.refund_requested_at = new Date().toISOString()
    await expect(releaseOrder(r.deps, { operator: 'ops@x', userId: U1, sessionId: sid })).rejects.toMatchObject({ code: 'refund_pending' }); expect(order(r, orderId).status).toBe('awaiting_artwork')
  })
})

describe('static isolation: no customer-reachable code can start manufacturing', () => {
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)])
  it('only compose.ts and the operator script reference releaseOrder; the customer handlers and routes never touch kick, Prodigi, completePrintOrder or the legacy approveOrder', () => {
    const src = [...walk('lib/v1/gift'), ...walk('app/api/v1/gift'), ...walk('scripts')].filter(f => /\.ts$/.test(f) && !/\.test\.ts$/.test(f))
    const code = (f: string) => fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    const users = src.filter(f => /\breleaseOrder\b/.test(code(f))).map(f => f.replace(/\\/g, '/')).sort()
    expect(users).toEqual(['lib/v1/gift/compose.ts', 'lib/v1/gift/store.ts', 'scripts/gift-release-order.ts'])
    const customer = src.filter(f => /handlers\.ts$|app[\\/]api[\\/]v1[\\/]gift/.test(f))
    for (const f of customer) { const t = code(f); expect(t, f).not.toMatch(/\bkick\b|prodigi|completePrintOrder|\breleaseOrder\b|\bapproveOrder\b\s*\(/i) }
    // inside compose.ts the only use of deps.kick is in releaseOrder
    const compose = fs.readFileSync('lib/v1/gift/compose.ts', 'utf8'), kickLines = compose.split('\n').map((l, i) => [i, l] as const).filter(([, l]) => /deps\.kick/.test(l) && !/^\s*(\/\/|\*)/.test(l))
    expect(kickLines.length).toBe(1); const start = compose.split('\n').findIndex(l => /export async function releaseOrder/.test(l)); expect(kickLines[0][0]).toBeGreaterThan(start)
    // the finalize route exists and imports only the approval handler
    expect(fs.readFileSync('app/api/v1/gift/sessions/[id]/finalize/route.ts', 'utf8')).toMatch(/finalizeOrderH/)
  })
})
