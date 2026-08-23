// scripts/batch-library-2up.ts
//
// THE WHOLE LIBRARY, ONE MAN AND ONE WOMAN, INTO A CLEAN DIRECTORY.
//
//   npx tsx --env-file=.env.local scripts/batch-library-2up.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-library-2up.ts
//   npx tsx --env-file=.env.local scripts/batch-library-2up.ts --subject woman
//   npx tsx --env-file=.env.local scripts/batch-library-2up.ts --only neon,clockwork
//   npx tsx --env-file=.env.local scripts/batch-library-2up.ts --no-score
//
// Descended from batch-likeness-arms.ts, which asked a different question:
// one source photograph against four. That comparison is finished with.
// This one runs the library ONCE PER SUBJECT after the 22 August body
// rewrites, so the renders can be judged by eye against a known prompt set.
//
// ── WHY A NEW DIRECTORY ────────────────────────────────────────────────
//
// likeness-arms holds two arms, four attempts a cell and a superseded
// subfolder, and it is no longer possible to tell what is new in it. This
// writes somewhere else and does not touch it.
//
//     H:\minramas\public\previews\library-<date>\man\
//     H:\minramas\public\previews\library-<date>\woman\
//
// ── THE GENDERED SPLIT IS AUTOMATIC ────────────────────────────────────
//
// portraits-bodies.ts carries 62 bodies: 48 gender-neutral materials, and
// 7 costumes that exist twice - victorian/victorian_woman and so on.
//
//   man    48 neutral + the 7 base costumes          = 55
//   woman  48 neutral + the 7 _woman variants        = 55
//
// The old script dropped the _woman rows entirely because both its arms
// were the same man. Here the subject decides, so no cell is ever rendered
// against a body written for the other gender. That was the single largest
// source of meaningless low scores in the last run.
//
// ── SCORING IS OPTIONAL AND OFF-BY-DEFAULT REASONS ─────────────────────
//
// scoreSingleFaceLikeness agreed with Rich 28 times out of 44. It is kept
// because the trait columns - beard, hairline, face_shape - are useful even
// when the number is not, and because "beard: added" across a column is
// exactly the signal the 22 August likeness clause was written to kill.
//
// --no-score renders without it: no OPENAI_API_KEY needed, no gate, no
// retries, one attempt per cell. Use it when the corpus is the point and
// the judgement is Rich's eye.
//
// ── EVERY ATTEMPT IS KEPT ──────────────────────────────────────────────
//
// Both the file and the CSV row. A cell that passes on attempt three is a
// different fact from one that passes on attempt one.
//
// ── THE MANIFEST ───────────────────────────────────────────────────────
//
// One CSV row per render, written as it goes so a killed run keeps its
// evidence. Carries subject, effect, attempt, score, the three traits, the
// prompt hash and the file. The prompt hash is what was missing last time:
// it says which wording produced which image, so a body rewritten between
// runs is visible in the data rather than remembered.
//
// STYLE PLATES ARE STILL INERT. MAX_STYLE_REFS is 0. This sends none and
// neither does production.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'

import { buildEffectPrompt, listBodyIds } from '../lib/v1/portraits/portraits-bodies'
import { scoreSingleFaceLikeness } from '../lib/v1/portraits/portraits-refine'
import { MAIN_ASPECT } from '../lib/v1/shared/render-aspect'

// ─── CONFIG ─────────────────────────────────────────────────────

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const OUT_ROOT = `H:\\minramas\\public\\previews\\library-${stamp()}`

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000

// Two in flight. Each cell is a render and, when scoring, a second call to
// a different service with its own window.
const CONCURRENCY = 2

// ─── SUBJECTS ───────────────────────────────────────────────────
//
// One photograph each. The four-source arm was the previous experiment and
// is not repeated here.

const SUBJECTS: Record<string, string> = {
  man:   'H:\\Download Backup\\rich_1.jpg',
  woman: 'C:\\Users\\richh\\Desktop\\chard\\IMG_1522.jpg',
}

// The seven costumes that exist in both genders. Everything else in the
// library is neutral and runs for both subjects unchanged.
const GENDERED = [
  'deco_twenties', 'elizabethan', 'persian_court', 'renaissance',
  'samurai', 'victorian', 'wild_west',
]

/**
 * The effect list for one subject.
 *
 * A woman gets the _woman variant of each costume and never the base; a man
 * gets the base and never the variant. Neutral materials go to both.
 *
 * Throws rather than silently shrinking if a variant named here is missing
 * from the library - a run that quietly drops six costumes is worse than one
 * that refuses to start.
 */
function effectsFor(subject: string, all: string[]): string[] {
  const woman = subject === 'woman'
  const out: string[] = []

  for (const id of all) {
    if (id.endsWith('_woman')) continue
    if (GENDERED.includes(id)) {
      if (woman) {
        const variant = `${id}_woman`
        if (!all.includes(variant)) {
          throw new Error(`${id} is gendered but ${variant} is not in the library`)
        }
        out.push(variant)
      } else {
        out.push(id)
      }
      continue
    }
    out.push(id)
  }
  return out
}

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  subject: string
  effect:  string
  prompt:  string
  hash:    string
  out:     string
}

interface Result extends Row {
  attempt:  number
  attempts: number
  score:    number | null
  passed:   boolean
  beard:    string
  hairline: string
  shape:    string
  reason:   string
  ms:       number
}

function promptHash(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 10)
}

function rows(subjects: string[], all: string[]): Row[] {
  const out: Row[] = []
  for (const subject of subjects) {
    for (const effect of effectsFor(subject, all)) {
      // The engine's own builder. Body verbatim, avoid appended. Nothing in
      // this file restates a prompt.
      const prompt = buildEffectPrompt(effect)
      out.push({
        subject,
        effect,
        prompt,
        hash: promptHash(prompt),
        out:  join(OUT_ROOT, subject, `${effect}.jpg`),
      })
    }
  }
  return out
}

// ─── NB2 ────────────────────────────────────────────────────────

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
        aspect_ratio:  MAIN_ASPECT,
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

// ─── CSV ────────────────────────────────────────────────────────

function csvCell(v: string | number | boolean | null): string {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(path: string, results: Result[]): void {
  const head = ['subject', 'effect', 'attempt', 'attempts', 'score', 'passed',
                'beard', 'hairline', 'shape', 'reason', 'prompt_hash', 'ms', 'file']
  const lines = [head.join(',')]
  for (const r of results) {
    lines.push([
      r.subject, r.effect, r.attempt, r.attempts, r.score, r.passed,
      r.beard, r.hairline, r.shape, r.reason, r.hash, r.ms, basename(r.out),
    ].map(csvCell).join(','))
  }
  writeFileSync(path, lines.join('\n'))
}

/**
 * A second file, one row per effect per subject, listing the exact prompt
 * that produced it. The CSV carries the hash; this carries the text the hash
 * stands for, so a run can be reconstructed months later without guessing
 * which version of a body was live.
 */
function writePrompts(path: string, all: Row[]): void {
  const lines: string[] = []
  for (const r of all) {
    lines.push(`### ${r.subject} / ${r.effect}  [${r.hash}]`)
    lines.push('')
    lines.push(r.prompt)
    lines.push('')
  }
  writeFileSync(path, lines.join('\n'))
}

function summarise(results: Result[], gate: number, scoring: boolean): void {
  const subjects = [...new Set(results.map(r => r.subject))]
  console.log('\n─── SUMMARY ───')

  for (const subject of subjects) {
    const rs = results.filter(r => r.subject === subject)
    const ok = rs.filter(r => r.reason.startsWith('error:') === false)
    const errored = rs.length - ok.length

    if (!scoring) {
      const effects = [...new Set(rs.map(r => r.effect))]
      console.log(`  ${subject}  ${ok.length} rendered across ${effects.length} effects` +
                  (errored ? `, ${errored} errored` : ''))
      continue
    }

    const scored = rs.filter(r => typeof r.score === 'number')
    if (!scored.length) { console.log(`  ${subject}: no scores`); continue }

    // First attempts only for the mean - the honest picture of the library
    // before any money is spent rescuing a cell.
    const first  = scored.filter(r => r.attempt === 1)
    const nums   = first.map(r => r.score as number).sort((a, b) => a - b)
    const mean   = nums.reduce((a, b) => a + b, 0) / nums.length

    const effects = [...new Set(scored.map(r => r.effect))]
    const rescued = effects.filter(e => {
      const a = scored.filter(r => r.effect === e)
      return !a.find(r => r.attempt === 1)?.passed && a.some(r => r.passed)
    })
    const neverPass = effects.filter(e => !scored.some(r => r.effect === e && r.passed))

    console.log(
      `  ${subject}  first-attempt mean=${mean.toFixed(2)} ` +
      `range=${nums[0]}-${nums[nums.length - 1]}  ` +
      `passed first try ${first.filter(r => r.passed).length}/${first.length} (>=${gate})`,
    )
    console.log(
      `           retries rescued ${rescued.length}, never passed ${neverPass.length}` +
      (neverPass.length ? `: ${neverPass.join(', ')}` : ''),
    )

    // THE REASON THIS RUN EXISTS. The 22 August likeness clause went into
    // sixteen bodies to stop facial hair drifting in either direction. If
    // these two columns are still busy, the wording did not take.
    const beardAdded   = scored.filter(r => r.beard === 'added').length
    const beardRemoved = scored.filter(r => r.beard === 'removed').length
    const hairFill     = scored.filter(r => r.hairline === 'lowered_or_thickened').length
    console.log(`           beard added ${beardAdded}, removed ${beardRemoved}, ` +
                `hairline filled ${hairFill}, of ${scored.length}`)
  }
  console.log('')
}

// ─── RUN ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dry     = args.includes('--dry')
  const noScore = args.includes('--no-score')
  const only    = args.includes('--only')    ? args[args.indexOf('--only') + 1]    : null
  const subject = args.includes('--subject') ? args[args.indexOf('--subject') + 1] : null
  const gate    = args.includes('--gate')    ? Number(args[args.indexOf('--gate') + 1])    : 7
  const retries = args.includes('--retries')
    ? Number(args[args.indexOf('--retries') + 1])
    : (noScore ? 0 : 3)

  if (noScore && args.includes('--gate')) {
    throw new Error('--gate means nothing with --no-score: there is no score to gate on')
  }

  const token = process.env.REPLICATE_API_TOKEN
  if (!token && !dry) throw new Error('REPLICATE_API_TOKEN not set')

  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey && !noScore && !dry) {
    throw new Error('OPENAI_API_KEY not set — pass --no-score to render without scoring')
  }

  const subjects = subject ? [subject] : Object.keys(SUBJECTS)
  for (const s of subjects) {
    if (!SUBJECTS[s]) {
      throw new Error(`unknown subject "${s}" — known: ${Object.keys(SUBJECTS).join(', ')}`)
    }
  }

  const library = listBodyIds()

  let all = rows(subjects, library)

  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const known = new Set(all.map(r => r.effect))
    const unknown = want.filter(w => !known.has(w))
    if (unknown.length) {
      throw new Error(
        `unknown effect id(s) for the chosen subject(s): ${unknown.join(', ')}\n` +
        `  note the gendered ones swap by subject - victorian for a man, ` +
        `victorian_woman for a woman`,
      )
    }
    all = all.filter(r => want.includes(r.effect))
  }
  if (!all.length) throw new Error('nothing to render')

  // Every source checked before the first render. A run that produces forty
  // images and then stops on a missing file has spent forty renders to find
  // out something a loop could have said in a second.
  const missing = subjects.map(s => SUBJECTS[s]).filter(p => !existsSync(p))
  if (missing.length) {
    console.error(`\nMISSING SOURCES (${missing.length}):`)
    for (const m of missing) console.error('  ' + m)
    process.exit(1)
  }

  for (const s of subjects) mkdirSync(join(OUT_ROOT, s), { recursive: true })

  // Existing renders are NOT overwritten silently. This directory is dated
  // so a collision should be impossible, but a second run on the same day is
  // exactly when evidence gets destroyed.
  for (const r of all) {
    if (existsSync(r.out)) {
      const keep = join(OUT_ROOT, r.subject, 'superseded')
      mkdirSync(keep, { recursive: true })
      let n = 1
      while (existsSync(join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))) n++
      renameSync(r.out, join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))
    }
  }

  const runId       = Date.now()
  const csvPath     = join(OUT_ROOT, `library-${runId}.csv`)
  const jsonPath    = join(OUT_ROOT, `library-${runId}.json`)
  const promptsPath = join(OUT_ROOT, `library-${runId}-prompts.txt`)

  for (const s of subjects) {
    const n = all.filter(r => r.subject === s).length
    console.log(`  ${s.padEnd(6)} ${n} effects   ${SUBJECTS[s]}`)
  }
  console.log(`  total     ${all.length} renders`)
  console.log(`  aspect    ${MAIN_ASPECT}`)
  console.log(`  scoring   ${noScore ? 'OFF' : `on, gate ${gate}/10, up to ${retries + 1} attempt(s)`}`)
  console.log(`  plates    none (MAX_STYLE_REFS is 0)`)
  console.log(`  out       ${OUT_ROOT}`)
  console.log(`  csv       ${csvPath}`)

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    for (const s of subjects) {
      const es = all.filter(r => r.subject === s).map(r => r.effect)
      console.log(`\n  ${s} (${es.length}): ${es.join(', ')}`)
    }
    return
  }

  writePrompts(promptsPath, all)

  const results: Result[] = []
  let done = 0, failed = 0, cells = 0
  const queue = [...all]

  async function worker() {
    while (queue.length) {
      const row = queue.shift()!
      const maxAttempts = Math.max(1, retries + 1)
      let attempt = 0

      while (attempt < maxAttempts) {
        attempt++
        const t0 = Date.now()
        const out = maxAttempts > 1
          ? row.out.replace(/\.jpg$/, `_a${attempt}.jpg`)
          : row.out

        try {
          const buf = await callNB2(row.prompt, SUBJECTS[row.subject], token!)
          writeFileSync(out, buf)

          let score: number | null = null
          let passed = true
          let beard = '', hairline = '', shape = '', reason = ''

          if (!noScore) {
            // Scored against this subject's own photograph, never a fixed
            // one. The old script compared every render to rich_1.
            const sc = await scoreSingleFaceLikeness({
              sourceImageB64:   readFileSync(SUBJECTS[row.subject]).toString('base64'),
              renderedImageB64: buf.toString('base64'),
              openaiApiKey:     openaiApiKey!,
            })
            score    = sc.score
            passed   = sc.score >= gate
            beard    = sc.traits.beard
            hairline = sc.traits.hairline
            shape    = sc.traits.face_shape
            reason   = sc.reason
          }

          results.push({
            ...row, out,
            attempt, attempts: maxAttempts,
            score, passed, beard, hairline, shape, reason,
            ms: Date.now() - t0,
          })
          cells++
          console.log(
            `[${cells}/${all.length}] ${row.subject.padEnd(5)} ${row.effect.padEnd(20)} ` +
            (noScore
              ? `a${attempt} ok`
              : `a${attempt}/${maxAttempts} ${String(score).padStart(2)}/10 ` +
                `${passed ? 'pass' : 'FAIL'}  ${beard}/${hairline}`),
          )
          writeCsv(csvPath, results)
          writeFileSync(jsonPath, JSON.stringify(results, null, 2))
          if (passed) { done++; break }
          if (attempt === maxAttempts) failed++
        } catch (e: any) {
          results.push({
            ...row, out,
            attempt, attempts: maxAttempts,
            score: null, passed: false,
            beard: '', hairline: '', shape: '',
            reason: `error: ${e.message}`, ms: Date.now() - t0,
          })
          cells++
          console.error(`[${cells}] ${row.subject} ${row.effect} a${attempt}: ${e.message}`)
          writeCsv(csvPath, results)
          writeFileSync(jsonPath, JSON.stringify(results, null, 2))
          if (attempt === maxAttempts) failed++
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n${done} rendered, ${failed} failed. -> ${OUT_ROOT}`)
  summarise(results, gate, !noScore)
  console.log(`csv      ${csvPath}`)
  console.log(`prompts  ${promptsPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
