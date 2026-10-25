// Migration 061 against real Postgres (PGlite): ONE automatic goodwill refund per customer; every later refund claim is reviewed. Minimal stand-ins for support_messages and portfolios.
import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }
const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const A = (n: number) => `30000000-0000-4000-8000-${String(n).padStart(12, '0')}`

it.skipIf(!PGlite)('goodwill refund is paid once per customer; later refund claims are reviewed; redo and the $50 ceiling are unchanged', async () => {
  const db = new PGlite()
  await db.exec(`create table portfolios(id uuid primary key, user_id uuid, composition jsonb);
    create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, preview_id uuid);
    create table support_messages(id uuid primary key default gen_random_uuid(), user_id uuid, context jsonb);`)
  await db.exec(fs.readFileSync('supabase/migrations/061_goodwill_refund_once.sql', 'utf8'))
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows
  const open = async (user: string, art: number, requested: 'refund' | 'redo', scope = 'artwork') =>
    (await q(`insert into support_messages(user_id, context) values ($1,$2) returning id`, [user, JSON.stringify({ case: { kind: 'make_it_right', scope, requested_remedy: requested, status: 'requested', artwork: { id: A(art), kind: 'portfolio' } } })]))[0].id as string
  const decide = async (id: string, user: string, d: Record<string, unknown>, keys: string[] = []) =>
    (await q(`select (public.authorize_make_it_right_case($1,$2,$3::jsonb)).context->'case' as c`, [id, user, JSON.stringify({ identity_keys: [`user:${user}`, ...keys], source_hash: null, evidence: { classification: 'likely_failure' }, refund_allocations: [], ...d })]))[0].c

  const first = await decide(await open(U1, 1, 'refund'), U1, { remedy: 'refund', amountCents: 499 })
  expect(first).toMatchObject({ authorized_remedy: 'refund', authorized_amount_cents: 499, decision_source: 'goodwill', goodwill_consumed: true, status: 'authorized' })

  // the second refund claim, even with strong evidence and a different artwork: reviewed, not paid
  const second = await decide(await open(U1, 2, 'refund'), U1, { remedy: 'refund', amountCents: 299, evidence: { classification: 'likely_failure' } })
  expect(second).toMatchObject({ authorized_remedy: 'review', authorized_amount_cents: 0, decision_source: 'subsequent_review', goodwill_consumed: false, status: 'reviewing' })

  // a later redo is still decided by the evidence policy
  expect(await decide(await open(U1, 3, 'redo'), U1, { remedy: 'redo' })).toMatchObject({ authorized_remedy: 'redo', decision_source: 'evidence_policy', goodwill_consumed: false })

  // another account that shares a payment identity with the consumed goodwill cannot mint a second refund
  const sharedPayment = await decide(await open(U2, 4, 'refund'), U2, { remedy: 'refund', amountCents: 499 }, ['payment:abc'])
  expect(sharedPayment.authorized_remedy).toBe('refund')                                  // different identity so far: this account's own first goodwill
  const U3 = '10000000-0000-4000-8000-000000000003'
  await q(`update support_messages set context = jsonb_set(context,'{case,identity_keys}','["user:${U2}","payment:abc"]') where user_id = $1`, [U2])
  expect(await decide(await open(U3, 5, 'refund'), U3, { remedy: 'refund', amountCents: 499 }, ['payment:abc'])).toMatchObject({ authorized_remedy: 'review' })

  // the $50 ceiling still holds for a customer's first claim, and a repeated call is idempotent
  const U4 = '10000000-0000-4000-8000-000000000004'
  expect(await decide(await open(U4, 6, 'refund'), U4, { remedy: 'refund', amountCents: 5001 })).toMatchObject({ authorized_remedy: 'review', decision_source: 'integrity_review' })
  const U5 = '10000000-0000-4000-8000-000000000005', id5 = await open(U5, 7, 'refund')
  const once = await decide(id5, U5, { remedy: 'refund', amountCents: 5000 }), again = await decide(id5, U5, { remedy: 'refund', amountCents: 100 })
  expect(once.authorized_amount_cents).toBe(5000); expect(again).toEqual(once)

  // exactly one goodwill refund exists per customer
  const consumed = await q(`select user_id, count(*)::int n from support_messages where context#>>'{case,goodwill_consumed}'='true' group by user_id having count(*) > 1`)
  expect(consumed).toEqual([])
  await db.close()
})
