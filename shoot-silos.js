// shoot-silos.js
// Liten and Co - the missing gender for each of the 8 silo cards.
//
// Reads silo-jobs.json, renders through NB2, writes straight into
//   public/previews/silos/<silo>_<gender>.jpg
// at 800px, which is larger than the 400px effect previews because the silo
// cards render much bigger in the room grid.
//
// DRY RUN BY DEFAULT.
//   Preview:   node shoot-silos.js
//   One only:  node shoot-silos.js --apply --only light_glass
//   All eight: node shoot-silos.js --apply
//
// Existing files are never overwritten. Delete one to re-shoot it.
//
// No style-reference plate is sent. MAX_STYLE_REFS went to 0 on 2026-08-03
// because plates were overriding the source's facial structure; these cards
// are rendered the same way the live engine now renders.

const fs   = require('fs')
const path = require('path')

const REPO      = 'D:\\minramas'
const JOBS      = path.join(REPO, 'silo-jobs.json')
const SRC_DIR   = path.join(REPO, '_test_source_aug3')
const SILO_DIR  = path.join(REPO, 'public', 'previews', 'silos')

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000
const CARD_PX           = 800

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')
const onlyI = args.indexOf('--only')
const ONLY  = onlyI >= 0 ? args[onlyI + 1] : null

function readToken() {
  if (process.env.REPLICATE_API_TOKEN) return process.env.REPLICATE_API_TOKEN
  const envPath = path.join(REPO, '.env.local')
  if (!fs.existsSync(envPath)) return null
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*REPLICATE_API_TOKEN\s*=\s*(.+)\s*$/)
    if (m) return m[1].replace(/^["']|["']$/g, '').trim()
  }
  return null
}

let sharp = null
try { sharp = require(path.join(REPO, 'node_modules', 'sharp')) }
catch { try { sharp = require('sharp') } catch { sharp = null } }

function mimeFor(file) {
  const e = path.extname(file).toLowerCase()
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

  if (!res.ok) throw new Error(`Replicate POST ${res.status}: ${(await res.text()).slice(0, 200)}`)

  let pred = await res.json()

  if (pred.status !== 'succeeded' && pred.urls && pred.urls.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const p = await fetch(pred.urls.get, { headers: { 'Authorization': `Token ${token}` } })
      if (!p.ok) throw new Error(`poll ${p.status}`)
      pred = await p.json()
      if (pred.status === 'succeeded') break
      if (pred.status === 'failed' || pred.status === 'canceled') {
        throw new Error(`prediction ${pred.status}: ${pred.error || 'no detail'}`)
      }
    }
  }

  if (pred.status !== 'succeeded' || !pred.output) throw new Error(`no output, status=${pred.status}`)

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  if (!img.ok) throw new Error(`fetch output ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

async function main() {
  if (!fs.existsSync(JOBS)) {
    console.log(`\nMissing ${JOBS}\nPut silo-jobs.json in the repo root.\n`); return
  }
  if (!fs.existsSync(SILO_DIR)) {
    console.log(`\nMissing ${SILO_DIR}\n`); return
  }

  let jobs = JSON.parse(fs.readFileSync(JOBS, 'utf8'))
  if (ONLY) jobs = jobs.filter(j => j.silo === ONLY)

  if (jobs.length === 0) {
    console.log(`\nNo jobs matched${ONLY ? ` --only ${ONLY}` : ''}.\n`); return
  }

  const ready = []
  const problems = []

  for (const j of jobs) {
    const src = path.join(SRC_DIR, j.source)
    const dst = path.join(SILO_DIR, j.out)
    if (!fs.existsSync(src)) { problems.push(`${j.silo}: source missing - ${j.source}`); continue }
    if (fs.existsSync(dst))  { problems.push(`${j.silo}: ${j.out} already exists - skipping`); continue }
    ready.push({ ...j, src, dst })
  }

  console.log('')
  console.log(`=== READY : ${ready.length} ===`)
  for (const j of ready) {
    console.log(`  ${j.silo.padEnd(17)}${j.effect.padEnd(19)}${j.gender.padEnd(7)}${j.source.padEnd(17)}-> ${j.out}`)
  }

  if (problems.length) {
    console.log('')
    console.log(`=== SKIPPED : ${problems.length} ===`)
    problems.forEach(p => console.log(`  ${p}`))
  }

  if (!sharp) {
    console.log('')
    console.log(`sharp not found. Files will be written at full size, not ${CARD_PX}px.`)
  }

  if (!APPLY) {
    console.log('')
    console.log('DRY RUN. No renders, no writes, no credits spent.')
    console.log('Re-run with --apply to execute.')
    console.log('')
    return
  }

  const token = readToken()
  if (!token) { console.log('\nREPLICATE_API_TOKEN not found in env or .env.local\n'); return }

  console.log('')
  let ok = 0, fail = 0

  for (let i = 0; i < ready.length; i++) {
    const j = ready[i]
    const t = Date.now()
    process.stdout.write(`[${i + 1}/${ready.length}] ${j.silo} (${j.gender}) ... `)
    try {
      const buf = await callNB2(j.prompt, j.src, token)
      if (sharp) {
        await sharp(buf).resize(CARD_PX, CARD_PX, { fit: 'inside' })
                        .jpeg({ quality: 90 }).toFile(j.dst)
      } else {
        fs.writeFileSync(j.dst, buf)
      }
      ok++
      console.log(`ok ${((Date.now() - t) / 1000).toFixed(1)}s`)
    } catch (e) {
      fail++
      console.log(`FAILED - ${e.message}`)
    }
  }

  console.log('')
  console.log(`done. ${ok} rendered, ${fail} failed.`)
  console.log(`files in ${SILO_DIR}`)
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
