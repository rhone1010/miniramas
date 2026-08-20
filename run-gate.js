// run-gate.js
// Liten and Co - run the calibration corpus through the live intake gate
// and dump every field it returns to a CSV.
//
// This does NOT judge anything. It records what the gate said so Rich can
// put his own verdict beside it. Where the two disagree is the spec.
//
// Reads   D:\minramas\calibration\        (the labelled originals)
//         D:\minramas\_calibration\       (derived ladders, if present)
// Writes  D:\minramas\_calibration\gate-results.csv
//
// Hits the running app, so the dev server must be up:
//   npm run dev
//
// DRY RUN BY DEFAULT.
//   Preview:   node run-gate.js
//   Execute:   node run-gate.js --apply
//   Subset:    node run-gate.js --apply --match dim
//   Resume:    already-recorded files are skipped
//
// Costs one vision call per image. 200 images is roughly 6-10 minutes.

const fs   = require('fs')
const path = require('path')

const REPO      = 'D:\\minramas'
const DIRS      = [
  'D:\\minramas\\_recovery\\at-19c3157\\bench-sources\\calibration',
  path.join(REPO, '_calibration'),
  path.join(REPO, '_calibration', 'false-reject'),
]
const OUT_CSV   = path.join(REPO, '_calibration', 'gate-results.csv')
const ENDPOINT  = 'http://localhost:3000/api/v1/portraits/analyze'
const CONCURRENCY = 3

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')
const MATCH = args.indexOf('--match') >= 0 ? args[args.indexOf('--match') + 1] : null

// Columns. Ordered so the ones Rich reads are leftmost.
const COLS = [
  'file', 'label', 'severity',
  'rich_verdict',            // left blank - Rich fills this in
  'quality_verdict',
  'recommendation',
  'smallest_face_min_dim_px',
  'body_coverage',
  'subject_count_estimate',
  'face_count', 'face_gates', 'face_size_pcts',
  'sharpness', 'lighting', 'concerns',
  'detected_gender', 'detected_age_group',
  'gender', 'age_group',     // top-level, from detectFaceVisibility
  'http', 'error',
]

function mimeFor(f) {
  const e = path.extname(f).toLowerCase()
  if (e === '.png')  return 'image/png'
  if (e === '.webp') return 'image/webp'
  return 'image/jpeg'
}

// Pull label + severity out of the filename. Two shapes:
//   person-009-f-dim.jpg        -> label=dim      severity=(none)
//   blur-r7__person-004-f-clean -> label=blur     severity=r7
function parseName(f) {
  // Anything sitting in false-reject/ is a known-good photo the gate wrongly
  // refused. Label by folder, not filename - these come from the wild and
  // have no naming convention.
  if (path.dirname(f).replace(/\\/g,'/').endsWith('/false-reject')) {
    return { label: 'false-reject', severity: '' }
  }
  const stem = path.basename(f).replace(/\.[^.]+$/, '')
  const derived = stem.match(/^([a-z]+)-([a-z0-9]+)__/)
  if (derived) return { label: derived[1], severity: derived[2] }
  const orig = stem.match(/^person-\d+-[mf]-([a-z]+)$/)
  if (orig) return { label: orig[1], severity: '' }
  if (/^mismatch/.test(stem)) return { label: 'mismatch', severity: '' }
  return { label: 'other', severity: '' }
}

function csvEscape(v) {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function analyze(file) {
  const b64 = fs.readFileSync(file).toString('base64')
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      source_image_b64: b64,
      mime_type: mimeFor(file),
    }),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* leave null */ }
  return { http: res.status, json, raw: text.slice(0, 200) }
}

// The analyze route nests most of this under `result`, and returns gender /
// age_group at the TOP level. Read defensively - if a field moves, the cell
// comes back blank rather than the script dying.
function flatten(file, r) {
  const { label, severity } = parseName(file)
  const j  = r.json || {}
  const R  = j.result || j
  const p0 = (R.per_photo && R.per_photo[0]) || {}
  const faces = p0.faces || R.faces || []

  return {
    file: path.basename(file),
    label, severity,
    rich_verdict: '',
    quality_verdict:          R.quality_verdict,
    recommendation:           R.recommendation,
    smallest_face_min_dim_px: R.smallest_face_min_dim_px,
    body_coverage:            R.body_coverage,
    subject_count_estimate:   R.subject_count_estimate,
    face_count:      faces.length,
    face_gates:      faces.map(f => f.gate).join('|'),
    face_size_pcts:  faces.map(f => f.size_pct).join('|'),
    sharpness:       p0.sharpness,
    lighting:        p0.lighting,
    concerns:        (p0.concerns || []).join('; '),
    detected_gender:    R.detected_gender,
    detected_age_group: R.detected_age_group,
    gender:    j.gender,
    age_group: j.age_group,
    http:  r.http,
    error: r.http === 200 ? '' : r.raw,
  }
}

async function main() {
  let files = []
  for (const d of DIRS) {
    if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d)) {
      if (/\.(jpe?g|png|webp)$/i.test(f)) files.push(path.join(d, f))
    }
  }
  if (MATCH) files = files.filter(f => path.basename(f).includes(MATCH))
  files.sort()

  if (files.length === 0) { console.log('\nNo images found.\n'); return }

  // Resume: skip anything already in the CSV.
  const done = new Set()
  if (fs.existsSync(OUT_CSV)) {
    const lines = fs.readFileSync(OUT_CSV, 'utf8').split(/\r?\n/).slice(1)
    for (const l of lines) {
      const first = l.split(',')[0].replace(/^"|"$/g, '')
      if (first) done.add(first)
    }
  }
  const todo = files.filter(f => !done.has(path.basename(f)))

  const byLabel = {}
  for (const f of todo) {
    const { label } = parseName(f)
    byLabel[label] = (byLabel[label] || 0) + 1
  }

  console.log('')
  console.log(`=== TO RUN : ${todo.length} ===   (${done.size} already recorded)`)
  for (const [k, v] of Object.entries(byLabel).sort()) {
    console.log(`  ${k.padEnd(14)}${String(v).padStart(4)}`)
  }
  console.log('')
  console.log(`endpoint : ${ENDPOINT}`)
  console.log(`output   : ${OUT_CSV}`)

  if (!APPLY) {
    console.log('')
    console.log('DRY RUN. No calls made, nothing written.')
    console.log('Re-run with --apply to execute. Dev server must be running.')
    console.log('')
    return
  }
  if (todo.length === 0) { console.log('\nNothing to do.\n'); return }

  const outDir = path.dirname(OUT_CSV)
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  if (!fs.existsSync(OUT_CSV)) {
    fs.writeFileSync(OUT_CSV, COLS.join(',') + '\n')
  }

  console.log('')
  let next = 0, done_n = 0, failed = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= todo.length) return
      const f = todo[i]
      const t = Date.now()
      let row
      try {
        row = flatten(f, await analyze(f))
        if (row.http !== 200) failed++
      } catch (e) {
        failed++
        row = { ...flatten(f, { http: 0, json: null, raw: '' }), error: e.message }
      }
      fs.appendFileSync(OUT_CSV, COLS.map(c => csvEscape(row[c])).join(',') + '\n')
      console.log(
        `[${++done_n}/${todo.length}] ${path.basename(f).padEnd(40)}` +
        `${String(row.quality_verdict || row.http).padEnd(8)}${((Date.now() - t) / 1000).toFixed(1)}s`
      )
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log('')
  console.log(`${done_n} rows written, ${failed} errored.`)
  console.log(OUT_CSV)
  console.log('')
  console.log('Next: open the CSV, fill in rich_verdict (pass / fail / borderline).')
  console.log('Disagreements between rich_verdict and quality_verdict are the spec.')
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
