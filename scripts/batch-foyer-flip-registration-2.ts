// scripts/batch-foyer-flip-registration-2.ts
//
// THE FOYER FLIP, SECOND BATCH: REGISTRATION VARIANTS.
//
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip-registration-2.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip-registration-2.ts
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip-registration-2.ts --only ice,neon
//
// Rich, 2026-09-10. The first batch (batch-foyer-flip.ts) sent the production
// prompts untouched, and each effect's own framing put the face in a
// different place and size. This batch keeps each effect's material, likeness,
// hair, period, lighting and avoid language, and changes only its
// composition, orientation and framing, so the same woman's face lands in
// about the same place across the thirty.
//
// FOYER-ONLY. The prompts are built at run time from production's own
// buildEffectPrompt(id) with the exact edits in foyer-variants-registration-2.ts
// applied - each edit must match the production text exactly once, or the
// run refuses. Nothing in lib/ or app/ is touched.
//
// Everything else is batch-foyer-flip.ts: the same source, the same NB2 call
// (the only change is that it also hands back the prediction id and status
// for the manifest), 2:3, resolution unset, one attempt, no plates, raw JPG
// output, resume. Output goes to its own directory so the first batch is
// never touched.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, statSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'

import { buildEffectPrompt, hasBody } from '../lib/v1/portraits/portraits-bodies'
import { byId, isOfferable } from '../lib/v1/portraits/effect-registry'
import {
  PRESET_LABELS, POSE_PHRASE, DEFAULT_POSE,
} from '../lib/v1/portraits/portraits-shared'
import { MAX_STYLE_REFS } from '../lib/v1/portraits/style-refs'
import { VARIANTS, applyVariant, type Variant } from './foyer-variants-registration-2'

// ─── CONFIG ─────────────────────────────────────────────────────

/* The same approved source as the first batch. */
const SOURCE = 'D:\\minramas\\source-pool\\batch_woman.jpg'

const FOYER_ASPECT = '2:3'

/* Its own directory. The first batch is H:\...\foyer-flip and is not read
   or written by this script. */
const OUT_ROOT = 'H:\\minramas\\public\\previews\\foyer-flip-registration-2'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000

const CONCURRENCY = 2

/* The same thirty as the first batch, in the same order. */
const EXPECTED_IDS = [
  'reclaimed_bronze', 'retro_robot', 'stained_glass', 'plushy', 'ice',
  'impressionist', 'art_deco', 'stone', 'petal_sculpture', 'renaissance_woman',
  'victorian_woman', 'wild_west_woman', 'neon', 'oil_impasto', 'balloon_face',
  'sheet_music', 'origami', 'linocut', 'art_nouveau', 'crystallized',
  'deco_twenties_woman', 'elizabethan_woman', 'iron', 'cast_glass', 'ebony',
  'quilted', 'porcelain', 'fire_face', 'sand_form', 'mercury',
]

// ─── CHECKS ─────────────────────────────────────────────────────

/**
 * The thirty ids, live and bodied; one variant each; every edit matching
 * the production text exactly once (applyVariant throws otherwise); and no
 * pose phrase or plates, so the production prompt the edits start from is
 * buildEffectPrompt alone.
 */
function check(): void {
  const problems: string[] = []
  const ids = VARIANTS.map(v => v.id)
  if (JSON.stringify(ids) !== JSON.stringify(EXPECTED_IDS)) {
    problems.push(`variants are not the expected thirty in order: ${ids.join(', ')}`)
  }
  for (const id of ids) {
    const reg = byId(id)
    if (!reg) { problems.push(`${id}: not in effect-registry`); continue }
    if (!isOfferable(reg)) problems.push(`${id}: registry body is '${reg.body}', not live`)
    if (!hasBody(id)) problems.push(`${id}: no body in portraits-bodies`)
    if (!(id in PRESET_LABELS)) problems.push(`${id}: not in PRESET_LABELS`)
  }
  if (POSE_PHRASE[DEFAULT_POSE] !== '') problems.push(`POSE_PHRASE.${DEFAULT_POSE} is no longer empty`)
  if (MAX_STYLE_REFS !== 0) problems.push(`MAX_STYLE_REFS is ${MAX_STYLE_REFS}`)
  if (problems.length) throw new Error('refusing:\n  ' + problems.join('\n  '))
}

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  id:         string
  label:      string
  variant:    Variant
  production: string
  prodHash:   string
  prompt:     string
  hash:       string
  out:        string
}

interface Result {
  effect:      string
  label:       string
  status:      'rendered' | 'skipped' | 'error'
  prediction:  string
  pred_status: string
  prod_hash:   string
  hash:        string
  ms:          number
  file:        string
  prompt_file: string
  error:       string
  prompt:      string
}

function promptHash(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 10)
}

function rows(): Row[] {
  return VARIANTS.map(variant => {
    const production = buildEffectPrompt(variant.id)
    const prompt = applyVariant(production, variant)
    return {
      id: variant.id,
      label: byId(variant.id)!.label,
      variant,
      production,
      prodHash: promptHash(production),
      prompt,
      hash: promptHash(prompt),
      out: join(OUT_ROOT, `${variant.id}.jpg`),
    }
  })
}

// ─── NB2 ── copied from batch-foyer-flip.ts; the one change is ──
// ─── that it returns the prediction id and status with the bytes ─

function asDataUrl(p: string): string {
  const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`
}

class NB2Error extends Error {
  constructor(message: string, public prediction: string, public predStatus: string) { super(message) }
}

async function callNB2(prompt: string, source: string, token: string):
  Promise<{ buf: Buffer; prediction: string; status: string }> {
  const res = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_input:   [asDataUrl(source)],
        aspect_ratio:  FOYER_ASPECT,
        output_format: 'jpg',
      },
    }),
  })

  if (!res.ok) {
    throw new NB2Error(`POST ${res.status}: ${(await res.text()).slice(0, 200)}`, '', 'post_failed')
  }

  let pred = await res.json()

  for (let i = 0; i < POLL_MAX && pred.status !== 'succeeded'; i++) {
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new NB2Error(`${pred.status}: ${pred.error || ''}`, pred.id || '', pred.status)
    }
    await new Promise(r => setTimeout(r, POLL_DELAY))
    const pr = await fetch(pred.urls.get, { headers: { 'Authorization': `Token ${token}` } })
    pred = await pr.json()
  }

  if (pred.status !== 'succeeded') throw new NB2Error(`timed out: ${pred.status}`, pred.id || '', pred.status)

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  return { buf: Buffer.from(await img.arrayBuffer()), prediction: pred.id, status: pred.status }
}

// ─── RESUME RECORD ──────────────────────────────────────────────

interface Rendered {
  hash: string; aspect: string; file: string; bytes: number; at: string
  source: string; prediction: string
}

const RECORD = join(OUT_ROOT, 'renders.json')

function readRecord(): Record<string, Rendered> {
  if (!existsSync(RECORD)) return {}
  return JSON.parse(readFileSync(RECORD, 'utf8'))
}

function plan(all: Row[], record: Record<string, Rendered>, source: string) {
  const todo: Row[] = [], skip: Row[] = [], conflicts: string[] = []
  for (const r of all) {
    if (!existsSync(r.out)) { todo.push(r); continue }
    const rec = record[r.id]
    if (!rec) conflicts.push(`${basename(r.out)} is on disk with no record of what made it`)
    else if (rec.hash !== r.hash) conflicts.push(`${basename(r.out)} was made from prompt ${rec.hash}; the variant is now ${r.hash}`)
    else if (rec.aspect !== FOYER_ASPECT) conflicts.push(`${basename(r.out)} was made at ${rec.aspect}, not ${FOYER_ASPECT}`)
    else if (source && rec.source !== source) conflicts.push(`${basename(r.out)} was made from ${rec.source}, not ${source}`)
    else skip.push(r)
  }
  return { todo, skip, conflicts }
}

// ─── MANIFEST ───────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null): string {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(path: string, results: Result[]): void {
  const head = ['effect', 'label', 'status', 'prediction_id', 'prediction_status',
                'prod_prompt_hash', 'variant_prompt_hash', 'ms', 'file', 'prompt_file', 'error']
  const lines = [head.join(',')]
  for (const r of results) {
    lines.push([r.effect, r.label, r.status, r.prediction, r.pred_status, r.prod_hash, r.hash,
                r.ms, r.file, r.prompt_file, r.error].map(csvCell).join(','))
  }
  writeFileSync(path, lines.join('\n'))
}

function writePrompts(path: string, all: Row[]): void {
  const lines: string[] = []
  for (const r of all) {
    lines.push(`### ${r.id}  (${r.label})  [${r.hash}]  from production [${r.prodHash}]`)
    lines.push('')
    lines.push(r.prompt)
    lines.push('')
  }
  writeFileSync(path, lines.join('\n'))
}

const oneLine = (s: string) => s.replace(/\n/g, ' / ').trim()

function printEdits(all: Row[]): void {
  console.log('\n─── COMPOSITION EDITS (production -> foyer) ───')
  all.forEach((r, i) => {
    console.log(`\n${String(i + 1).padStart(2)} ${r.id}   production ${r.prodHash} -> variant ${r.hash}   ${r.production.length} -> ${r.prompt.length} chars`)
    for (const e of r.variant.edits) {
      console.log(`   ORIGINAL:    ${oneLine(e.find)}`)
      console.log(`   REPLACEMENT: ${e.replace ? oneLine(e.replace) : '(removed)'}`)
    }
    if (r.variant.note) console.log(`   NOTE:        ${r.variant.note}`)
  })
}

// ─── RUN ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dry    = args.includes('--dry')
  const only   = args.includes('--only')   ? args[args.indexOf('--only') + 1]   : null
  const source = args.includes('--source') ? args[args.indexOf('--source') + 1] : SOURCE

  check()

  let all = rows()
  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const unknown = want.filter(w => !all.some(r => r.id === w))
    if (unknown.length) throw new Error(`not in the foyer set: ${unknown.join(', ')}`)
    all = all.filter(r => want.includes(r.id))
  }

  const sourceOk = !!source && existsSync(source)
  const runId    = Date.now()

  console.log('')
  console.log('=== FOYER FLIP · REGISTRATION 2 ===')
  console.log(`  effects   ${all.length}`)
  console.log(`  source    ${source}${sourceOk ? `  ${statSync(source).size} bytes, sent as data:image/${source.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'}` : '  (MISSING)'}`)
  console.log(`  prompts   production buildEffectPrompt + foyer composition edits (FOYER-ONLY)`)
  console.log(`  aspect    ${FOYER_ASPECT}; resolution not sent -> NB2 default 1K`)
  console.log(`  pose      ${DEFAULT_POSE} (appends nothing); plates none (MAX_STYLE_REFS ${MAX_STYLE_REFS})`)
  console.log(`  attempts  1 per effect, unscored, raw NB2 output - no crop`)
  console.log(`  request   ${REPLICATE_URL}`)
  console.log(`            input: { prompt, image_input: [source], aspect_ratio: '${FOYER_ASPECT}', output_format: 'jpg' }`)
  console.log(`  out       ${OUT_ROOT}`)

  printEdits(all)

  const record = readRecord()
  const { todo, skip, conflicts } = plan(all, record, sourceOk ? source : '')

  console.log('\n─── PLAN ───')
  all.forEach((r, i) => {
    const state = skip.includes(r) ? 'on disk, skip' : (todo.includes(r) ? 'to render' : 'CONFLICT')
    console.log(`  ${String(i + 1).padStart(2)} ${r.id.padEnd(22)} ${r.label.padEnd(22)} ${String(r.prompt.length).padStart(5)}  ${r.hash}  ${state}`)
  })
  if (conflicts.length) {
    console.log('\n  CONFLICTS - move or delete these to re-render them:')
    for (const c of conflicts) console.log('    ' + c)
  }

  mkdirSync(OUT_ROOT, { recursive: true })

  if (dry) {
    const dryPrompts = join(OUT_ROOT, `registration-2-dry-${runId}-prompts.txt`)
    writePrompts(dryPrompts, all)
    console.log(`\n  prompts   ${dryPrompts}`)
    console.log('\nDRY RUN. Nothing rendered.')
    return
  }

  if (conflicts.length) throw new Error('conflicting files on disk - see above')
  if (!sourceOk) throw new Error(`source not found: ${source}`)
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not set')

  const csvPath     = join(OUT_ROOT, `registration-2-${runId}.csv`)
  const jsonPath    = join(OUT_ROOT, `registration-2-${runId}.json`)
  const promptsPath = join(OUT_ROOT, `registration-2-${runId}-prompts.txt`)
  writePrompts(promptsPath, all)

  // The exact prompt beside each render.
  for (const r of all) writeFileSync(join(OUT_ROOT, `${r.id}.prompt.txt`), r.prompt)

  const base = (r: Row) => ({
    effect: r.id, label: r.label, prod_hash: r.prodHash, hash: r.hash,
    prompt_file: `${r.id}.prompt.txt`, prompt: r.prompt,
  })
  const results: Result[] = skip.map(r => ({
    ...base(r), status: 'skipped' as const, prediction: record[r.id]?.prediction || '',
    pred_status: 'succeeded', ms: 0, file: basename(r.out), error: '',
  }))
  const save = () => {
    writeCsv(csvPath, results)
    writeFileSync(jsonPath, JSON.stringify(results, null, 2))
  }
  save()

  let done = 0, failed = 0
  const queue = [...todo]

  async function worker() {
    while (queue.length) {
      const row = queue.shift()!
      const t0 = Date.now()
      try {
        const { buf, prediction, status } = await callNB2(row.prompt, source, token!)
        const tmp = row.out + '.tmp'
        writeFileSync(tmp, buf)
        record[row.id] = {
          hash: row.hash, aspect: FOYER_ASPECT, file: basename(row.out), bytes: buf.length,
          at: new Date().toISOString(), source, prediction,
        }
        writeFileSync(RECORD, JSON.stringify(record, null, 2))
        renameSync(tmp, row.out)

        results.push({ ...base(row), status: 'rendered', prediction, pred_status: status,
                       ms: Date.now() - t0, file: basename(row.out), error: '' })
        done++
        console.log(`[${done + failed}/${todo.length}] ${row.id.padEnd(22)} ok  ${((Date.now() - t0) / 1000).toFixed(1)}s  ${prediction}`)
      } catch (e: any) {
        results.push({ ...base(row), status: 'error', prediction: e.prediction || '',
                       pred_status: e.predStatus || '', ms: Date.now() - t0, file: '', error: e.message })
        failed++
        console.error(`[${done + failed}/${todo.length}] ${row.id}: ${e.message}`)
      }
      save()
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n${done} rendered, ${skip.length} skipped, ${failed} failed. -> ${OUT_ROOT}`)
  console.log(`csv      ${csvPath}`)
  console.log(`json     ${jsonPath}`)
  console.log(`prompts  ${promptsPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
