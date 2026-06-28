#!/usr/bin/env node
// scripts/render-preview-matrix.mjs
//
// Renders a full preview matrix: every preset × every source image.
// Posts to the live dev-server route so each render goes through the real
// QA + canvas-pad pipeline.
//
// Usage:  node scripts/render-preview-matrix.mjs
//   - Requires dev server running on localhost:3000
//   - Reads REPLICATE_API_TOKEN and OPENAI_API_KEY from .env.local
//   - Source images from ./preview-sources/picked/
//   - Output to ./preview-matrix/<preset_id>/<subject>.jpg

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

// ── Config ────────────────────────────────────────────────────────
const API_URL = 'http://localhost:3000/api/v1/portraits/generate'
const CONCURRENCY = 3
const MAX_RETRIES = 3
const BASE_RETRY_MS = 2000
const COST_PER_RENDER = 0.10

// ── Presets (deployed roster from portraits-shared.ts) ───────────
const PRESETS = [
  // realistic
  { preset_id: 'ebony',          style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'walnut',         style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'stone',          style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'bronze',         style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'iron',           style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'alabaster',      style_id: 'realistic',        location_id: 'mantel' },
  { preset_id: 'plushy',         style_id: 'realistic',        location_id: 'plushy_shelf' },
  // artists_gallery
  { preset_id: 'impressionist',  style_id: 'artists_gallery',  location_id: 'pedestal' },
  { preset_id: 'torn_paper',     style_id: 'artists_gallery',  location_id: 'pedestal' },
  { preset_id: 'folded_book',    style_id: 'artists_gallery',  location_id: 'pedestal' },
  { preset_id: 'charcoal_chalk', style_id: 'artists_gallery',  location_id: 'pedestal' },
  { preset_id: 'pencil_sketch',  style_id: 'artists_gallery',  location_id: 'pedestal' },
  { preset_id: 'sheet_music',    style_id: 'artists_gallery',  location_id: 'pedestal' },
]

// ── Discover source images ───────────────────────────────────────
const SOURCES_DIR = path.join(ROOT, 'preview-sources', 'picked')
const OUTPUT_DIR  = path.join(ROOT, 'preview-matrix')

function discoverSources() {
  const files = fs.readdirSync(SOURCES_DIR)
    .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
    .sort()
  return files.map(f => ({
    filename: f,
    subject:  path.parse(f).name,
    path:     path.join(SOURCES_DIR, f),
  }))
}

// ── Build work list ──────────────────────────────────────────────
function buildJobs(sources) {
  const jobs = []
  for (const preset of PRESETS) {
    for (const src of sources) {
      const outDir  = path.join(OUTPUT_DIR, preset.preset_id)
      const outPath = path.join(outDir, `${src.subject}.jpg`)
      jobs.push({
        ...preset,
        subject:   src.subject,
        srcPath:   src.path,
        outDir,
        outPath,
      })
    }
  }
  return jobs
}

// ── Fetch with 429 retry (mirrors houses-generator.ts) ───────────
async function fetchWithRetry(url, options, context) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, options)
    if (res.status !== 429) return res
    if (attempt === MAX_RETRIES) return res

    const retryAfter = res.headers.get('Retry-After')
    let delayMs
    if (retryAfter) {
      const seconds = Number(retryAfter)
      delayMs = Number.isFinite(seconds) && seconds > 0
        ? seconds * 1000
        : BASE_RETRY_MS * Math.pow(2, attempt)
    } else {
      delayMs = BASE_RETRY_MS * Math.pow(2, attempt)
    }
    console.warn(`  [429] ${context} — retry ${attempt + 1}/${MAX_RETRIES} after ${delayMs}ms`)
    await new Promise(r => setTimeout(r, delayMs))
  }
  throw new Error(`${context}: exhausted retries on 429`)
}

// ── Render one combination ───────────────────────────────────────
async function renderOne(job) {
  const imageB64 = fs.readFileSync(job.srcPath).toString('base64')

  const body = {
    source_image_b64: imageB64,
    style_id:         job.style_id,
    preset_id:        job.preset_id,
    location_id:      job.location_id,
    scale:            'close_up',
    framing:          'signature',
    skip_redirect:    true,
  }

  const t0 = Date.now()
  const res = await fetchWithRetry(
    API_URL,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    `${job.preset_id}/${job.subject}`,
  )

  const durationMs = Date.now() - t0
  const json = await res.json()

  if (!res.ok) {
    return {
      ok: false,
      durationMs,
      error: json.error || `HTTP ${res.status}`,
      promptChars: 0,
      finalReason: json.error || `HTTP ${res.status}`,
    }
  }

  // intake_rejected or redirected — not a render failure but no image
  if (json.status === 'intake_rejected' || json.status === 'redirected') {
    return {
      ok: false,
      durationMs,
      error: `${json.status}: ${JSON.stringify(json.intake || json.redirect || {})}`,
      promptChars: 0,
      finalReason: json.status,
    }
  }

  const result = json.result
  if (!result || !result.image_b64) {
    return {
      ok: false,
      durationMs,
      error: result?.fatal_error || 'no image in response',
      promptChars: result?.prompt_used?.length || 0,
      finalReason: result?.final_reason || 'no_image',
    }
  }

  // Validate prompt doesn't contain "undefined"
  if (result.prompt_used && result.prompt_used.includes('undefined')) {
    return {
      ok: false,
      durationMs,
      error: `BROKEN PROMPT — contains "undefined": ${result.prompt_used.slice(0, 200)}`,
      promptChars: result.prompt_used.length,
      finalReason: 'broken_prompt',
    }
  }

  // Save the image
  fs.mkdirSync(job.outDir, { recursive: true })
  const imgBuf = Buffer.from(result.image_b64, 'base64')
  fs.writeFileSync(job.outPath, imgBuf)

  return {
    ok: true,
    durationMs,
    error: null,
    promptChars: result.prompt_used?.length || 0,
    finalReason: result.final_reason || 'pass',
  }
}

// ── Concurrency pool ─────────────────────────────────────────────
async function runPool(jobs, concurrency, onResult) {
  let idx = 0
  const results = new Array(jobs.length)

  async function worker() {
    while (idx < jobs.length) {
      const i = idx++
      const job = jobs[i]
      try {
        const r = await renderOne(job)
        results[i] = r
        onResult(i, job, r)
      } catch (err) {
        const r = { ok: false, durationMs: 0, error: err.message, promptChars: 0, finalReason: 'exception' }
        results[i] = r
        onResult(i, job, r)
      }
    }
  }

  const workers = []
  for (let w = 0; w < concurrency; w++) workers.push(worker())
  await Promise.all(workers)
  return results
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const sources = discoverSources()
  console.log(`\nSources: ${sources.length} images`)
  sources.forEach(s => console.log(`  ${s.subject} (${s.filename})`))

  const allJobs = buildJobs(sources)
  console.log(`\nPresets: ${PRESETS.length}`)
  PRESETS.forEach(p => console.log(`  ${p.preset_id} [${p.style_id}] → ${p.location_id}`))

  // Skip already-rendered
  const pending = []
  let skipped = 0
  for (const job of allJobs) {
    if (fs.existsSync(job.outPath)) {
      skipped++
    } else {
      pending.push(job)
    }
  }

  console.log(`\nTotal: ${allJobs.length} | Skipped (already exist): ${skipped} | To render: ${pending.length}`)
  if (pending.length === 0) {
    console.log('Nothing to render — all outputs exist.')
    writeManifest(allJobs, [], [])
    return
  }

  console.log(`Concurrency: ${CONCURRENCY} | Est. cost: $${(pending.length * COST_PER_RENDER).toFixed(2)}`)
  console.log(`\n${'─'.repeat(60)}\n`)

  const t0 = Date.now()
  let succeeded = 0
  let failed = 0

  const results = await runPool(pending, CONCURRENCY, (i, job, r) => {
    const n = skipped + i + 1
    const total = allJobs.length
    if (r.ok) {
      succeeded++
      console.log(`[${n}/${total}] ✓ ${job.preset_id}/${job.subject} — ${r.durationMs}ms`)
    } else {
      failed++
      console.error(`[${n}/${total}] ✗ ${job.preset_id}/${job.subject} — ${r.error}`)
    }
  })

  const totalMs = Date.now() - t0
  const totalMin = (totalMs / 60000).toFixed(1)

  console.log(`\n${'─'.repeat(60)}`)
  console.log(`Done in ${totalMin} min`)
  console.log(`  Succeeded: ${succeeded}`)
  console.log(`  Failed:    ${failed}`)
  console.log(`  Skipped:   ${skipped}`)
  console.log(`  Total:     ${allJobs.length}`)
  console.log(`  Est. cost: $${(succeeded * COST_PER_RENDER).toFixed(2)}`)

  writeManifest(allJobs, pending, results)
}

function writeManifest(allJobs, pendingJobs, results) {
  const resultByKey = new Map()
  pendingJobs.forEach((job, i) => {
    resultByKey.set(`${job.preset_id}/${job.subject}`, results[i])
  })

  const rows = allJobs.map(job => {
    const key = `${job.preset_id}/${job.subject}`
    const r = resultByKey.get(key)
    const exists = fs.existsSync(job.outPath)
    return {
      subject:      job.subject,
      preset_id:    job.preset_id,
      style_id:     job.style_id,
      location_id:  job.location_id,
      prompt_chars: r?.promptChars ?? null,
      duration_ms:  r?.durationMs ?? null,
      ok:           r ? r.ok : exists,
      final_reason: r ? r.finalReason : (exists ? 'skipped' : 'missing'),
      output_path:  `${job.preset_id}/${job.subject}.jpg`,
    }
  })

  const manifestPath = path.join(ROOT, 'preview-matrix', 'manifest.json')
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true })
  fs.writeFileSync(manifestPath, JSON.stringify(rows, null, 2))
  console.log(`\nManifest written: ${manifestPath} (${rows.length} rows)`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
