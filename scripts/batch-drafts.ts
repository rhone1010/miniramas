// scripts/batch-drafts.ts
//
// SHOOT THE DRAFT PROMPTS. Gate, then REPAIR rather than re-roll.
//
//   npx tsx --env-file=.env.local scripts/batch-drafts.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-drafts.ts
//   npx tsx --env-file=.env.local scripts/batch-drafts.ts --only ebony,plushy
//   npx tsx --env-file=.env.local scripts/batch-drafts.ts --gate 7 --retries 3
//   npx tsx --env-file=.env.local scripts/batch-drafts.ts --reroll   (old behaviour)
//
// Reads H:\minramas\prompts\drafts\*.txt - written by emit-likeness-drafts.ts
// and edited by hand afterwards. The .txt is the source of truth, not the
// engine catalogue, so a wording can be changed in Notepad between runs.
//
// ── THE REPAIR PASS IS THE POINT OF THIS SCRIPT ───────────────────────
//
// The 21 August run retried by re-rolling: same prompt, same single source
// photograph, new random draw. It rescued a fair number, and it never
// rescued sea_glass, plushy or retro_robot in four attempts each - twelve
// renders that bought nothing.
//
// A re-roll throws away the one thing the failed attempt produced: an image
// that is usually RIGHT about the material, the costume, the background and
// the light, and wrong about the face. Re-rolling gambles the whole picture
// to fix a corner of it.
//
// So a failed attempt here is not discarded. It goes back to NB2 as a
// SECOND INPUT alongside the source photograph, with an instruction to keep
// the picture and repair the face. The field guidance is blunt about this:
// if an image is 80% correct, never regenerate from scratch, and
// incremental editing preserves identity far better than a fresh prompt.
//
// The repair instruction is built from WHAT THE SCORER SAW. A render that
// lost the beard is told about the beard; one that filled the hairline is
// told about the hairline. That is only possible because the v2 scorer
// returns named traits rather than one number - it is the first thing the
// trait checklist has bought that a score alone could not.
//
// --reroll restores the old behaviour, so the two can be compared over the
// same set. That comparison is the experiment; do not assume the repair
// pass wins because it reads better on paper.
//
// ── ATTEMPT 1 IS ALWAYS THE PLAIN PROMPT ──────────────────────────────
//
// The repair only ever runs on a failure. A first attempt that passes costs
// exactly what it did before.

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join, basename, extname } from 'path'

import { scoreSingleFaceLikeness, type LikenessTraits } from '../lib/v1/portraits/portraits-refine'
import { MAIN_ASPECT } from '../lib/v1/shared/render-aspect'

const DRAFT_DIR = 'H:\\minramas\\prompts\\drafts'
const OUT_ROOT  = 'H:\\minramas\\public\\previews\\draft-shoot'
const SOURCE    = 'H:\\Download Backup\\rich_1.jpg'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'
const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000
const CONCURRENCY = 2

// ─── THE REPAIR INSTRUCTION ─────────────────────────────────────────
//
// Built from the traits the scorer named. Only the faults it actually found
// are mentioned: a repair note listing every possible fault would be a
// second full prompt fighting the first.

function repairPrompt(t: LikenessTraits): string {
  const faults: string[] = []

  if (t.beard === 'removed') {
    faults.push(
      `His facial hair is missing. Put it back exactly as it is in the ` +
      `photograph - the same beard in the same places, the same length, the ` +
      `same grey, across the cheeks, jaw, chin and upper lip.`)
  } else if (t.beard === 'added') {
    faults.push(`He has facial hair he does not have in the photograph. Remove it.`)
  } else if (t.beard === 'changed') {
    faults.push(`His facial hair is the wrong length or shape. Match the photograph.`)
  }

  if (t.hairline === 'lowered_or_thickened') {
    faults.push(
      `He has been given more hair than he has. Restore his real hairline, ` +
      `including the recession at the temples and the height of the forehead.`)
  } else if (t.hairline === 'raised' || t.hairline === 'changed') {
    faults.push(`His hairline is wrong. Match the photograph.`)
  }

  if (t.face_shape === 'narrower') {
    faults.push(`His face has been slimmed. Restore its real width and weight through the cheeks and jaw.`)
  } else if (t.face_shape === 'wider' || t.face_shape === 'changed') {
    faults.push(`The shape of his face is wrong. Match the width and weight in the photograph.`)
  }

  if (t.eyes === 'changed')  faults.push(`The set, spacing or shape of his eyes is wrong. Match the photograph.`)
  if (t.nose === 'changed')  faults.push(`The shape of his nose is wrong. Match the photograph.`)
  if (t.mouth === 'changed') faults.push(`The shape of his mouth is wrong. Match the photograph.`)
  if (t.age === 'younger')   faults.push(`He looks younger than he is. Restore his real age and the lines around his eyes and mouth.`)
  if (t.age === 'older')     faults.push(`He looks older than he is. Match the photograph.`)

  if (!faults.length) {
    faults.push(`The face does not read as the same man. Rebuild it from the first photograph.`)
  }

  return [
    `The FIRST image is a photograph of a real man.`,
    `The SECOND image is a portrait of him that is nearly right.`,
    ``,
    `Keep the second image. Its material, costume, background, lighting,`,
    `colour, framing and composition are all correct and must not change.`,
    `Do not restage it, do not relight it, do not reframe it.`,
    ``,
    `Only the face is wrong. Fix these, using the first photograph:`,
    ...faults.map(f => `- ${f}`),
    ``,
    `Change nothing else. Do not beautify him, do not smooth him, do not`,
    `slim him and do not make him younger.`,
  ].join('\n')
}

// ─── NB2 ────────────────────────────────────────────────────────────

function asDataUrl(p: string): string {
  const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
  return `data:image/${ext};base64,${readFileSync(p).toString('base64')}`
}

async function callNB2(prompt: string, images: string[], token: string): Promise<Buffer> {
  const res = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${token}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT}`,
    },
    body: JSON.stringify({
      input: { prompt, image_input: images, aspect_ratio: MAIN_ASPECT, output_format: 'jpg' },
    }),
  })
  if (!res.ok) throw new Error(`POST ${res.status}: ${(await res.text()).slice(0, 200)}`)

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

// ─── CSV ────────────────────────────────────────────────────────────

interface Row {
  effect: string; attempt: number; mode: string
  score: number | null; passed: boolean
  beard: string; hairline: string; shape: string
  reason: string; ms: number; file: string
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(path: string, rows: Row[]): void {
  const head = ['effect', 'attempt', 'mode', 'score', 'passed',
                'beard', 'hairline', 'shape', 'reason', 'ms', 'file']
  writeFileSync(path, [head.join(',')]
    .concat(rows.map(r => head.map(h => csvCell((r as any)[h])).join(',')))
    .join('\n'))
}

// ─── RUN ────────────────────────────────────────────────────────────

async function main() {
  const args    = process.argv.slice(2)
  const dry     = args.includes('--dry')
  const reroll  = args.includes('--reroll')
  const only    = args.includes('--only')    ? args[args.indexOf('--only') + 1] : null
  const gate    = args.includes('--gate')    ? Number(args[args.indexOf('--gate') + 1])    : 7
  const retries = args.includes('--retries') ? Number(args[args.indexOf('--retries') + 1]) : 3

  if (!existsSync(DRAFT_DIR)) throw new Error(`no drafts at ${DRAFT_DIR} — run emit-likeness-drafts.ts first`)
  if (!existsSync(SOURCE))    throw new Error(`source not found: ${SOURCE}`)

  const token = process.env.REPLICATE_API_TOKEN
  if (!token && !dry) throw new Error('REPLICATE_API_TOKEN not set')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey && !dry) throw new Error('OPENAI_API_KEY not set — no scoring means no gate')

  let names = readdirSync(DRAFT_DIR)
    .filter(n => extname(n).toLowerCase() === '.txt' && !n.startsWith('_'))
    .map(n => basename(n, '.txt'))
    .sort()

  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const missing = want.filter(w => !names.includes(w))
    if (missing.length) throw new Error(`no draft for: ${missing.join(', ')}`)
    names = want
  }
  if (!names.length) throw new Error('no drafts to shoot')

  mkdirSync(OUT_ROOT, { recursive: true })
  const stamp   = Date.now()
  const csvPath = join(OUT_ROOT, `draft-shoot-${stamp}.csv`)

  console.log(`${names.length} draft(s)`)
  console.log(`  drafts  ${DRAFT_DIR}`)
  console.log(`  gate    ${gate}/10, up to ${retries + 1} attempt(s)`)
  console.log(`  retry   ${reroll ? 're-roll (same prompt again)' : 'REPAIR PASS (failed render fed back)'}`)
  console.log(`  out     ${OUT_ROOT}`)

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    for (const n of names) {
      const chars = readFileSync(join(DRAFT_DIR, `${n}.txt`), 'utf8').trim().length
      console.log(`  ${n.padEnd(18)} ${chars} chars`)
    }
    return
  }

  const rows: Row[] = []
  const sourceB64 = readFileSync(SOURCE).toString('base64')
  const queue = [...names]
  let cells = 0

  async function worker() {
    while (queue.length) {
      const effect = queue.shift()!
      const basePrompt = readFileSync(join(DRAFT_DIR, `${effect}.txt`), 'utf8').trim()
      const maxAttempts = Math.max(1, retries + 1)

      let lastBuf: Buffer | null = null
      let lastTraits: LikenessTraits | null = null

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const t0 = Date.now()
        const isRepair = attempt > 1 && !reroll && lastBuf && lastTraits
        const mode = attempt === 1 ? 'first' : (isRepair ? 'repair' : 'reroll')

        // Every attempt keeps its own file. A repair is only worth buying if
        // attempt two is visibly better than attempt one.
        const out = join(OUT_ROOT, `${effect}_a${attempt}_${mode}.jpg`)
        if (existsSync(out)) {
          const keep = join(OUT_ROOT, 'superseded')
          mkdirSync(keep, { recursive: true })
          let n = 1
          while (existsSync(join(keep, `${basename(out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))) n++
          renameSync(out, join(keep, `${basename(out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))
        }

        try {
          // The repair sends TWO images: the photograph first, the failed
          // render second, in that order. The prompt names them in that
          // order and NB2 is being asked to edit the second toward the first.
          const prompt = isRepair ? repairPrompt(lastTraits!) : basePrompt
          const images = isRepair
            ? [asDataUrl(SOURCE), `data:image/jpeg;base64,${lastBuf!.toString('base64')}`]
            : [asDataUrl(SOURCE)]

          const buf = await callNB2(prompt, images, token!)
          writeFileSync(out, buf)

          const sc = await scoreSingleFaceLikeness({
            sourceImageB64:   sourceB64,
            renderedImageB64: buf.toString('base64'),
            openaiApiKey:     openaiApiKey!,
          })
          const passed = sc.score >= gate

          rows.push({
            effect, attempt, mode,
            score: sc.score, passed,
            beard: sc.traits.beard, hairline: sc.traits.hairline, shape: sc.traits.face_shape,
            reason: sc.reason, ms: Date.now() - t0, file: basename(out),
          })
          cells++
          console.log(
            `[${cells}] ${effect.padEnd(16)} a${attempt} ${mode.padEnd(6)} ` +
            `${String(sc.score).padStart(2)}/10 ${passed ? 'pass' : 'FAIL'}  ` +
            `${sc.traits.beard}/${sc.traits.hairline}/${sc.traits.face_shape}`,
          )
          writeCsv(csvPath, rows)

          if (passed) break
          lastBuf    = buf
          lastTraits = sc.traits
        } catch (e: any) {
          rows.push({
            effect, attempt, mode, score: null, passed: false,
            beard: '', hairline: '', shape: '',
            reason: `error: ${e.message}`, ms: Date.now() - t0, file: basename(out),
          })
          cells++
          console.error(`[${cells}] ${effect} a${attempt}: ${e.message}`)
          writeCsv(csvPath, rows)
        }
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  // ── SUMMARY ──
  const scored  = rows.filter(r => typeof r.score === 'number')
  const firsts  = scored.filter(r => r.attempt === 1)
  const effects = [...new Set(scored.map(r => r.effect))]
  const rescued = effects.filter(e => {
    const a = scored.filter(r => r.effect === e)
    return !a.find(r => r.attempt === 1)?.passed && a.some(r => r.passed)
  })
  const never = effects.filter(e => !scored.some(r => r.effect === e && r.passed))
  const mean  = (xs: number[]) => xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : '--'

  console.log('\n─── SUMMARY ───')
  console.log(`  first attempt   mean=${mean(firsts.map(r => r.score as number))}  ` +
              `passed ${firsts.filter(r => r.passed).length}/${firsts.length} (>=${gate})`)
  console.log(`  ${reroll ? 're-rolls' : 'repairs'} rescued  ${rescued.length}` +
              (rescued.length ? `: ${rescued.join(', ')}` : ''))
  console.log(`  never passed    ${never.length}` + (never.length ? `: ${never.join(', ')}` : ''))
  console.log(`  renders spent   ${scored.length} for ${effects.length} effects`)
  console.log(`  beard removed   ${scored.filter(r => r.beard === 'removed').length}/${scored.length}` +
              `   hairline filled ${scored.filter(r => r.hairline === 'lowered_or_thickened').length}/${scored.length}`)
  console.log(`\ncsv  ${csvPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
