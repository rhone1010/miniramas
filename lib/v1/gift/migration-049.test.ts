// Migration 049 against real Postgres (PGlite): the composition geometry columns, the method check, shared files through
// source_composition_id, and a harmless re-run. Applied on top of 046 to 048 with the same stand-ins for the live tables.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001'

it.skipIf(!PGlite)('migration 049 adds composition geometry without changing how lines are approved', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      create type public.print_order_status as enum ('created','paid','placed','in_production','shipped','delivered','cancelled','error');
      create table print_orders(id uuid primary key default gen_random_uuid(), status public.print_order_status not null default 'created',
        stripe_session_id text not null unique, stripe_payment_intent text, paid_at timestamptz, placed_at timestamptz, prodigi_order_id text,
        retail_total_cents int not null default 0, updated_at timestamptz default now());
      create table portfolios(id uuid primary key, purchase_id uuid, user_id uuid, series text, size int, status text, free_unlocks int, source_image text,
        composition jsonb, delivery text, pose text, framing text, subject text, aspect_ratio text, origin text not null default 'discovery');
      alter table portfolios add constraint portfolios_origin_purchase_check check (origin = 'discovery' and purchase_id is not null or origin = 'foyer');
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, preset text, status text, preview_id uuid);
      create table preview_ledger(id uuid primary key, email text unique, ip_hash text, series text, preset text, resolution text, storage_path text, unlocked_at timestamptz);`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }

    const s = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ($1,'abc',10,10,'portraits', now() + interval '7 days') returning id`, [U1]))[0].id
    const preview = '20000000-0000-4000-8000-000000000001'
    const ins = (line: string, attempt: number, extra = '', vals: any[] = []) => q(
      `insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path${extra ? ',' + extra.split('=')[0] : ''}) values ($1,$2,$3,$4,'c','p'${extra ? ',' + '$5' : ''}) returning id`, [s, line, preview, attempt, ...vals])

    // existing rows and inserts keep working: method defaults to deterministic, the new columns are optional
    const a = (await ins('a', 1))[0].id
    expect((await q('select method, geometry_key, source_composition_id from gift_compositions where id=$1', [a]))[0]).toEqual({ method: 'deterministic', geometry_key: null, source_composition_id: null })

    // generation provenance defaults to "adapted, no model call, no cost", and the checks hold
    expect((await q('select generation_mode, generation_aspect, nb21_calls, outpaint_calls, cost_usd_est from gift_compositions where id=$1', [a]))[0]).toEqual(
      { generation_mode: 'none', generation_aspect: null, nb21_calls: 0, outpaint_calls: 0, cost_usd_est: null })
    await q(`update gift_compositions set generation_mode='favorite_reference', generation_aspect='2:3', nb21_calls=1, cost_usd_est=0.0670 where id=$1`, [a])
    expect((await q('select generation_mode, generation_aspect, nb21_calls from gift_compositions where id=$1', [a]))[0]).toEqual({ generation_mode: 'favorite_reference', generation_aspect: '2:3', nb21_calls: 1 })
    expect(await bad(`update gift_compositions set generation_mode='magic' where id=$1`, [a])).toBeTruthy()
    expect(await bad(`update gift_compositions set nb21_calls=-1 where id=$1`, [a])).toBeTruthy()
    expect(await bad(`update gift_compositions set cost_usd_est=-1 where id=$1`, [a])).toBeTruthy()
    await q(`update gift_compositions set generation_mode='none', generation_aspect=null, nb21_calls=0, cost_usd_est=null where id=$1`, [a])

    // a second line shares the first line's files, recorded through source_composition_id; both keep their own rows and statuses
    const b = (await q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path,geometry_key,method,source_composition_id) values ($1,'b',$2,1,'c','p','a667','generated',$3) returning id`, [s, preview, a]))[0].id
    await q(`update gift_compositions set geometry_key='a667', method='generated' where id=$1`, [a])
    await q(`update gift_compositions set status='approved', approved_at=now() where id=$1`, [a])
    expect((await q('select line_id, status, geometry_key, method from gift_compositions where session_id=$1 order by line_id', [s]))).toEqual([
      { line_id: 'a', status: 'approved', geometry_key: 'a667', method: 'generated' }, { line_id: 'b', status: 'ready', geometry_key: 'a667', method: 'generated' }])

    // the one free correction is still a separate attempt row for its own line (attempt 3 is still refused)
    await q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path,geometry_key,method) values ($1,'b',$2,2,'c2','p2','a667','generated')`, [s, preview])
    expect(await bad(`insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path) values ($1,'b',$2,3,'c','p')`, [s, preview])).toBeTruthy()
    expect(await bad(`insert into gift_compositions(session_id,line_id,preview_id,attempt,composed_path,preview_path,method) values ($1,'z',$2,1,'c','p','invented')`, [s, preview])).toBeTruthy()

    // removing the row whose files were shared never removes the line that reused them
    await q('delete from gift_compositions where id=$1', [a])
    expect((await q('select source_composition_id from gift_compositions where id=$1', [b]))[0].source_composition_id).toBeNull()

    // permissions are unchanged, and a re-run is harmless
    await db.exec('set role anon')
    expect(await bad('select * from gift_compositions')).toMatch(/permission denied/)
    await db.exec('reset role')
    await db.exec(fs.readFileSync('supabase/migrations/049_gift_composition_geometry.sql', 'utf8'))
  } finally { await db.close() }
}, 120_000)
