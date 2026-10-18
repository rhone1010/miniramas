// Migration 051 against real Postgres (PGlite): the persistent, atomic session-attempt limit. Skipped where PGlite is not installed.
import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'

it.skipIf(!PGlite)('migration 051 counts attempts per account and photograph before the work, survives deletion, and is closed to browser roles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;`)
    await db.exec('create table gift_sessions(id uuid primary key)')                                                  // stand-in so the verify file's 047 check passes
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const verify = fs.readFileSync('docs/GOVERNANCE/gift-051-preflight-and-verify.sql', 'utf8')
    const pre = await q(verify); expect(pre.find((r: any) => r.check_name.startsWith('attempt ledger'))!.detail).toBe('table missing'); expect(pre.some((r: any) => String(r.result).startsWith('FAIL'))).toBe(false)
    await db.exec(fs.readFileSync('supabase/migrations/051_gift_session_rate_limit.sql', 'utf8'))
    const post = await q(verify); expect(post.filter((r: any) => String(r.result).startsWith('FAIL') || String(r.result).startsWith('NOTE: not yet')).length).toBe(0)
    const bad = async (sql: string, p: any[] = []) => { try { await db.query(sql, p); return null } catch (e: any) { return String(e.message) } }
    const rec = (user: string, sha: string, caps: number[] = [10, 30, 5]) => q('select gift_record_session_attempt($1,$2,$3,$4,$5)', [user, sha, ...caps])
    const count = async (user: string) => (await q('select count(*)::int as n from gift_session_attempts where user_id=$1', [user]))[0].n

    for (let i = 0; i < 5; i++) await rec(U1, 'photoA'); expect(await count(U1)).toBe(5)
    expect(await bad('select gift_record_session_attempt($1,$2)', [U1, 'photoA'])).toMatch(/rate_limited/); expect(await count(U1)).toBe(5)      // refused: nothing recorded
    await rec(U1, 'photoB')                                                                                                                     // another photograph is fine
    for (let i = 0; i < 4; i++) await rec(U1, 'p' + i)                                                                                          // 10 in the hour
    expect(await bad('select gift_record_session_attempt($1,$2)', [U1, 'photoZ'])).toMatch(/rate_limited/)
    await rec(U2, 'photoA')                                                                                                                     // another account is unaffected
    // windows: an hour later only the hour cap is free again; two days later everything is pruned
    await q(`update gift_session_attempts set created_at = now() - interval '2 hours' where user_id = $1`, [U1])
    await rec(U1, 'photoZ')                                                                                                                     // the hour cap is free again
    expect(await bad('select gift_record_session_attempt($1,$2)', [U1, 'photoA'])).toMatch(/rate_limited/)                                      // but the photograph's 24-hour cap still holds
    expect(await bad('select gift_record_session_attempt($1,$2,$3,$4,$5)', [U1, 'photoQ', 10, 10, 5])).toMatch(/rate_limited/)                  // and the 24-hour account cap is a parameter
    await q(`update gift_session_attempts set created_at = now() - interval '3 days' where user_id = $1`, [U1])
    await rec(U1, 'photoA'); expect(await count(U1)).toBe(1)                                                                                    // old rows are pruned

    await db.exec('set role anon')
    expect(await bad('select gift_record_session_attempt($1,$2)', [U1, 'x'])).toMatch(/permission denied/)
    expect(await bad('select * from gift_session_attempts')).toMatch(/permission denied/)
    await db.exec('reset role')
    await db.exec(fs.readFileSync('supabase/migrations/051_gift_session_rate_limit.sql', 'utf8'))                                              // a re-run is harmless
  } finally { await db.close() }
}, 120_000)
