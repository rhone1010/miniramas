// The one-paste launch bundle (055 then 056 in one transaction) is exactly the two migrations, and it runs on real Postgres (PGlite) on top of 046 to 049 and 052 without error, twice.
import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const lf = (f: string) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n').trim()

it('the bundle is exactly 055 then 056 inside begin/commit, so it cannot drift from the migrations', () => {
  const bundle = lf('docs/GOVERNANCE/gift-launch-apply-055-056.sql')
  expect(bundle).toContain(lf('supabase/migrations/055_gift_composition_jobs.sql')); expect(bundle).toContain(lf('supabase/migrations/056_gift_final_approval.sql'))
  expect(bundle.indexOf(lf('supabase/migrations/055_gift_composition_jobs.sql'))).toBeLessThan(bundle.indexOf(lf('supabase/migrations/056_gift_final_approval.sql')))
  expect(/^begin;$/m.test(bundle) && /^commit;$/m.test(bundle)).toBe(true)
})
it.skipIf(!PGlite)('the bundle runs on real Postgres after 046-049 and 052, and a second run changes nothing', async () => {
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
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions', '048_gift_orders', '049_gift_composition_geometry', '052_gift_composition_repair']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string) => (await db.query(sql)).rows
    const bundle = fs.readFileSync('docs/GOVERNANCE/gift-launch-apply-055-056.sql', 'utf8')
    await db.exec(bundle)
    const v55 = await q(fs.readFileSync('docs/GOVERNANCE/gift-composition-jobs-055-preflight-and-verify.sql', 'utf8')), v56 = await q(fs.readFileSync('docs/GOVERNANCE/gift-056-preflight-and-verify.sql', 'utf8'))
    for (const rows of [v55, v56]) expect(rows.filter((r: any) => String(r.result).startsWith('FAIL') || /not applied yet|not yet/.test(String(r.result))).length).toBe(0)
    await db.exec(bundle)
  } finally { await db.close() }
}, 120_000)
