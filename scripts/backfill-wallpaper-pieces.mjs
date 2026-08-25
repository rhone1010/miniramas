#!/usr/bin/env node
// scripts/backfill-wallpaper-pieces.mjs
//
// Repairs wallpaper rows written before the collection-copy fix.
//
// Those rows carry image_path = studio/<section>/<file> - a path in the
// PUBLIC wallpapers bucket. The pieces reader signs image_path against the
// private 'collection' bucket, gets null, and the tile renders src="null".
// The purchase route now copies at buy time; this repairs what was bought
// before it did (as of 25 August: one row, Rich's 24 Aug test purchase).
//
// For each live wallpapers row whose image_path still starts studio/:
//   1. download from the wallpapers bucket
//   2. upload to collection/<owner>/<uuid>.jpg
//   3. update the row: image_path = the new path, meta.source_path = the old
//
// DRY RUN BY DEFAULT - lists what it would repair. --write to do it.
// Idempotent: repaired rows no longer match the studio/ prefix and are
// never touched again. Nothing is deleted; the studio master stays.
//
//   node scripts/backfill-wallpaper-pieces.mjs
//   node scripts/backfill-wallpaper-pieces.mjs --write
//
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment -
// reads .env.local from the repo root itself, since node does not.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

// .env.local, hand-parsed - two keys, no dependency.
try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* fine - env may already be set */ }

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set and .env.local absent.')
  process.exit(1)
}

const write = process.argv.includes('--write')
const db = createClient(url, key, { auth: { persistSession: false } })

const { data: rows, error } = await db
  .from('collection_pieces')
  .select('id, owner_key, image_path, meta')
  .eq('series', 'wallpapers')
  .like('image_path', 'studio/%')

if (error) { console.error('query failed:', error.message); process.exit(1) }

console.log(`\n${rows.length} row(s) carry a studio path${write ? '' : '  (dry run)'}\n`)

let repaired = 0
for (const r of rows) {
  console.log(`  ${r.id}  ${r.image_path}`)
  if (!write) continue

  const { data: blob, error: dlErr } = await db.storage.from('wallpapers').download(r.image_path)
  if (dlErr || !blob) { console.error('    download failed:', dlErr?.message); continue }

  const newPath = `${r.owner_key}/${randomUUID()}.jpg`
  const { error: upErr } = await db.storage
    .from('collection')
    .upload(newPath, blob, { contentType: 'image/jpeg', upsert: false })
  if (upErr) { console.error('    upload failed:', upErr.message); continue }

  const { error: updErr } = await db
    .from('collection_pieces')
    .update({ image_path: newPath, meta: { ...(r.meta || {}), source_path: r.image_path } })
    .eq('id', r.id)
  if (updErr) { console.error('    row update failed:', updErr.message); continue }

  console.log(`    -> ${newPath}`)
  repaired++
}

console.log(`\n${write ? repaired + ' repaired.' : 'Dry run - nothing changed. Re-run with --write.'}\n`)
