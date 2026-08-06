// shoot-plates.js
// Liten and Co - render the missing gender plates.
//
// Reads shoot-jobs.json, renders each job through NB2 (google/nano-banana-2),
// and writes the result to BOTH trees:
//   lib/v1/portraits/style-refs/<effect>/<out>     full resolution
//   public/previews/effects/<effect>/<out>         400px copy
//
// DRY RUN BY DEFAULT. Nothing calls Replicate and nothing is written
// until you add --apply.
//
//   Preview:  node shoot-plates.js
//   One only: node shoot-plates.js --apply --only bronze
//   All 23:   node shoot-plates.js --apply
//
// Existing files are never overwritten. Delete a plate to re-shoot it.

const fs   = require('fs')
const path = require('path')

const REPO      = 'D:\\minramas'
const JOBS      = path.join(REPO, 'shoot-jobs.json')
const SRC_DIR   = path.join(REPO, '_test_source_aug3')
const PLATE_DIR = path.join(REPO, 'lib', 'v1', 'portraits', 'style-refs')
const PVW_DIR   = path.join(REPO, 'public', 'previews', 'effects')

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000
const PREVIEW_PX        = 400

const args  = process.argv.slice(2)
const APPLY = args.includes('--apply')
const onlyI = args.indexOf('--only')
const ONLY  = onlyI >= 0 ? args[onlyI + 1] : null

// ─── token, read the same way Next does ──────────────────────────

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

// ─── sharp, for the 400px copy ───────────────────────────────────

let sharp = null
try {
  sharp = require(path.join(REPO, 'node_modules', 'sharp'))
} catch {
  try { sharp = require('sharp') } catch { sharp = null }
}

// ─── NB2 ─────────────────────────────────────────────────────────

function mimeFor(file) {
  const e = path.extname(file).toLowerCase()
  if (e === '.png')  return 'image/png'
  if (e === '.webp') return 'image/webp'
  return 'image/jpeg'
}

async function callNB2(prompt, sourceFile, token) {
  const b64  = fs.readFileSync(sourceFile).toString('base64')
  const uri  = `data:${mimeFor(sourceFile)};base64,${b64}`

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

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Replicate POST ${res.status}: ${t.slice(0, 200)}`)
  }

  let pred = await res.json()

  if (pred.status !== 'succeeded' && pred.urls && pred.urls.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const p = await fetch(pred.urls.get, {
        headers: { 'Authorization': `Token ${token}` },
      })
      if (!p.ok) throw new Error(`poll ${p.status}`)
      pred = await p.json()
      if (pred.status === 'succeeded') break
      if (pred.status === 'failed' || pred.status === 'canceled') {
        throw new Error(`prediction ${pred.status}: ${pred.error || 'no detail'}`)
      }
    }
  }

  if (pred.status !== 'succeeded' || !pred.output) {
    throw new Error(`no output, status=${pred.status}`)
  }

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  if (!img.ok) throw new Error(`fetch output ${img.status}`)
  return Buffer.from(await img.arrayBuffer())
}

// ─── main ────────────────────────────────────────────────────────

async function main() {

  if (!fs.existsSync(JOBS)) {
    console.log(`\nMissing ${JOBS}\nPut shoot-jobs.json in the repo root.\n`)
    return
  }

  let jobs = JSON.parse(fs.readFileSync(JOBS, 'utf8'))
  if (ONLY) jobs = jobs.filter(j => j.effect === ONLY)

  if (jobs.length === 0) {
    console.log(`\nNo jobs matched${ONLY ? ` --only ${ONLY}` : ''}.\n`)
    return
  }

  // Pre-flight. Every check runs before a single credit is spent.
  const problems = []
  const ready    = []

  for (const j of jobs) {
    const src   = path.join(SRC_DIR, j.source)
    const plate = path.join(PLATE_DIR, j.effect, j.out)
    const pvw   = path.join(PVW_DIR,  j.effect, j.out)

    if (!fs.existsSync(src)) {
      problems.push(`${j.effect}: source missing - ${j.source}`); continue
    }
    if (!fs.existsSync(path.join(PLATE_DIR, j.effect))) {
      problems.push(`${j.effect}: no style-refs folder`); continue
    }
    if (!fs.existsSync(path.join(PVW_DIR, j.effect))) {
      problems.push(`${j.effect}: no previews folder`); continue
    }
    if (fs.existsSync(plate) || fs.existsSync(pvw)) {
      problems.push(`${j.effect}: ${j.out} already exists - skipping`); continue
    }
    ready.push({ ...j, src, plate, pvw })
  }

  console.log('')
  console.log(`=== READY : ${ready.length} ===`)
  for (const j of ready) {
    console.log(`  ${j.effect.padEnd(18)} ${j.gender.padEnd(6)} ${j.source.padEnd(24)} -> ${j.out}`)
  }

  if (problems.length) {
    console.log('')
    console.log(`=== SKIPPED : ${problems.length} ===`)
    problems.forEach(p => console.log(`  ${p}`))
  }

  if (!sharp) {
    console.log('')
    console.log('sharp not found. Full plates will be written; 400px previews will not.')
  }

  if (!APPLY) {
    console.log('')
    console.log('DRY RUN. No renders, no writes, no credits spent.')
    console.log('Re-run with --apply to execute.')
    console.log('')
    return
  }

  const token = readToken()
  if (!token) {
    console.log('\nREPLICATE_API_TOKEN not found in env or D:\\minramas\\.env.local\n')
    return
  }

  console.log('')
  let ok = 0, fail = 0

  for (let i = 0; i < ready.length; i++) {
    const j = ready[i]
    const t = Date.now()
    process.stdout.write(`[${i + 1}/${ready.length}] ${j.effect} (${j.gender}) ... `)

    try {
      const buf = await callNB2(j.prompt, j.src, token)
      fs.writeFileSync(j.plate, buf)

      if (sharp) {
        await sharp(buf).resize(PREVIEW_PX, PREVIEW_PX, { fit: 'inside' })
                        .jpeg({ quality: 88 }).toFile(j.pvw)
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
  console.log('')
}

main().catch(e => { console.error(e); process.exit(1) })
