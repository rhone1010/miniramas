// scripts/test-prompt-file.ts
//
// RENDER A PROMPT FROM A TEXT FILE, N TIMES, SCORED.
//
// For testing a wording change before it goes anywhere near
// portraits-bodies.ts. The prompt lives in a .txt so Rich can edit it in
// Notepad and re-run - no code change, no install, no patch script between
// a change of mind and a render.
//
//   npx tsx --env-file=.env.local scripts/test-prompt-file.ts H:\prompts\victorian-likeness-test.txt
//   npx tsx --env-file=.env.local scripts/test-prompt-file.ts <file> --n 4
//   npx tsx --env-file=.env.local scripts/test-prompt-file.ts <file> --n 4 --label beardclause
//
// ── NOTHING HERE WRITES TO THE ENGINE ──────────────────────────────────
//
// This script reads a text file and sends it to NB2. It does not import a
// catalogue, does not touch portraits-bodies.ts, and cannot change what the
// live route sends. A wording that wins here still has to be installed
// deliberately, with Rich's sign-off, as a normal patch.
//
// ── WHY N RENDERS OF THE SAME PROMPT ───────────────────────────────────
//
// NB2 is stochastic. One render tells you what one roll did; four tell you
// whether a clause holds. The beard question of 21 August is exactly this
// shape - three renders lost the beard, and the thing worth knowing was
// whether that was three bad rolls or the wording.
//
// Every render is scored with the engine's own scorer, so the numbers are
// comparable with the likeness-arms run. But READ THE IMAGES. The scorer
// gave all three beardless renders an 8; it is not measuring the thing
// that was wrong.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'

import { scoreSingleFaceFidelity } from '../lib/v1/portraits/portraits-refine'
import {
  evaluateSingleFaceScore,
  SINGLE_FACE_THRESHOLD,
} from '../lib/v1/portraits/portraits-shared'
import { MAIN_ASPECT } from '../lib/v1/shared/render-aspect'

const OUT_ROOT = 'H:\\minramas\\public\\previews\\prompt-tests'
const SOURCE   = 'H:\\Download Backup\\rich_1.jpg'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT  = 60
const POLL_MAX   = 40
const POLL_DELAY = 2000

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

async function main() {
  const args = process.argv.slice(2)
  const file = args.find(a => !a.startsWith('--'))
  if (!file) throw new Error('usage: test-prompt-file.ts <prompt.txt> [--n 4] [--label name]')
  if (!existsSync(file)) throw new Error(`prompt file not found: ${file}`)

  const n     = args.includes('--n')     ? Number(args[args.indexOf('--n') + 1]) : 4
  const label = args.includes('--label') ? args[args.indexOf('--label') + 1]
                                         : basename(file, extname(file))

  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN not set')
  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  if (!existsSync(SOURCE)) throw new Error(`source not found: ${SOURCE}`)

  const prompt = readFileSync(file, 'utf8').trim()
  if (!prompt) throw new Error('prompt file is empty')

  const dir = join(OUT_ROOT, label)
  mkdirSync(dir, { recursive: true })

  console.log(`${n} renders of "${label}"`)
  console.log(`  prompt  ${file}  (${prompt.length} chars)`)
  console.log(`  source  ${SOURCE}`)
  console.log(`  out     ${dir}\n`)

  // Sequential, not concurrent. Four renders is two minutes either way and
  // the point is to watch them arrive.
  for (let i = 1; i <= n; i++) {
    // Numbered, never overwritten. A second run of the same label continues
    // the numbering rather than replacing what is there.
    let seq = i
    while (existsSync(join(dir, `${label}_${String(seq).padStart(3, '0')}.jpg`))) seq++
    const out = join(dir, `${label}_${String(seq).padStart(3, '0')}.jpg`)

    try {
      const buf = await callNB2(prompt, SOURCE, token)
      writeFileSync(out, buf)

      const score = await scoreSingleFaceFidelity({
        sourceImageB64:   readFileSync(SOURCE).toString('base64'),
        renderedImageB64: buf.toString('base64'),
        openaiApiKey,
      })
      const evaluated = evaluateSingleFaceScore(score, SINGLE_FACE_THRESHOLD)

      console.log(
        `[${i}/${n}] ${basename(out)}  ${score.score}/10 ` +
        `${evaluated.passed ? 'pass' : 'FAIL'}  ${score.reason}`,
      )
    } catch (e: any) {
      console.error(`[${i}/${n}] FAILED: ${e.message}`)
    }
  }

  // The prompt is copied next to its renders. Six weeks from now the
  // question will be what wording produced these, and a path to a file that
  // has since been edited does not answer it.
  writeFileSync(join(dir, `${label}.prompt.txt`), prompt)
  console.log(`\ndone -> ${dir}`)
}

main().catch(e => { console.error(e); process.exit(1) })
