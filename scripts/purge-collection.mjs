// scripts/purge-collection.mjs
//
// One-off owner-scoped purge of My Collection.
//
//   node scripts/purge-collection.mjs you@example.com            (dry run)
//   node scripts/purge-collection.mjs you@example.com --live     (deletes)
//
// Deletes, for one owner only:
//   - every object in the private 'collection' bucket named by that owner's rows
//   - every collection_pieces row for that owner (wall AND archive)
//
// It does NOT add a DELETE handler to the API. The route's rule stands:
// nothing in the product destroys a customer's work. This is a hand-run tool.
//
// Storage objects are removed BEFORE the rows, because the row is the only
// record of the object's path. Rows first would orphan every file forever.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUCKET = 'collection'

// --- env ------------------------------------------------------------------
// Read .env.local directly. This runs outside Next, so process.env is bare.
function loadEnv() {
  const out = {}
  let raw
  try {
    raw = readFileSync(resolve(ROOT, '.env.local'), 'utf8')
  } catch {
    throw new Error('.env.local not found at ' + ROOT)
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    let v = m[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    out[m[1]] = v
  }
  return out
}

const env = loadEnv()
const URL = env.SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('FAIL  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing from .env.local')
  process.exit(1)
}

// --- args -----------------------------------------------------------------
const args = process.argv.slice(2)
const LIVE = args.includes('--live')
const target = args.find(a => !a.startsWith('--'))
if (!target) {
  console.error('FAIL  give an email address or an owner_key')
  console.error('      node scripts/purge-collection.mjs you@example.com')
  process.exit(1)
}

const db = createClient(URL, KEY, { auth: { persistSession: false } })

// --- resolve the owner ----------------------------------------------------
// owner_key is the auth user id for a signed-in account, or a browser guest
// token for anything crafted before signing in. An email resolves to the
// former; guest pieces have to be named directly.
async function resolveOwnerKey(input) {
  if (!input.includes('@')) return input
  let page = 1
  for (;;) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error('listUsers failed: ' + error.message)
    const hit = (data?.users || []).find(
      u => (u.email || '').toLowerCase() === input.toLowerCase()
    )
    if (hit) return hit.id
    if (!data?.users?.length || data.users.length < 200) break
    page += 1
  }
  throw new Error('no account found for ' + input)
}

// --- run ------------------------------------------------------------------
const ownerKey = await resolveOwnerKey(target)
console.log('owner_key  ' + ownerKey)
console.log('mode       ' + (LIVE ? 'LIVE - THIS DELETES' : 'dry run'))
console.log('')

const { data: rows, error: readErr } = await db
  .from('collection_pieces')
  .select('id, label, image_path, source_path, archived, created_at')
  .eq('owner_key', ownerKey)
  .order('created_at', { ascending: false })

if (readErr) {
  console.error('FAIL  read: ' + readErr.message)
  process.exit(1)
}
if (!rows || !rows.length) {
  console.log('Nothing to purge. 0 rows.')
  process.exit(0)
}

const onWall   = rows.filter(r => !r.archived).length
const archived = rows.length - onWall
const paths = []
for (const r of rows) {
  if (r.image_path)  paths.push(r.image_path)
  if (r.source_path) paths.push(r.source_path)
}

console.log('rows       ' + rows.length + '  (' + onWall + ' on the wall, ' + archived + ' archived)')
console.log('objects    ' + paths.length + ' in bucket "' + BUCKET + '"')
console.log('oldest     ' + rows[rows.length - 1].created_at)
console.log('newest     ' + rows[0].created_at)
console.log('')

if (!LIVE) {
  console.log('Dry run. Re-run with --live to delete.')
  process.exit(0)
}

// Storage first. Supabase caps a remove() call, so go in batches and report
// each one rather than assuming a single call cleared everything.
let removed = 0
for (let i = 0; i < paths.length; i += 100) {
  const batch = paths.slice(i, i + 100)
  const { data, error } = await db.storage.from(BUCKET).remove(batch)
  if (error) {
    console.error('FAIL  storage batch at ' + i + ': ' + error.message)
    console.error('      No rows deleted. Fix and re-run.')
    process.exit(1)
  }
  removed += (data || []).length
  console.log('storage    removed ' + removed + ' / ' + paths.length)
}

const { error: delErr } = await db
  .from('collection_pieces')
  .delete()
  .eq('owner_key', ownerKey)

if (delErr) {
  console.error('FAIL  row delete: ' + delErr.message)
  console.error('      Storage objects are already gone. Rows must be cleared by hand.')
  process.exit(1)
}

const { count } = await db
  .from('collection_pieces')
  .select('id', { count: 'exact', head: true })
  .eq('owner_key', ownerKey)

console.log('rows       deleted')
console.log('remaining  ' + (count ?? 0))
console.log('')
console.log(count === 0 ? 'Done. Collection is empty.' : 'WARNING  ' + count + ' rows survived.')
