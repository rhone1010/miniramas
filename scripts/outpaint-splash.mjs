// scripts/outpaint-splash.mjs
//
// TALL PLATES FOR THE PHONE REEL.
//
//     node scripts/outpaint-splash.mjs                 (dry run — costs nothing)
//     node scripts/outpaint-splash.mjs --live          (calls Stability)
//     node scripts/outpaint-splash.mjs --live --only man_charcoal.jpg
//
// WHY
//   The splash plates are near square and a phone is about 9:19.5. The reel
//   currently contains them on a blurred ground, which keeps the whole
//   picture but does not fill the screen with it. Outpainting extends the
//   scene upward and downward so the plate is genuinely tall.
//
// WHAT IT DOES NOT DO
//   It does not touch the originals, and it does not pad sideways. The
//   width is already right; adding to the sides would only push the face
//   smaller. Output lands in splash/tall/ as a separate set, so a bad
//   result is deleted rather than recovered.
//
// COST
//   Stability outpaint is 4 credits a call, about four cents. Twenty-four
//   plates is roughly a dollar. The dry run prints the bill before you
//   agree to it.
//
// CREATIVITY
//   0.35, not the 0.5 the app pipeline uses. That pipeline is extending a
//   generated scene; this is extending a portrait somebody will recognise
//   themselves in, and a creative outpaint invents shoulders. Lower is
//   duller and duller is right here.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs'
import { resolve, dirname, join } from 'path'
import { fileURLToPath } from 'url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC  = join(ROOT, 'public', 'previews', 'home', 'splash')
const OUT  = join(SRC, 'tall')

const TARGET_RATIO = 9 / 16   // the reel's shape; the phone is taller still
                              // but the scrim and the headline take the rest
const CREATIVITY   = '0.35'
const MAX_SIDE_PAD = 2000     // Stability's ceiling per direction

const LIVE = process.argv.includes('--live')
const onlyIdx = process.argv.indexOf('--only')
const ONLY = onlyIdx > -1 ? process.argv[onlyIdx + 1] : null

// ── env ────────────────────────────────────────────────────────────────
function loadEnv() {
  const out = {}
  let raw
  try { raw = readFileSync(join(ROOT, '.env.local'), 'utf8') }
  catch { throw new Error('.env.local not found at ' + ROOT) }
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
const KEY = env.STABILITY_API_KEY
if (!KEY) {
  console.error('FAIL  STABILITY_API_KEY missing from .env.local')
  process.exit(1)
}

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('FAIL  sharp not available. Run this from the repo root.')
  process.exit(1)
}

// ── work out what needs doing ──────────────────────────────────────────
if (!existsSync(SRC)) {
  console.error('FAIL  no splash folder at ' + SRC)
  process.exit(1)
}

let files = readdirSync(SRC)
  .filter(f => /\.(jpe?g|png)$/i.test(f))
  .filter(f => statSync(join(SRC, f)).isFile())
  .sort()

if (ONLY) files = files.filter(f => f === ONLY)

/* The source photographs are not in the reel and do not want extending —
   they appear only on the before-and-after wall, at square. */
files = files.filter(f => !f.includes('_real'))

console.log('source      ' + SRC)
console.log('output      ' + OUT)
console.log('mode        ' + (LIVE ? 'LIVE — THIS SPENDS CREDITS' : 'dry run'))
console.log('target      ' + TARGET_RATIO.toFixed(4) + ' (9:16), creativity ' + CREATIVITY)
console.log('candidates  ' + files.length)
console.log('')

const jobs = []
const skipped = []

for (const f of files) {
  const dest = join(OUT, f.replace(/\.[^.]+$/, '.jpg'))

  if (existsSync(dest) && !ONLY) {
    skipped.push(f + '  (already built)')
    continue
  }

  const meta = await sharp(join(SRC, f)).metadata()
  const w = meta.width, h = meta.height
  if (!w || !h) { skipped.push(f + '  (unreadable)'); continue }

  /* The width stays. Only height is added, split evenly above and below —
     a portrait sits centred and pushing it up or down looks like a
     mistake rather than a decision. */
  const wantH = Math.round(w / TARGET_RATIO)
  const need  = wantH - h

  if (need <= 0) {
    skipped.push(`${f}  (already ${w}x${h}, tall enough)`)
    continue
  }

  const pad = Math.ceil(need / 2)
  if (pad > MAX_SIDE_PAD) {
    skipped.push(`${f}  (needs ${pad}px a side, over Stability's ${MAX_SIDE_PAD} ceiling)`)
    continue
  }

  jobs.push({ file: f, dest, w, h, pad, outH: h + pad * 2 })
}

for (const j of jobs) {
  console.log(`  ${j.file.padEnd(32)} ${j.w}x${j.h}  ->  ${j.w}x${j.outH}   (+${j.pad} top and bottom)`)
}
if (skipped.length) {
  console.log('')
  console.log('skipped:')
  for (const s of skipped) console.log('  ' + s)
}

console.log('')
console.log(`${jobs.length} to build  ·  about $${(jobs.length * 0.04).toFixed(2)} at 4 credits each`)

if (!jobs.length) { console.log('Nothing to do.'); process.exit(0) }

if (!LIVE) {
  console.log('')
  console.log('Dry run — nothing was sent and nothing was spent.')
  console.log('Re-run with --live to build them.')
  process.exit(0)
}

mkdirSync(OUT, { recursive: true })

// ── run ────────────────────────────────────────────────────────────────
let done = 0, failed = 0

for (const j of jobs) {
  const buf = readFileSync(join(SRC, j.file))

  const form = new FormData()
  form.append('image', new Blob([buf], { type: 'image/jpeg' }), j.file)
  form.append('up',   String(j.pad))
  form.append('down', String(j.pad))
  /* left and right deliberately omitted — the width is already right and
     padding sideways only makes the face smaller. */
  form.append('creativity', CREATIVITY)
  form.append('output_format', 'jpeg')

  try {
    const res = await fetch(
      'https://api.stability.ai/v2beta/stable-image/edit/outpaint',
      { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, Accept: 'image/*' }, body: form },
    )

    if (!res.ok) {
      const err = await res.text()
      console.log(`  FAIL  ${j.file}  (${res.status}) ${err.slice(0, 160)}`)
      failed++
      continue
    }

    const out = Buffer.from(await res.arrayBuffer())
    writeFileSync(j.dest, out)

    const m = await sharp(out).metadata()
    done++
    console.log(`  ok    ${j.file.padEnd(32)} ${m.width}x${m.height}   ${(out.length / 1024) | 0}KB   [${done}/${jobs.length}]`)
  } catch (e) {
    console.log(`  FAIL  ${j.file}  ${e?.message || e}`)
    failed++
  }
}

console.log('')
console.log(`Done. ${done} built, ${failed} failed.`)
console.log('')
console.log('LOOK AT THEM BEFORE COMMITTING. An outpaint invents what was never')
console.log('photographed — a shoulder, a background, sometimes a second chin.')
console.log('Delete any that did not work; the reel falls back to the square')
console.log('plate on its own for anything missing from tall/.')
