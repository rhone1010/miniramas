#!/usr/bin/env node
/*
 * split-style-refs.js — CENG · 2026-08-01
 *
 * Splits public/style-refs/portraits into two trees:
 *
 *   lib/v1/portraits/style-refs/<id>/    full-res plates, SERVER ONLY.
 *                                        Never web-served. These are the aux
 *                                        images NB2 receives at request time.
 *
 *   public/previews/<id>/                downsampled derivatives for the UI.
 *                                        400px long edge, JPEG q70, ~30KB.
 *                                        Small enough to be useless scraped.
 *
 * Also applies the id renames the catalog needs, and archives cut effects
 * rather than deleting them.
 *
 * DRY RUN by default. Nothing moves, writes or deletes without --apply.
 *
 *   node split-style-refs.js                 # show the plan
 *   node split-style-refs.js --apply
 *   node split-style-refs.js --apply --size=512 --quality=75
 *
 * Requires sharp, which the repo already has (portraits-expand used it).
 */

const fs   = require('fs')
const path = require('path')

const argv    = process.argv.slice(2)
const APPLY   = argv.includes('--apply')
const SIZE    = parseInt((argv.find(a => a.startsWith('--size='))    || '--size=400').split('=')[1], 10)
const QUALITY = parseInt((argv.find(a => a.startsWith('--quality=')) || '--quality=70').split('=')[1], 10)
const ROOT    = (argv.find(a => a.startsWith('--root=')) || '').split('=')[1] || process.cwd()

const SRC     = path.join(ROOT, 'public', 'style-refs', 'portraits')
const REFS    = path.join(ROOT, 'lib', 'v1', 'portraits', 'style-refs')
const PREV    = path.join(ROOT, 'public', 'previews', 'effects')
const ARCHIVE = path.join(ROOT, '_archive', 'style-refs-2026-08-01')

/* folder name -> canonical effect id.
 * NOT renaming `stone` — its engine id really is `stone`; only the LABEL
 * changed to Quartzite (see the note in effect-registry.ts). */
const RENAME = {
  forest_gaurdian: 'forest_guardian',   // typo
  deco_20s:        'deco_twenties',
  persian:         'persian_court',
  petals:          'petal_sculpture',
  ebony_live_edge: 'ebony',             // live-edge body supersedes the old one
  quartzite:       'stone',             // engine id is `stone`; label is Quartzite
}

/* Superseded plates. Archived so the folder they rename INTO is free.
 * Order matters: these are archived before any rename runs. */
const SUPERSEDED = [
  'ebony',      // pre-live-edge plate
  'stone',      // pre-raw-edge plate; quartzite/ holds the current pair
]

/* Gender suffix normalisation. _male/_female -> _man/_woman so a loader can
 * parse one convention. */
function normName(f) {
  return f.replace(/_male\b/, '_man').replace(/_female\b/, '_woman')
}

/* cut from the catalog — archived, never deleted */
const CUT = [
  'alabaster', 'walnut',                    // replaced by petrified_wood
  'amber', 'blown_glass',                   // cut 2026-08-01
  'haunted', 'melted_wax',                  // cut 2026-08-01
  'cosmic', 'volume_light', 'living_vines', // failed / cut earlier
]

/* locked ids with no plates yet */
const MISSING = [
  'art_deco',        // locked off a plate that was never saved to disk
  'lichen_granite',
  'mercury',
]

let sharp
try { sharp = require('sharp') }
catch { console.error('  ! sharp not found. npm i sharp'); process.exit(1) }

const IMG = /\.(jpe?g|png|webp)$/i
const mk  = d => { if (APPLY && !fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }) }
const kb  = n => (n / 1024).toFixed(0) + 'K'

console.log(`\n  source:   ${SRC}`)
console.log(`  refs ->   ${REFS}`)
console.log(`  prev ->   ${PREV}   (${SIZE}px long edge, q${QUALITY})`)
console.log(`  mode:     ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

if (!fs.existsSync(SRC)) { console.error('  ! source not found'); process.exit(1) }

const folders = fs.readdirSync(SRC, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('_'))
  .map(e => e.name)

const cutSet = new Set(CUT)
let nRef = 0, nPrev = 0, bIn = 0, bOut = 0

;(async () => {

  /* ---- 0. archive superseded plates so their id frees up ---- */
  console.log('  SUPERSEDED (archived so the rename target is free)')
  for (const f of SUPERSEDED) {
    const from = path.join(SRC, f)
    if (!fs.existsSync(from)) { console.log(`    - ${f} absent`); continue }
    const n = fs.readdirSync(from).filter(x => IMG.test(x)).length
    console.log(`    > ${f.padEnd(20)} ${n} file(s)`)
    if (APPLY) { mk(ARCHIVE); fs.renameSync(from, path.join(ARCHIVE, f + '-superseded')) }
  }

  /* ---- 1. archive the cuts ---- */
  console.log('\n  ARCHIVE')
  for (const f of folders.filter(f => cutSet.has(f)).sort()) {
    const from = path.join(SRC, f)
    const n = fs.readdirSync(from).filter(x => IMG.test(x)).length
    console.log(`    > ${f.padEnd(20)} ${n} files`)
    if (APPLY) { mk(ARCHIVE); fs.renameSync(from, path.join(ARCHIVE, f)) }
  }

  /* ---- 2. split the keepers ---- */
  console.log('\n  SPLIT')
  const supSet = new Set(SUPERSEDED)
  for (const f of folders.filter(f => !cutSet.has(f) && !supSet.has(f)).sort()) {
    const id    = RENAME[f] || f
    const from  = path.join(SRC, f)
    const files = fs.readdirSync(from).filter(x => IMG.test(x)).sort()
    if (!files.length) { console.log(`    - ${f.padEnd(20)} empty, skipped`); continue }

    const tag = id !== f ? `${f} -> ${id}` : id
    console.log(`    ${tag.padEnd(34)} ${files.length} plate(s)`)

    mk(path.join(REFS, id))
    mk(path.join(PREV, id))

    for (const file of files) {
      const src  = path.join(from, file)
      const size = fs.statSync(src).size
      bIn += size

      // full-res -> lib (server only)
      const refName = normName(file)
      if (APPLY) fs.copyFileSync(src, path.join(REFS, id, refName))
      nRef++

      // downsampled -> public/previews
      const outName = normName(file).replace(IMG, '.jpg')
      const outPath = path.join(PREV, id, outName)
      if (APPLY) {
        const buf = await sharp(src)
          .resize(SIZE, SIZE, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: QUALITY, mozjpeg: true })
          .toBuffer()
        fs.writeFileSync(outPath, buf)
        bOut += buf.length
      }
      nPrev++
      const tagN = normName(file) !== file ? `${file} -> ${normName(file)}` : file
      console.log(`        ${tagN.padEnd(30)} ${kb(size).padStart(6)}`)
    }
  }

  /* ---- 3. gaps ---- */
  console.log('\n  NO PLATES YET (locked, needs a shoot)')
  MISSING.filter(m => !folders.includes(m)).sort()
    .forEach(m => console.log(`    + ${m}`))

  /* ---- 4. gendered folders, flag only ---- */
  console.log('\n  GENDERED — one folder, both sexes. Split only after the')
  console.log('  Another Age toggle / refSelector contract is decided.')
  for (const g of ['victorian','renaissance','wild_west','samurai','deco_20s','persian','elizabethan']) {
    const p = path.join(SRC, g)
    if (!fs.existsSync(p)) continue
    const f = fs.readdirSync(p).filter(x => IMG.test(x))
    console.log(`    ${(RENAME[g] || g).padEnd(18)} ${f.join(', ')}`)
  }

  console.log(`\n  ${nRef} plates -> refs, ${nPrev} -> previews`)
  if (APPLY) {
    console.log(`  ${kb(bIn)} full-res kept server-side, ${kb(bOut)} public (${(100 - bOut / bIn * 100).toFixed(0)}% smaller)`)
    console.log(`\n  Originals are still in ${path.relative(ROOT, SRC)} — delete that tree`)
    console.log(`  once you have verified both outputs. Nothing is removed automatically.`)
    console.log(`\n  Add to .gitignore if refs should not be committed:`)
    console.log(`    lib/v1/portraits/style-refs/`)
  } else {
    console.log(`  dry run — nothing written. Add --apply.\n`)
  }
  console.log('')
})()
