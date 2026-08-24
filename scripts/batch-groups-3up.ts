// scripts/batch-groups-3up.ts
//
// Groups library run. Three family group photographs against every
// group_photo effect, plus two per-person sets against every multi_photo
// effect.
//
//   24 group_photo effects x 3 photographs  = 72
//    4 multi_photo effects x 2 sets         =  8
//                                            ---
//                                             80 renders
//
// Calls generateGroupsRender directly, so this exercises the REAL pipeline
// and not a copy of it. If the prompt assembly changes, this run changes
// with it.
//
// ── UNSCORED BY DEFAULT ──────────────────────────────────────────────
//
// skip_scoring: true means ONE attempt per cell, no pre-flight face
// detection, no per-figure scoring, no retries. Rich's ruling, 23 August:
// judge by eye this round.
//
// --shadow-score turns the scorer back on WITHOUT letting it gate: the
// render is kept either way and the verdict is written to the CSV beside
// it. That is what answers "is the scorer earning its cost" — it does not
// change a single pixel, it only records what the gate would have said.
// Costs one gpt-4o-mini call per render. Off unless asked for.
//
// ── USAGE ────────────────────────────────────────────────────────────
//
//   npx tsx scripts/batch-groups-3up.ts
//   npx tsx scripts/batch-groups-3up.ts --shadow-score
//   npx tsx scripts/batch-groups-3up.ts --only bronze,ebony,stone
//   npx tsx scripts/batch-groups-3up.ts --subjects hone_3
//   npx tsx scripts/batch-groups-3up.ts --dry-run
//
// --dry-run resolves every path, builds every prompt, writes the prompts
// file and the CSV header, and renders nothing. Run it first. It is the
// only way to find a bad path before eighty renders have been paid for.
//
// Re-running skips cells whose output file already exists, so an
// interrupted run resumes where it stopped.

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

import {
  generateGroupsRender,
} from '../lib/v1/groups/groups-generator'
import {
  GROUPS_EFFECTS,
  buildGroupsPrompt,
  type GroupsEffectId,
} from '../lib/v1/groups/groups-effects'
import {
  MAX_SOURCE_IMAGES,
  MAX_SUBJECTS,
} from '../lib/v1/groups/groups-shared'

// ═════════════════════════════════════════════════════════════════════
// CONFIG - EDIT THESE PATHS, NOTHING ELSE
// ═════════════════════════════════════════════════════════════════════

const OUT_ROOT = 'H:\\minramas\\public\\previews'

/** Group photographs. subjectCount is HAND-COUNTED and authoritative -
 *  with skip_scoring there is no pre-flight to count for us, and this
 *  number picks the framing clause at a threshold of 6. */
const GROUP_SUBJECTS: Array<{
  key:          string
  file:         string
  subjectCount: number
  note?:        string
}> = [
  {
    key:          'hone_3',
    file:         'H:\\Download Backup\\hone 3.jpg',
    subjectCount: 8,
    note:         'in range, faces readable - the clean test',
  },
  {
    key:          'hone_04',
    file:         'H:\\Download Backup\\Miniramas Source\\Hone 04.jpg',
    subjectCount: 17,
    note:         'OVER MAX_SUBJECTS (15) - break test, not a quality test',
  },
  {
    key:          'hone_05',
    file:         'H:\\Download Backup\\Miniramas Source\\Hone 05.jpg',
    subjectCount: 19,
    note:         'OVER MAX_SUBJECTS (15), small soft faces on a scan',
  },
]

/** Per-person sets for the multi_photo effects. One photograph per person,
 *  every jpg/png in the folder, sorted by filename. Point these at real
 *  folders or leave them empty to skip the multi_photo effects entirely. */
const MULTI_SUBJECTS: Array<{ key: string; dir: string }> = [
  { key: 'family_8', dir: 'H:\\Download Backup\\Miniramas Source\\multi_8' },
  { key: 'family_5', dir: 'H:\\Download Backup\\Miniramas Source\\multi_5' },
]

// ═════════════════════════════════════════════════════════════════════
// ARGS
// ═════════════════════════════════════════════════════════════════════

const argv        = process.argv.slice(2)
const SHADOW      = argv.includes('--shadow-score')
const DRY_RUN     = argv.includes('--dry-run')

function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
}

const ONLY_EFFECTS = argValue('--only')?.split(',').map(s => s.trim()).filter(Boolean)
const ONLY_SUBJECTS = argValue('--subjects')?.split(',').map(s => s.trim()).filter(Boolean)

// ═════════════════════════════════════════════════════════════════════
// KEYS
// ═════════════════════════════════════════════════════════════════════

// tsx does NOT load .env.local - that is Next.js behaviour, and this
// script is not Next.js. Read it here so the runner works the same way
// from a bare shell as the app does.
//
// Does not overwrite anything already in the real environment: a token
// exported in the shell wins over the file.
function loadEnvLocal(): void {
  const file = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(file)) return

  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq < 1) continue

    const key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    let val   = line.slice(eq + 1).trim()

    // Strip one matching pair of surrounding quotes, nothing more.
    if (val.length > 1 && (
      (val.startsWith('"')  && val.endsWith('"')) ||
      (val.startsWith("'")  && val.endsWith("'"))
    )) {
      val = val.slice(1, -1)
    }

    if (key && process.env[key] === undefined) process.env[key] = val
  }
}

loadEnvLocal()

const REPLICATE = process.env.REPLICATE_API_TOKEN || ''
const OPENAI    = process.env.OPENAI_API_KEY || ''
const STABILITY = process.env.STABILITY_API_KEY || ''

// ═════════════════════════════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════════════════════════════

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function hash(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 12)
}

function readB64(file: string): string {
  return fs.readFileSync(file).toString('base64')
}

function listImages(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => /\.(jpe?g|png)$/i.test(f))
    .sort()
    .map(f => path.join(dir, f))
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',') + '\r\n'
}

// ═════════════════════════════════════════════════════════════════════
// CELL PLAN
// ═════════════════════════════════════════════════════════════════════

interface Cell {
  subjectKey:   string
  effectId:     GroupsEffectId
  intake:       'group_photo' | 'multi_photo'
  sourceFiles:  string[]
  subjectCount: number
  prompt:       string
  promptHash:   string
}

function buildPlan(): { cells: Cell[]; skipped: string[] } {
  const cells:   Cell[] = []
  const skipped: string[] = []

  const allIds = Object.keys(GROUPS_EFFECTS) as GroupsEffectId[]
  const ids = ONLY_EFFECTS
    ? allIds.filter(id => ONLY_EFFECTS.includes(id))
    : allIds

  if (ONLY_EFFECTS) {
    const unknown = ONLY_EFFECTS.filter(id => !allIds.includes(id as GroupsEffectId))
    if (unknown.length) {
      throw new Error(`unknown effect id(s): ${unknown.join(', ')}`)
    }
  }

  const groupIds = ids.filter(id => GROUPS_EFFECTS[id].intake === 'group_photo')
  const multiIds = ids.filter(id => GROUPS_EFFECTS[id].intake === 'multi_photo')

  // ── group_photo ──
  for (const subj of GROUP_SUBJECTS) {
    if (ONLY_SUBJECTS && !ONLY_SUBJECTS.includes(subj.key)) continue

    if (!fs.existsSync(subj.file)) {
      skipped.push(`MISSING source, skipping subject "${subj.key}": ${subj.file}`)
      continue
    }
    if (subj.subjectCount > MAX_SUBJECTS) {
      skipped.push(
        `WARNING "${subj.key}" has ${subj.subjectCount} subjects, over MAX_SUBJECTS ` +
        `(${MAX_SUBJECTS}) - rendering anyway, treat as a break test`,
      )
    }

    for (const effectId of groupIds) {
      const prompt = buildGroupsPrompt({ effectId, subjectCount: subj.subjectCount })
      cells.push({
        subjectKey:   subj.key,
        effectId,
        intake:       'group_photo',
        sourceFiles:  [subj.file],
        subjectCount: subj.subjectCount,
        prompt,
        promptHash:   hash(prompt),
      })
    }
  }

  // ── multi_photo ──
  for (const set of MULTI_SUBJECTS) {
    if (ONLY_SUBJECTS && !ONLY_SUBJECTS.includes(set.key)) continue

    const files = listImages(set.dir)
    if (files.length === 0) {
      skipped.push(`no images found, skipping multi set "${set.key}": ${set.dir}`)
      continue
    }
    if (files.length > MAX_SOURCE_IMAGES) {
      skipped.push(
        `WARNING multi set "${set.key}" has ${files.length} photographs, over ` +
        `MAX_SOURCE_IMAGES (${MAX_SOURCE_IMAGES}) - the generator will TRUNCATE`,
      )
    }

    for (const effectId of multiIds) {
      // No framing clause on multi_photo, so subjectCount does not enter
      // the prompt. It still drives nothing here - the photographs are the
      // count.
      const prompt = buildGroupsPrompt({ effectId })
      cells.push({
        subjectKey:   set.key,
        effectId,
        intake:       'multi_photo',
        sourceFiles:  files,
        subjectCount: files.length,
        prompt,
        promptHash:   hash(prompt),
      })
    }
  }

  return { cells, skipped }
}

// ═════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════

async function main() {
  const runDir = path.join(OUT_ROOT, `groups-${stamp()}`)

  console.log('')
  console.log('=== GROUPS BATCH ===')
  console.log(`  scoring     : ${SHADOW ? 'SHADOW (logged, does NOT gate)' : 'OFF'}`)
  console.log(`  dry run     : ${DRY_RUN ? 'YES - nothing will render' : 'no'}`)
  console.log(`  output      : ${runDir}`)
  console.log('')

  if (!DRY_RUN && !REPLICATE) {
    console.error('REPLICATE_API_TOKEN is not set. Nothing to do.')
    process.exit(1)
  }
  if (SHADOW && !OPENAI) {
    console.error('--shadow-score needs OPENAI_API_KEY. Nothing to do.')
    process.exit(1)
  }
  if (!DRY_RUN && !STABILITY) {
    console.warn('STABILITY_API_KEY not set - renders will NOT be outpainted,')
    console.warn('so they will crop at the frame edge unlike production. Continuing.')
    console.warn('')
  }

  const { cells, skipped } = buildPlan()

  for (const s of skipped) console.warn(`  ${s}`)
  if (skipped.length) console.warn('')

  if (cells.length === 0) {
    console.error('No cells to run. Check the paths in the CONFIG block.')
    process.exit(1)
  }

  // Group the plan for a readable summary.
  const bySubject = new Map<string, number>()
  for (const c of cells) bySubject.set(c.subjectKey, (bySubject.get(c.subjectKey) || 0) + 1)
  for (const [k, n] of bySubject) console.log(`  ${k.padEnd(12)} ${n} renders`)
  console.log(`  ${'TOTAL'.padEnd(12)} ${cells.length} renders`)
  console.log('')

  // ── Directories ──
  for (const key of bySubject.keys()) {
    const d = path.join(runDir, key)
    if (!DRY_RUN) fs.mkdirSync(d, { recursive: true })
  }
  if (DRY_RUN) fs.mkdirSync(runDir, { recursive: true })

  // ── Prompts file, written BEFORE any render ──
  //
  // The per-cell prompt hash is the thing that was missing from
  // likeness-arms and the reason that directory became unreadable: a
  // render with no recoverable prompt cannot be reasoned about later.
  const promptsPath = path.join(runDir, 'prompts.txt')
  const promptLines: string[] = [
    `GROUPS BATCH - ${stamp()}`,
    `scoring: ${SHADOW ? 'shadow' : 'off'}`,
    '',
  ]
  for (const c of cells) {
    promptLines.push('='.repeat(70))
    promptLines.push(`${c.subjectKey} / ${c.effectId}  [${c.intake}]  hash=${c.promptHash}`)
    promptLines.push(`subjects: ${c.subjectCount}   sources: ${c.sourceFiles.length}`)
    promptLines.push('-'.repeat(70))
    promptLines.push(c.prompt)
    promptLines.push('')
  }
  fs.writeFileSync(promptsPath, promptLines.join('\r\n'), 'utf8')
  console.log(`  prompts written: ${promptsPath}`)

  // ── CSV, header first, appended per render ──
  //
  // Appended rather than written at the end so that an interrupted run
  // still leaves everything it managed to do.
  const csvPath = path.join(runDir, 'results.csv')
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath, csvRow([
      'subject', 'effect', 'intake', 'subject_count', 'prompt_hash',
      'ok', 'passed', 'attempts', 'duration_ms', 'outpainted',
      'shadow_scores', 'shadow_verdict', 'shadow_would_pass',
      'failure_kind', 'error', 'file',
    ]), 'utf8')
  }

  if (DRY_RUN) {
    console.log('')
    console.log('DRY RUN complete. Paths resolved, prompts built, nothing rendered.')
    console.log('Read prompts.txt, then run again without --dry-run.')
    return
  }

  // ── Render loop ──
  const jsonOut: any[] = []
  let done = 0, failed = 0, resumed = 0

  for (const c of cells) {
    const fileName = `${c.effectId}.jpg`
    const outFile  = path.join(runDir, c.subjectKey, fileName)
    const label    = `${c.subjectKey}/${c.effectId}`

    if (fs.existsSync(outFile)) {
      resumed++
      console.log(`  [skip] ${label} - already rendered`)
      continue
    }

    const t0 = Date.now()
    process.stdout.write(`  [${done + failed + 1}/${cells.length}] ${label} ... `)

    try {
      const result = await generateGroupsRender({
        request: {
          source_images_b64: c.sourceFiles.map(readB64),
          effect_id:         c.effectId,
          subject_count:     c.subjectCount,
          skip_scoring:      true,
        },
        replicateApiToken: REPLICATE,
        // Deliberately absent unless shadow scoring: with skip_scoring true
        // the generator never reads it, and passing it only invites a
        // future edit to start spending on it silently.
        openaiApiKey:      undefined,
        stabilityApiKey:   STABILITY || undefined,
      })

      if (!result.image_b64) {
        failed++
        console.log(`FAILED (${result.fatal_error || 'no image'})`)
        appendRow(csvPath, c, result, null, outFile)
        jsonOut.push({ ...cellMeta(c), ok: false, error: result.fatal_error })
        continue
      }

      fs.writeFileSync(outFile, Buffer.from(result.image_b64, 'base64'))

      // ── Shadow scoring ──
      //
      // AFTER the image is on disk, and wrapped, so a scorer failure can
      // never cost a render. The verdict is recorded, never acted on.
      let shadow: ShadowResult | null = null
      if (SHADOW) {
        shadow = await shadowScore(c, result.image_b64)
      }

      done++
      const secs = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(
        `ok  ${secs}s` +
        (shadow ? `  shadow: ${shadow.wouldPass ? 'PASS' : 'fail'} [${shadow.scores.join(',')}]` : ''),
      )

      appendRow(csvPath, c, result, shadow, outFile)
      jsonOut.push({ ...cellMeta(c), ok: true, file: outFile, shadow })

    } catch (e: any) {
      failed++
      console.log(`ERROR ${e?.message || e}`)
      fs.appendFileSync(csvPath, csvRow([
        c.subjectKey, c.effectId, c.intake, c.subjectCount, c.promptHash,
        false, false, '', Date.now() - t0, '',
        '', '', '', '', e?.message || String(e), '',
      ]), 'utf8')
      jsonOut.push({ ...cellMeta(c), ok: false, error: e?.message || String(e) })
    }
  }

  fs.writeFileSync(
    path.join(runDir, 'results.json'),
    JSON.stringify(jsonOut, null, 2),
    'utf8',
  )

  console.log('')
  console.log('=== DONE ===')
  console.log(`  rendered : ${done}`)
  console.log(`  failed   : ${failed}`)
  if (resumed) console.log(`  skipped  : ${resumed} (already on disk)`)
  console.log(`  csv      : ${csvPath}`)
  console.log(`  images   : ${runDir}`)
  console.log('')

  if (SHADOW) {
    const scored = jsonOut.filter(r => r.shadow)
    const wouldPass = scored.filter(r => r.shadow.wouldPass).length
    console.log(`  shadow gate would have passed ${wouldPass}/${scored.length}`)
    console.log('  Judge the images by eye first, THEN compare against that number.')
    console.log('  Compute the base rate before trusting it: a scorer that always')
    console.log('  says pass scores whatever your own pass rate is.')
    console.log('')
  }
}

// ═════════════════════════════════════════════════════════════════════
// SHADOW SCORING
// ═════════════════════════════════════════════════════════════════════

interface ShadowResult {
  scores:    number[]
  verdict:   string
  wouldPass: boolean
  reasons:   string[]
  error?:    string
}

async function shadowScore(c: Cell, imageB64: string): Promise<ShadowResult> {
  // Imported lazily so that an unscored run never loads the OpenAI path.
  const { scorePerFigureFidelity } = await import('../lib/v1/groups/groups-refine')
  const { evaluateGroupScores }    = await import('../lib/v1/groups/groups-shared')

  try {
    const scores = await scorePerFigureFidelity({
      sourceImageB64:       readB64(c.sourceFiles[0]),
      renderedImageB64:     imageB64,
      openaiApiKey:         OPENAI,
      expectedSubjectCount: c.subjectCount,
    })
    const verdict = evaluateGroupScores(scores)
    return {
      scores:    scores.map(s => s.score),
      verdict:   verdict.reason,
      wouldPass: verdict.passed,
      reasons:   scores.filter(s => s.score < 9).map(s => s.reason),
    }
  } catch (e: any) {
    return {
      scores: [], verdict: 'scorer errored', wouldPass: false,
      reasons: [], error: e?.message || String(e),
    }
  }
}

// ═════════════════════════════════════════════════════════════════════
// OUTPUT ROWS
// ═════════════════════════════════════════════════════════════════════

function cellMeta(c: Cell) {
  return {
    subject:       c.subjectKey,
    effect:        c.effectId,
    intake:        c.intake,
    subject_count: c.subjectCount,
    prompt_hash:   c.promptHash,
    sources:       c.sourceFiles,
  }
}

function appendRow(
  csvPath: string,
  c:       Cell,
  result:  any,
  shadow:  ShadowResult | null,
  outFile: string,
) {
  fs.appendFileSync(csvPath, csvRow([
    c.subjectKey,
    c.effectId,
    c.intake,
    c.subjectCount,
    c.promptHash,
    result.ok,
    result.passed,
    result.attempts?.length ?? '',
    result.duration_ms,
    result.outpainted,
    shadow ? shadow.scores.join(' ') : '',
    shadow ? shadow.verdict : '',
    shadow ? shadow.wouldPass : '',
    result.failure?.kind ?? '',
    result.fatal_error ?? '',
    result.image_b64 ? outFile : '',
  ]), 'utf8')
}

main().catch(e => {
  console.error('')
  console.error('FATAL:', e?.message || e)
  console.error(e?.stack || '')
  process.exit(1)
})
