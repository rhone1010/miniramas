// Migration 057 (the My Collection entrance) against real Postgres (PGlite), on top of 046 to 052, 055 and 056: ownership is decided in the database; the owned piece is never written;
// starting twice gives the same session; a collection session cannot take generation batches; the existing approval path creates NO second My Collection piece; browser roles reach nothing;
// a re-run is harmless. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const LINES = [{ lineId: 'a', productId: 'fine_art:8x8', sku: 'GLOBAL-FAP-8X8', copies: 1 }]

it.skipIf(!PGlite)('migration 057: database-side ownership, owned records untouched, idempotent, no generation for collection sessions, finalize creates no second piece, closed to browser roles, re-runnable', async () => {
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
      alter table portfolios add constraint portfolios_origin_purchase_check check ((origin = 'discovery' and purchase_id is not null) or origin = 'foyer' or origin = 'gift');
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, preset text, status text, preview_id uuid);
      create table preview_ledger(id uuid primary key, email text unique, ip_hash text, series text, preset text, resolution text, storage_path text, unlocked_at timestamptz);`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry', '050_gift_previews_before_purchase', '051_gift_session_rate_limit', '052_gift_composition_repair', '055_gift_composition_jobs', '056_gift_final_approval']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }

    const verify = fs.readFileSync('docs/GOVERNANCE/gift-057-preflight-and-verify.sql', 'utf8')
    const pre = await q(verify); expect(pre.some((r: any) => String(r.result).startsWith('FAIL'))).toBe(false); expect(pre.find((r: any) => r.check_name === 'collection_preview_id column')!.result).toBe('not applied yet')

    // an ordinary photo session before 057 (history that must survive the constraint change)
    const old = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, master_aspect, expires_at) values ($1,'abc',1000,1000,'portraits','1:1', now() + interval '7 days') returning id`, [U1]))[0].id as string
    const ob = (await q('select * from gift_reserve_batch($1,$2,$3,$4)', [old, U1, 'key-old-batch', ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']]))[0]; expect(ob.o_kind).toBe('free')

    // the owned piece, as My Collection stores it
    const PF = id(1), L = id(2), L2 = id(3), PFW = id(4), LW = id(5)
    await q(`insert into portfolios(id,purchase_id,user_id,series,size,status,free_unlocks,source_image,delivery,origin) values ($1,$2,$3,'portraits',1,'ready',0,'SRC','preview','discovery')`, [PF, id(90), U1])
    await q(`insert into portfolio_items(portfolio_id,slot,preset,status,preview_id) values ($1,0,'bronze','done',$2)`, [PF, L])
    await q(`insert into preview_ledger(id,email,ip_hash,series,preset,resolution,storage_path,unlocked_at) values ($1,$2,'x','portraits','bronze','1k','portraits/owned.png', now())`, [L, `portfolio:${PF}:0`])
    const owned = async () => JSON.stringify({ pf: await q('select * from portfolios order by id'), it: await q('select * from portfolio_items order by id'), led: await q('select * from preview_ledger order by id') })
    const ownedBefore = await owned()

    // 057
    await db.exec(fs.readFileSync('supabase/migrations/057_gift_collection_entrance.sql', 'utf8'))
    const post = await q(verify); expect(post.filter((r: any) => String(r.result).startsWith('FAIL') || String(r.result) === 'not applied yet').length).toBe(0)
    expect((await q('select kind, cardinality(effect_ids) n from gift_batches where session_id=$1', [old]))[0]).toEqual({ kind: 'free', n: 6 })       // history untouched

    const create = (user: string, owned: string, s: string, b: string, p: string) => q('select * from gift_create_collection_session($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now() + interval \'7 days\',$12,$13,$14,$15)',
      [user, owned, s, b, p, `gift/${s}/source.jpg`, 'sha', 800, 600, JSON.stringify({ peopleCount: null }), '1:1', `gift/${s}/masters/${p}.png`, `gift/${s}/previews/${p}.jpg`, 1024, 1024])
    const S1 = id(11), B1 = id(12), P1 = id(13)
    const c1 = (await create(U1, L, S1, B1, P1))[0]; expect(c1).toEqual({ o_session: S1, o_created: true })
    expect((await q('select series, unlock_portfolio_id u, collection_preview_id c, artwork_preview_id a, master_aspect m, lines from gift_sessions where id=$1', [S1]))[0]).toEqual({ series: 'portraits', u: PF, c: L, a: P1, m: '1:1', lines: [] })
    expect((await q('select kind, batch_index i, effect_ids e, pack_id from gift_batches where session_id=$1', [S1]))[0]).toEqual({ kind: 'collection', i: 1, e: ['bronze'], pack_id: null })
    expect((await q('select slot, effect_id e, status s, master_path mp from gift_previews where session_id=$1', [S1]))[0]).toMatchObject({ slot: 1, e: 'bronze', s: 'ready', mp: `gift/${S1}/masters/${P1}.png` })
    expect(await owned()).toBe(ownedBefore)                                                                    // the owned piece is byte-identical

    // idempotent: starting again (new ids offered) returns the SAME session and writes nothing
    const rows = async () => JSON.stringify([(await q('select count(*)::int n from gift_sessions'))[0], (await q('select count(*)::int n from gift_batches'))[0], (await q('select count(*)::int n from gift_previews'))[0]])
    const snap = await rows(); expect((await create(U1, L, id(21), id(22), id(23)))[0]).toEqual({ o_session: S1, o_created: false }); expect(await rows()).toBe(snap)
    expect(await bad('insert into gift_sessions(user_id, source_sha256, source_width, source_height, expires_at, collection_preview_id) values ($1,$2,1,1, now(), $3)', [U1, 'z', L])).toMatch(/unique|duplicate/)      // the database refuses a second live session for the piece

    // ownership is decided in the database; a refusal creates nothing and does not say why
    const refuse = async (u: string, o: string, m: RegExp) => { const before = await rows(); expect(await bad('select * from gift_create_collection_session($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15)', [u, o, id(31), id(32), id(33), 'p', 's', 1, 1, '{}', '1:1', 'm', 'v', 1, 1])).toMatch(m); expect(await rows()).toBe(before) }
    await refuse(U2, L, /artwork_not_found/)                                                                    // someone else's piece
    await refuse(U1, id(99), /artwork_not_found/)                                                               // no such piece
    await q(`insert into portfolios(id,purchase_id,user_id,series,size,status,free_unlocks,source_image,delivery,origin) values ($1,$2,$3,'portraits',1,'ready',0,'S','preview','discovery')`, [PFW, id(91), U1])
    await q(`insert into portfolio_items(portfolio_id,slot,preset,status,preview_id) values ($1,0,'bronze','done',$2)`, [PFW, LW]); await q(`insert into preview_ledger(id,email,series,storage_path,unlocked_at) values ($1,$2,'portraits','p/x.png', null)`, [LW, `portfolio:${PFW}:0`])
    await refuse(U1, LW, /artwork_not_found/)                                                                   // not unlocked
    await q(`update preview_ledger set unlocked_at = now(), email = 'someone@example.com' where id = $1`, [LW]); await refuse(U1, LW, /artwork_not_found/)    // a ledger row that is not a portfolio piece
    await q(`update preview_ledger set email = $2 where id = $1`, [LW, `portfolio:${PFW}:0`]); await q(`update portfolio_items set status = 'pending' where portfolio_id = $1`, [PFW]); await refuse(U1, LW, /artwork_not_found/)   // not finished
    await q(`update portfolio_items set status = 'done' where portfolio_id = $1`, [PFW]); await q(`update portfolios set series = 'wallpapers' where id = $1`, [PFW]); await refuse(U1, LW, /artwork_not_compatible/)
    await q(`insert into preview_ledger(id,email,series,storage_path,unlocked_at) values ($1,$2,'portraits','p/y.png', now())`, [L2, `portfolio:${PFW}:7`]); await refuse(U1, L2, /artwork_not_found/)   // the item for that slot does not exist
    expect(await owned()).not.toBe(ownedBefore)                                                                  // (the rows added for the refusal cases) ...
    await q('delete from preview_ledger where id in ($1,$2)', [LW, L2]); await q('delete from portfolio_items where portfolio_id=$1', [PFW]); await q('delete from portfolios where id=$1', [PFW])
    expect(await owned()).toBe(ownedBefore)                                                                      // ... and back to exactly the original

    // constraints: free and paid batches still need six effects; a collection batch exactly one; a collection session takes no generation batch
    const S0 = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ($1,'q',1,1,'pets', now() + interval '7 days') returning id`, [U1]))[0].id as string
    expect(await bad(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,1,'free','key-one-effect',array['a'])`, [S0, U1])).toMatch(/check/)
    expect(await bad(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,1,'collection','key-six-effects',array['a','b','c','d','e','f'])`, [S0, U1])).toMatch(/check/)
    expect(await bad(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,1,'bogus','key-bogus-kind',array['a'])`, [S0, U1])).toMatch(/check/)
    expect(await bad(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,$2,2,'free','key-after-collection',array['a','b','c','d','e','f'])`, [S1, U1])).toMatch(/collection_session_no_generation/)
    expect(await bad('select * from gift_reserve_batch($1,$2,$3,$4)', [S1, U1, 'key-generate-more', ['e1', 'e2', 'e3', 'e4', 'e5', 'e6']])).toBeTruthy()      // the real generation entry point refuses too

    // the existing approval path: a paid order, one approved line, then gift_finalize_order creates NO second piece and leaves the owned one alone
    const o = (await q(`insert into print_orders(stripe_session_id, retail_total_cents) values ('cs_057', 1000) returning id`))[0].id as string
    await q('select gift_link_order($1,$2,$3,$4)', [S1, U1, o, 'v1']); await q('select gift_confirm_order($1,$2,$3,$4,$5,$6)', [S1, o, U1, 'cs_057', 'pi_1', JSON.stringify(LINES)])
    await q(`insert into gift_compositions(session_id,line_id,preview_id,attempt,status,composed_path,preview_path) values ($1,'a',$2,1,'approved','c','p')`, [S1, P1])
    expect((await q('select gift_finalize_order($1,$2,$3,$4,$5) r', [S1, U1, id(41), 'portraits/new.png', 'src']))[0].r).toBe('approved')
    expect(await owned()).toBe(ownedBefore)                                                                       // no second portfolio, no ledger row, nothing changed
    expect((await q('select unlock_portfolio_id u, final_approved_at is not null f from gift_sessions where id=$1', [S1]))[0]).toEqual({ u: PF, f: true })
    expect((await q('select status::text s from print_orders where id=$1', [o]))[0].s).toBe('awaiting_artwork')

    // removing the session (retention) removes its batch and preview, never the owned piece
    await q('delete from gift_sessions where id=$1', [S1]); expect((await q('select count(*)::int n from gift_batches where session_id=$1', [S1]))[0].n).toBe(0); expect(await owned()).toBe(ownedBefore)
    expect((await create(U1, L, id(51), id(52), id(53)))[0].o_created).toBe(true)                                // a new session can be started once the old one is gone

    // permissions and a re-run
    await db.exec('set role anon'); expect(await bad('select * from gift_create_collection_session($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15)', [U1, L, id(61), id(62), id(63), 'p', 's', 1, 1, '{}', '1:1', 'm', 'v', 1, 1])).toMatch(/permission denied/); await db.exec('reset role')
    await db.exec('set role authenticated'); expect(await bad('select * from gift_create_collection_session($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now(),$12,$13,$14,$15)', [U1, L, id(61), id(62), id(63), 'p', 's', 1, 1, '{}', '1:1', 'm', 'v', 1, 1])).toMatch(/permission denied/); await db.exec('reset role')
    await db.exec(fs.readFileSync('supabase/migrations/057_gift_collection_entrance.sql', 'utf8'))
    expect((await q('select count(*)::int n from pg_constraint where conrelid = \'public.gift_batches\'::regclass and conname like \'%_057\''))[0].n).toBe(2)   // the widened checks exist once
  } finally { await db.close() }
}, 180_000)
