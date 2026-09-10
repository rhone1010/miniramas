// lib/store/tests/generation-grants.test.ts
//
// The single-use generation grant: who may generate, and how a paid image is
// delivered exactly once.
//
// THE INVARIANT under test throughout: one paid grant produces at most one
// canonical delivered image, and retrying that grant never produces a
// different one once its canonical result exists.
//
// Runs the real lib/store/generation-grants.ts against an in-memory Supabase.

import { describe, it, expect } from 'vitest'
import {
  decideGenerateAccess, openGrant, persistAndConsume, releaseGrant,
  canonicalResultPath, GRANT_STALE_CLAIM_MS, INFLIGHT_WAIT_MS, INFLIGHT_POLL_MS,
} from '@/lib/store/generation-grants'
import { fakeSupabase } from './helpers/fake-supabase'

const OWNER = 'owner-1'
const G = '11111111-1111-4111-8111-111111111111'
const IMG_A = Buffer.from('canonical-image-A').toString('base64')
const IMG_B = Buffer.from('a-second-render-B').toString('base64')

function grant(over: Record<string, any> = {}) {
  return {
    id: G, ref_id: 'craft_1', unit: 0, owner_key: OWNER, series: 'portraits', preset: 'bronze',
    cost_credits: 10, status: 'issued', claim_token: null, claimed_at: null,
    consumed_at: null, refunded_at: null, result_path: null, attempts: 0, last_error: null,
    ...over,
  }
}
const open = (sb: any, over: Partial<{ grantId: string; ownerKey: string; preset: string }> = {}, deps: any = {}) =>
  openGrant(sb, { grantId: G, ownerKey: OWNER, preset: 'bronze', ...over }, deps)

/** A clock and sleep the tests drive. */
function clock(start = Date.parse('2026-09-10T20:00:00Z')) {
  let t = start
  const sleeps: number[] = []
  return {
    now: () => t,
    advance: (ms: number) => { t += ms },
    sleeps,
    deps: (onSleep?: () => void) => ({
      now: () => t,
      sleep: async (ms: number) => { sleeps.push(ms); t += ms; onSleep?.() },
    }),
  }
}

// -- who may generate --------------------------------------------------------

describe('decideGenerateAccess', () => {
  it('refuses experimental_effect for everyone, internal included', () => {
    for (const internal of [true, false]) {
      expect(decideGenerateAccess({ body: { experimental_effect: 'x' }, internal, bakeAuthorized: true }))
        .toEqual({ kind: 'refuse', status: 403, error: 'experimental_effect_disabled' })
    }
  })

  it('refuses the anonymous free preview', () => {
    expect(decideGenerateAccess({ body: { is_preview: true }, internal: false, bakeAuthorized: false }))
      .toEqual({ kind: 'refuse', status: 403, error: 'preview_disabled' })
  })

  it('keeps the catalogue bake on its own internal token', () => {
    expect(decideGenerateAccess({ body: { is_preview_bake: true, is_preview: true }, internal: false, bakeAuthorized: true }))
      .toEqual({ kind: 'internal' })
    expect(decideGenerateAccess({ body: { is_preview_bake: true }, internal: false, bakeAuthorized: false }))
      .toEqual({ kind: 'refuse', status: 403, error: 'preview_bake_forbidden' })
  })

  it('the internal secret is the only way to clean output without a grant', () => {
    expect(decideGenerateAccess({ body: {}, internal: true, bakeAuthorized: false })).toEqual({ kind: 'internal' })
    expect(decideGenerateAccess({ body: {}, internal: false, bakeAuthorized: false })).toEqual({ kind: 'grant' })
  })

  it('no body flag can raise a request above "needs a grant"', () => {
    for (const body of [{ is_preview: false }, { internal: true }, { admin: true }, { grant_id: G }, { skip_redirect: true }]) {
      expect(decideGenerateAccess({ body, internal: false, bakeAuthorized: false })).toEqual({ kind: 'grant' })
    }
  })
})

// -- opening a grant ---------------------------------------------------------

describe('openGrant: issued', () => {
  it('claims before any work: status, token, time, attempt', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const c = clock()
    const out = await open(f.sb, {}, c.deps())
    expect(out.kind).toBe('claimed')
    const r = f.row('generation_grants', G)!
    expect(r.status).toBe('claimed')
    expect(r.claim_token).toBe((out as any).grant.token)
    expect(r.claimed_at).toBe(new Date(c.now()).toISOString())
    expect(r.attempts).toBe(1)
  })

  it('refuses another owner, and an unknown grant, identically', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    expect(await open(f.sb, { ownerKey: 'someone-else' })).toEqual({ kind: 'refuse', status: 403, error: 'grant_invalid' })
    expect(await open(f.sb, { grantId: '22222222-2222-4222-8222-222222222222' })).toEqual({ kind: 'refuse', status: 403, error: 'grant_invalid' })
    expect(f.row('generation_grants', G)!.status).toBe('issued')
  })

  it('a grant is only good for its own preset', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    expect(await open(f.sb, { preset: 'walnut' })).toEqual({ kind: 'refuse', status: 403, error: 'grant_mismatch' })
  })

  it('a refunded grant cannot be used', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant({ status: 'refunded' })] } })
    expect(await open(f.sb)).toEqual({ kind: 'refuse', status: 409, error: 'grant_refunded' })
  })
})

describe('openGrant: already delivered', () => {
  it('re-delivers the stored canonical image and never claims', async () => {
    const path = canonicalResultPath(G)
    const f = fakeSupabase({
      tables: { generation_grants: [grant({ status: 'consumed', result_path: path })] },
      objects: { [path]: Buffer.from(IMG_A, 'base64') },
    })
    expect(await open(f.sb)).toEqual({ kind: 'redeliver', grantId: G, imageB64: IMG_A })
    expect(f.row('generation_grants', G)!.status).toBe('consumed')
  })

  it('says so, retryably, if the stored result cannot be read', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant({ status: 'consumed', result_path: canonicalResultPath(G) })] } })
    expect(await open(f.sb)).toEqual({ kind: 'refuse', status: 503, error: 'redelivery_failed' })
  })

  it('a claimed grant whose result is already stored is completed, not rendered again', async () => {
    // The consume write failed after persistence: the row still says claimed.
    const c = clock()
    const f = fakeSupabase({
      tables: { generation_grants: [grant({ status: 'claimed', claim_token: 'dead', claimed_at: new Date(c.now()).toISOString() })] },
      objects: { [canonicalResultPath(G)]: Buffer.from(IMG_A, 'base64') },
    })
    expect(await open(f.sb, {}, c.deps())).toEqual({ kind: 'redeliver', grantId: G, imageB64: IMG_A })
    const r = f.row('generation_grants', G)!
    expect(r.status).toBe('consumed')
    expect(r.result_path).toBe(canonicalResultPath(G))
  })
})

describe('openGrant: a render already in flight', () => {
  it('waits for it and re-delivers its result', async () => {
    const c = clock()
    const f = fakeSupabase({
      tables: { generation_grants: [grant({ status: 'claimed', claim_token: 'first', claimed_at: new Date(c.now()).toISOString() })] },
    })
    let polls = 0
    const out = await open(f.sb, {}, c.deps(() => {
      if (++polls === 3) {                       // the first request finishes
        f.objects.set(canonicalResultPath(G), Buffer.from(IMG_A, 'base64'))
        Object.assign(f.row('generation_grants', G)!, { status: 'consumed', result_path: canonicalResultPath(G) })
      }
    }))
    expect(out).toEqual({ kind: 'redeliver', grantId: G, imageB64: IMG_A })
    expect(c.sleeps.every((ms) => ms === INFLIGHT_POLL_MS)).toBe(true)
  })

  it('if the first attempt failed and released, the waiter renders it instead', async () => {
    const c = clock()
    const f = fakeSupabase({
      tables: { generation_grants: [grant({ status: 'claimed', claim_token: 'first', claimed_at: new Date(c.now()).toISOString() })] },
    })
    const out = await open(f.sb, {}, c.deps(() => {
      Object.assign(f.row('generation_grants', G)!, { status: 'issued', claim_token: null, claimed_at: null })
    }))
    expect(out.kind).toBe('claimed')
  })

  it('gives up with grant_in_progress once the wait budget is spent', async () => {
    const c = clock()
    const f = fakeSupabase({
      tables: { generation_grants: [grant({ status: 'claimed', claim_token: 'first', claimed_at: new Date(c.now()).toISOString() })] },
    })
    expect(await open(f.sb, {}, c.deps())).toEqual({ kind: 'refuse', status: 409, error: 'grant_in_progress' })
    const waited = c.sleeps.reduce((a, b) => a + b, 0)
    expect(waited).toBeLessThanOrEqual(INFLIGHT_WAIT_MS)
    expect(waited).toBeGreaterThan(INFLIGHT_WAIT_MS - 2 * INFLIGHT_POLL_MS)
  })

  it('a claim older than 600s is taken over by compare-and-swap on its token', async () => {
    const c = clock()
    const f = fakeSupabase({
      tables: { generation_grants: [grant({
        status: 'claimed', claim_token: 'dead', attempts: 1,
        claimed_at: new Date(c.now() - GRANT_STALE_CLAIM_MS - 1000).toISOString(),
      })] },
    })
    const out = await open(f.sb, {}, c.deps())
    expect(out.kind).toBe('claimed')
    const r = f.row('generation_grants', G)!
    expect(r.claim_token).not.toBe('dead')
    expect(r.attempts).toBe(2)
  })

  it('says so, retryably, when the lookup itself fails', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const broken = { ...f.sb, from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'down' } }) }) }) }) }
    expect(await open(broken as any)).toEqual({ kind: 'refuse', status: 503, error: 'grant_lookup_failed' })
  })
})

// -- persist, then consume ----------------------------------------------------

async function claimed(f: ReturnType<typeof fakeSupabase>) {
  const out = await open(f.sb)
  if (out.kind !== 'claimed') throw new Error('expected a claim, got ' + out.kind)
  return out.grant
}

describe('persistAndConsume: the success contract', () => {
  it('stores at the grant path with upsert OFF, then consumes', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    expect(await persistAndConsume(f.sb, g, IMG_A)).toEqual({ ok: true, imageB64: IMG_A, consumed: true })
    expect(f.calls.uploads).toEqual([{ path: canonicalResultPath(G), upsert: false }])
    const r = f.row('generation_grants', G)!
    expect([r.status, r.result_path, r.claim_token]).toEqual(['consumed', canonicalResultPath(G), null])
  })

  it('if persistence fails, the grant is NOT consumed -- and release puts it back', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    f.fault({ op: 'upload' })
    const out = await persistAndConsume(f.sb, g, IMG_A)
    expect(out.ok).toBe(false)
    expect(f.row('generation_grants', G)!.status).toBe('claimed')
    await releaseGrant(f.sb, g, 'not_delivered')
    const r = f.row('generation_grants', G)!
    expect([r.status, r.claim_token, r.last_error]).toEqual(['issued', null, 'not_delivered'])
  })

  it('if the consume write fails after storing, the stored result still completes it', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    f.fault({ op: 'update', table: 'generation_grants', match: (p) => p.status === 'consumed' })
    const out = await persistAndConsume(f.sb, g, IMG_A)
    expect(out).toEqual({ ok: true, imageB64: IMG_A, consumed: true })  // completed by id
    expect(f.row('generation_grants', G)!.status).toBe('consumed')
  })

  it('if BOTH consume writes fail, the next request on the grant completes it from storage', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    f.fault({ op: 'update', table: 'generation_grants', match: (p) => p.status === 'consumed' })
    f.fault({ op: 'update', table: 'generation_grants', match: (p) => p.status === 'consumed' })
    const out = await persistAndConsume(f.sb, g, IMG_A)
    expect(out).toEqual({ ok: true, imageB64: IMG_A, consumed: false })
    expect(f.row('generation_grants', G)!.status).toBe('claimed')
    // The retry: no NB2, the stored image, and the grant settles.
    expect(await open(f.sb)).toEqual({ kind: 'redeliver', grantId: G, imageB64: IMG_A })
    expect(f.row('generation_grants', G)!.status).toBe('consumed')
  })
})

describe('THE INVARIANT: one canonical image per grant', () => {
  it('a second render on the same grant returns the FIRST image, never its own', async () => {
    // Two attempts end up rendering (a stale claim taken over while the first
    // was still alive). The first to store wins; the second cannot replace it.
    const c = clock()
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const first = await claimed(f)
    c.advance(GRANT_STALE_CLAIM_MS + 1000)
    const row = f.row('generation_grants', G)!
    row.claimed_at = new Date(Date.now() - GRANT_STALE_CLAIM_MS - 1000).toISOString()
    const second = await claimed(f)
    expect(second.token).not.toBe(first.token)

    // The first finishes and stores A (its own claim is gone; it completes by id).
    const a = await persistAndConsume(f.sb, first, IMG_A)
    expect(a).toMatchObject({ ok: true, imageB64: IMG_A })
    // The second finishes with B, finds A stored, and returns A.
    const b = await persistAndConsume(f.sb, second, IMG_B)
    expect(b).toMatchObject({ ok: true, imageB64: IMG_A })
    expect(f.objects.get(canonicalResultPath(G))!.toString('base64')).toBe(IMG_A)
    // And every later request gets A.
    for (let i = 0; i < 3; i++) expect(await open(f.sb)).toEqual({ kind: 'redeliver', grantId: G, imageB64: IMG_A })
  })

  it('a replay after delivery never claims, never renders', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    await persistAndConsume(f.sb, g, IMG_A)
    const uploadsBefore = f.calls.uploads.length
    expect((await open(f.sb)).kind).toBe('redeliver')
    expect(f.calls.uploads.length).toBe(uploadsBefore)
    expect(f.row('generation_grants', G)!.attempts).toBe(1)
  })
})

describe('releaseGrant', () => {
  it('only the claim that took the grant may release it', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    await releaseGrant(f.sb, { ...g, token: 'not-mine' }, 'nope')
    expect(f.row('generation_grants', G)!.status).toBe('claimed')
    await releaseGrant(f.sb, g, 'not_delivered')
    expect(f.row('generation_grants', G)!.status).toBe('issued')
  })

  it('never un-consumes a delivered grant', async () => {
    const f = fakeSupabase({ tables: { generation_grants: [grant()] } })
    const g = await claimed(f)
    await persistAndConsume(f.sb, g, IMG_A)
    await releaseGrant(f.sb, g, 'late release')
    expect(f.row('generation_grants', G)!.status).toBe('consumed')
  })
})
