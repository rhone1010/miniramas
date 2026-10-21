import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

it.skipIf(!PGlite)('migration 058: one nullable column, existing previews unchanged, a generation record round-trips, closed to browser roles, re-runnable', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema storage;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create type public.print_order_status as enum ('created','paid','placed','in_production','shipped','delivered','cancelled','error');
      create table print_orders(id uuid primary key default gen_random_uuid(), status public.print_order_status not null default 'created', stripe_session_id text not null unique, stripe_payment_intent text, paid_at timestamptz, placed_at timestamptz, prodigi_order_id text, retail_total_cents int not null default 0, updated_at timestamptz default now());`)
    for (const m of ['046_print_upscale_jobs', '047_gift_wizard_sessions']) await db.exec(fs.readFileSync(`supabase/migrations/${m}.sql`, 'utf8'))
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const verify = fs.readFileSync('docs/GOVERNANCE/gift-058-preflight-and-verify.sql', 'utf8')
    expect((await q(verify)).find((r: any) => r.check_name.startsWith('gift_previews.generation'))!.result).toBe('not applied yet')
    const s = (await q(`insert into gift_sessions(user_id, source_sha256, source_width, source_height, series, expires_at) values ('10000000-0000-4000-8000-000000000001','a',1,1,'portraits', now() + interval '7 days') returning id`))[0].id
    const b = (await q(`insert into gift_batches(session_id,user_id,batch_index,kind,idempotency_key,effect_ids) values ($1,'10000000-0000-4000-8000-000000000001',1,'free','key-058-batch',array['a','b','c','d','e','f']) returning id`, [s]))[0].id
    const p = (await q(`insert into gift_previews(batch_id,session_id,slot,effect_id,status,master_path,preview_path) values ($1,$2,1,'a','ready','m','p') returning id`, [b, s]))[0].id
    const before = await q('select * from gift_previews')
    await db.exec(fs.readFileSync('supabase/migrations/058_gift_preview_generation_record.sql', 'utf8'))
    expect((await q('select * from gift_previews'))[0]).toEqual({ ...before[0], generation: null })
    const rec = { v: 1, quality: 'below_bar', attempts: 2, scores: [8, 7], postProcessing: { outpaint: false, skipped: 'initial_preview' } }
    await q('update gift_previews set generation = $2 where id = $1', [p, JSON.stringify(rec)]); expect((await q('select generation g from gift_previews where id=$1', [p]))[0].g).toEqual(rec)
    expect((await q(verify)).filter((r: any) => String(r.result).startsWith('FAIL') || r.result === 'not applied yet').length).toBe(0)
    await db.exec('set role anon'); let err = ''; try { await db.query('select generation from gift_previews') } catch (e: any) { err = String(e.message) } await db.exec('reset role'); expect(err).toMatch(/permission denied/)
    await db.exec(fs.readFileSync('supabase/migrations/058_gift_preview_generation_record.sql', 'utf8'))
  } finally { await db.close() }
}, 120_000)
