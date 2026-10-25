// Migration 060 against real Postgres (PGlite) with minimal stand-ins for the live tables it reads: the 60-day source-photograph retention sweep for
// Portraits, Pets and Groups (portfolios.source_image). Skipped where PGlite is not installed.

import { it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

const candidates = [process.env.PGLITE_PATH, '../../../../.temp/collection-sql-test/node_modules/@electric-sql/pglite', 'E:/Dev/_recovery-staging/pg046/node_modules/@electric-sql/pglite'].filter(Boolean) as string[]
let PGlite: any = null
for (const c of candidates) { try { PGlite = createRequire(import.meta.url)(c).PGlite; break } catch { /* try the next */ } }

const U1 = '10000000-0000-4000-8000-000000000001', U2 = '10000000-0000-4000-8000-000000000002'
const NOW = '2026-12-31T00:00:00Z'
const ago = (days: number) => new Date(Date.parse(NOW) - days * 864e5).toISOString()
const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`

it.skipIf(!PGlite)('retention sweep: the right clock per product, disputes suspend, dry run deletes nothing, apply is idempotent and keeps the identity hash', async () => {
  const photo = (await sharp({ create: { width: 64, height: 64, channels: 3, background: '#a33' } }).jpeg().toBuffer())
  const dataUrl = 'data:image/jpeg;base64,' + photo.toString('base64')
  const nodeHash = createHash('sha256').update(Buffer.from(dataUrl.split(',')[1], 'base64').toString('base64')).digest('hex')        // lib/store/remedy-evidence.ts hashRemedyIdentity
  const db = new PGlite()
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table purchases(id uuid primary key, status text, paid_at timestamptz);
    create table portfolios(id uuid primary key, purchase_id uuid, user_id uuid, series text, status text, source_image text, composition jsonb, origin text, created_at timestamptz default now());
    create table portfolio_items(id uuid primary key default gen_random_uuid(), portfolio_id uuid, slot int, status text, preview_id uuid, rendering_started_at timestamptz, created_at timestamptz default now());
    create table preview_ledger(id uuid primary key, unlocked_at timestamptz, storage_path text);
    create table support_messages(id uuid primary key default gen_random_uuid(), user_id uuid, context jsonb);
    create table gift_sessions(id uuid primary key, user_id uuid, final_approved_at timestamptz, approved_at timestamptz, refund_requested_at timestamptz, refunded_at timestamptz, unlock_portfolio_id uuid);
    create table gift_refund_requests(id uuid primary key default gen_random_uuid(), session_id uuid, status text);`)
  await db.exec(fs.readFileSync('supabase/migrations/060_source_photo_retention.sql', 'utf8'))
  const q = async (sql: string, p: any[] = []) => (await db.query(sql, p)).rows

  let n = 0
  const portfolio = async (o: { created: number; paidDaysAgo?: number; unlockDaysAgo?: number; origin?: string; gift?: { session: string; approvedDaysAgo: number | null }; user?: string; itemStatus?: string; itemAgeDays?: number }) => {
    const pid = id(++n), purchase = o.paidDaysAgo != null ? id(1000 + n) : null
    if (purchase) await q(`insert into purchases values ($1,'paid',$2)`, [purchase, ago(o.paidDaysAgo!)])
    await q(`insert into portfolios(id,purchase_id,user_id,series,status,source_image,composition,origin,created_at) values ($1,$2,$3,'portraits','ready',$4,$5,$6,$7)`,
      [pid, purchase, o.user ?? U1, dataUrl, o.gift ? JSON.stringify({ gift: { session: o.gift.session } }) : '{}', o.origin ?? (o.gift ? 'gift' : 'discovery'), ago(o.created)])
    if (o.gift) await q(`insert into gift_sessions(id,user_id,final_approved_at) values ($1,$2,$3) on conflict do nothing`, [o.gift.session, o.user ?? U1, o.gift.approvedDaysAgo != null ? ago(o.gift.approvedDaysAgo) : null])
    const lid = id(2000 + n)
    await q(`insert into preview_ledger(id, unlocked_at) values ($1,$2)`, [lid, o.unlockDaysAgo != null ? ago(o.unlockDaysAgo) : null])
    await q(`insert into portfolio_items(portfolio_id, slot, status, preview_id, created_at, rendering_started_at) values ($1,0,$2,$3,$4,$4)`, [pid, o.itemStatus ?? 'done', lid, ago(o.itemAgeDays ?? o.created)])
    return pid
  }
  const sweep = async (apply: boolean) => (await q(`select * from retention_sweep_portfolio_sources($1::timestamptz, 0, $2)`, [NOW, apply])).reduce((m: Record<string, any>, r: any) => (m[r.portfolio_id] = r, m), {})

  const young = await portfolio({ created: 59, paidDaysAgo: 59 })                         // not 60 days old: not even listed
  const unpurchased = await portfolio({ created: 61 })                                      // never bought or unlocked: creation + 60
  const boughtRecently = await portfolio({ created: 200, paidDaysAgo: 30 })                 // old portfolio, purchase 30 days ago: the PURCHASE clock
  const boughtLongAgo = await portfolio({ created: 200, paidDaysAgo: 90 })                  // purchase 90 days ago
  const unlockedRecently = await portfolio({ created: 200, paidDaysAgo: 150, unlockDaysAgo: 10 })   // a later Collection unlock moves the clock
  const unlockedLongAgo = await portfolio({ created: 100, unlockDaysAgo: 70, origin: 'foyer' })
  const giftApprovedRecently = await portfolio({ created: 61, gift: { session: id(9001), approvedDaysAgo: 5 } })   // Gift: approval 5 days ago
  const giftApprovedLongAgo = await portfolio({ created: 100, gift: { session: id(9002), approvedDaysAgo: 65 } })
  const disputedArtwork = await portfolio({ created: 100, paidDaysAgo: 100 })               // open case naming it
  const disputedBatch = await portfolio({ created: 100, paidDaysAgo: 100, user: U2 })       // open batch case for that user
  const resolvedCase = await portfolio({ created: 100, paidDaysAgo: 100, user: id(77) })    // a RESOLVED case does not suspend
  const otherUsersCase = await portfolio({ created: 100, paidDaysAgo: 100, user: id(88) })  // someone else's open case is irrelevant
  const giftRefundOpen = await portfolio({ created: 100, gift: { session: id(9003), approvedDaysAgo: 90 } })
  const rendering = await portfolio({ created: 100, paidDaysAgo: 100, user: id(99), itemStatus: 'pending', itemAgeDays: 2 })    // a render in flight
  const stuck = await portfolio({ created: 100, paidDaysAgo: 100, user: id(98), itemStatus: 'pending', itemAgeDays: 40 })        // a dead render does not hold the photograph
  const kase = (user: string, status: string, scope: string | null, pid: string | null) => q(`insert into support_messages(user_id, context) values ($1,$2)`, [user, JSON.stringify({ case: { kind: 'make_it_right', status, ...(scope ? { scope } : {}), artwork: { kind: 'portfolio', portfolioId: pid } } })])
  await kase(U1, 'reviewing', 'artwork', disputedArtwork)
  await kase(U2, 'requested', null, null)
  await kase(id(77), 'resolved', 'artwork', resolvedCase)
  await kase(id(1), 'reviewing', 'artwork', id(5555))                                       // another user's, about another portfolio
  await q(`insert into gift_refund_requests(session_id, status) values ($1,'requested')`, [id(9003)])

  const before = await q(`select id, source_image from portfolios order by id`)
  const dry = await sweep(false)
  expect(Object.keys(dry)).not.toContain(young)
  const due = (pid: string) => dry[pid]?.due as boolean
  expect([unpurchased, boughtLongAgo, unlockedLongAgo, giftApprovedLongAgo, resolvedCase, stuck].map(due)).toEqual([true, true, true, true, true, true])
  expect([boughtRecently, unlockedRecently, giftApprovedRecently, disputedArtwork, disputedBatch, giftRefundOpen, rendering].map(due)).toEqual([false, false, false, false, false, false, false])
  expect(dry[disputedArtwork].disputed && dry[disputedBatch].disputed && dry[giftRefundOpen].disputed).toBe(true)
  expect(dry[otherUsersCase].due).toBe(true)
  expect(new Date(dry[boughtRecently].delete_after).toISOString()).toBe(new Date(Date.parse(ago(30)) + 60 * 864e5).toISOString())
  expect(await q(`select id, source_image from portfolios order by id`)).toEqual(before)             // a dry run deletes nothing
  expect(await q(`select count(*)::int c from retention_log`)).toEqual([{ c: 0 }])

  const applied = await sweep(true)
  const deleted = Object.values(applied).filter((r: any) => r.deleted).map((r: any) => r.portfolio_id).sort()
  expect(deleted).toEqual([unpurchased, boughtLongAgo, unlockedLongAgo, giftApprovedLongAgo, resolvedCase, otherUsersCase, stuck].sort())
  const rows = await q(`select id, source_image, source_sha256, source_deleted_at, status, series from portfolios`)
  for (const r of rows) {
    if (deleted.includes(r.id)) { expect(r.source_image).toBeNull(); expect(r.source_sha256).toBe(nodeHash); expect(r.source_deleted_at).not.toBeNull() }
    else { expect(r.source_image).toBe(dataUrl); expect(r.source_sha256).toBeNull() }
    expect(r.status).toBe('ready')                                                                       // the artwork itself is never touched
  }
  expect((await q(`select count(*)::int c from purchases`))[0].c).toBe(10)                               // financial rows intact
  expect((await q(`select count(*)::int c from portfolio_items`))[0].c).toBe(rows.length)
  expect((await q(`select count(*)::int c from retention_log`))[0].c).toBe(deleted.length)

  const again = await sweep(true)                                                                        // idempotent: nothing left to delete, nothing logged twice
  expect(Object.values(again).filter((r: any) => r.deleted)).toEqual([])
  expect((await q(`select count(*)::int c from retention_log`))[0].c).toBe(deleted.length)

  // the dispute closes: the photograph becomes deletable on the next run
  await q(`update support_messages set context = jsonb_set(context, '{case,status}', '"resolved"') where user_id = $1`, [U1])
  await q(`update support_messages set context = jsonb_set(context, '{case,status}', '"resolved"') where user_id = $1`, [U2])
  await q(`update gift_refund_requests set status = 'declined'`)
  const later = await sweep(true)
  expect(Object.values(later).filter((r: any) => r.deleted).map((r: any) => r.portfolio_id).sort()).toEqual([disputedArtwork, disputedBatch, giftRefundOpen].sort())
  await db.close()
})
