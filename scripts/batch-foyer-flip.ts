// scripts/batch-foyer-flip.ts
//
// THE FOYER TRUTH SET. Thirty Portrait effects, one approved source woman.
//
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip.ts
//   npx tsx --env-file=.env.local scripts/batch-foyer-flip.ts --only ice,neon
//
// Adapted from batch-library-2up.ts. Same NB2 call, same prompt builder,
// same prompt dump, hash and CSV/JSON. What changed is only what this
// experiment needs: one fixed source, a fixed list of thirty, a 2:3 canvas,
// no scoring, and resume.
//
// ── WHAT NB2 RECEIVES IS WHAT A CUSTOMER'S RENDER SENDS ────────────────
//
// The foyer sequence has to show effects a customer can actually buy, so
// nothing here is a foyer prompt. Each prompt is buildEffectPrompt(id) from
// portraits-bodies.ts - body verbatim, avoid appended on its own line - the
// same call generatePortraitsRender makes. Nothing is added to it:
//
//   pose        as_photographed, whose POSE_PHRASE is '' -> nothing appended
//   plates      none. MAX_STYLE_REFS is 0 in production, so the style-ref
//               clause is never appended there either
//
// Both are CHECKED against the production modules before anything runs,
// not assumed. If production starts sending plates or the default pose
// grows a phrase, this refuses to start rather than quietly rendering
// something a customer would not get.
//
// ── THE ONE DELIBERATE DEPARTURE: A 2:3 CANVAS ─────────────────────────
//
// Rich, 2026-09-10: the foyer shows these at width/height .69. NB2 has no
// .69; 2:3 (848x1264 at 1K, .671) is the nearest supported ratio and needs
// the least trim to reach it - 35px of height, 2.8%. Production Portraits
// renders 1:1, 3:4 or 4:3 and never 2:3, so this canvas is the single
// respect in which a render here differs from a customer's. resolution is
// not sent, exactly as production does not send it: NB2's 1K default.
//
// The 2:3 render is kept exactly as NB2 returns it. The .69 crop and any
// alignment are a separate, later, derived step - never baked in here.
//
// ── THE WOMEN'S BODIES ARE NAMED, NOT DETECTED ─────────────────────────
//
// The source is a woman. Production swaps five costumes to their _woman
// body for a woman (resolvePresetForSubject). This list names the _woman ids
// outright so no detection step can change the experiment, and checks each
// one against resolvePresetForSubject so the list cannot drift from it.
//
// ── ONE ATTEMPT, RAW OUTPUT ────────────────────────────────────────────
//
// No scoring, no retries, no post-processing: the bytes NB2 returns are
// the file. This is the truth set; judgement is by eye.
//
// ── RESUME ─────────────────────────────────────────────────────────────
//
// A render already on disk is skipped, not redone, so an interrupted run
// just runs again. renders.json in the output directory records the prompt
// hash each file was made from. A file whose prompt has since changed is
// NOT skipped and NOT overwritten - the run refuses and names it. Files are
// written to .tmp and renamed only after the record is written, so a
// killed run never leaves a half-file that a resume would skip.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync, statSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'

import { buildEffectPrompt, hasBody } from '../lib/v1/portraits/portraits-bodies'
import { byId, isOfferable } from '../lib/v1/portraits/effect-registry'
import {
  PRESET_LABELS, POSE_PHRASE, DEFAULT_POSE, resolvePresetForSubject,
  type PortraitsPresetId,
} from '../lib/v1/portraits/portraits-shared'
import { MAX_STYLE_REFS } from '../lib/v1/portraits/style-refs'

// ─── CONFIG ─────────────────────────────────────────────────────

/* The approved foyer source woman, 1145x1374. A JPEG so the bytes and the
   data URL's MIME follow production's convention (callNB2 always sends
   image/jpeg). Encoded 2026-09-10 from batch_woman.png at q0.9, 4:2:0, no
   resize - the Portraits page's own re-encode (FIT_QUALITY[0]), and it
   resizes only above 2048px, which this is not. --source overrides for a
   single run. */
const SOURCE = 'D:\\minramas\\source-pool\\batch_woman.jpg'

/* See THE ONE DELIBERATE DEPARTURE above. */
const FOYER_ASPECT = '2:3'

/* Not dated: resume has to find yesterday's renders. */
const OUT_ROOT = 'H:\\minramas\\public\\previews\\foyer-flip'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000

const CONCURRENCY = 2

// ─── THE THIRTY ─────────────────────────────────────────────────
//
// `asked` is the name Rich used; `id` is the live catalogue id it resolves
// to. `base` is set where the id is a production _woman variant.
// `provisional` marks a resolution that still needs Rich's word - a live
// run refuses while any remain.

interface Pick {
  asked:        string
  id:           string
  base?:        string
  group:        'original' | 'requested' | 'chosen'
  provisional?: string
}

const EFFECTS: Pick[] = [
  // The original twelve
  { group: 'original',  asked: 'Reclaimed Bronze', id: 'reclaimed_bronze' },
  { group: 'original',  asked: 'Retro Robot',      id: 'retro_robot' },
  { group: 'original',  asked: 'Stained Glass',    id: 'stained_glass' },
  { group: 'original',  asked: 'Plushy',           id: 'plushy' },
  { group: 'original',  asked: 'Ice / Ice Frost',  id: 'ice' },
  { group: 'original',  asked: 'Impressionism',    id: 'impressionist' },
  { group: 'original',  asked: 'Art Deco',         id: 'art_deco' },
  { group: 'original',  asked: 'Stone',            id: 'stone' },
  { group: 'original',  asked: 'Petal Sculpture',  id: 'petal_sculpture' },
  { group: 'original',  asked: 'Renaissance',      id: 'renaissance_woman', base: 'renaissance' },
  { group: 'original',  asked: 'Victorian',        id: 'victorian_woman',   base: 'victorian' },
  { group: 'original',  asked: 'Wild West',        id: 'wild_west_woman',   base: 'wild_west' },

  // Requested
  { group: 'requested', asked: 'Neon',             id: 'neon' },
  { group: 'requested', asked: 'Oil Impasto',      id: 'oil_impasto' },
  { group: 'requested', asked: 'Balloon Face',     id: 'balloon_face' },
  { group: 'requested', asked: 'Sheet Music',      id: 'sheet_music' },
  // No effect is named Folded Paper; origami approved by Rich 2026-09-10.
  { group: 'requested', asked: 'Folded Paper',     id: 'origami' },
  // Torn Paper is not here: torn_paper was retired 2026-08-02 (0a8d545) and
  // has no live body. Replaced by mercury, below.
  { group: 'requested', asked: 'Linocut',          id: 'linocut' },
  { group: 'requested', asked: 'Art Nouveau',      id: 'art_nouveau' },
  { group: 'requested', asked: 'Crystallized',     id: 'crystallized' },
  { group: 'requested', asked: 'Deco Twenties',    id: 'deco_twenties_woman', base: 'deco_twenties' },
  { group: 'requested', asked: 'Elizabethan',      id: 'elizabethan_woman',   base: 'elizabethan' },
  { group: 'requested', asked: 'Iron',             id: 'iron' },
  { group: 'requested', asked: 'Cast Glass',       id: 'cast_glass' },

  // Chosen for contrast with the twenty-five above
  { group: 'chosen',    asked: '(chosen) wood',      id: 'ebony' },
  { group: 'chosen',    asked: '(chosen) textile',   id: 'quilted' },
  { group: 'chosen',    asked: '(chosen) ceramic',   id: 'porcelain' },
  { group: 'chosen',    asked: '(chosen) element',   id: 'fire_face' },
  { group: 'chosen',    asked: '(chosen) granular',  id: 'sand_form' },
  { group: 'chosen',    asked: '(for Torn Paper) liquid', id: 'mercury' },
]

// ─── CHECKS AGAINST PRODUCTION ──────────────────────────────────

/**
 * Every id live, bodied and accepted by the route; every _woman id exactly
 * what production resolves for a woman; every other id one production does
 * NOT swap for a woman; and the two conditions that make the prompt
 * buildEffectPrompt alone - no pose phrase, no plates. Throws on the first
 * thing that is not so.
 */
function checkAgainstProduction(): void {
  const problems: string[] = []

  if (EFFECTS.length !== 30) problems.push(`expected 30 effects, have ${EFFECTS.length}`)
  const dupes = EFFECTS.map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i)
  if (dupes.length) problems.push(`duplicate ids: ${dupes.join(', ')}`)

  for (const e of EFFECTS) {
    const reg = byId(e.id)
    if (!reg) { problems.push(`${e.id}: not in effect-registry`); continue }
    if (!isOfferable(reg)) problems.push(`${e.id}: registry body is '${reg.body}', not live`)
    if (!hasBody(e.id)) problems.push(`${e.id}: no body in portraits-bodies`)
    if (!(e.id in PRESET_LABELS)) problems.push(`${e.id}: not in PRESET_LABELS - the route would refuse it`)

    const requested = (e.base ?? e.id) as PortraitsPresetId
    const forWoman = resolvePresetForSubject(requested, 'woman')
    if (forWoman !== e.id) {
      problems.push(`${e.asked}: production resolves ${requested} for a woman to ${forWoman}, list says ${e.id}`)
    }
  }

  if (POSE_PHRASE[DEFAULT_POSE] !== '') {
    problems.push(`POSE_PHRASE.${DEFAULT_POSE} is no longer empty - production now appends it`)
  }
  if (MAX_STYLE_REFS !== 0) {
    problems.push(`MAX_STYLE_REFS is ${MAX_STYLE_REFS} - production now sends plates and the style-ref clause`)
  }

  if (problems.length) {
    throw new Error('does not match production:\n  ' + problems.join('\n  '))
  }
}

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  pick:   Pick
  label:  string
  prompt: string
  hash:   string
  out:    string
}

interface Result {
  effect: string
  label:  string
  asked:  string
  status: 'rendered' | 'skipped' | 'error'
  hash:   string
  ms:     number
  file:   string
  error:  string
}

function promptHash(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 10)
}

function rows(): Row[] {
  return EFFECTS.map(pick => {
    // The engine's own builder. Body verbatim, avoid appended. Nothing in
    // this file restates a prompt.
    const prompt = buildEffectPrompt(pick.id)
    return {
      pick,
      label:  byId(pick.id)!.label,
      prompt,
      hash:   promptHash(prompt),
      out:    join(OUT_ROOT, `${pick.id}.jpg`),
    }
  })
}

// ─── NB2 ── copied from batch-library-2up.ts; the one change is ─
// ─── aspect_ratio, MAIN_ASPECT -> FOYER_ASPECT ──────────────────

function asDataUrl(p: string): string {
  const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`
}

async function callNB2(prompt: string, source: string, token: string): Promise<Buffer> {
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
    throw new Error(`POST ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }

  let pred = await res.json()

  for (let i = 0; i < POLL_MAX && pred.status !== 'succeeded'; i++) {
    if (pred.status === 'failed' || pred.status === 'canceled') {
      throw new Error(`${pred.status}: ${pred.error || ''}`)
    }
    await new Promise(r => setTimeout(r, POLL_DELAY))
    const pr = await fetch(pred.urls.get, { headers: { 'Authorization': `Token ${token}` } })
    pred = await pr.json()
  }

  if (pred.status !== 'succeeded') throw new Error(`timed out: ${pred.status}`)

  const url = Array.isArray(pred.output) ? pred.output[0] : pred.output
  const img = await fetch(url)
  return Buffer.from(await img.arrayBuffer())
}

// ─── RESUME RECORD ──────────────────────────────────────────────

interface Rendered { hash: string; aspect: string; file: string; bytes: number; at: string; source: string }

const RECORD = join(OUT_ROOT, 'renders.json')

function readRecord(): Record<string, Rendered> {
  if (!existsSync(RECORD)) return {}
  return JSON.parse(readFileSync(RECORD, 'utf8'))
}

/**
 * What to do with each row. A file on disk made from this exact prompt is
 * skipped. A file made from a different prompt, or one this script has no
 * record of, stops the run: skipping it would put a render in the set that
 * is not this prompt's, and overwriting it would destroy evidence.
 */
function plan(all: Row[], record: Record<string, Rendered>, source: string) {
  const todo: Row[] = [], skip: Row[] = [], conflicts: string[] = []
  for (const r of all) {
    if (!existsSync(r.out)) { todo.push(r); continue }
    const rec = record[r.pick.id]
    if (!rec) {
      conflicts.push(`${basename(r.out)} is on disk with no record of what made it`)
    } else if (rec.hash !== r.hash) {
      conflicts.push(`${basename(r.out)} was made from prompt ${rec.hash}; production is now ${r.hash}`)
    } else if (rec.aspect !== FOYER_ASPECT) {
      conflicts.push(`${basename(r.out)} was made at ${rec.aspect}, not ${FOYER_ASPECT}`)
    } else if (source && rec.source !== source) {
      conflicts.push(`${basename(r.out)} was made from ${rec.source}, not ${source}`)
    } else {
      skip.push(r)
    }
  }
  return { todo, skip, conflicts }
}

// ─── CSV ────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null): string {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(path: string, results: Result[]): void {
  const head = ['effect', 'label', 'asked', 'status', 'prompt_hash', 'ms', 'file', 'error']
  const lines = [head.join(',')]
  for (const r of results) {
    lines.push([r.effect, r.label, r.asked, r.status, r.hash, r.ms, r.file, r.error].map(csvCell).join(','))
  }
  writeFileSync(path, lines.join('\n'))
}

/**
 * The exact prompt behind every hash, so a run can be reconstructed months
 * later without guessing which version of a body was live.
 */
function writePrompts(path: string, all: Row[]): void {
  const lines: string[] = []
  for (const r of all) {
    lines.push(`### ${r.pick.id}  (${r.label})  [${r.hash}]`)
    lines.push('')
    lines.push(r.prompt)
    lines.push('')
  }
  writeFileSync(path, lines.join('\n'))
}

// ─── RUN ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dry    = args.includes('--dry')
  const only   = args.includes('--only')   ? args[args.indexOf('--only') + 1]   : null
  const source = args.includes('--source') ? args[args.indexOf('--source') + 1] : SOURCE

  checkAgainstProduction()

  let all = rows()
  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const unknown = want.filter(w => !all.some(r => r.pick.id === w))
    if (unknown.length) {
      throw new Error(`not in the foyer set: ${unknown.join(', ')} - the women's costumes are the _woman ids`)
    }
    all = all.filter(r => want.includes(r.pick.id))
  }

  const sourceOk = !!source && existsSync(source)
  const runId    = Date.now()

  console.log('')
  console.log('=== FOYER FLIP ===')
  console.log(`  effects   ${all.length}`)
  console.log(`  source    ${source || 'NOT SET'}${source && !sourceOk ? '  (MISSING)' : ''}` +
              (sourceOk ? `  ${statSync(source).size} bytes, sent as data:image/${source.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'}` : ''))
  console.log(`  aspect    ${FOYER_ASPECT} (production Portraits: 1:1, 3:4 or 4:3 - the one departure)`)
  console.log(`  size      resolution not sent -> NB2 default 1K (expected 848x1264)`)
  console.log(`  pose      ${DEFAULT_POSE} (appends nothing)`)
  console.log(`  plates    none (MAX_STYLE_REFS is ${MAX_STYLE_REFS})`)
  console.log(`  attempts  1 per effect, unscored, raw NB2 output - no .69 crop`)
  console.log(`  request   ${REPLICATE_URL}`)
  console.log(`            Prefer: wait=${SYNC_WAIT}; poll ${POLL_MAX} x ${POLL_DELAY}ms; concurrency ${CONCURRENCY}`)
  console.log(`            input: { prompt, image_input: [source], aspect_ratio: '${FOYER_ASPECT}', output_format: 'jpg' }`)
  console.log(`  out       ${OUT_ROOT}`)
  console.log('')

  const record = readRecord()
  const { todo, skip, conflicts } = plan(all, record, sourceOk ? source : '')

  console.log('  #  effect                 label                   asked              chars  hash        state')
  all.forEach((r, i) => {
    const state = skip.includes(r) ? 'on disk, skip' : (todo.includes(r) ? 'to render' : 'CONFLICT')
    console.log(
      `  ${String(i + 1).padStart(2)} ${r.pick.id.padEnd(22)} ${r.label.padEnd(23)} ${r.pick.asked.padEnd(18)} ` +
      `${String(r.prompt.length).padStart(5)}  ${r.hash}  ${state}` +
      (r.pick.base ? `   <- ${r.pick.base} for a woman` : ''),
    )
  })

  const provisional = all.filter(r => r.pick.provisional)
  if (provisional.length) {
    console.log('\n  PROVISIONAL - need Rich\'s word before a live run:')
    for (const r of provisional) console.log(`    ${r.pick.asked} -> ${r.pick.id}: ${r.pick.provisional}`)
  }
  if (conflicts.length) {
    console.log('\n  CONFLICTS - move or delete these to re-render them:')
    for (const c of conflicts) console.log('    ' + c)
  }

  mkdirSync(OUT_ROOT, { recursive: true })

  if (dry) {
    const dryPrompts = join(OUT_ROOT, `foyer-flip-dry-${runId}-prompts.txt`)
    writePrompts(dryPrompts, all)
    console.log(`\n  prompts   ${dryPrompts}`)
    console.log('\nDRY RUN. Nothing rendered.')
    return
  }

  if (provisional.length) throw new Error('provisional resolutions remain - see above')
  if (conflicts.length) throw new Error('conflicting files on disk - see above')
  if (!source) throw new Error('no source - set SOURCE or pass --source')
  // Checked before the first render, not discovered after it.
  if (!sourceOk) throw new Error(`source not found: ${source}`)

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not set')

  const csvPath     = join(OUT_ROOT, `foyer-flip-${runId}.csv`)
  const jsonPath    = join(OUT_ROOT, `foyer-flip-${runId}.json`)
  const promptsPath = join(OUT_ROOT, `foyer-flip-${runId}-prompts.txt`)
  writePrompts(promptsPath, all)

  const results: Result[] = skip.map(r => ({
    effect: r.pick.id, label: r.label, asked: r.pick.asked, status: 'skipped' as const,
    hash: r.hash, ms: 0, file: basename(r.out), error: '',
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
        const buf = await callNB2(row.prompt, source, token!)
        // Record first, then rename: a kill between the two leaves a record
        // with no file (re-rendered next time), never a file with no record.
        const tmp = row.out + '.tmp'
        writeFileSync(tmp, buf)
        record[row.pick.id] = {
          hash: row.hash, aspect: FOYER_ASPECT, file: basename(row.out), bytes: buf.length,
          at: new Date().toISOString(), source,
        }
        writeFileSync(RECORD, JSON.stringify(record, null, 2))
        renameSync(tmp, row.out)

        results.push({
          effect: row.pick.id, label: row.label, asked: row.pick.asked, status: 'rendered',
          hash: row.hash, ms: Date.now() - t0, file: basename(row.out), error: '',
        })
        done++
        console.log(`[${done + failed}/${todo.length}] ${row.pick.id.padEnd(22)} ok  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
      } catch (e: any) {
        results.push({
          effect: row.pick.id, label: row.label, asked: row.pick.asked, status: 'error',
          hash: row.hash, ms: Date.now() - t0, file: '', error: e.message,
        })
        failed++
        console.error(`[${done + failed}/${todo.length}] ${row.pick.id}: ${e.message}`)
      }
      save()
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n${done} rendered, ${skip.length} skipped, ${failed} failed. -> ${OUT_ROOT}`)
  console.log(`csv      ${csvPath}`)
  console.log(`prompts  ${promptsPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
