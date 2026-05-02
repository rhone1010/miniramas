// scripts/dev-db-probe.mjs
//
// One-shot probe of the dev Supabase DB to answer Step 0 questions:
//   - which commerce tables are present (003 applied?)
//   - SKUs seeded with real Stripe price IDs?
//   - any paid purchase rows yet (evidence of an end-to-end pass)?
//   - what does `jobs` look like (existing or new)?
//
// Reads .env.local for NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.

import 'dotenv/config'
import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'

loadDotenv({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function probeTable(name, masked = []) {
  const { data, error, count } = await supabase
    .from(name)
    .select('*', { count: 'exact' })
    .limit(3)
  if (error) return { exists: false, error: error.message }
  const sample = (data ?? []).map((row) => {
    const out = {}
    for (const [k, v] of Object.entries(row)) {
      out[k] = masked.includes(k) && typeof v === 'string' && v.length > 8
        ? v.slice(0, 6) + '…'
        : v
    }
    return out
  })
  return { exists: true, rowCount: count, sample }
}

async function jobsSchema() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql: `select column_name, data_type, is_nullable
            from information_schema.columns
           where table_schema = 'public' and table_name = 'jobs'
           order by ordinal_position`,
  })
  if (error) {
    // Fallback: probe an empty select to learn the columns
    const { data: row, error: e2 } = await supabase.from('jobs').select('*').limit(1)
    if (e2) return { method: 'select-probe', error: e2.message }
    return { method: 'select-probe', columnsKnown: row && row.length > 0 ? Object.keys(row[0]) : [], note: 'no rows; columns unknown without information_schema RPC' }
  }
  return { method: 'information_schema', columns: data }
}

const out = {}
for (const t of ['skus', 'purchases', 'entitlements', 'refund_log', 'jobs', 'queued_jobs', 'orders', 'magic_tokens', 'prompt_versions', 'renders', 'users']) {
  out[t] = await probeTable(t, ['stripe_price_id', 'stripe_session_id', 'stripe_charge_id', 'guest_email'])
}
out._jobs_schema = await jobsSchema()
console.log(JSON.stringify(out, null, 2))
