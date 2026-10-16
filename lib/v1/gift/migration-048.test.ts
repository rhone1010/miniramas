// Executes migrations 046 + 047 + 048 against real Postgres (PGlite) with minimal stand-ins for the live tables they touch
// (print_orders, portfolios, portfolio_items, preview_ledger). Covers: payment confirmation, the order-gated free batches,
// artwork selection, compositions and the one free correction, approval with the one-time unlock, refund request and
// verified refund, idempotency, and who may call what. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const eff = (n: number, from = 0) => Array.from({ length: n }, (_, i) => 'e' + (from + i + 1))
const LINES = [{ lineId: 'a', productId: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1 }, { lineId: 'b', productId: 'canvas:12x12', sku: 'GLOBAL-CAN-12X12', copies: 2 }]

it.skipIf(!PGlite)('migration 048 enforces pay-first, approval before fulfilment, the one unlock and verified refunds', async () => {
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
      alter table portfolios add constraint portfolios_origin_purchase_check check ((origin = 'discovery' and purchase_id is not null) or
        (origin = 'foyer' and purchase_id is null and series in ('portraits','pets') and size = 1 and delivery = 'preview' and free_unlocks = 0));
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, preset text, status text, preview_id uuid);
      create table preview_ledger(id uuid primary key, email text unique, ip_hash text, series text, preset text, resolution text, storage_path text, unlocked_at timestamptz);`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }

    // ── a session and its (unpaid) order
    const mkSession = async (user: string, order: boolean) => {
      const s = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at) values ($1,'abc',1000,1000,'portraits','1:1', now() + interval '7 days') returning id`, [user]))[0].id as string
      let o: string | null = null
      if (order) {
        o = (await q(`insert into print_orders(stripe_session_id, retail_total_cents) values ($1, 12345) returning id`, ['cs_test_' + s.slice(0, 8)]))[0].id
        await q('select gift_link_order($1,$2,$3,$4)', [s, user, o, 'v1'])
      }
      return { s, o: o!, cs: 'cs_test_' + s.slice(0, 8) }
    }
    const reserve = (s: string, u: string, key: string, effects: string[]) => q('select * from gift_reserve_batch($1,$2,$3,$4)', [s, u, key, effects])
    const ready = (batch: string) => q(`update gift_previews set status='ready', master_path='m/'||id, preview_path='p/'||id where batch_id=$1`, [batch])
    const confirm = (x: { s: string; o: string; cs: string }, user = U1) => q('select gift_confirm_order($1,$2,$3,$4,$5,$6) r', [x.s, x.o, user, x.cs, 'pi_test_1', JSON.stringify(LINES)])

    // ── before payment: no generation at all, whatever the session says
    const A = await mkSession(U1, true)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [A.s, U1, 'key-a-batch-1', eff(6)])).toMatch(/order_payment_required/)
    const noOrder = await mkSession(U1, false)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [noOrder.s, U1, 'key-n-batch-1', eff(6)])).toMatch(/order_payment_required/)
    expect(await bad('select gift_link_order($1,$2,$3,$4)', [A.s, U2, A.o, 'v1'])).toMatch(/session_not_found/)           // not the owner
    const o2 = (await q(`insert into print_orders(stripe_session_id) values ('cs_test_other_1') returning id`))[0].id
    expect(await bad('select gift_link_order($1,$2,$3,$4)', [A.s, U1, o2, 'v1'])).toMatch(/session_already_has_order/)      // one order per session
    expect(await bad('select gift_confirm_order($1,$2,$3,$4,$5,$6)', [A.s, A.o, U2, A.cs, 'pi', '[]'])).toMatch(/session_not_found/)
    expect(await bad('select gift_confirm_order($1,$2,$3,$4,$5,$6)', [A.s, A.o, U1, 'cs_test_forged', 'pi', '[]'])).toMatch(/order_session_mismatch/)

    // ── payment confirmed: order awaits artwork, two free batches, session pinned, lines frozen; idempotent
    expect((await confirm(A))[0].r).toBe('confirmed')
    expect((await confirm(A))[0].r).toBe('already')
    expect((await q('select status::text s, stripe_payment_intent pi, paid_at is not null paid from print_orders where id=$1', [A.o]))[0]).toEqual({ s: 'awaiting_artwork', pi: 'pi_test_1', paid: true })
    expect((await q('select free_batches_granted f, pinned_at is not null p from gift_sessions where id=$1', [A.s]))[0]).toEqual({ f: 2, p: true })
    expect((await q('select line_index i, line_id l, copies c from gift_order_lines where order_id=$1 order by 1', [A.o]))).toEqual([{ i: 0, l: 'a', c: 1 }, { i: 1, l: 'b', c: 2 }])

    // ── batches: two free from the order, then payment_required (packs are separate)
    const b1 = (await reserve(A.s, U1, 'key-a-batch-1', eff(6)))[0]; expect(b1).toMatchObject({ o_kind: 'free', o_batch_index: 1 }); await ready(b1.o_batch_id)
    const b2 = (await reserve(A.s, U1, 'key-a-batch-2', eff(6, 6)))[0]; expect(b2).toMatchObject({ o_kind: 'free', o_batch_index: 2 }); await ready(b2.o_batch_id)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [A.s, U1, 'key-a-batch-3', eff(6, 12)])).toMatch(/payment_required/)
    await q('select gift_fulfill_preview_pack($1,$2,$3)', [U1, 'cs_pack_1', 299])
    const b3 = (await reserve(A.s, U1, 'key-a-batch-3', eff(6, 12)))[0]; expect(b3.o_kind).toBe('paid'); await ready(b3.o_batch_id)
    expect((await reserve(A.s, U1, 'key-a-batch-3', eff(6, 12)))[0].o_reused).toBe(true)

    // ── artwork selection: ready previews of this session only; before approval only
    const previews = await q('select id, effect_id from gift_previews where session_id=$1 order by effect_id', [A.s])
    expect(await bad('select gift_select_artwork($1,$2,$3)', [A.s, U1, '99999999-9999-4999-8999-999999999999'])).toMatch(/preview_not_ready/)
    expect(await bad('select gift_select_artwork($1,$2,$3)', [A.s, U2, previews[0].id])).toMatch(/session_not_found/)
    await q('select gift_select_artwork($1,$2,$3)', [A.s, U1, previews[0].id])
    // generation stays open until approval: a customer may keep browsing after picking a favourite
    await q('select gift_select_artwork($1,$2,$3)', [A.s, U1, previews[1].id])
    expect((await q('select artwork_preview_id a from gift_sessions where id=$1', [A.s]))[0].a).toBe(previews[1].id)

    // ── compositions: approval needs EVERY line approved for THE selected artwork; one free correction per line
    const comp = async (line: string, preview: string, attempt: number, status = 'ready') =>
      (await q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,status,composed_path,preview_path) values ($1,$2,$3,$4,$5,'c','p') returning id`, [A.s, line, preview, attempt, status]))[0].id as string
    const ca = await comp('a', previews[1].id, 1)
    expect(await bad('select gift_approve_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'portraits/x.png', 'src'])).toMatch(/compositions_not_approved/)
    await q(`update gift_compositions set status='approved', approved_at=now() where id=$1`, [ca])
    expect(await bad('select gift_approve_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'portraits/x.png', 'src'])).toMatch(/compositions_not_approved/)   // line b still open
    await q('select gift_use_correction($1,$2,$3)', [A.s, U1, 'b'])
    expect(await bad('select gift_use_correction($1,$2,$3)', [A.s, U1, 'b'])).toMatch(/correction_limit/)                       // only one free correction
    expect(await bad('select gift_use_correction($1,$2,$3)', [A.s, U1, 'zzz'])).toMatch(/line_not_found/)
    expect(await bad(`insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path) values ($1,'b',$2,3,'c','p')`, [A.s, previews[1].id])).toBeTruthy()   // no third attempt
    const cb1 = await comp('b', previews[1].id, 1, 'superseded'); const cb2 = await comp('b', previews[1].id, 2)
    expect(cb1).toBeTruthy()
    // a composition of a DIFFERENT artwork does not count
    await q(`update gift_compositions set status='approved' where id=$1`, [cb2]); await q(`update gift_compositions set preview_id=$2 where id=$1`, [cb2, previews[0].id])
    expect(await bad('select gift_approve_order($1,$2,$3,$4,$5)', [A.s, U1, '30000000-0000-4000-8000-000000000001', 'portraits/x.png', 'src'])).toMatch(/compositions_not_approved/)
    await q(`update gift_compositions set preview_id=$2 where id=$1`, [cb2, previews[1].id])

    // ── approval: the one unlock into My Collection, no entitlement, order -> 'paid' for the existing pipeline; idempotent
    expect(await bad('select gift_approve_order($1,$2,$3,$4,$5)', [A.s, U2, '30000000-0000-4000-8000-000000000001', 'portraits/x.png', 'src'])).toMatch(/session_not_found/)
    const PF = '30000000-0000-4000-8000-000000000001'
    expect((await q('select gift_approve_order($1,$2,$3,$4,$5) r', [A.s, U1, PF, 'portraits/x.png', 'src']))[0].r).toBe('approved')
    expect((await q('select status::text s from print_orders where id=$1', [A.o]))[0].s).toBe('paid')
    expect((await q('select origin, series, size, delivery, free_unlocks, purchase_id from portfolios where id=$1', [PF]))[0]).toEqual({ origin: 'gift', series: 'portraits', size: 1, delivery: 'preview', free_unlocks: 0, purchase_id: null })
    expect((await q('select storage_path sp, unlocked_at is not null u from preview_ledger where id=$1', [previews[1].id]))[0]).toEqual({ sp: 'portraits/x.png', u: true })
    expect((await q('select count(*)::int n from portfolio_items where portfolio_id=$1 and status=$2', [PF, 'done']))[0].n).toBe(1)
    expect((await q('select unlock_portfolio_id u, approved_at is not null a from gift_sessions where id=$1', [A.s]))[0]).toEqual({ u: PF, a: true })
    expect((await q('select gift_approve_order($1,$2,$3,$4,$5) r', [A.s, U1, '30000000-0000-4000-8000-000000000002', 'portraits/y.png', 'src']))[0].r).toBe('already')
    expect((await q('select count(*)::int n from portfolios'))[0].n).toBe(1)                                                        // never a second unlock
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [A.s, U1, 'key-a-batch-4', eff(6, 18)])).toMatch(/order_not_awaiting_artwork/)
    expect(await bad('select gift_request_refund($1,$2,$3,$4)', ['00000000-0000-4000-8000-000000000000', U1, 'x', null])).toMatch(/session_not_found/)

    // ── refund: a request blocks generation and approval until Concierge resolves it; idempotent per order
    const B = await mkSession(U1, true); await confirm(B)
    const rb = (await reserve(B.s, U1, 'key-b-batch-1', eff(6, 50)))[0]; await ready(rb.o_batch_id)
    const msg = '40000000-0000-4000-8000-000000000001'
    const r1 = (await q('select gift_request_refund($1,$2,$3,$4) id', [B.s, U1, 'none of them are right', msg]))[0].id
    expect((await q('select gift_request_refund($1,$2,$3,$4) id', [B.s, U1, 'again', msg]))[0].id).toBe(r1)
    expect((await q('select count(*)::int n from gift_refund_requests where order_id=$1', [B.o]))[0].n).toBe(1)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [B.s, U1, 'key-b-batch-2', eff(6, 60)])).toMatch(/refund_pending/)
    const pv = (await q('select id from gift_previews where session_id=$1 limit 1', [B.s]))[0].id
    expect(await bad('select gift_select_artwork($1,$2,$3)', [B.s, U1, pv])).toMatch(/refund_pending/)
    expect(await bad('select gift_approve_order($1,$2,$3,$4,$5)', [B.s, U1, '30000000-0000-4000-8000-000000000003', 'portraits/z.png', 'src'])).toMatch(/refund_pending/)
    await q('select gift_decline_refund($1)', [B.o])                                                                               // Concierge declines: the customer continues
    expect((await q('select refund_requested_at is null n from gift_sessions where id=$1', [B.s]))[0].n).toBe(true)
    expect((await reserve(B.s, U1, 'key-b-batch-2', eff(6, 60)))[0].o_batch_index).toBe(2)
    await ready((await q('select id from gift_batches where session_id=$1 and batch_index=2', [B.s]))[0].id)
    await q('select gift_request_refund($1,$2,$3,$4)', [B.s, U1, 'still no', msg])                                                  // re-requestable after a decline

    // ── a verified full refund cancels the order, releases the session for cleanup, never manufactures; idempotent on the refund id
    expect((await q('select gift_apply_refund($1,$2,$3,$4) r', [B.o, 're_test_1', 12345, true]))[0].r).toBe('cancelled')
    expect((await q('select gift_apply_refund($1,$2,$3,$4) r', [B.o, 're_test_1', 12345, true]))[0].r).toBe('already')
    expect((await q('select status::text s from print_orders where id=$1', [B.o]))[0].s).toBe('cancelled')
    expect((await q('select refunded_at is not null r, pinned_at is null p, refund_requested_at is null q from gift_sessions where id=$1', [B.s]))[0]).toEqual({ r: true, p: true, q: true })
    expect((await q('select status from gift_refund_requests where order_id=$1', [B.o]))[0].status).toBe('refunded')
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [B.s, U1, 'key-b-batch-3', eff(6, 70)])).toMatch(/order_refunded/)
    expect((await q('select gift_apply_refund($1,$2,$3,$4) r', ['00000000-0000-4000-8000-000000000000', 're_x', 100, true]))[0].r).toBe('not_gift_order')

    // ── a partial refund is recorded and cancels nothing; a refund after placement is flagged, not undone
    const C = await mkSession(U1, true); await confirm(C)
    expect((await q('select gift_apply_refund($1,$2,$3,$4) r', [C.o, 're_test_part', 500, false]))[0].r).toBe('recorded_partial')
    expect((await q('select status::text s from print_orders where id=$1', [C.o]))[0].s).toBe('awaiting_artwork')
    await q(`update print_orders set status='placed', prodigi_order_id='ord_1', placed_at=now() where id=$1`, [C.o])
    expect(await bad('select gift_request_refund($1,$2,$3,$4)', [C.s, U1, 'late', null])).toMatch(/refund_not_available_after_manufacturing/)
    expect((await q('select gift_apply_refund($1,$2,$3,$4) r', [C.o, 're_test_late', 12345, true]))[0].r).toBe('refunded_after_placement')
    expect((await q('select status::text s from print_orders where id=$1', [C.o]))[0].s).toBe('placed')                              // the lab order is untouched
    await q('select gift_release_session($1)', [C.o])
    expect((await q('select pinned_at is null p from gift_sessions where id=$1', [C.s]))[0].p).toBe(true)

    // ── an unpaid or cancelled order cannot be confirmed; the browser roles cannot call anything
    const D = await mkSession(U1, true); await q(`update print_orders set status='cancelled' where id=$1`, [D.o])
    expect(await bad('select gift_confirm_order($1,$2,$3,$4,$5,$6)', [D.s, D.o, U1, D.cs, 'pi', '[]'])).toMatch(/order_not_payable/)
    expect(await bad('select gift_request_refund($1,$2,$3,$4)', [D.s, U1, 'x', null])).toMatch(/order_not_paid/)          // never paid: nothing to refund
    for (const role of ['anon', 'authenticated']) {
      await db.exec('set role ' + role)
      for (const sql of ['select gift_confirm_order($1,$2,$3,$4,$5,$6)', 'select gift_apply_refund($1,$2,$3,$4)', 'select gift_approve_order($1,$2,$3,$4,$5)', 'select gift_link_order($1,$2,$3,$4)']) {
        const n = (sql.match(/\$/g) ?? []).length
        expect(await bad(sql, Array.from({ length: n }, () => null)), role + ' ' + sql).toMatch(/permission denied/)
      }
      expect(await bad('select * from gift_order_lines'), role).toMatch(/permission denied/)
      expect(await bad('select * from gift_refunds'), role).toMatch(/permission denied/)
      await db.exec('reset role')
    }

    // ── gift is an accepted print job source, and the migration re-applies cleanly
    expect((await q(`select pg_get_constraintdef(oid) d from pg_constraint where conrelid='public.print_asset_jobs'::regclass and contype='c' and pg_get_constraintdef(oid) ilike '%source_kind%'`))[0].d).toMatch(/gift/)
    await db.exec(fs.readFileSync('supabase/migrations/048_gift_orders.sql', 'utf8'))
  } finally { await db.close() }
}, 120_000)
