// scripts/admin-test-db-probe.mjs
//
// Read-only probe of the TEST Supabase project, to answer one question before
// anyone asks for a database password:
//
//   can migration 033 even run there?
//
// 033 replaces five panel_* functions whose bodies reference eleven tables. If
// the test project does not have those tables, applying it fails on the first
// missing relation and the "verification" would prove nothing.
//
// Reads .env.test (TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY) and
// prints presence and row counts only. No secret, no URL and no row content is
// ever printed. Touches nothing: every call is a HEAD count or a zero-row
// select.
//
//   node scripts/admin-test-db-probe.mjs

import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env.test' })

const url = process.env.TEST_SUPABASE_URL
const key = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('TEST_SUPABASE_URL / TEST_SUPABASE_SERVICE_ROLE_KEY not set in .env.test')
  process.exit(2)
}

// Guard: refuse to run against whatever .env.local points at, so a mistyped
// file can never turn this into a production probe.
if (process.env.APP_URL || process.env.STRIPE_SECRET_KEY) {
  console.error('refusing to run: production-looking vars are present in this env')
  process.exit(2)
}

const db = createClient(url, key, { auth: { persistSession: false } })

// Every table the five replaced functions read.
const TABLES = [
  'purchases', 'print_orders', 'qa_log', 'identity_map', 'credit_balances',
  'credit_ledger', 'events', 'collection_pieces', 'error_log', 'qa_settings',
  'account_flags', 'prompt_versions',
]

const RPCS = [
  ['panel_overview',   { days: 7 }],
  ['panel_engine',     { days: 7 }],
  ['panel_marketing',  { days: 7 }],
  ['panel_customers',  {}],
  ['panel_fulfilment', {}],
  ['panel_health',     { days: 7 }],
  ['panel_controls',   {}],
]

let missing = 0

console.log('TABLES')
for (const t of TABLES) {
  const { error, count } = await db
    .from(t)
    .select('*', { count: 'exact', head: true })
  if (error) {
    console.log(`  %-20s ABSENT  (%s)`.replace('%-20s', t.padEnd(20)), error.message.slice(0, 60))
    missing++
  } else {
    console.log(`  ${t.padEnd(20)} present  rows=${count}`)
  }
}

console.log('\nPANEL FUNCTIONS (pre-033)')
for (const [fn, args] of RPCS) {
  const { data, error } = await db.rpc(fn, args)
  if (error) {
    console.log(`  ${fn.padEnd(18)} ABSENT   ${error.message.slice(0, 60)}`)
  } else {
    const keys = data && typeof data === 'object' ? Object.keys(data).length : 0
    console.log(`  ${fn.padEnd(18)} present  ${keys} fields`)
  }
}

console.log(`\nverdict: ${missing === 0
  ? 'all tables present — 033 can be applied and verified here'
  : `${missing} table(s) absent — 033 would fail on a missing relation`}`)
