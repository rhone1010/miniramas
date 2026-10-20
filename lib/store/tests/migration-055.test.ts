// Migration 055 (durable composition jobs) against real Postgres (PGlite): the atomic claim, takeover of an expired or failed job while attempts remain, exhaustion, finish and fail
// with the right and a wrong token, closed permissions, and a re-run. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const S = '00000000-0000-4000-8000-0000000000a1', P = '00000000-0000-4000-8000-0000000000b1'

it.skipIf(!PGlite)('migration 055: one live claim per requirement, takeover only when expired or failed with attempts left, exhaustion, token-checked finish and fail, closed to browser roles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
      create table public.gift_sessions(id uuid primary key);
      insert into public.gift_sessions values ('${S}');`)
    const sql = fs.readFileSync('supabase/migrations/055_gift_composition_jobs.sql', 'utf8')
    await db.exec(sql)
    const q = async (text: string, p: any[] = []) => (await db.query(text, p)).rows
    const claim = async (ttl = 600, max = 3) => (await q('select * from gift_claim_composition($1,$2,$3,$4,$5,$6,$7)', [S, P, 'a667', ['line1'], 'generated', ttl, max]))[0]
    const job = async () => (await q('select state, attempts, error_code, expires_at > now() as live, line_ids from gift_composition_jobs'))[0]

    // 1. the first claim wins; a second while the lease is live gets nothing and says why
    const a = await claim(); expect(a.o_reason).toBe('claimed'); expect(a.o_token).toBeTruthy()
    const b = await claim(); expect(b).toEqual({ o_token: null, o_reason: 'in_progress' })
    expect(await job()).toMatchObject({ state: 'preparing', attempts: 1, live: true, line_ids: ['line1'] })
    // 2. a wrong token cannot finish or fail it; the right one can
    const wrong = '00000000-0000-4000-8000-00000000dead'
    await q('select gift_finish_composition($1,$2,$3,$4)', [S, P, 'a667', wrong]); await q('select gift_fail_composition($1,$2,$3,$4,$5)', [S, P, 'a667', wrong, 'x']); expect(await job()).toMatchObject({ state: 'preparing' })
    // 3. an expired lease (the process died) is taken over: attempt 2, new token
    await db.exec(`update gift_composition_jobs set expires_at = now() - interval '1 second'`)
    const c = await claim(); expect(c.o_reason).toBe('claimed'); expect(c.o_token).not.toBe(a.o_token); expect(await job()).toMatchObject({ attempts: 2, state: 'preparing', live: true })
    // 4. a failure is kept with its code (truncated), and a failed job is retried while attempts remain
    await q('select gift_fail_composition($1,$2,$3,$4,$5)', [S, P, 'a667', c.o_token, 'nb2_failed' + 'x'.repeat(100)])
    expect(await job()).toMatchObject({ state: 'failed', attempts: 2, live: false }); expect((await job()).error_code.length).toBeLessThanOrEqual(60)
    const d = await claim(); expect(d.o_reason).toBe('claimed'); expect(await job()).toMatchObject({ state: 'preparing', attempts: 3, error_code: null })
    // 5. attempts used up: no further claim, however old the job
    await q('select gift_fail_composition($1,$2,$3,$4,$5)', [S, P, 'a667', d.o_token, 'again'])
    expect(await claim()).toEqual({ o_token: null, o_reason: 'attempts_exhausted' }); expect(await job()).toMatchObject({ state: 'failed', attempts: 3 })
    // 6. success drops the job (only with the holder's token); a new requirement is its own job
    await db.exec(`delete from gift_composition_jobs`)
    const e = await claim(); await q('select gift_finish_composition($1,$2,$3,$4)', [S, P, 'a667', e.o_token]); expect(await q('select 1 from gift_composition_jobs')).toHaveLength(0)
    await q('select * from gift_claim_composition($1,$2,$3,$4,$5)', [S, P, 'a1000', ['l2'], 'deterministic']); await q('select * from gift_claim_composition($1,$2,$3,$4,$5)', [S, P, 'a667', ['l1'], 'generated'])
    expect(await q('select 1 from gift_composition_jobs')).toHaveLength(2)
    // 7. a session's jobs go with the session
    await db.exec(`delete from public.gift_sessions where id = '${S}'`); expect(await q('select 1 from gift_composition_jobs')).toHaveLength(0)
    // 8. permissions closed to the browser roles, open to the service role
    const bad = async (text: string) => { try { await db.query(text); return null } catch (err: any) { return String(err.message) } }
    await db.exec('set role anon'); expect(await bad(`select * from gift_composition_jobs`)).toMatch(/permission denied/); expect(await bad(`select * from gift_claim_composition('${S}','${P}','g',null,null)`)).toMatch(/permission denied/)
    await db.exec('reset role'); await db.exec('set role authenticated'); expect(await bad(`select * from gift_composition_jobs`)).toMatch(/permission denied/); await db.exec('reset role')
    await db.exec('set role service_role'); expect(await bad(`select count(*) from gift_composition_jobs`)).toBeNull(); await db.exec('reset role')
    // 9. a re-run is harmless
    await db.exec(sql)
  } finally { await db.close() }
}, 120_000)
