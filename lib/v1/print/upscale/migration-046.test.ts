// Executes migration 046 against a real Postgres engine (PGlite): constraints, seeded defaults, the audit
// trigger, the single-flight lease, idempotent enqueue, the review transition, and who may call what.
// Skipped (not failed) where PGlite is not installed. Set PGLITE_PATH, or install it at .temp/collection-sql-test.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const order = '10000000-0000-4000-8000-000000000001'
const MIG = 'supabase/migrations/046_print_upscale_jobs.sql'

it.skipIf(!PGlite)('migration 046 runs, seeds the approved defaults, and enforces its rules', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create schema storage;
      create type public.print_order_status as enum ('created','paid','placed','in_production','shipped','delivered','cancelled','error');   -- exactly as migration 012 creates it
      create table print_orders(id uuid primary key, status public.print_order_status not null default 'created');`)
    await db.exec(fs.readFileSync(MIG, 'utf8'))
    await db.query('insert into print_orders(id) values($1)', [order])
    // The order status the account gate and the pipeline's holds both write must exist after the migration.
    await db.query("update print_orders set status='withheld' where id=$1", [order])
    expect((await db.query('select status from print_orders where id=$1', [order])).rows[0]).toEqual({ status: 'withheld' })

    // ── seeded defaults: exactly the approved ones
    const g = (await db.query("select * from print_upscale_settings where scope='global'")).rows[0]
    expect(g).toMatchObject({ provider: 'replicate', target_ppi: 300, output_format: 'jpg', output_quality: 95, enhance_details: false, enhance_realism: false, disable_safety_checker: false, human_approval: 'flagged', qa_enabled: true })

    // ── constraints
    const bad = async (sql: string, params: any[] = []) => { let err: any = null; try { await db.query(sql, params) } catch (e) { err = e } return err }
    expect(await bad("update print_upscale_settings set provider='openai' where scope='global'")).toBeTruthy()
    expect(await bad("update print_upscale_settings set output_quality=101 where scope='global'")).toBeTruthy()
    expect(await bad("update print_upscale_settings set max_megapixels=200 where scope='global'")).toBeTruthy()
    expect(await bad("update print_upscale_settings set provider=null where scope='global'")).toBeTruthy()          // global must stay complete
    expect(await bad("insert into print_upscale_settings(scope) values ('sku:x; drop table y')")).toBeTruthy()
    expect(await bad("insert into print_upscale_settings(scope) values ('bogus')")).toBeTruthy()
    await db.query("insert into print_upscale_settings(scope, enhance_details, updated_by) values ('family:canvas', true, 'test')")   // partial override is allowed
    expect((await db.query("select provider, enhance_details from print_upscale_settings where scope='family:canvas'")).rows[0]).toEqual({ provider: null, enhance_details: true })

    // ── every change is kept
    await db.query("update print_upscale_settings set output_quality=90, updated_by='control-panel' where scope='global'")
    const hist = (await db.query('select scope, op, changed_by from print_upscale_settings_history order by id')).rows
    expect(hist.map((h: any) => h.op)).toEqual(['INSERT', 'INSERT', 'UPDATE']); expect(hist.at(-1)).toMatchObject({ scope: 'global', changed_by: 'control-panel' })

    // ── enqueue is idempotent per line
    const enqueue = async (rev = 0) => (await db.query("select enqueue_print_asset_job($1,0,'render','GLOBAL-FAP-8X8','8x8','fine_art','owned',$2) j", [order, rev])).rows[0].j
    const a = await enqueue(), b = await enqueue()
    expect(a.id).toBe(b.id); expect(a).toMatchObject({ status: 'queued', submit_state: 'none', attempts: 0, possible_duplicate: false, warnings: [], events: [] })
    expect((await enqueue(1)).id).not.toBe(a.id)                                                                      // a new revision is a new job
    expect(await bad("insert into print_asset_jobs(order_id,item_index,render_id,sku,size,finish,source_kind) values ($1,5,'r','s','8x8','fine_art','nonsense')", [order])).toBeTruthy()
    expect(await bad("update print_asset_jobs set status='bogus'")).toBeTruthy()

    // ── the lease is single-flight and takes over only once it has expired
    const t1 = '30000000-0000-4000-8000-000000000001', t2 = '30000000-0000-4000-8000-000000000002'
    const lease = async (t: string, secs = 300) => (await db.query('select lease_print_asset_job($1,$2,$3) j', [a.id, secs, t])).rows[0].j
    const first = await lease(t1); expect(first).toMatchObject({ attempts: 1, lease_token: t1 })
    expect(await lease(t2)).toBeNull()                                                                                 // held
    await db.query("update print_asset_jobs set lease_until = now() - interval '1 second' where id=$1", [a.id])         // the holder died
    expect(await lease(t2)).toMatchObject({ attempts: 2, lease_token: t2 })
    await db.query("update print_asset_jobs set status='approved' where id=$1", [a.id])
    await db.query('update print_asset_jobs set lease_until = null where id=$1', [a.id])
    expect(await lease(t1)).toBeNull()                                                                                 // finished jobs are never leased

    // ── a person's review: only a job in review, only approved or rejected
    const review = async (decision: string) => db.query("select review_print_asset_job($1,$2,'control-panel','note') j", [a.id, decision])
    await expect(review('approved')).rejects.toThrow('job_not_in_review')                                              // it is 'approved' already
    await db.query("update print_asset_jobs set status='review' where id=$1", [a.id])
    await expect(review('maybe')).rejects.toThrow('invalid_review_decision')
    expect(((await review('rejected')).rows[0] as any).j).toMatchObject({ status: 'rejected', reviewed_by: 'control-panel', review_note: 'note', lease_token: null })

    // ── nothing is callable or readable by the public roles; the service role can work
    const priv = (await db.query(`select
      has_function_privilege('anon','lease_print_asset_job(uuid,integer,uuid)','execute') anon_lease,
      has_function_privilege('authenticated','enqueue_print_asset_job(uuid,integer,text,text,text,text,text,integer)','execute') auth_enqueue,
      has_function_privilege('authenticated','review_print_asset_job(uuid,text,text,text)','execute') auth_review,
      has_function_privilege('service_role','enqueue_print_asset_job(uuid,integer,text,text,text,text,text,integer)','execute') svc_enqueue,
      has_function_privilege('service_role','lease_print_asset_job(uuid,integer,uuid)','execute') svc_lease,
      has_function_privilege('service_role','review_print_asset_job(uuid,text,text,text)','execute') svc_review,
      has_table_privilege('anon','print_asset_jobs','select') anon_jobs,
      has_table_privilege('authenticated','print_upscale_settings','select') auth_settings,
      has_table_privilege('service_role','print_asset_jobs','update') svc_jobs,
      has_table_privilege('service_role','print_upscale_settings','insert') svc_settings`)).rows[0]
    expect(priv).toEqual({ anon_lease: false, auth_enqueue: false, auth_review: false, svc_enqueue: true, svc_lease: true, svc_review: true, anon_jobs: false, auth_settings: false, svc_jobs: true, svc_settings: true })
    const rls = (await db.query("select relname, relrowsecurity from pg_class where relname in ('print_asset_jobs','print_upscale_settings','print_upscale_settings_history') order by relname")).rows
    expect(rls.every((r: any) => r.relrowsecurity)).toBe(true); expect(rls).toHaveLength(3)
  } finally { await db.close() }
}, 60_000)
