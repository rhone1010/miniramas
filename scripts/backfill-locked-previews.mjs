// scripts/backfill-locked-previews.mjs
//
// Build the locked-preview derivative for every portfolio piece that was
// rendered before the derivative existed.
//
// Before this runs, a locked piece has only the retired baked watermark to
// fall back on. The status route handles that (and says so in the log), but
// the fallback is the old 1.9-2.5 MB PNG — the thing the derivative exists to
// stop sending. This closes the gap for the pieces already in the database.
//
// ADDITIVE AND IDEMPOTENT. Writes only under the new locked/ prefix, never
// touches the clean master, never deletes a bake. A piece that already has a
// derivative is skipped, so re-running costs a list call and nothing else.
//
//   node scripts/backfill-locked-previews.mjs           # report only
//   node scripts/backfill-locked-previews.mjs --write   # actually upload

import { config as loadDotenv } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

loadDotenv({ path: '.env.local' })

const WRITE = process.argv.includes('--write')

/* Kept in step with lib/store/preview.ts by hand. This script is a one-off
   for existing rows; the render path is the authority for everything new. */
const LOCKED_PREVIEW_PX = 512
const LOCKED_PREVIEW_QUALITY = 82
const BUCKET = 'previews'
const lockedPath = (series, previewId) => `locked/${series}/${previewId}.jpg`

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

const { data: items, error: itemsErr } = await sb
  .from('portfolio_items')
  .select('id, portfolio_id, slot, status, preview_id')
  .eq('status', 'done')
  .not('preview_id', 'is', null)
if (itemsErr) { console.error('portfolio_items query failed:', itemsErr.message); process.exit(1) }

const { data: portfolios, error: pfErr } = await sb.from('portfolios').select('id, series')
if (pfErr) { console.error('portfolios query failed:', pfErr.message); process.exit(1) }
const seriesOf = new Map((portfolios ?? []).map((p) => [p.id, p.series]))

const previewIds = (items ?? []).map((i) => i.preview_id)
const { data: ledger, error: ledErr } = await sb
  .from('preview_ledger')
  .select('id, storage_path, unlocked_at')
  .in('id', previewIds)
if (ledErr) { console.error('preview_ledger query failed:', ledErr.message); process.exit(1) }
const ledgerOf = new Map((ledger ?? []).map((r) => [r.id, r]))

console.log(`${WRITE ? 'BACKFILL' : 'DRY RUN'} — ${items.length} done pieces across ${new Set(items.map(i => i.portfolio_id)).size} portfolios\n`)

let built = 0, skipped = 0, failed = 0
for (const item of items) {
  const series = seriesOf.get(item.portfolio_id)
  const led = ledgerOf.get(item.preview_id)
  const dest = lockedPath(series, item.preview_id)

  if (!series) { console.log(`  FAIL   ${item.preview_id}  no portfolio series`); failed++; continue }
  if (!led?.storage_path) { console.log(`  FAIL   ${item.preview_id}  no ledger storage_path`); failed++; continue }

  /* Every piece gets one, unlocked included. A piece can go back to locked:
     the unlock route's releaseClaim sets preview_ledger.unlocked_at to NULL
     when there was nothing to spend, so 'unlocked today' is not 'unlocked
     for good', and a re-locked piece with no derivative would fall through
     to the bake. */
  const existing = await sb.storage.from(BUCKET).createSignedUrl(dest, 60)
  if (existing.data?.signedUrl) { skipped++; continue }

  const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(led.storage_path)
  if (dlErr || !blob) { console.log(`  FAIL   ${item.preview_id}  master unreadable: ${dlErr?.message}`); failed++; continue }

  const src = Buffer.from(await blob.arrayBuffer())
  let out
  try {
    out = await sharp(src)
      .resize({ width: LOCKED_PREVIEW_PX, height: LOCKED_PREVIEW_PX, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: LOCKED_PREVIEW_QUALITY })
      .toBuffer()
  } catch (e) { console.log(`  FAIL   ${item.preview_id}  resize: ${e.message}`); failed++; continue }

  const pct = ((1 - out.length / src.length) * 100).toFixed(0)
  const state = led.unlocked_at ? 'unlocked' : 'locked  '
  if (!WRITE) {
    console.log(`  would  ${item.preview_id}  ${state}  ${(src.length/1024).toFixed(0)} KB -> ${(out.length/1024).toFixed(0)} KB  (-${pct}%)`)
    built++
    continue
  }

  const { error: upErr } = await sb.storage.from(BUCKET)
    .upload(dest, out, { contentType: 'image/jpeg', upsert: true })
  if (upErr) { console.log(`  FAIL   ${item.preview_id}  upload: ${upErr.message}`); failed++; continue }
  console.log(`  built  ${item.preview_id}  ${state}  ${(src.length/1024).toFixed(0)} KB -> ${(out.length/1024).toFixed(0)} KB  (-${pct}%)`)
  built++
}

console.log(`\n${WRITE ? 'built' : 'would build'}: ${built}   already present: ${skipped}   failed: ${failed}`)
if (!WRITE) console.log('\nNothing was written. Re-run with --write to upload.')
if (failed) process.exitCode = 1
