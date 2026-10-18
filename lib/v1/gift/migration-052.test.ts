// Migration 052 against real Postgres (PGlite), on top of 046 to 049 with the same stand-ins for the live tables: operator repair of a composition.
// Existing rows and their history survive; uniqueness extends across repair_seq without changing ordinary behaviour (attempt 1 or 2, one row each); the
// claim is single-holder, expires, and cannot be released or completed by a stranger; completion is one transaction that refuses once the order is
// approved; browser roles reach nothing. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001'
const P1 = '20000000-0000-4000-8000-000000000001'

it.skipIf(!PGlite)('migration 052: repair_seq uniqueness, history kept, the atomic claim, the one-transaction completion, closed to browser roles, safe to re-run', async () => {
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

    // the owner's read-only verify file runs before the migration (everything not yet, nothing FAIL) and after it (nothing FAIL, nothing not yet)
    const verify = fs.readFileSync('docs/GOVERNANCE/gift-052-preflight-and-verify.sql', 'utf8')
    const pre = await q(verify); expect(pre.some((r: any) => String(r.result).startsWith('FAIL'))).toBe(false); expect(pre.find((r: any) => r.check_name === '052 state')!.detail).toBe('not applied yet')

    // before 052: an ordinary composition and a correction exist, as they do live
    const s = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ($1,'sha',10,10,'groups', now() + interval '7 days') returning id`, [U1]))[0].id
    const order = (await q(`insert into print_orders(stripe_session_id, status, paid_at) values ('cs_1','awaiting_artwork', now()) returning id`))[0].id
    await q('update gift_sessions set order_id=$2 where id=$1', [s, order])
    const comp = (attempt: number, extra = '') => q(`insert into gift_compositions(session_id, line_id, preview_id, attempt, status, composed_path, preview_path, width, height, plan ${extra ? ', ' + extra.split('=')[0] : ''})
      values ($1,'a',$2,$3,'ready','c.png','c.jpg',1575,1050,'{"keep":"me"}' ${extra ? ', ' + extra.split('=')[1] : ''}) returning id`, [s, P1, attempt])
    const old = (await comp(1))[0].id; const corr = (await comp(2))[0].id
    await q(`update gift_compositions set status='superseded' where id=$1`, [corr])             // the correction row exists in history already

    const before = await q('select id, session_id, line_id, preview_id, attempt, status, composed_path, width, height, plan, approved_at from gift_compositions order by attempt')
    await db.exec(fs.readFileSync('supabase/migrations/052_gift_composition_repair.sql', 'utf8'))
    expect(await q('select id, session_id, line_id, preview_id, attempt, status, composed_path, width, height, plan, approved_at from gift_compositions order by attempt')).toEqual(before)   // nothing existing changed
    const post = await q(verify); expect(post.filter((r: any) => String(r.result).startsWith('FAIL') || String(r.result).startsWith('NOTE: not yet')).length).toBe(0)
    expect(post.find((r: any) => r.check_name.startsWith('every existing'))!.result).toBe('0'); expect(post.find((r: any) => r.check_name.startsWith('one unique key'))!.detail).toBe('1 unique constraint(s)')
    expect((await q('select distinct repair_seq from gift_compositions')).map((r: any) => r.repair_seq)).toEqual([0])

    // uniqueness across repair_seq: ordinary behaviour is unchanged, a repair row fits beside its original
    expect(await bad(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path) values ($1,'a',$2,1,'x','y')`, [s, P1])).toMatch(/unique|duplicate/)            // a second ordinary attempt 1 still refused
    expect(await bad(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path) values ($1,'a',$2,3,'x','y')`, [s, P1])).toMatch(/check/)               // attempt stays 1 or 2
    expect(await bad(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path, repair_seq) values ($1,'a',$2,1,'x','y',-1)`, [s, P1])).toMatch(/check/)
    const fresh = (await q(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path, width, height, repair_seq) values ($1,'a',$2,1,'n.png','n.jpg',1050,1575,1) returning id`, [s, P1]))[0].id
    expect(await bad(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path, repair_seq) values ($1,'a',$2,1,'x','y',1)`, [s, P1])).toMatch(/unique|duplicate/)   // the same repair twice is refused
    expect((await q(`insert into gift_compositions(session_id, line_id, preview_id, attempt, composed_path, preview_path, repair_seq) values ($1,'a',$2,1,'z','z',2) returning id`, [s, P1])).length).toBe(1)   // a later repair is allowed
    await q(`delete from gift_compositions where repair_seq = 2`)

    // the claim: one holder, nobody else can take, release or complete it
    const claim = (comp: string, line = 'a', op = 'op@x') => q('select gift_claim_repair($1,$2,$3,$4) as t', [s, line, comp, op]).then(r => r[0].t as string | null)
    const t1 = await claim(old); expect(t1).toMatch(/^[0-9a-f-]{36}$/)
    expect(await claim(old)).toBeNull(); expect(await claim(old, 'a', 'other@x')).toBeNull()                         // a second claim while the first lives gets nothing
    expect(await bad('select gift_claim_repair($1,$2,$3,$4)', [s, 'a', old, '  '])).toMatch(/operator_required/)
    expect(await bad('select gift_claim_repair($1,$2,$3,$4)', [s, 'zzz', old, 'op@x'])).toMatch(/composition_not_found/)   // the composition must belong to that line
    expect(await bad('select gift_claim_repair($1,$2,$3,$4)', [s, 'a', corr, 'op@x'])).toMatch(/composition_not_found/)      // and be live
    await q('select gift_release_repair($1,$2,$3)', [s, 'a', '00000000-0000-4000-8000-000000000000']); expect(await claim(old)).toBeNull()      // a wrong token releases nothing
    await q(`update gift_repair_claims set expires_at = now() - interval '1 second'`)                                  // an expired claim can be taken over, with a new token
    const t2 = await claim(old, 'a', 'second@x'); expect(t2).not.toBe(t1); expect(t2).toBeTruthy()
    expect((await q('select operator from gift_repair_claims'))[0].operator).toBe('second@x')

    // completion: needs the claim's token, refuses an inconsistent pair, retires the old row keeping its history, drops the claim, in one step
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t1, old, fresh])).toMatch(/repair_claim_lost/)                       // the first holder lost it
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t2, old, old])).toMatch(/repair_not_consistent/)
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t2, old, corr])).toMatch(/repair_not_consistent/)                  // the replacement must be a ready repair row
    expect((await q('select status from gift_compositions where id=$1', [old]))[0].status).toBe('ready')
    await q(`update print_orders set status='paid' where id=$1`, [order]); expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t2, old, fresh])).toMatch(/order_not_awaiting_artwork/)
    await q(`update print_orders set status='awaiting_artwork' where id=$1`, [order])
    await q('select gift_complete_repair($1,$2,$3,$4,$5,$6)', [s, 'a', t2, old, fresh, JSON.stringify({ repairedBy: 'second@x' })])
    const o = (await q('select status, composed_path, width, height, plan from gift_compositions where id=$1', [old]))[0]
    expect(o).toMatchObject({ status: 'superseded', composed_path: 'c.png', width: 1575, height: 1050 }); expect(o.plan).toMatchObject({ keep: 'me', repairedBy: 'second@x', supersededReason: 'geometry_defect', supersededBy: fresh })
    expect((await q('select count(*)::int as n from gift_repair_claims'))[0].n).toBe(0)
    expect((await q('select status from gift_compositions where id=$1', [fresh]))[0].status).toBe('ready')
    // a retry of the same completion finds no claim: it cannot run twice
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t2, old, fresh])).toMatch(/repair_claim_lost/)
    // the customer's correction entitlement is not part of any of this
    expect(await q('select 1 from gift_order_lines where corrections_used <> 0')).toEqual([])

    // approval is refused once the order is approved, even holding a valid claim
    const t3 = await claim(fresh); await q('update gift_sessions set approved_at = now() where id=$1', [s])
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t3, fresh, fresh])).toMatch(/order_not_awaiting_artwork/)

    // browser roles can call and read none of it
    await db.exec('set role anon')
    expect(await bad('select gift_claim_repair($1,$2,$3,$4)', [s, 'a', fresh, 'x'])).toMatch(/permission denied/)
    expect(await bad('select * from gift_repair_claims')).toMatch(/permission denied/)
    await db.exec('reset role'); await db.exec('set role authenticated')
    expect(await bad('select gift_complete_repair($1,$2,$3,$4,$5)', [s, 'a', t3, fresh, fresh])).toMatch(/permission denied/)
    expect(await bad('select * from gift_repair_claims')).toMatch(/permission denied/)
    await db.exec('reset role')

    // a re-run is harmless and changes no data
    const rows = await q('select * from gift_compositions order by created_at, id')
    await db.exec(fs.readFileSync('supabase/migrations/052_gift_composition_repair.sql', 'utf8'))
    expect(await q('select * from gift_compositions order by created_at, id')).toEqual(rows)
    expect((await q(`select count(*)::int as n from pg_constraint where conrelid='public.gift_compositions'::regclass and contype='u'`))[0].n).toBe(1)     // exactly one unique key remains
  } finally { await db.close() }
}, 120_000)
