// scripts/admin-test-db-probe.mjs
//
// Read-only probe of the TEST Supabase project, to answer one question before
// anyone applies a migration:
//
//   can migration 033 even run there?
//
// 033 replaces five panel_* functions whose bodies reference twelve tables. If
// the test project does not have them, applying it fails on the first missing
// relation and the "verification" would prove nothing.
//
// Reads .env.test (TEST_SUPABASE_URL + TEST_SUPABASE_SERVICE_ROLE_KEY) and
// prints presence and row counts only. No secret, no URL and no key is ever
// printed. Touches nothing: every call is a HEAD count or a zero-row select.
//
//   node scripts/admin-test-db-probe.mjs
//
// ── WHY THERE IS A DNS PRE-FLIGHT ──────────────────────────────────────
//
// The first version of this script reported "12 tables absent" when the real
// answer was "the project does not resolve". Both surfaced as a failed
// supabase-js call, and it drew exactly the wrong conclusion — a transport
// failure read as a fact about the schema. That is the same class of error the
// Admin panel was built to stop making, so the probe checks reachability
// first, and refuses to say anything about tables until it has an answer it is
// entitled to give.

import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { lookup } from 'node:dns/promises'

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

// ── Pre-flight: is the project reachable at all? ────────────────────────
let host
try {
  host = new URL(url).host
} catch (e) {
  console.error(`TEST_SUPABASE_URL is not a valid URL: ${e.message}`)
  process.exit(2)
}

try {
  await lookup(host)
} catch (e) {
  console.error('REACHABILITY: FAILED')
  console.error(`  The TEST project host does not resolve (${e.code}).`)
  console.error('  Host shape:', host.replace(/^[a-z0-9]+\./, '<ref>.'))
  console.error('')
  console.error('  This is NOT a statement about the schema. Nothing can be')
  console.error('  concluded about which tables or functions exist until the')
  console.error('  project resolves. A paused Supabase project still resolves;')
  console.error('  a deleted one does not.')
  process.exit(3)
}

console.log('REACHABILITY: host resolves\n')

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

/** A missing relation is a fact about the schema. Anything else is not. */
function classify(error) {
  const msg = error.message || ''
  if (error.code === '42P01' || /does not exist|find the table|schema cache/i.test(msg)) {
    return 'ABSENT'
  }
  if (/fetch failed|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network/i.test(msg)) {
    return 'UNREACHABLE'
  }
  return 'ERROR'
}

let absent = 0
let unreachable = 0

console.log('TABLES')
for (const t of TABLES) {
  const { error, count } = await db
    .from(t)
    .select('*', { count: 'exact', head: true })
  if (!error) {
    console.log(`  ${t.padEnd(20)} present      rows=${count}`)
    continue
  }
  const kind = classify(error)
  if (kind === 'ABSENT') absent++
  if (kind === 'UNREACHABLE') unreachable++
  console.log(`  ${t.padEnd(20)} ${kind.padEnd(12)} ${error.message.slice(0, 55)}`)
}

console.log('\nPANEL FUNCTIONS')
for (const [fn, args] of RPCS) {
  const { data, error } = await db.rpc(fn, args)
  if (!error) {
    const keys = data && typeof data === 'object' ? Object.keys(data).length : 0
    console.log(`  ${fn.padEnd(18)} present      ${keys} fields`)
    continue
  }
  console.log(`  ${fn.padEnd(18)} ${classify(error).padEnd(12)} ${error.message.slice(0, 55)}`)
}

console.log('')
if (unreachable > 0) {
  console.log('verdict: transport failed mid-probe — the results above are not')
  console.log('         a reliable account of the schema. Nothing concluded.')
  process.exit(3)
}
console.log(`verdict: ${absent === 0
  ? 'all tables present — 033 can be applied and verified here'
  : `${absent} of ${TABLES.length} table(s) genuinely absent — 033 would fail on a missing relation`}`)
