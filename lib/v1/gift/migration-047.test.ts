// Executes migration 047 against a real Postgres engine (PGlite): ownership, free-then-paid batches, idempotency,
// effect uniqueness, the incomplete-batch guard, preview leases, pack fulfilment and who may call what.
// Skipped (not failed) where PGlite is not installed. Set PGLITE_PATH, or install it at .temp/collection-sql-test.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const eff = (n: number, from = 0) => Array.from({ length: n }, (_, i) => 'e' + (from + i + 1))

it.skipIf(!PGlite)('migration 047 enforces ownership, the free-then-paid policy, idempotency and one-effect-once', async () => {
  const db = new PGlite()
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;')
    // Simulate Supabase's default privileges, which hand every new public object to the browser roles.
    await db.exec('alter default privileges in schema public grant all on tables to anon, authenticated, service_role; alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;')
    await db.exec(fs.readFileSync('supabase/migrations/047_gift_wizard_sessions.sql', 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }
    const mkSession = async (user: string) => (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ($1,'abc',1000,1000,'portraits', now() + interval '7 days') returning id`, [user]))[0].id as string
    const reserve = (s: string, u: string, key: string, effects: string[]) => q('select * from gift_reserve_batch($1,$2,$3,$4)', [s, u, key, effects])
    const ready = (batch: string) => q(`update gift_previews set status='ready', master_path='m', preview_path='p' where batch_id=$1`, [batch])

    const s1 = await mkSession(U1)
    // ── ownership
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U2, 'key-other-user', eff(6)])).toMatch(/session_not_found/)

    // ── batch 1: free, six previews created pending
    const b1 = (await reserve(s1, U1, 'key-batch-001', eff(6)))[0]
    expect(b1).toMatchObject({ o_batch_index: 1, o_kind: 'free', o_reused: false })
    expect((await q('select count(*)::int n from gift_previews where batch_id=$1 and status=$2', [b1.o_batch_id, 'pending']))[0].n).toBe(6)

    // ── idempotent: the same key returns the same batch and creates nothing
    const again = (await reserve(s1, U1, 'key-batch-001', eff(6)))[0]
    expect(again).toMatchObject({ o_batch_id: b1.o_batch_id, o_batch_index: 1, o_reused: true })
    expect((await q('select count(*)::int n from gift_batches where session_id=$1', [s1]))[0].n).toBe(1)

    // ── a new batch cannot be taken while the last one still has unfinished previews
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-002', eff(6, 6)])).toMatch(/previous_batch_incomplete/)
    await ready(b1.o_batch_id)

    // ── an effect is never used twice, and six DISTINCT effects are required
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-002', ['e1', ...eff(5, 6)]])).toMatch(/effect_already_used/)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-002', ['x1', 'x1', 'x2', 'x3', 'x4', 'x5']])).toMatch(/six_distinct_effects_required/)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-002', eff(5, 6)])).toMatch(/six_distinct_effects_required/)

    // ── batch 2 is free too
    const b2 = (await reserve(s1, U1, 'key-batch-002', eff(6, 6)))[0]
    expect(b2).toMatchObject({ o_batch_index: 2, o_kind: 'free' }); await ready(b2.o_batch_id)

    // ── batch 3 needs a paid pack: none exists, and no client call can make one
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-003', eff(6, 12)])).toMatch(/payment_required/)
    expect((await q('select count(*)::int n from gift_batches where session_id=$1', [s1]))[0].n).toBe(2)

    // ── a verified payment records one pack, exactly once however often the webhook repeats
    const p1 = (await q('select gift_fulfill_preview_pack($1,$2,$3) id', [U1, 'cs_test_1', 299]))[0].id
    const p1b = (await q('select gift_fulfill_preview_pack($1,$2,$3) id', [U1, 'cs_test_1', 299]))[0].id
    expect(p1b).toBe(p1); expect((await q('select count(*)::int n from gift_preview_packs'))[0].n).toBe(1)

    // ── another user's pack is not usable by this user
    await q('select gift_fulfill_preview_pack($1,$2,$3)', [U2, 'cs_test_2', 299])
    const b3 = (await reserve(s1, U1, 'key-batch-003', eff(6, 12)))[0]
    expect(b3).toMatchObject({ o_batch_index: 3, o_kind: 'paid' })
    const used = await q('select id, user_id, status, consumed_batch_id from gift_preview_packs where id=$1', [p1])
    expect(used[0]).toMatchObject({ user_id: U1, status: 'consumed', consumed_batch_id: b3.o_batch_id })
    expect((await q(`select count(*)::int n from gift_preview_packs where user_id=$1 and status='paid'`, [U2]))[0].n).toBe(1)   // untouched
    await ready(b3.o_batch_id)

    // ── idempotent retry of the paid batch consumes nothing more; the next batch needs another payment
    expect((await reserve(s1, U1, 'key-batch-003', eff(6, 12)))[0].o_reused).toBe(true)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s1, U1, 'key-batch-004', eff(6, 18)])).toMatch(/payment_required/)

    // ── a pack survives its session: it is the user's, and works in a new session
    const s2 = await mkSession(U2)
    const c1 = (await reserve(s2, U2, 'key-u2-batch-1', eff(6, 100)))[0]; await ready(c1.o_batch_id)
    const c2 = (await reserve(s2, U2, 'key-u2-batch-2', eff(6, 110)))[0]; await ready(c2.o_batch_id)
    expect((await reserve(s2, U2, 'key-u2-batch-3', eff(6, 120)))[0].o_kind).toBe('paid')

    // ── leases: one claimer wins, a ready preview is never claimed, an expired lease is taken over, attempts are capped
    const s3 = await mkSession(U1)
    const b = (await reserve(s3, U1, 'key-s3-batch-1', eff(6, 200)))[0]
    const pv = (await q('select id from gift_previews where batch_id=$1 and slot=1', [b.o_batch_id]))[0].id
    const claim = async (id: string, user = U1) => (await q('select * from gift_claim_preview($1,$2,$3,$4)', [id, user, 300, 3]))[0]
    expect((await claim(pv)).status).toBe('generating')
    expect((await claim(pv)).id).toBeNull()                                       // already leased
    expect((await claim(pv, U2)).id).toBeNull()                                   // not the owner
    await q(`update gift_previews set lease_until = now() - interval '1 second' where id=$1`, [pv])
    expect((await claim(pv)).attempts).toBe(2)                                     // lapsed lease is taken over
    await q(`update gift_previews set status='failed', error='boom' where id=$1`, [pv])
    expect((await claim(pv)).attempts).toBe(3)                                     // a failed preview retries on its own row
    await q(`update gift_previews set status='failed' where id=$1`, [pv])
    expect((await claim(pv)).id).toBeNull()                                        // attempts capped
    await q(`update gift_previews set status='ready', master_path='m', preview_path='p', attempts=1 where id=$1`, [pv])
    expect((await claim(pv)).id).toBeNull()                                        // ready is never regenerated

    // ── a ready preview must have both files; an expired session refuses a batch
    expect(await bad(`update gift_previews set status='ready', master_path=null where id=$1`, [pv])).toBeTruthy()
    await q(`update gift_sessions set expires_at = now() - interval '1 day' where id=$1`, [s3])
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s3, U1, 'key-s3-batch-2', eff(6, 210)])).toMatch(/session_expired/)

    // ── a paid batch must carry a pack, a free one must not
    expect(await bad(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,9,'paid','key-nopack-1', array['a','b','c','d','e','f'])`, [s1, U1])).toBeTruthy()

    // ── retention: activity extends expiry to 7 days ahead but never past 30 days from creation
    const s4 = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, created_at, expires_at) values ($1,'abc',10,10,'pets', now() - interval '29 days', now() + interval '1 day') returning id`, [U1]))[0].id
    await reserve(s4, U1, 'key-s4-batch-1', eff(6, 300))
    const e4 = (await q(`select (expires_at <= created_at + interval '30 days') as capped, (expires_at > now() + interval '23 hours') as extended from gift_sessions where id=$1`, [s4]))[0]
    expect(e4).toEqual({ capped: true, extended: true })                         // 29 days old: extended, but only to day 30
    const s5 = await mkSession(U1)
    await reserve(s5, U1, 'key-s5-batch-1', eff(6, 400))
    expect((await q(`select (expires_at > now() + interval '6 days 23 hours') as seven from gift_sessions where id=$1`, [s5]))[0].seven).toBe(true)

    // ── deleting a session removes its batches and previews but never a paid pack
    const packsBefore = (await q('select count(*)::int n from gift_preview_packs'))[0].n
    await q('delete from gift_sessions where id=$1', [s1])
    expect((await q('select count(*)::int n from gift_batches where session_id=$1', [s1]))[0].n).toBe(0)
    expect((await q('select count(*)::int n from gift_previews where session_id=$1', [s1]))[0].n).toBe(0)
    expect((await q('select count(*)::int n from gift_preview_packs'))[0].n).toBe(packsBefore)

    // ── the migration can be applied twice (a re-run is harmless)
    await db.exec(fs.readFileSync('supabase/migrations/047_gift_wizard_sessions.sql', 'utf8'))

    // ── permissions: the browser roles can neither read the tables nor call the functions; RLS is on for all four
    for (const t of ['gift_sessions', 'gift_batches', 'gift_previews', 'gift_preview_packs']) {
      expect((await q('select relrowsecurity r from pg_class where relname=$1', [t]))[0].r, t).toBe(true)
    }
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      expect(await bad('select * from gift_sessions'), role + ' read').toMatch(/permission denied/)
      expect(await bad('select * from gift_preview_packs'), role + ' read packs').toMatch(/permission denied/)
      expect(await bad('select gift_fulfill_preview_pack($1,$2,$3)', [U1, 'cs_test_forged', 299]), role + ' forge a pack').toMatch(/permission denied/)
      expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [s5, U1, 'key-forged-01', eff(6, 500)]), role + ' reserve').toMatch(/permission denied/)
      await db.exec('reset role')
    }

    // ── the service role can call the functions
    await db.exec('set role service_role')
    expect((await q('select * from gift_claim_preview($1,$2)', ['00000000-0000-4000-8000-000000000000', U1])).length).toBe(1)
    await db.exec('reset role')
  } finally { await db.close() }
}, 60_000)
