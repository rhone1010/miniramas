// scripts/batch-likeness-arms.ts
//
// THE LIKENESS EXPERIMENT. One photograph against four, same library, scored.
//
// Rich, 21 August: more than half of his own Portraits renders could have
// been better on likeness. This measures it instead of arguing about it.
//
//   npx tsx --env-file=.env.local scripts/batch-likeness-arms.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-likeness-arms.ts
//   npx tsx --env-file=.env.local scripts/batch-likeness-arms.ts --only ebony,iron
//   npx tsx --env-file=.env.local scripts/batch-likeness-arms.ts --arm one
//   npx tsx --env-file=.env.local scripts/batch-likeness-arms.ts --with-women
//
// ── WHAT IT COMPARES ───────────────────────────────────────────────────
//
//   arm "one"   rich_1.jpg alone            - what ships today
//   arm "four"  rich_1..4, rich_1 first     - the question
//
// NB2 takes up to fourteen images; MAX_SOURCE_IMAGES caps the product at
// four. rich_1 leads in both arms so the two differ by ADDED REFERENCES and
// nothing else - a different lead photograph would change the render for a
// reason that has nothing to do with the count.
//
// ── STYLE REFERENCE PLATES ARE NOT AN ARM, AND HERE IS WHY ─────────────
//
// MAX_STYLE_REFS is 0 in lib/v1/portraits/style-refs.ts, set there on
// 3 August because plates were outranking the source photograph on facial
// structure. loadStyleRefs returns [] before it touches the disk.
//
// The 115 files under lib/v1/portraits/style-refs/ are therefore INERT.
// They are still on disk, the loader is still imported, and the call site
// in portraits-generator.ts still reads as though plates go out. They do
// not. This script sends no plates and neither does production.
//
// If plates are ever restored, this experiment must be re-run before its
// numbers mean anything again.
//
// ── IT SCORES WITH THE ENGINE'S OWN SCORER ─────────────────────────────
//
// scoreSingleFaceLikeness - the trait-checklist scorer. NOT the one the
// live route calls today; the route still calls v1. Swapping it is a
// separate deliberate edit and should follow these numbers, not precede
// them.
//
// ── IT GATES AND RETRIES ──────────────────────────────────────────────
//
//   --gate N     pass mark out of 10, default 7
//   --retries N  extra attempts after a fail, default 3 (so up to 4 renders)
//   --retries 0  one attempt each, no gate behaviour - measuring mode
//
// EVERY ATTEMPT IS KEPT, both the file and the row. A cell that passes on
// attempt three is a different fact from one that passes on attempt one,
// and a folder that kept only the winner cannot tell you whether the retry
// budget bought anything.
//
// SCORED WITH scoreSingleFaceLikeness (v2). v1 gave 8/10 to renders that
// had silently removed the subject's beard, which is what started this.
//
// OLD NOTE, WHICH STILL APPLIES TO --retries 0: The
// question is what a first attempt scores, and a retried sample would
// report the better of two rolls and hide the distribution that decides
// whether retries are worth buying.
//
// ── THE CSV IS THE DELIVERABLE ─────────────────────────────────────────
//
// The images are worth looking at, but the answer is in the numbers:
// mean score per arm, and the spread. If arm "four" is a point higher
// across the library, more references fix drift. If the two are level, the
// bodies are the problem and no retry budget will touch it.
//
// A score of 4 and a score of 7 want opposite decisions - 7s are worth
// retrying, 4s are not - so the per-row reason is carried through too.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join, basename } from 'path'

import { buildEffectPrompt, listBodyIds } from '../lib/v1/portraits/portraits-bodies'
import { scoreSingleFaceLikeness } from '../lib/v1/portraits/portraits-refine'
import { MAX_SOURCE_IMAGES } from '../lib/v1/portraits/portraits-shared'
import { MAIN_ASPECT } from '../lib/v1/shared/render-aspect'

// ─── CONFIG ─────────────────────────────────────────────────────

const OUT_ROOT = 'H:\\minramas\\public\\previews\\likeness-arms'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000

// Lower than the shoot scripts' three. Each cell here is a render AND a
// scoring call, and the scorer is a second rate limit on a different
// service. Two in flight keeps both inside their windows.
const CONCURRENCY = 2

// ─── SOURCES ────────────────────────────────────────────────────
//
// Rich, 21 August. Four photographs of the same person across three
// folders, varied lighting and angle. rich_1 is the single.

const RICH_1 = 'H:\\Download Backup\\rich_1.jpg'
const RICH_2 = 'H:\\Backups\\Backup October 2025\\rich_2.jpg'
const RICH_3 = 'H:\\Download Backup\\Rich To Sort\\rich_3.jpg'
const RICH_4 = 'H:\\Download Backup\\rich_4.jpg'

// rich_1 leads. See the header.
const ARM_SOURCES: Record<string, string[]> = {
  one:  [RICH_1],
  four: [RICH_1, RICH_2, RICH_3, RICH_4].slice(0, MAX_SOURCE_IMAGES),
}

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  arm:    string
  effect: string
  prompt: string
  out:    string
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

function rows(effects: string[], arms: string[]): Row[] {
  const out: Row[] = []
  for (const arm of arms) {
    for (const effect of effects) {
      out.push({
        arm,
        effect,
        // The engine's own builder. Body verbatim, avoid appended. Nothing
        // in this file restates a prompt.
        prompt: buildEffectPrompt(effect),
        out:    join(OUT_ROOT, arm, `${effect}.jpg`),
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

async function callNB2(prompt: string, sources: string[], token: string): Promise<Buffer> {
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
        image_input:   sources.map(asDataUrl),
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
  const head = ['arm', 'effect', 'attempt', 'attempts', 'score', 'passed',
                'beard', 'hairline', 'shape', 'reason', 'ms', 'file']
  const lines = [head.join(',')]
  for (const r of results) {
    lines.push([
      r.arm, r.effect, r.attempt, r.attempts, r.score, r.passed,
      r.beard, r.hairline, r.shape, r.reason, r.ms, basename(r.out),
    ].map(csvCell).join(','))
  }
  writeFileSync(path, lines.join('\n'))
}

function summarise(results: Result[], gate: number): void {
  const arms = [...new Set(results.map(r => r.arm))]
  console.log('\n─── SUMMARY ───')
  for (const arm of arms) {
    const rs = results.filter(r => r.arm === arm && typeof r.score === 'number')
    if (!rs.length) { console.log(`  ${arm}: no scores`); continue }

    // FIRST ATTEMPTS ONLY for the mean. That is the honest picture of the
    // library - what a render scores before any money is spent rescuing it.
    const first  = rs.filter(r => r.attempt === 1)
    const scores = first.map(r => r.score as number).sort((a, b) => a - b)
    const mean   = scores.reduce((a, b) => a + b, 0) / scores.length

    // And what the retries bought. The gap between these two is the value
    // of the retry budget in the only terms that matter.
    const effects   = [...new Set(rs.map(r => r.effect))]
    const rescued   = effects.filter(e => {
      const a = rs.filter(r => r.effect === e)
      return !a.find(r => r.attempt === 1)?.passed && a.some(r => r.passed)
    })
    const neverPass = effects.filter(e => !rs.some(r => r.effect === e && r.passed))

    console.log(
      `  ${arm}  first-attempt mean=${mean.toFixed(2)} ` +
      `range=${scores[0]}-${scores[scores.length - 1]}  ` +
      `passed first try ${first.filter(r => r.passed).length}/${first.length} (>=${gate})`,
    )
    console.log(
      `         retries rescued ${rescued.length}, never passed ${neverPass.length}` +
      (neverPass.length ? `: ${neverPass.join(', ')}` : ''),
    )
    console.log(`         ${rs.length} renders spent on ${effects.length} effects`)

    // The two faults that started this. If they are still common after a
    // wording change, the wording did not take.
    const beardGone = rs.filter(r => r.beard === 'removed').length
    const hairFill  = rs.filter(r => r.hairline === 'lowered_or_thickened').length
    console.log(`         beard removed ${beardGone}/${rs.length}, hairline filled ${hairFill}/${rs.length}`)
  }
  console.log('')
}

// ─── RUN ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dry  = args.includes('--dry')
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
  const arm  = args.includes('--arm')  ? args[args.indexOf('--arm')  + 1] : null
  const withWomen = args.includes('--with-women')
  const gate    = args.includes('--gate')    ? Number(args[args.indexOf('--gate') + 1])    : 7
  const retries = args.includes('--retries') ? Number(args[args.indexOf('--retries') + 1]) : 3

  const token = process.env.REPLICATE_API_TOKEN
  if (!token && !dry) throw new Error('REPLICATE_API_TOKEN not set')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey && !dry) {
    // Without it the run produces images and no numbers, which is the one
    // thing this script exists to produce.
    throw new Error('OPENAI_API_KEY not set — this run is pointless without scoring')
  }

  const arms = arm ? [arm] : Object.keys(ARM_SOURCES)
  for (const a of arms) {
    if (!ARM_SOURCES[a]) {
      throw new Error(`unknown arm "${a}" — known: ${Object.keys(ARM_SOURCES).join(', ')}`)
    }
  }

  // ── THE GENDERED VARIANTS COME OUT BY DEFAULT ──────────────────
  //
  // portraits-bodies.ts carries seven _woman rows - deco_twenties_woman,
  // elizabethan_woman, persian_court_woman, renaissance_woman,
  // samurai_woman, victorian_woman, wild_west_woman. Their bodies describe
  // a woman: gown, bodice, coiffure.
  //
  // The source photographs here are of a man. Those cells would score badly
  // for a reason that has nothing to do with how many references were sent,
  // and they would drag BOTH arms down by roughly the same amount - noise
  // in the mean without moving the comparison.
  //
  // Rich, 21 August: drop them.
  //
  // --with-women puts them back, for the day the same experiment is run on
  // a female source. Nothing about the script assumes a man beyond this.
  let effects = listBodyIds()
  if (!withWomen) {
    const before = effects.length
    effects = effects.filter(id => !id.endsWith('_woman'))
    console.log(`  excluded  ${before - effects.length} _woman bodies (--with-women to keep)`)
  }
  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const unknown = want.filter(w => !effects.includes(w))
    if (unknown.length) throw new Error(`unknown effect id(s): ${unknown.join(', ')}`)
    effects = want
  }
  if (!effects.length) throw new Error('nothing to render')

  // Every source checked before the first render. A run that produces
  // forty images and then stops on a missing file has spent forty renders
  // to find out something a loop could have said in a second.
  const allSources = [...new Set(arms.flatMap(a => ARM_SOURCES[a]))]
  const missing = allSources.filter(p => !existsSync(p))
  if (missing.length) {
    console.error(`\nMISSING SOURCES (${missing.length}):`)
    for (const m of missing) console.error('  ' + m)
    process.exit(1)
  }

  const all = rows(effects, arms)

  for (const a of arms) mkdirSync(join(OUT_ROOT, a), { recursive: true })

  // Existing renders are NOT overwritten silently - the old one goes to a
  // numbered sibling first, so a second run does not destroy the first
  // run's evidence.
  for (const r of all) {
    if (existsSync(r.out)) {
      const keep = join(OUT_ROOT, r.arm, 'superseded')
      mkdirSync(keep, { recursive: true })
      let n = 1
      while (existsSync(join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))) n++
      renameSync(r.out, join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))
    }
  }

  const stamp    = Date.now()
  const csvPath  = join(OUT_ROOT, `likeness-arms-${stamp}.csv`)
  const jsonPath = join(OUT_ROOT, `likeness-arms-${stamp}.json`)

  console.log(`${effects.length} effects x ${arms.length} arm(s) = ${all.length} renders`)
  console.log(`  aspect    ${MAIN_ASPECT}`)
  console.log(`  gate      ${gate}/10, up to ${retries + 1} attempt(s) per cell`)
  console.log(`  plates    none (MAX_STYLE_REFS is 0)`)
  console.log(`  out       ${OUT_ROOT}`)
  console.log(`  csv       ${csvPath}`)

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    for (const a of arms) {
      console.log(`\n  arm "${a}" — ${ARM_SOURCES[a].length} source(s):`)
      for (const s of ARM_SOURCES[a]) console.log(`    ${s}`)
    }
    console.log(`\n  effects: ${effects.join(', ')}`)
    return
  }

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
        // Every attempt keeps its own file. A retry budget is only worth
        // buying if attempt three is visibly better than attempt one, and
        // that cannot be judged from a folder that kept only the winner.
        const out = maxAttempts > 1
          ? row.out.replace(/\.jpg$/, `_a${attempt}.jpg`)
          : row.out

        try {
          const buf = await callNB2(row.prompt, ARM_SOURCES[row.arm], token!)
          writeFileSync(out, buf)

          const sc = await scoreSingleFaceLikeness({
            sourceImageB64:   readFileSync(RICH_1).toString('base64'),
            renderedImageB64: buf.toString('base64'),
            openaiApiKey:     openaiApiKey!,
          })
          const passed = sc.score >= gate

          results.push({
            ...row, out,
            attempt, attempts: maxAttempts,
            score: sc.score, passed,
            beard:    sc.traits.beard,
            hairline: sc.traits.hairline,
            shape:    sc.traits.face_shape,
            reason:   sc.reason,
            ms: Date.now() - t0,
          })
          cells++
          console.log(
            `[${cells}] ${row.arm.padEnd(5)} ${row.effect.padEnd(18)} ` +
            `a${attempt}/${maxAttempts} ${String(sc.score).padStart(2)}/10 ` +
            `${passed ? 'pass' : 'FAIL'}  ${sc.traits.beard}/${sc.traits.hairline}`,
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
          console.error(`[${cells}] ${row.arm} ${row.effect} a${attempt}: ${e.message}`)
          writeCsv(csvPath, results)
          writeFileSync(jsonPath, JSON.stringify(results, null, 2))
          if (attempt === maxAttempts) failed++
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n${done} rendered, ${failed} failed. -> ${OUT_ROOT}`)
  summarise(results, gate)
  console.log(`csv  ${csvPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
