// Migration 050 against real Postgres (PGlite), on top of 046 to 049 with the same stand-ins for the live tables: previews before purchase. Free
// batches need no order, are capped per session, per account and photograph, per account per day and in total, and the ledger outlives the session;
// a favorite can be saved before any order; generation stops at approval; permissions are unchanged. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const eff = (n: number, from = 0) => Array.from({ length: n }, (_, i) => 'e' + (from + i + 1))

it.skipIf(!PGlite)('migration 050: free previews without an order, the caps, the persistent ledger, saved favorites, and unchanged permissions', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create type public.print_order_status as enum ('created','paid','placed','in_production','shipped','delivered','cancelled','error');
      create table print_orders(id uuid primary key default gen_random_uuid(), status public.print_order_status not null default 'created',
        stripe_session_id text not null unique, stripe_payment_intent text, paid_at timestamptz, placed_at timestamptz, prodigi_order_id text,
        retail_total_cents int not null default 0, updated_at timestamptz default now());
      create table portfolios(id uuid primary key, purchase_id uuid, user_id uuid, series text, size int, status text, free_unlocks int, source_image text,
        composition jsonb, delivery text, pose text, framing text, subject text, aspect_ratio text, origin text not null default 'discovery');
      alter table portfolios add constraint portfolios_origin_purchase_check check ((origin = 'discovery' and purchase_id is not null) or origin = 'foyer');
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, preset text, status text, preview_id uuid);
      create table preview_ledger(id uuid primary key, email text unique, ip_hash text, series text, preset text, resolution text, storage_path text, unlocked_at timestamptz);`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry', '050_gift_previews_before_purchase']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }
    const session = async (user: string, sha: string) => (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ($1,$2,10,10,'portraits', now() + interval '7 days') returning id`, [user, sha]))[0].id
    const reserve = (s: string, user: string, key: string, effects: string[], caps: number[] = [2, 2, 6, 20]) =>
      q('select * from gift_reserve_batch($1,$2,$3,$4,$5,$6,$7,$8)', [s, user, key, effects, ...caps])
    const ready = async (s: string) => { await q(`update gift_previews set status='ready', master_path='m', preview_path='p' where session_id=$1`, [s]) }
    const status = async (s: string, user: string, caps: number[] = [2, 2, 6, 20]) => (await q('select * from gift_free_status($1,$2,$3,$4,$5,$6)', [s, user, ...caps]))[0]

    // one function of each name (the 5-argument reservation was replaced, not overloaded)
    expect((await q(`select count(*)::int as n from pg_proc where proname = 'gift_reserve_batch'`))[0].n).toBe(1)

    // free batches need no order: two free, the third needs payment, and the ledger records each free one
    const a = await session(U1, 'photoA')
    expect(await status(a, U1)).toEqual({ o_available: true, o_used_in_session: 0, o_reason: null })
    const b1 = (await reserve(a, U1, 'key-aaaa-1', eff(6)))[0]; expect([b1.o_batch_index, b1.o_kind, b1.o_reused]).toEqual([1, 'free', false]); await ready(a)
    const b2 = (await reserve(a, U1, 'key-aaaa-2', eff(6, 6)))[0]; expect([b2.o_batch_index, b2.o_kind]).toEqual([2, 'free']); await ready(a)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [a, U1, 'key-aaaa-3', eff(6, 12)])).toMatch(/payment_required/)
    expect(await status(a, U1)).toEqual({ o_available: false, o_used_in_session: 2, o_reason: 'session_limit' })
    expect((await q('select count(*)::int as n from gift_free_grants where user_id=$1', [U1]))[0].n).toBe(2)
    // idempotent: the same key returns the same batch and records no second grant
    expect((await reserve(a, U1, 'key-aaaa-1', eff(6)))[0]).toMatchObject({ o_batch_index: 1, o_reused: true })
    expect((await q('select count(*)::int as n from gift_free_grants where user_id=$1', [U1]))[0].n).toBe(2)

    // the ledger outlives the session: the same photograph gets nothing more, even after the session is deleted
    const again = await session(U1, 'photoA'); expect(await status(again, U1)).toMatchObject({ o_available: false, o_reason: 'photo_limit' })
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [again, U1, 'key-aaaa-9', eff(6)])).toMatch(/payment_required/)
    await q('delete from gift_sessions where id=$1', [a])
    expect((await q('select count(*)::int as n, count(session_id)::int as linked from gift_free_grants where user_id=$1', [U1]))[0]).toEqual({ n: 2, linked: 0 })
    expect(await status(again, U1)).toMatchObject({ o_available: false, o_reason: 'photo_limit' })

    // a different photograph and a different account have their own allocation
    const other = await session(U1, 'photoB'); expect(await status(other, U1)).toMatchObject({ o_available: true })
    const them = await session(U2, 'photoA'); expect(await status(them, U2)).toMatchObject({ o_available: true })
    // account caps are parameters: 24 hours and lifetime
    expect(await status(other, U1, [2, 2, 2, 20])).toMatchObject({ o_available: false, o_reason: 'daily_limit' })
    await q(`update gift_free_grants set created_at = now() - interval '2 days'`)
    expect(await status(other, U1, [2, 2, 2, 20])).toMatchObject({ o_available: true })
    expect(await status(other, U1, [2, 2, 6, 2])).toMatchObject({ o_available: false, o_reason: 'lifetime_limit' })

    // a pack buys further batches
    await q(`insert into gift_preview_packs(user_id, stripe_session_id, amount_cents, status, paid_at) values ($1,'cs_pack_1',299,'paid', now())`, [U1])
    const p1 = (await reserve(again, U1, 'key-pack-1', eff(6)))[0]; expect(p1.o_kind).toBe('paid')
    expect((await q('select count(*)::int as n from gift_free_grants where user_id=$1', [U1]))[0].n).toBe(2)         // a paid batch is not a free grant

    // generation with an order: unpaid ('created') and awaiting_artwork are allowed, anything past approval is not
    const c = await session(U2, 'photoC'); const o = (await q(`insert into print_orders(stripe_session_id, retail_total_cents) values ('cs_o1', 5000) returning id`))[0].id
    await q(`update gift_sessions set order_id=$2 where id=$1`, [c, o])
    expect((await reserve(c, U2, 'key-cccc-1', eff(6)))[0].o_kind).toBe('free'); await ready(c)
    await q(`update print_orders set status='paid', paid_at=now() where id=$1`, [o])
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [c, U2, 'key-cccc-2', eff(6, 6)])).toMatch(/order_not_awaiting_artwork/)
    await q(`update print_orders set status='awaiting_artwork' where id=$1`, [o])
    expect((await reserve(c, U2, 'key-cccc-2', eff(6, 6)))[0].o_kind).toBe('free')

    // the favorite is saved before any order, can change, and is refused only after approval
    const d = await session(U1, 'photoD'); await reserve(d, U1, 'key-dddd-1', eff(6)); await ready(d)
    const pv = await q('select id from gift_previews where session_id=$1 order by slot', [d])
    await q('select gift_select_artwork($1,$2,$3)', [d, U1, pv[0].id]); expect((await q('select artwork_preview_id from gift_sessions where id=$1', [d]))[0].artwork_preview_id).toBe(pv[0].id)
    await q('select gift_select_artwork($1,$2,$3)', [d, U1, pv[3].id]); expect((await q('select artwork_preview_id from gift_sessions where id=$1', [d]))[0].artwork_preview_id).toBe(pv[3].id)
    expect(await bad('select gift_select_artwork($1,$2,$3)', [d, U1, '00000000-0000-4000-8000-000000000000'])).toMatch(/preview_not_ready/)
    expect(await bad('select gift_select_artwork($1,$2,$3)', [d, U2, pv[0].id])).toMatch(/session_not_found/)
    const po = (await q(`insert into print_orders(stripe_session_id, retail_total_cents, status) values ('cs_o2', 5000, 'paid') returning id`))[0].id
    await q(`update gift_sessions set order_id=$2 where id=$1`, [d, po])
    expect(await bad('select gift_select_artwork($1,$2,$3)', [d, U1, pv[0].id])).toMatch(/order_not_awaiting_artwork/)

    // permissions: browser roles can call and read none of it
    await db.exec('set role anon')
    expect(await bad('select * from gift_free_status($1,$2)', [d, U1])).toMatch(/permission denied/)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [d, U1, 'key-anon-1', eff(6)])).toMatch(/permission denied/)
    expect(await bad('select * from gift_free_grants')).toMatch(/permission denied/)
    await db.exec('reset role'); await db.exec('set role authenticated')
    expect(await bad('select * from gift_free_grants')).toMatch(/permission denied/)
    await db.exec('reset role')

    // a re-run is harmless
    await db.exec(fs.readFileSync('supabase/migrations/050_gift_previews_before_purchase.sql', 'utf8'))
    expect((await q(`select count(*)::int as n from pg_proc where proname = 'gift_reserve_batch'`))[0].n).toBe(1)
  } finally { await db.close() }
}, 120_000)
