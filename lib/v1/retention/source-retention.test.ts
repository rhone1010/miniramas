// Source photograph retention, application side: the Gift Shop source (60 days after artwork approval), the dispute guard on the existing expiry sweep, the
// combined sweep report, and the remedy policy once a source is gone. (The Portraits / Pets / Groups side is SQL: migration-060.test.ts.)

import { describe, it, expect, vi } from 'vitest'
import sharp from 'sharp'
import { createSession, purgeApprovedSources, purgeExpired, type GiftDeps } from '../gift/service'
import { memoryGiftStore } from '../gift/store'
import { runSourceRetention } from './sweep'
import { decideRemedy } from '../../store/remedy-policy'

const U1 = '10000000-0000-4000-8000-000000000001'
const DAY = 864e5
const NOW = Date.parse('2026-12-31T00:00:00Z')
const photo = async () => (await sharp({ create: { width: 600, height: 600, channels: 3, background: '#a33' } }).jpeg().toBuffer()).toString('base64')

function rig() {
  const store = memoryGiftStore(() => NOW), files = new Map<string, Buffer>(), removeFails = { n: 0 }
  const gift: GiftDeps = {
    store, generate: vi.fn() as any, compose: vi.fn() as any, watermark: async b64 => sharp(Buffer.from(b64, 'base64')).jpeg().toBuffer(), clock: () => NOW,
    storage: { put: async (p, b) => { files.set(p, b) }, get: async p => files.get(p) ?? null, remove: async ps => { if (removeFails.n > 0) { removeFails.n--; throw new Error('storage_down') } for (const p of ps) files.delete(p) }, signedUrl: async p => 'https://signed.test/' + p, list: async d => [...files.keys()].filter(k => k.startsWith(d)) },
    analyze: async () => ({ status: 'supported', series: 'portraits', peopleCount: null }), kick: vi.fn(async () => ({})),
  } as GiftDeps
  return { gift, store, files, removeFails }
}
async function approvedSession(r: ReturnType<typeof rig>, approvedDaysAgo: number | null, opts: { legacy?: boolean } = {}) {
  const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }), s = r.store.sessions.get(v.sessionId)!
  // the files a paid, approved session also holds: master, preview, composition: these must survive
  for (const p of [`gift/${s.id}/masters/m.png`, `gift/${s.id}/previews/p.jpg`, `gift/${s.id}/compositions/c.png`]) r.files.set(p, Buffer.from('artwork'))
  s.pinned_at = new Date(NOW - 100 * DAY).toISOString()
  if (approvedDaysAgo != null) { const at = new Date(NOW - approvedDaysAgo * DAY).toISOString(); if (opts.legacy) s.approved_at = at; else s.final_approved_at = at }
  return s
}

describe('Gift Shop: the source photograph goes 60 days after artwork approval', () => {
  it('59 days: kept. 61 days: dry run reports it, apply deletes only the photograph', async () => {
    const r = rig(), young = await approvedSession(r, 59), old = await approvedSession(r, 61), unapproved = await approvedSession(r, null)
    const youngSrc = young.source_path!, oldSrc = old.source_path!, unapprovedSrc = unapproved.source_path!
    expect(r.files.has(oldSrc)).toBe(true)
    const dry = await purgeApprovedSources(r.gift, { apply: false })
    expect(dry).toMatchObject({ due: 1, deleted: 0, held: 0, failed: 0, ids: [old.id] })
    expect(r.files.has(oldSrc)).toBe(true); expect(r.store.sessions.get(old.id)!.source_path).toBe(oldSrc)               // a dry run deletes nothing
    const run = await purgeApprovedSources(r.gift, { apply: true })
    expect(run).toMatchObject({ due: 1, deleted: 1, failed: 0 })
    expect(r.files.has(oldSrc)).toBe(false); expect(r.store.sessions.get(old.id)!.source_path).toBeNull()
    expect(r.store.sessions.get(old.id)!.source_sha256).toBeTruthy()                                                         // the hash stays
    for (const f of ['masters/m.png', 'previews/p.jpg', 'compositions/c.png']) expect(r.files.has(`gift/${old.id}/${f}`), f).toBe(true)      // artwork and manufacturing files are intact
    expect(r.store.sessions.get(old.id)!.status).toBe('active')                                                              // the session and its rows remain
    expect(r.files.has(youngSrc) && r.files.has(unapprovedSrc)).toBe(true)
    expect(r.store.sessions.get(young.id)!.source_path).toBe(youngSrc)
  })

  it('is idempotent and safe to retry: a storage failure leaves the session to be found again', async () => {
    const r = rig(), old = await approvedSession(r, 70), src = old.source_path!
    r.removeFails.n = 1
    expect(await purgeApprovedSources(r.gift, { apply: true })).toMatchObject({ deleted: 0, failed: 1 })
    expect(r.store.sessions.get(old.id)!.source_path).toBe(src)                                                              // the path is cleared only after the object is gone
    expect(await purgeApprovedSources(r.gift, { apply: true })).toMatchObject({ deleted: 1, failed: 0 })
    expect(await purgeApprovedSources(r.gift, { apply: true })).toMatchObject({ due: 0, deleted: 0, failed: 0 })              // nothing left to do
    expect(r.files.has(src)).toBe(false)
  })

  it('uses release (approved_at) where the final approval was never recorded', async () => {
    const r = rig(), old = await approvedSession(r, 65, { legacy: true })
    expect(await purgeApprovedSources(r.gift, { apply: true })).toMatchObject({ deleted: 1 })
    expect(r.store.sessions.get(old.id)!.source_path).toBeNull()
  })

  it('an open dispute suspends it, and the photograph goes once the dispute is closed', async () => {
    const r = rig(), a = await approvedSession(r, 90), b = await approvedSession(r, 90), c = await approvedSession(r, 90)
    r.store.disputedSessions.add(a.id)                                                                                       // an unresolved Make It Right case
    r.store.sessions.get(b.id)!.refund_requested_at = new Date(NOW - DAY).toISOString()                                     // an open Gift refund request
    const held = await purgeApprovedSources(r.gift, { apply: true })
    expect(held).toMatchObject({ deleted: 1, held: 2 })
    expect(r.store.sessions.get(a.id)!.source_path).not.toBeNull(); expect(r.store.sessions.get(b.id)!.source_path).not.toBeNull(); expect(r.store.sessions.get(c.id)!.source_path).toBeNull()
    r.store.disputedSessions.delete(a.id); r.store.sessions.get(b.id)!.refunded_at = new Date(NOW).toISOString()
    expect(await purgeApprovedSources(r.gift, { apply: true })).toMatchObject({ deleted: 2, held: 0 })
  })

  it('the existing expiry sweep also respects an open dispute', async () => {
    const r = rig()
    const v = await createSession(r.gift, { userId: U1, imageB64: await photo() }), v2 = await createSession(r.gift, { userId: U1, imageB64: await photo() })
    for (const id of [v.sessionId, v2.sessionId]) r.store.sessions.get(id)!.expires_at = new Date(NOW - DAY).toISOString()
    r.store.disputedSessions.add(v.sessionId)
    expect(await purgeExpired(r.gift)).toMatchObject({ purged: 1, held: 1, failed: 0 })
    expect(r.store.sessions.has(v.sessionId)).toBe(true); expect(r.store.sessions.has(v2.sessionId)).toBe(false)
  })

  it('the only source URL is the session photoUrl (one hour at most); once deleted there is no URL and the object cannot be fetched', async () => {
    const r = rig(), s = await approvedSession(r, 61), src = s.source_path!, signed: Array<[string, number]> = []
    const orig = r.gift.storage.signedUrl; r.gift.storage.signedUrl = async (p: string, secs: number) => { signed.push([p, secs]); return orig(p, secs) }
    const { getSessionView } = await import('../gift/service')
    const before = await getSessionView(r.gift, U1, s.id)
    expect((before as any).source.photoUrl).toBeTruthy()
    expect(signed.filter(([p]) => p === src).every(([, secs]) => secs <= 3600)).toBe(true)
    await purgeApprovedSources(r.gift, { apply: true })
    signed.length = 0
    const after = await getSessionView(r.gift, U1, s.id)
    expect((after as any).source.photoUrl).toBeNull(); expect(signed.filter(([p]) => p === src)).toEqual([])
    expect(await r.gift.storage.get(src)).toBeNull()                                                                         // the object itself is gone: an earlier URL has nothing to serve
  })
})

describe('the combined sweep', () => {
  it('reports both halves and passes apply through; a failing half never hides the other', async () => {
    const r = rig(); await approvedSession(r, 61)
    const rows = [
      { portfolio_id: 'p1', delete_after: '2026-01-01T00:00:00Z', disputed: false, due: true, deleted: false },
      { portfolio_id: 'p2', delete_after: '2027-01-01T00:00:00Z', disputed: false, due: false, deleted: false },
      { portfolio_id: 'p3', delete_after: '2026-01-01T00:00:00Z', disputed: true, due: false, deleted: false },
    ]
    const rpc = vi.fn(async (_fn: string, args: Record<string, unknown>) => ({ data: rows.map(x => ({ ...x, deleted: !!args.p_apply && x.due })), error: null }))
    const dry = await runSourceRetention({ db: { rpc }, gift: r.gift, now: () => new Date(NOW) }, { apply: false })
    expect(rpc).toHaveBeenCalledWith('retention_sweep_portfolio_sources', expect.objectContaining({ p_apply: false }))
    expect(dry.portfolios).toMatchObject({ held: 3, due: 1, deleted: 0, disputed: 1, notYetDue: 1 }); expect(dry.gift).toMatchObject({ due: 1, deleted: 0 })
    const live = await runSourceRetention({ db: { rpc }, gift: r.gift, now: () => new Date(NOW) }, { apply: true })
    expect(live.portfolios).toMatchObject({ deleted: 1, ids: ['p1'] }); expect(live.gift).toMatchObject({ deleted: 1 })
    const broken = await runSourceRetention({ db: { rpc: async () => ({ data: null, error: { message: 'function does not exist' } }) }, gift: r.gift, now: () => new Date(NOW) }, { apply: true })
    expect(broken.portfolios.error).toMatch(/does not exist/); expect(broken.gift.error).toBeUndefined()
  })
})

describe('Make It Right once the source photograph is gone', () => {
  const base = { requested: 'redo' as const, scope: 'artwork' as const, firstGoodwill: true, alreadyRemediedArtwork: false, identityNeedsReview: false, paymentVerified: true, eligibleCents: 499, evidence: 'uncertain' as const }
  it('a redo cannot run from a deleted photograph: the customer is asked for a new one, and no goodwill is spent', () => {
    expect(decideRemedy(base)).toMatchObject({ remedy: 'redo', consumeGoodwill: true })
    expect(decideRemedy({ ...base, sourceRetained: false })).toEqual({ remedy: 'source_photo', source: 'goodwill', amountCents: 0, consumeGoodwill: false })
    expect(decideRemedy({ ...base, firstGoodwill: false, sourceRetained: false })).toMatchObject({ remedy: 'source_photo', source: 'evidence_policy' })
  })
  it('a refund does not need the photograph: the goodwill refund is unchanged', () => {
    expect(decideRemedy({ ...base, requested: 'refund', sourceRetained: false })).toEqual({ remedy: 'refund', source: 'goodwill', amountCents: 499, consumeGoodwill: true })
    expect(decideRemedy({ ...base, requested: 'refund', eligibleCents: 5001, sourceRetained: false })).toMatchObject({ remedy: 'review' })          // above $50 never automatic
  })
})
