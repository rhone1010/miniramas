// Migration 059 (the generation ledger) against real Postgres (PGlite) on top of 046 to 058 with the same stand-ins for the live tables: one effect, the allowance (six free per session, the account
// abuse limits, packs of six), what counts and what does not, idempotency and retry, the in-flight cap, the lease, delivery readying the anchor, acceptance, the flow guards, and closed permissions.
// Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002', U3 = '10000000-0000-4000-8000-000000000003'
const key = (n: number | string) => `gen-key-${String(n).padStart(4, '0')}`

it.skipIf(!PGlite)('migration 059: one effect, six free then packs of six, failures and retries, caps, in-flight limit, delivery, acceptance, guards, permissions, re-run', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create type public.print_order_status as enum ('created','paid','placed','in_production','shipped','delivered','cancelled','error');
      create table print_orders(id uuid primary key default gen_random_uuid(), status public.print_order_status not null default 'created', stripe_session_id text not null unique, stripe_payment_intent text, paid_at timestamptz, placed_at timestamptz, prodigi_order_id text, retail_total_cents int not null default 0, updated_at timestamptz default now());
      create table portfolios(id uuid primary key, purchase_id uuid, user_id uuid, series text, size int, status text, free_unlocks int, source_image text, composition jsonb, delivery text, pose text, framing text, subject text, aspect_ratio text, origin text not null default 'discovery');
      alter table portfolios add constraint portfolios_origin_purchase_check check ((origin = 'discovery' and purchase_id is not null) or origin = 'foyer' or origin = 'gift');
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, preset text, status text, preview_id uuid);
      create table preview_ledger(id uuid primary key, email text unique, ip_hash text, series text, preset text, resolution text, storage_path text, unlocked_at timestamptz);`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry', '050_gift_previews_before_purchase', '051_gift_session_rate_limit', '052_gift_composition_repair', '055_gift_composition_jobs', '056_gift_final_approval', '057_gift_collection_entrance', '058_gift_preview_generation_record']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }

    // ── before 059: a legacy session with a batch, and U1 holds a paid pack, as live data does
    const legacy = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at) values ($1,'photo-L',1000,1000,'portraits','1:1', now() + interval '7 days') returning id`, [U1]))[0].id as string
    expect((await q(`select * from gift_reserve_batch($1,$2,$3,$4)`, [legacy, U1, 'legacy-key-1', ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']]))[0].o_kind).toBe('free')
    const oldPack = (await q(`insert into gift_preview_packs(user_id, stripe_session_id, amount_cents) values ($1,'cs_old_pack',299) returning id`, [U1]))[0].id as string
    const snap = async () => JSON.parse(JSON.stringify([await q('select * from gift_batches'), await q('select * from gift_previews'), await q('select * from gift_free_grants')]), (k, v) => (k === 'generation_id' && v === null ? undefined : v))
    const before = JSON.stringify(await snap()), sessBefore = (await q('select * from gift_sessions where id=$1', [legacy]))[0]
    await db.exec(fs.readFileSync('supabase/migrations/059_gift_generation_ledger.sql', 'utf8'))
    { const after = JSON.stringify(await snap()); if (after !== before) { let i = 0; while (after[i] === before[i]) i++; throw new Error('snapshot differs near: ' + before.slice(Math.max(0, i - 80), i + 120) + ' || ' + after.slice(Math.max(0, i - 80), i + 120)) } } expect((await q('select * from gift_sessions where id=$1', [legacy]))[0]).toEqual({ ...sessBefore, flow: 'previews' })     // every existing row keeps its meaning
    expect((await q('select units from gift_preview_packs where id=$1', [oldPack]))[0].units).toBe(6)                                                                              // an existing pack is worth six generations
    const mk = async (user: string, sha = 'photo-A', flow = 'generations') => (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at, flow) values ($1,$2,1000,1000,'portraits','1:1', now() + interval '7 days', $3) returning id`, [user, sha, flow]))[0].id as string
    const reserve = (s: string, k: string, user: string, over: any[] = []) => q('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6' + over.map((_, i) => `,$${7 + i}`).join('') + ')', [s, user, k, 'fine_art:12x18', 'a667', '2:3', ...over])
    const finish = async (gid: string, user: string) => { await q('select * from gift_claim_generation($1,$2)', [gid, user]); return (await q('select gift_complete_generation($1,$2,$3,$4,$5,$6,$7,$8) ok', [gid, user, `m/${gid}.png`, `p/${gid}.jpg`, 842, 1263, 'sha-' + gid, JSON.stringify({ v: 1, quality: 'passed' })]))[0].ok as boolean }
    const fail = (gid: string, user: string) => q('select gift_fail_generation($1,$2,$3)', [gid, user, 'nb2_failed'])
    const status = async (s: string, user: string, over: any[] = []) => (await q('select * from gift_generation_status($1,$2' + over.map((_, i) => `,$${3 + i}`).join('') + ')', [s, user, ...over]))[0]

    // ── the flows cannot mix
    const S = await mk(U2)
    expect(await bad(`select * from gift_reserve_batch($1,$2,$3,$4)`, [S, U2, 'legacy-key-2', ['a1', 'a2', 'a3', 'a4', 'a5', 'a6']])).toMatch(/legacy_batches_closed/)
    expect(await bad(`select gift_choose_effect($1,$2,$3)`, [legacy, U1, 'bronze'])).toMatch(/flow_not_generations/)
    expect(await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6)', [S, U2, key(1), 'fine_art:12x18', 'a667', '2:3'])).toMatch(/effect_not_chosen/)

    // ── ONE effect: owner only, idempotent, readable
    expect(await bad(`select gift_choose_effect($1,$2,$3)`, [S, U1, 'bronze'])).toMatch(/session_not_found/)
    const A1 = (await q(`select gift_choose_effect($1,$2,$3) a`, [S, U2, 'bronze']))[0].a as string
    expect((await q(`select gift_choose_effect($1,$2,$3) a`, [S, U2, 'bronze']))[0].a).toBe(A1)
    expect((await q('select artwork_preview_id a from gift_sessions where id=$1', [S]))[0].a).toBe(A1)
    expect((await q(`select kind, cardinality(effect_ids) n from gift_batches where session_id=$1`, [S]))[0]).toEqual({ kind: 'generation', n: 1 }); expect((await q('select status from gift_previews where id=$1', [A1]))[0].status).toBe('pending')

    // ── six free, no pack for U2: the seventh needs payment; in-flight cap; idempotent keys; delivery readies the anchor
    const g1 = (await reserve(S, key(1), U2))[0]; expect(g1).toMatchObject({ o_kind: 'free', o_reused: false, o_status: 'pending' })
    expect((await reserve(S, key(1), U2))[0]).toMatchObject({ o_generation_id: g1.o_generation_id, o_reused: true })
    const g2 = (await reserve(S, key(2), U2))[0]
    expect(await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6)', [S, U2, key(3), 'fine_art:12x18', 'a667', '2:3'])).toMatch(/generation_in_progress/)              // two in flight at most
    expect(await finish(g1.o_generation_id, U2)).toBe(true); expect((await q('select status, master_path, width from gift_previews where id=$1', [A1]))[0]).toEqual({ status: 'ready', master_path: `m/${g1.o_generation_id}.png`, width: 842 })
    expect(await finish(g1.o_generation_id, U2)).toBe(false); expect(await finish(g2.o_generation_id, U2)).toBe(true)
    for (let i = 3; i <= 6; i++) { const g = (await reserve(S, key(i), U2))[0]; expect(g.o_kind, 'g' + i).toBe('free'); await finish(g.o_generation_id, U2) }
    expect(await status(S, U2)).toMatchObject({ o_free_used: 6, o_free_available: false, o_reason: 'session_limit', o_paid_units: 0 })
    expect(await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6)', [S, U2, key(7), 'fine_art:12x18', 'a667', '2:3'])).toMatch(/payment_required/)

    // ── a generation never delivered does NOT count; a retry with the same key finds a slot again
    const F = await mk(U3, 'photo-F'); await q('select gift_choose_effect($1,$2,$3)', [F, U3, 'bronze'])
    const f1 = (await reserve(F, key(1), U3))[0]; expect((await status(F, U3)).o_free_used).toBe(1); expect((await q('select count(*)::int n from gift_free_grants where generation_id=$1', [f1.o_generation_id]))[0].n).toBe(1)
    await fail(f1.o_generation_id, U3)
    expect((await status(F, U3)).o_free_used).toBe(0); expect((await q('select count(*)::int n from gift_free_grants where generation_id=$1', [f1.o_generation_id]))[0].n).toBe(0); expect((await q('select status from gift_generations where id=$1', [f1.o_generation_id]))[0].status).toBe('failed')
    expect((await reserve(F, key(1), U3))[0]).toMatchObject({ o_generation_id: f1.o_generation_id, o_reused: true, o_status: 'pending' })                               // retry: same row, counted again
    expect((await status(F, U3)).o_free_used).toBe(1)
    expect(await finish(f1.o_generation_id, U3)).toBe(true)

    // ── packs: the legacy pack (status paid) is six generations for U1, taken one by one after the free six, restored by a failure
    const P = await mk(U1, 'photo-P'); await q('select gift_choose_effect($1,$2,$3)', [P, U1, 'bronze'])
    for (let i = 1; i <= 6; i++) { const g = (await reserve(P, key(i), U1))[0]; expect(g.o_kind).toBe('free'); await finish(g.o_generation_id, U1) }
    expect((await status(P, U1)).o_paid_units).toBe(6)
    const paid: string[] = []
    for (let i = 7; i <= 12; i++) { const g = (await reserve(P, key(i), U1))[0]; expect(g.o_kind, 'g' + i).toBe('paid'); paid.push(g.o_generation_id); await finish(g.o_generation_id, U1) }
    expect((await q('select status from gift_preview_packs where id=$1', [oldPack]))[0].status).toBe('consumed'); expect((await status(P, U1)).o_paid_units).toBe(0)
    expect(await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6)', [P, U1, key(13), 'fine_art:12x18', 'a667', '2:3'])).toMatch(/payment_required/)
    // a fifth pack buyer: a failed paid generation returns its unit and re-opens the pack
    const P2 = await mk(U1, 'photo-P2'); await q('select gift_choose_effect($1,$2,$3)', [P2, U1, 'bronze'])
    const newPack = (await q(`insert into gift_preview_packs(user_id, stripe_session_id, amount_cents) values ($1,'cs_new_pack',299) returning id`, [U1]))[0].id as string
    for (let i = 1; i <= 6; i++) { const g = (await reserve(P2, key(i), U1))[0]; await finish(g.o_generation_id, U1) }                                                                  // photo cap (6 per photo) is per photo: photo-P2 is a new photo
    const pg = (await reserve(P2, key(7), U1))[0]; expect(pg.o_kind).toBe('paid')
    expect((await status(P2, U1)).o_paid_units).toBe(5); await fail(pg.o_generation_id, U1); expect((await status(P2, U1)).o_paid_units).toBe(6); expect((await q('select status from gift_preview_packs where id=$1', [newPack]))[0].status).toBe('paid')

    // ── account abuse limits, per photo and per 24 hours, apply across sessions and survive deleting a session
    const P3 = await mk(U1, 'photo-P'); await q('select gift_choose_effect($1,$2,$3)', [P3, U1, 'bronze'])                                                                  // the SAME photograph again
    expect((await status(P3, U1)).o_reason).toBe('photo_limit')
    const D = await mk(U3, 'photo-D'); await q('select gift_choose_effect($1,$2,$3)', [D, U3, 'bronze'])
    expect((await reserve(D, key(1), U3, [6, 6, 2, 60]))[0].o_kind).toBe('free')                                                                                                   // 24h cap of 2: the account already has one free grant today from F, this is the second
    const d2 = await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [D, U3, key(2), 'fine_art:12x18', 'a667', '2:3', 6, 6, 2, 60]); expect(d2).toMatch(/payment_required|generation_in_progress/)
    const grantsBefore = (await q('select count(*)::int n from gift_free_grants where user_id=$1', [U2]))[0].n; await q('delete from gift_sessions where id=$1', [S])
    expect((await q('select count(*)::int n from gift_free_grants where user_id=$1', [U2]))[0].n).toBe(grantsBefore); expect((await q('select count(*)::int n from gift_generations where session_id=$1', [S]))[0].n).toBe(0)    // the ledger outlives the session

    // ── acceptance: only a delivered generation, idempotent
    const E = await mk(U3, 'photo-E'); await q('select gift_choose_effect($1,$2,$3)', [E, U3, 'bronze']); const e1 = (await reserve(E, key(1), U3))[0]
    expect(await bad('select gift_accept_generation($1,$2,$3)', [E, U3, e1.o_generation_id])).toMatch(/generation_not_ready/)
    await finish(e1.o_generation_id, U3); const t1 = (await q('select gift_accept_generation($1,$2,$3) t', [E, U3, e1.o_generation_id]))[0].t; expect((await q('select gift_accept_generation($1,$2,$3) t', [E, U3, e1.o_generation_id]))[0].t).toEqual(t1)
    expect(await bad('select gift_accept_generation($1,$2,$3)', [E, U1, e1.o_generation_id])).toMatch(/session_not_found/)

    // ── switching effect supersedes the replaced effect's compositions; locked once the order is past created
    await q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,status,composed_path,preview_path) values ($1,'a',$2,1,'approved','c','p')`, [E, (await q('select artwork_preview_id a from gift_sessions where id=$1', [E]))[0].a])
    const A2 = (await q(`select gift_choose_effect($1,$2,$3) a`, [E, U3, 'clockwork']))[0].a; expect(A2).not.toBe((await q(`select id from gift_previews where session_id=$1 and effect_id='bronze'`, [E]))[0].id)
    expect((await q('select status from gift_compositions where session_id=$1', [E]))[0].status).toBe('superseded')
    const o = (await q(`insert into print_orders(stripe_session_id, status) values ('cs_059','awaiting_artwork') returning id`))[0].id; await q('update gift_sessions set order_id=$2 where id=$1', [E, o])
    expect(await bad(`select gift_choose_effect($1,$2,$3)`, [E, U3, 'bronze'])).toMatch(/order_not_awaiting_artwork/)

    // ── collection sessions: the effect is fixed to the owned artwork's
    const L = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at) values ($1,'photo-C',1,1,'portraits','1:1', now() + interval '7 days') returning id`, [U3]))[0].id
    const cb = (await q(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,1,'collection','collection:abcdefgh',array['bronze']) returning id`, [L, U3]))[0].id
    const cp = (await q(`insert into gift_previews(batch_id,session_id,slot,effect_id,status,master_path,preview_path) values ($1,$2,1,'bronze','ready','m','p') returning id`, [cb, L]))[0].id
    await q(`update gift_sessions set artwork_preview_id=$2, collection_preview_id=gen_random_uuid(), unlock_portfolio_id=gen_random_uuid() where id=$1`, [L, cp])
    expect((await q('select gift_choose_effect($1,$2,$3) a', [L, U3, 'bronze']))[0].a).toBe(cp); expect(await bad('select gift_choose_effect($1,$2,$3)', [L, U3, 'clockwork'])).toMatch(/effect_fixed/)
    expect((await reserve(L, key(1), U3))[0].o_kind).toMatch(/free|paid/)

    // ── permissions and a re-run
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`)
      expect(await bad('select * from gift_generations'), role).toMatch(/permission denied/); expect(await bad('select * from gift_reserve_generation($1,$2,$3,$4,$5,$6)', [E, U3, key(9), 'x', 'y', 'z']), role).toMatch(/permission denied/)
      expect(await bad('select gift_choose_effect($1,$2,$3)', [E, U3, 'x']), role).toMatch(/permission denied/); await db.exec('reset role')
    }
    await db.exec(fs.readFileSync('supabase/migrations/059_gift_generation_ledger.sql', 'utf8'))
    expect((await q(`select count(*)::int n from pg_constraint where conrelid='public.gift_batches'::regclass and conname like '%_059'`))[0].n).toBe(2)
  } finally { await db.close() }
}, 240_000)
