// shoot-review.js
// Liten and Co - one render per effect, for judging the whole catalog.
//
// Reads review-jobs.json and writes to
//   D:\minramas\_review\<effect_id>.jpg
//
// Nothing in the app is touched. This folder is scratch - it is not a plate
// tree, not a preview tree, and nothing reads it.
//
// Sources rotate across all 18 in _test_source_aug3, alternating man and
// woman, so no face appears more than four times across 56 effects.
//
// No style-reference plate is sent. MAX_STYLE_REFS is 0 in the live engine,
// so this matches exactly what a customer would get.
//
// DRY RUN BY DEFAULT.
//   Preview:      node shoot-review.js
//   One effect:   node shoot-review.js --apply --only bronze
//   A silo:       node shoot-review.js --apply --ids bronze,iron,stone,jade
//   Everything:   node shoot-review.js --apply
//
// Existing files are skipped. Delete one to re-shoot it.
// Runs 3 at a time. Expect roughly 8-12 minutes for all 56.

const fs   = require('fs')
const path = require('path')

const REPO    = 'D:\\minramas'
const JOBS    = path.join(REPO, 'review-jobs.json')
const SRC_DIR = path.join(REPO, '_test_source_aug3')
const OUT_DIR = path.join(REPO, '_review')

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000
const CONCURRENCY       = 3

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')

function argVal(flag) {
  const i = args.indexOf(flag)
  return i >= 0 ? args[i + 1] : null
}
const ONLY = argVal('--only')
const IDS  = argVal('--ids')

function readToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN
  const p = path.join(REPO, '.env.local')
  if (!fs.existsSync(p)) return null
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*REPLICATE_API_TOKEN\s*=\s*(.+)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

function mimeFor(f) {
  const e = path.extname(f).toLowerCase()
  if (e === '.png')  return 'image/png'
  if (e === '.webp') return 'image/webp'
  return 'image/jpeg'
}

async function callNB2(prompt, sourceFile, token) {
  const b64 = fs.readFileSync(sourceFile).toString('base64')
  const uri = `data:${mimeFor(sourceFile)};base64,${b64}`

  const res = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_input:   [uri],
        aspect_ratio:  '1:1',
        output_format: 'jpg',
      },
    }),
  })

  if (!res.ok) throw new Error(`POST ${res.status}: ${(await res.text()).slice(0, 160)}`)

  let pred = await res.json()

  if (pred.status !== 'succeeded' && pred.urls && pred.urls.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const p = await fetch(pred.urls.get, { headers: { 'Authorization': `Token ${token}` } })
      if (!p.ok) throw new Error(`poll ${p.status}`)
      pred = await p.json()
      if (pred.status === 'succeeded') break
      if (pred.status === 'failed' || pred.status === 'canceled') {
        throw new Error(`${pred.status}: ${pred.error || 'no detail'}`)
      }
    }
  }

  if (pred.status !== 'succeeded' || !pred.output) throw new Error(`no output (${pred.status})`)

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  if (!img.ok) throw new Error(`fetch output ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

async function main() {
  if (!fs.existsSync(JOBS)) {
    console.log(`\nMissing ${JOBS}\n`); return
  }

  let jobs = JSON.parse(fs.readFileSync(JOBS, 'utf8'))
  if (ONLY) jobs = jobs.filter(j => j.effect === ONLY)
  if (IDS) {
    const set = new Set(IDS.split(',').map(s => s.trim()).filter(Boolean))
    jobs = jobs.filter(j => set.has(j.effect))
  }

  if (jobs.length === 0) { console.log('\nNo jobs matched.\n'); return }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

  const ready = []
  const skipped = []

  for (const j of jobs) {
    const src = path.join(SRC_DIR, j.source)
    const dst = path.join(OUT_DIR, j.out)
    if (!fs.existsSync(src)) { skipped.push(`${j.effect}: source missing - ${j.source}`); continue }
    if (fs.existsSync(dst))  { skipped.push(`${j.effect}: already rendered`); continue }
    ready.push({ ...j, src, dst })
  }

  console.log('')
  console.log(`=== READY : ${ready.length} ===`)
  for (const j of ready) console.log(`  ${j.effect.padEnd(18)}${j.source}`)

  if (skipped.length) {
    console.log('')
    console.log(`=== SKIPPED : ${skipped.length} ===`)
    skipped.forEach(s => console.log(`  ${s}`))
  }

  if (!APPLY) {
    console.log('')
    console.log(`DRY RUN. No renders, no writes, no credits spent.`)
    console.log(`Output would go to ${OUT_DIR}`)
    console.log('Re-run with --apply to execute.')
    console.log('')
    return
  }

  const token = readToken()
  if (!token) { console.log('\nREPLICATE_API_TOKEN not found\n'); return }

  console.log('')
  let done = 0, ok = 0, fail = 0
  const failures = []
  let next = 0

  async function worker() {
    while (true) {
      const i = next++
      if (i >= ready.length) return
      const j = ready[i]
      const t = Date.now()
      try {
        const buf = await callNB2(j.prompt, j.src, token)
        fs.writeFileSync(j.dst, buf)
        ok++
        console.log(`[${++done}/${ready.length}] ${j.effect.padEnd(18)} ok   ${((Date.now() - t) / 1000).toFixed(1)}s`)
      } catch (e) {
        fail++
        failures.push(`${j.effect}: ${e.message}`)
        console.log(`[${++done}/${ready.length}] ${j.effect.padEnd(18)} FAIL ${e.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  console.log('')
  console.log(`${ok} rendered, ${fail} failed.`)
  if (failures.length) failures.forEach(f => console.log(`  ${f}`))
  console.log(`files in ${OUT_DIR}`)
  console.log('')
  console.log('Re-run any single effect after editing its body:')
  console.log('  del D:\\minramas\\_review\\<effect>.jpg')
  console.log('  node shoot-review.js --apply --only <effect>')
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
