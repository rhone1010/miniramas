// Migration 056 against real Postgres (PGlite), on top of 046 to 049 with the same stand-ins for the live tables: the customer's FINAL approval is recorded without touching the
// order's status (fulfilment cannot see it), it validates exactly what the old approval validated, it is idempotent, and the separate release is the only step that moves the
// order to 'paid'. Browser roles reach nothing; a re-run is harmless. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const LINES = [{ lineId: 'a', productId: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', sku: 'GLOBAL-CAN-12X12', copies: 2 }]
const eff = (n: number) => Array.from({ length: n }, (_, i) => 'e' + (i + 1))

it.skipIf(!PGlite)('migration 056: final approval records approval only; release is separate; idempotent; validated; closed to browser roles; safe to re-run', async () => {
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
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }

    // the owner's read-only verify file: before the migration "not applied yet", nothing FAIL
    const verify = fs.readFileSync('docs/GOVERNANCE/gift-056-preflight-and-verify.sql', 'utf8')
    const pre = await q(verify); expect(pre.some((r: any) => String(r.result).startsWith('FAIL'))).toBe(false); expect(pre.find((r: any) => r.check_name === 'final_approved_at column')!.result).toBe('not applied yet')

    // a paid session with a selected artwork and two lines, one of which is already APPROVED and one released legacy session, as they exist live
    const mk = async () => {
      const s = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at) values ($1,'abc',1000,1000,'portraits','1:1', now() + interval '7 days') returning id`, [U1]))[0].id as string
      const o = (await q(`insert into print_orders(stripe_session_id, retail_total_cents) values ($1, 12345) returning id`, ['cs_' + s.slice(0, 8)]))[0].id as string
      await q('select gift_link_order($1,$2,$3,$4)', [s, U1, o, 'v1']); await q('select gift_confirm_order($1,$2,$3,$4,$5,$6)', [s, o, U1, 'cs_' + s.slice(0, 8), 'pi_1', JSON.stringify(LINES)])
      const b = (await q('select * from gift_reserve_batch($1,$2,$3,$4)', [s, U1, 'key-' + s.slice(0, 8), eff(6)]))[0]
      await q(`update gift_previews set status='ready', master_path='m/'||id, preview_path='p/'||id where batch_id=$1`, [b.o_batch_id])
      const pv = (await q('select id from gift_previews where batch_id=$1 limit 1', [b.o_batch_id]))[0].id as string
      await q('select gift_select_artwork($1,$2,$3)', [s, U1, pv])
      return { s, o, pv }
    }
    const comp = (x: { s: string; pv: string }, line: string, status = 'approved') => q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,status,composed_path,preview_path) values ($1,$2,$3,1,$4,'c','p') returning id`, [x.s, line, x.pv, status]).then(r => r[0].id as string)
    const legacy = await mk(); await comp(legacy, 'a'); await comp(legacy, 'b')
    await q('select gift_approve_order($1,$2,$3,$4,$5)', [legacy.s, U1, '30000000-0000-4000-8000-0000000000aa', 'portraits/l.png', 'src'])          // released by the OLD function, before 056
    const beforeLegacy = await q('select * from gift_sessions where id=$1', [legacy.s])

    await db.exec(fs.readFileSync('supabase/migrations/056_gift_final_approval.sql', 'utf8'))
    const post = await q(verify); expect(post.filter((r: any) => String(r.result).startsWith('FAIL') || String(r.result) === 'not applied yet').length).toBe(0)
    expect((await q('select * from gift_sessions where id=$1', [legacy.s]))[0]).toEqual({ ...beforeLegacy[0], final_approved_at: null })                  // a legacy session is unchanged but for the new null column
    expect((await q(`select gift_finalize_order($1,$2,$3,$4,$5) r`, [legacy.s, U1, '30000000-0000-4000-8000-0000000000ab', 'portraits/l2.png', 'src']))[0].r).toBe('already')   // approved before 056 reads as already approved
    expect((await q('select count(*)::int n from portfolios'))[0].n).toBe(1)

    // ── finalize: validated exactly like the old approval
    const A = await mk(); const F = (s: string, u = U1, pf = '30000000-0000-4000-8000-000000000001') => q('select gift_finalize_order($1,$2,$3,$4,$5) r', [s, u, pf, 'portraits/x.png', 'src'])
    expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'x', 'src'])).toMatch(/compositions_not_approved/)           // none approved
    const ca = await comp(A, 'a'); expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'x', 'src'])).toMatch(/compositions_not_approved/)   // one of two
    const cb = await comp(A, 'b', 'ready'); expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'x', 'src'])).toMatch(/compositions_not_approved/)   // ready is not approved
    await q(`update gift_compositions set status='approved' where id=$1`, [cb])
    expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U2, '30000000-0000-4000-8000-000000000001', 'x', 'src'])).toMatch(/session_not_found/)                          // not the owner
    const orderBefore = (await q('select status::text s, paid_at, stripe_payment_intent pi, retail_total_cents t, updated_at from print_orders where id=$1', [A.o]))[0]
    expect((await F(A.s))[0].r).toBe('approved')
    // the order row is byte-identical: still awaiting_artwork, so invisible to the poller, completePrintOrder and the retry paths; approved_at (= released) is NOT set
    expect((await q('select status::text s, paid_at, stripe_payment_intent pi, retail_total_cents t, updated_at from print_orders where id=$1', [A.o]))[0]).toEqual(orderBefore); expect(orderBefore.s).toBe('awaiting_artwork')
    expect((await q('select final_approved_at is not null f, approved_at is null a, unlock_portfolio_id u from gift_sessions where id=$1', [A.s]))[0]).toEqual({ f: true, a: true, u: '30000000-0000-4000-8000-000000000001' })
    expect((await q(`select count(*)::int n from print_orders where status::text in ('paid','withheld','error')`))[0].n).toBe(1)                                                         // only the legacy one is fulfilment-visible
    // idempotent: a repeat (even with another portfolio id) changes nothing and never makes a second unlock
    const t1 = (await q('select final_approved_at t from gift_sessions where id=$1', [A.s]))[0].t
    expect((await F(A.s, U1, '30000000-0000-4000-8000-000000000002'))[0].r).toBe('already'); expect((await q('select final_approved_at t from gift_sessions where id=$1', [A.s]))[0].t).toEqual(t1)
    expect((await q('select count(*)::int n from portfolios'))[0].n).toBe(2)

    // ── refusal paths on fresh sessions
    const B = await mk(); await comp(B, 'a'); await comp(B, 'b')
    await q('select gift_request_refund($1,$2,$3,$4)', [B.s, U1, 'no', null]); expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [B.s, U1, '30000000-0000-4000-8000-000000000003', 'x', 'src'])).toMatch(/refund_pending/)
    expect(await bad('select gift_release_order($1)', [B.s])).toMatch(/refund_pending/)
    await q('select gift_decline_refund($1)', [B.o])
    // ── release: needs the final approval, then (and only then) fulfilment can see the order; idempotent; no customer path
    expect(await bad('select gift_release_order($1)', [B.s])).toMatch(/final_approval_required/); expect((await q('select status::text s from print_orders where id=$1', [B.o]))[0].s).toBe('awaiting_artwork')
    await q('select gift_finalize_order($1,$2,$3,$4,$5)', [B.s, U1, '30000000-0000-4000-8000-000000000003', 'x', 'src'])
    expect(await bad('select gift_release_order($1)', ['00000000-0000-4000-8000-000000000000'])).toMatch(/session_not_found/)
    expect((await q('select gift_release_order($1) r', [B.s]))[0].r).toBe('released')
    expect((await q('select status::text s from print_orders where id=$1', [B.o]))[0].s).toBe('paid'); expect((await q('select approved_at is not null a from gift_sessions where id=$1', [B.s]))[0].a).toBe(true)
    expect((await q('select gift_release_order($1) r', [B.s]))[0].r).toBe('already')
    expect((await q('select gift_release_order($1) r', [legacy.s]))[0].r).toBe('already')                                                                                             // the pre-056 release stays released
    // a refunded session can be neither finalized nor released
    const C = await mk(); await comp(C, 'a'); await comp(C, 'b'); await q('select gift_apply_refund($1,$2,$3,$4)', [C.o, 're_1', 12345, true])
    expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [C.s, U1, '30000000-0000-4000-8000-000000000004', 'x', 'src'])).toMatch(/order_refunded/)

    // ── permissions: closed to the browser roles, open to the service role; a re-run is harmless
    await db.exec('set role anon'); expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U1, A.pv, 'x', 'src'])).toMatch(/permission denied/); expect(await bad('select gift_release_order($1)', [A.s])).toMatch(/permission denied/); await db.exec('reset role')
    await db.exec('set role authenticated'); expect(await bad('select gift_finalize_order($1,$2,$3,$4,$5)', [A.s, U1, A.pv, 'x', 'src'])).toMatch(/permission denied/); expect(await bad('select gift_release_order($1)', [A.s])).toMatch(/permission denied/); await db.exec('reset role')
    await db.exec('set role service_role'); expect((await q('select gift_release_order($1) r', [A.s]))[0].r).toBe('released'); await db.exec('reset role')
    await db.exec(fs.readFileSync('supabase/migrations/056_gift_final_approval.sql', 'utf8'))
  } finally { await db.close() }
}, 120_000)
