#!/usr/bin/env node
// scripts/upload-clean-wallpapers.mjs
//
// Puts the CLEAN wallpaper masters where the store sells from.
//
// -- WHY -----------------------------------------------------------------
//
// The contract (wallpaper-registry.js, SPEC-WALLPAPER-STORE): the bucket
// path studio/<section>/<file> is the CLEAN file a purchase delivers, and
// studio/<section>/preview/<file> is the watermarked one the floor shows.
//
// Reality, found 25 August when Rich's first purchased tile rendered with
// the LITEN mark on it: WATERMARKED files sit at BOTH paths. The clean
// masters were never uploaded. The registry's own header admitted the
// preview layout was "ASSUMED, NOT CONFIRMED" - and the half that was
// wrong was the half customers pay for.
//
// This uploads D:\minramas\wallpaper-batch\<section>\clean\* to
// wallpapers/studio/<section>/, OVERWRITING the watermarked impostors at
// the main path. The preview/ set is not touched - it is watermarked on
// purpose.
//
// -- AFTER THIS RUNS ------------------------------------------------------
//
// Purchases deliver clean files from then on. Pieces ALREADY copied into
// the collection bucket were copied from the watermarked set and stay
// marked - re-run the repair for those:
//
//     node scripts/backfill-wallpaper-pieces.mjs            (it is
//     idempotent by path prefix, so re-repairing needs the row reset -
//     the script prints nothing to redo unless image_path is studio/*.
//     For Rich's one tile: point its image_path back to the studio path
//     in SQL, then run the backfill again - or simpler, buy nothing and
//     let CENG do it, one UPDATE + one run.)
//
// -- USAGE ----------------------------------------------------------------
//
//   node scripts/upload-clean-wallpapers.mjs                dry run
//   node scripts/upload-clean-wallpapers.mjs --write
//   node scripts/upload-clean-wallpapers.mjs --write --only general
//
// Dry run lists counts and the first few names per section. Needs
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (reads .env.local itself).
// ~1,029 files at ~300KB is a few minutes; progress prints every 50.

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

try {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^(SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
} catch { /* env may already be set */ }

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set and .env.local absent.')
  process.exit(1)
}

const write = process.argv.includes('--write')
const onlyIx = process.argv.indexOf('--only')
const only = onlyIx !== -1 ? process.argv[onlyIx + 1] : null

const SECTIONS = ['general', 'halloween'].filter(s => !only || s === only)
const ROOT = join('wallpaper-batch')

const db = createClient(url, key, { auth: { persistSession: false } })

let total = 0, done = 0, failed = 0
for (const section of SECTIONS) {
  const dir = join(ROOT, section, 'clean')
  let names
  try {
    names = readdirSync(dir).filter(n => n.endsWith('.jpg')).sort()
  } catch {
    console.error(`REFUSED: ${dir} not found - run from the repo root.`)
    process.exit(1)
  }
  total += names.length
  console.log(`\n${section}: ${names.length} clean files -> studio/${section}/`)
  if (!write) {
    for (const n of names.slice(0, 3)) console.log(`  ${n}`)
    if (names.length > 3) console.log(`  ... and ${names.length - 3} more`)
    continue
  }
  for (const n of names) {
    const bytes = readFileSync(join(dir, n))
    const { error } = await db.storage
      .from('wallpapers')
      .upload(`studio/${section}/${n}`, bytes, { contentType: 'image/jpeg', upsert: true })
    if (error) { console.error(`  FAILED ${n}: ${error.message}`); failed++ }
    else {
      done++
      if (done % 50 === 0) console.log(`  ${done} uploaded...`)
    }
  }
}

console.log('')
if (!write) {
  console.log(`Dry run - ${total} file(s) would upload, overwriting the watermarked set at the main path.`)
  console.log('Re-run with --write.')
} else {
  console.log(`${done} uploaded, ${failed} failed, of ${total}.`)
  if (failed) console.log('Failed names above - re-run; upsert makes it safe.')
  console.log('Spot-check one URL in the browser, then repair the already-bought tile.')
}
