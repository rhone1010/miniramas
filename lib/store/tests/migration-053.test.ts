// Migration 053 against real Postgres (PGlite): every rule of claim_render_recovery, the daily ceiling, the atomic single claim, the guarantee that failures recorded
// before the migration are never recovered, and closed permissions. Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { RECOVERY } from '../render-recovery'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const ARGS = (cost = 2, cap = 5, backoff = 7200, max = 1) => [cost, cap, backoff, max, [...RECOVERY.transient], RECOVERY.transientPattern]

it.skipIf(!PGlite)('migration 053: eligibility, backoff, one cycle, paid and activated only, no artwork, transient only, the $ ceiling, an atomic claim, closed to browser roles', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
      alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
      create table purchases(id uuid primary key default gen_random_uuid(), status text not null);
      create table portfolios(id uuid primary key default gen_random_uuid(), purchase_id uuid, status text not null);
      create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid not null, slot int not null default 0, preset text, status text not null,
        preview_id uuid, attempts int not null default 0, error text, rendering_started_at timestamptz);`)
    const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
    const verify = fs.readFileSync('docs/GOVERNANCE/render-recovery-053-preflight-and-verify.sql', 'utf8')
    const pre = await q(verify); expect(pre.some((r: any) => String(r.result).startsWith('FAIL'))).toBe(false); expect(pre.find((r: any) => r.check_name === '053 state')!.detail).toBe('not applied yet')

    // a failure recorded BEFORE the migration: it has no failure time afterwards
    const mk = async (purchase: string | null, pstatus: string) => {
      const pu = purchase ? (await q('insert into purchases(status) values ($1) returning id', [purchase]))[0].id : null
      return (await q('insert into portfolios(purchase_id, status) values ($1,$2) returning id', [pu, pstatus]))[0].id as string
    }
    const item = async (portfolio: string, over: Record<string, any> = {}) => {
      const r = { status: 'failed', error: 'generate_failed', preview_id: null, attempts: 4, ...over }
      return (await q('insert into portfolio_items(portfolio_id, status, error, preview_id, attempts) values ($1,$2,$3,$4,$5) returning id', [portfolio, r.status, r.error, r.preview_id, r.attempts]))[0].id as string
    }
    const historical = await item(await mk('paid', 'ready'))
    await db.exec(fs.readFileSync('supabase/migrations/053_render_recovery.sql', 'utf8'))
    const post = await q(verify); expect(post.filter((r: any) => String(r.result).startsWith('FAIL') || String(r.result).startsWith('NOTE: not yet')).length).toBe(0)
    expect(post.find((r: any) => r.check_name.startsWith('no earlier failure'))!.result).toBe('0'); expect(post.find((r: any) => r.check_name.startsWith('every existing'))!.result).toBe('0')

    const claim = async (id: string, a = ARGS()) => (await q('select * from claim_render_recovery($1,$2,$3,$4,$5,$6,$7)', [id, ...a]))[0]
    const aged = async (id: string, hours = 3) => { await q(`update portfolio_items set failed_at = now() - make_interval(hours => $2) where id = $1`, [id, hours]) }
    const row = async (id: string) => (await q('select * from portfolio_items where id=$1', [id]))[0]

    // 1. a failure from before the migration is never recovered, however old
    expect((await claim(historical)).reason).toBe('no_failure_time'); expect((await row(historical)).status).toBe('failed')

    // 2. the two-hour backoff, counted from failed_at
    const portfolio = await mk('paid', 'ready'), a = await item(portfolio)
    await q('update portfolio_items set failed_at = now() where id=$1', [a]); expect((await claim(a)).reason).toBe('backoff')
    await q(`update portfolio_items set failed_at = now() - interval '119 minutes' where id=$1`, [a]); expect((await claim(a)).reason).toBe('backoff')
    await aged(a, 3)
    const ok = await claim(a); expect(ok).toEqual({ claimed: true, reason: 'claimed' })
    // effect: one fresh cycle, back in the queue, portfolio generating again, spend reserved
    expect(await row(a)).toMatchObject({ status: 'pending', attempts: 0, error: null, recovery_count: 1 }); expect((await row(a)).recovered_at).toBeTruthy()
    expect((await q('select status from portfolios where id=$1', [portfolio]))[0].status).toBe('generating')
    expect((await q('select reserved_usd::float as r, previous_error from render_recovery_ledger'))[0]).toEqual({ r: 2, previous_error: 'generate_failed' })

    // 3. one cycle only: it fails again, and the second claim is refused
    await q(`update portfolio_items set status='failed', error='generate_failed', failed_at = now() - interval '3 hours' where id=$1`, [a])
    expect((await claim(a)).reason).toBe('already_recovered'); expect((await row(a)).status).toBe('failed')
    // and the same claim cannot be taken twice: once claimed the item is 'pending', not 'failed'
    const b = await item(await mk('paid', 'generating')); await aged(b); expect((await claim(b)).claimed).toBe(true); expect((await claim(b)).reason).toBe('not_failed')

    // 4. who: paid, activated (generating or ready), not refunded
    const cases: Array<[string, string | null, string, string]> = [
      ['unpaid purchase', 'pending', 'ready', 'not_paid'], ['refunded purchase', 'refunded', 'ready', 'not_paid'], ['no purchase (a foyer or gift portfolio)', null, 'ready', 'not_paid'],
      ['not activated', 'paid', 'pending', 'portfolio_not_active'], ['portfolio failed outright', 'paid', 'failed', 'portfolio_not_active'],
    ]
    for (const [label, purchase, pstatus, reason] of cases) { const id = await item(await mk(purchase, pstatus)); await aged(id); expect((await claim(id)).reason, label).toBe(reason); expect((await row(id)).status, label).toBe('failed') }

    // 5. artwork already exists: never
    const art = await item(await mk('paid', 'ready'), { preview_id: '00000000-0000-4000-8000-000000000001' }); await aged(art); expect((await claim(art)).reason).toBe('has_artwork')

    // 6. permanent errors are never recovered; transient ones (the list and the provider-condition pattern) are
    for (const e of ['age_restricted', 'unknown_groups_effect', 'unknown_pets_effect', 'intake_rejected', 'some new refusal', null]) {
      const id = await item(await mk('paid', 'ready'), { error: e }); await aged(id); expect((await claim(id)).reason, String(e)).toBe('permanent_error')
    }
    await q('delete from render_recovery_ledger')
    for (const e of ['generate_failed', 'locked_preview_failed', 'locked_preview_upload_failed', 'ledger_write_failed', 'unhandled_error', 'fetch failed', 'Request timeout after 60s', 'HTTP 503 upstream', 'Rate limit reached']) {
      const id = await item(await mk('paid', 'ready'), { error: e }); await aged(id); expect((await claim(id, ARGS(0.01))).claimed, e).toBe(true)
    }
    expect((await q(`select count(*)::int as n from portfolio_items where recovery_count = 1`))[0].n).toBeGreaterThanOrEqual(9)
    const lookalike = await item(await mk('paid', 'ready'), { error: 'HTTP 5030 oops' }); await aged(lookalike); expect((await claim(lookalike, ARGS(0.01))).reason).toBe('permanent_error')   // 503 only as a whole word

    // 7. the daily ceiling, from the ledger, to the cent
    await q('delete from render_recovery_ledger')
    const ids: string[] = []; for (let k = 0; k < 4; k++) { const id = await item(await mk('paid', 'ready')); await aged(id); ids.push(id) }
    expect((await claim(ids[0], ARGS(2, 5))).claimed).toBe(true); expect((await claim(ids[1], ARGS(2, 5))).claimed).toBe(true)         // 4.00 reserved
    expect((await claim(ids[2], ARGS(2, 5))).reason).toBe('daily_ceiling'); expect((await row(ids[2])).status).toBe('failed')          // 6.00 would pass 5.00
    expect((await claim(ids[2], ARGS(1, 5))).claimed).toBe(true)                                                                      // exactly 5.00 is allowed
    expect((await claim(ids[3], ARGS(0.01, 5))).reason).toBe('daily_ceiling')
    await q(`update render_recovery_ledger set day = day - 1`); expect((await claim(ids[3], ARGS(2, 5))).claimed).toBe(true)          // yesterday's spend does not count today
    expect((await claim(await item(await mk('paid', 'ready')), ARGS(0, 5))).reason).toBe('accounting_not_configured')

    // 8. unknown item; permissions closed
    expect((await claim('00000000-0000-4000-8000-0000000000aa')).reason).toBe('item_not_found')
    const bad = async (sql: string) => { try { await db.query(sql); return null } catch (e: any) { return String(e.message) } }
    await db.exec('set role anon'); expect(await bad(`select * from claim_render_recovery('00000000-0000-4000-8000-0000000000aa', 1, 5, 1, 1, '{}', null)`)).toMatch(/permission denied/); expect(await bad('select * from render_recovery_ledger')).toMatch(/permission denied/)
    await db.exec('reset role'); await db.exec('set role authenticated'); expect(await bad('select * from render_recovery_ledger')).toMatch(/permission denied/); await db.exec('reset role')

    // 9. a re-run is harmless and changes no data
    const before = await q('select * from portfolio_items order by id'), ledger = await q('select * from render_recovery_ledger order by id')
    await db.exec(fs.readFileSync('supabase/migrations/053_render_recovery.sql', 'utf8'))
    expect(await q('select * from portfolio_items order by id')).toEqual(before); expect(await q('select * from render_recovery_ledger order by id')).toEqual(ledger)
  } finally { await db.close() }
}, 120_000)
