// scripts/batch-groups-candidates.ts
//
// Renders the eleven candidate bodies in scripts/groups-candidates.ts
// against the family photographs.
//
// ── WHY THIS DOES NOT GO THROUGH generateGroupsRender ─────────────────
//
// The generator resolves an effect id against GROUPS_EFFECTS, so a body
// that is not in the live catalog cannot go through it. The alternative was
// to put eleven unapproved bodies into the catalog to test them, which
// would surface them to customers through the registry. So this calls NB2
// directly instead.
//
// The call is copied from callNB2 in lib/v1/groups/groups-generator.ts and
// MAIN_ASPECT is imported from the same module production uses, so the only
// difference between a render here and a customer render is the prompt.
// No scoring, no retries, no outpainting, no pre-flight - one attempt per
// cell, judged by eye.
//
// Prompt assembly matches buildGroupsPrompt exactly:
//     body + avoid + framingClause(subjectCount)
// joined with a single newline. If that ever changes in groups-effects.ts
// this file has to follow it, or the test stops predicting production.
//
// ── USAGE ────────────────────────────────────────────────────────────
//
//   npx tsx scripts/batch-groups-candidates.ts --dry-run
//   npx tsx scripts/batch-groups-candidates.ts
//   npx tsx scripts/batch-groups-candidates.ts --subjects hone_3
//   npx tsx scripts/batch-groups-candidates.ts --only quilted,linocut
//
// Re-running skips cells already on disk, so an interrupted run resumes.

import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

import { CANDIDATES } from './groups-candidates'
import {
  framingClause,
  FRAMING_STOMACH_UP,
  FRAMING_HEAD_TO_TOE,
} from '../lib/v1/groups/groups-effects'
import { MAIN_ASPECT } from '../lib/v1/shared/render-aspect'

// ═════════════════════════════════════════════════════════════════════
// CONFIG
// ═════════════════════════════════════════════════════════════════════

const OUT_ROOT = 'H:\\minramas\\public\\previews'

// Same three as batch-groups-3up.ts, plus the five-person set. Counts are
// hand-counted and authoritative - nothing here detects them, and the count
// picks the framing clause at a threshold of 6.
const SUBJECTS: Array<{ key: string; file: string; subjectCount: number }> = [
  { key: 'hone_3',  file: 'H:\\Download Backup\\hone 3.jpg',                        subjectCount: 8  },
  { key: 'group_2', file: 'H:\\Download Backup\\Miniramas Source\\Group_2_Pose_01.jpg', subjectCount: 5 },
  { key: 'hone_04', file: 'H:\\Download Backup\\Miniramas Source\\Hone 04.jpg',      subjectCount: 17 },
  { key: 'hone_05', file: 'H:\\Download Backup\\Miniramas Source\\Hone 05.jpg',      subjectCount: 19 },
]

// Which subjects run when --subjects is not given. The two big scans are
// break tests and are left out by default - they cost renders and tell us
// about the ceiling rather than about these bodies.
const DEFAULT_SUBJECTS = ['hone_3', 'group_2']

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'
const SYNC_WAIT_SECONDS = 60
const POLL_MAX_ATTEMPTS = 30
const POLL_DELAY_MS     = 2000

// ═════════════════════════════════════════════════════════════════════
// ARGS AND ENV
// ═════════════════════════════════════════════════════════════════════

const argv    = process.argv.slice(2)
const DRY_RUN = argv.includes('--dry-run')

function argValue(flag: string): string | undefined {
  const i = argv.indexOf(flag)
  return i >= 0 && argv[i + 1] ? argv[i + 1] : undefined
}

const ONLY     = argValue('--only')?.split(',').map(s => s.trim()).filter(Boolean)

// ── FRAMING OVERRIDE ─────────────────────────────────────────────────
//
// The framing clause is appended LAST, after the body and after the avoid,
// so it is the later instruction and it wins. At eight people the clause is
// "Framed head to toe, every figure fully in frame" - and eight full-length
// standing figures in stained glass is a cutout, whatever the body says
// about dimensional form.
//
// This isolates framing from headcount without touching a body or moving a
// source photograph:
//
//   --framing stomach   force FRAMING_STOMACH_UP
//   --framing toe       force FRAMING_HEAD_TO_TOE
//   (absent)            whatever the subject count picks, as production
//
// It changes ONLY the appended clause. The body, the avoid and the order
// are identical to a customer render.
const FRAMING = argValue('--framing')
if (FRAMING && !['stomach', 'toe'].includes(FRAMING)) {
  throw new Error(`--framing must be "stomach" or "toe", got "${FRAMING}"`)
}
const SUBJ_ARG = argValue('--subjects')?.split(',').map(s => s.trim()).filter(Boolean)

// tsx does not load .env.local - that is Next.js behaviour. Shell wins.
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
    if (val.length > 1 && (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )) val = val.slice(1, -1)
    if (key && process.env[key] === undefined) process.env[key] = val
  }
}
loadEnvLocal()

const REPLICATE = process.env.REPLICATE_API_TOKEN || ''

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

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Byte-for-byte what buildGroupsPrompt does in groups-effects.ts. */
function buildPrompt(c: { body: string; avoid: string | null }, subjectCount: number): string {
  const parts: string[] = [c.body]
  if (c.avoid) parts.push(c.avoid)
  parts.push(
    FRAMING === 'stomach' ? FRAMING_STOMACH_UP :
    FRAMING === 'toe'     ? FRAMING_HEAD_TO_TOE :
                            framingClause(subjectCount),
  )
  return parts.join('\n')
}

// ═════════════════════════════════════════════════════════════════════
// NB2 - copied from groups-generator.ts callNB2
// ═════════════════════════════════════════════════════════════════════

function pickOutputUrl(output: any): string {
  if (typeof output === 'string') return output
  if (Array.isArray(output) && output.length > 0) return output[0]
  throw new Error('NB2 output URL not found')
}

async function fetchAndEncode(url: string): Promise<string> {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`output fetch failed (${r.status})`)
  return Buffer.from(await r.arrayBuffer()).toString('base64')
}

async function callNB2(prompt: string, sourceB64: string): Promise<string> {
  const res = await fetch(REPLICATE_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${REPLICATE}`,
      'Content-Type':  'application/json',
      'Prefer':        `wait=${SYNC_WAIT_SECONDS}`,
    },
    body: JSON.stringify({
      input: {
        prompt,
        image_input:   [`data:image/jpeg;base64,${sourceB64}`],
        aspect_ratio:  MAIN_ASPECT,
        output_format: 'jpg',
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Replicate POST failed (${res.status}): ${(await res.text()).slice(0, 240)}`)
  }

  const prediction = await res.json()
  if (prediction.status === 'succeeded' && prediction.output) {
    return await fetchAndEncode(pickOutputUrl(prediction.output))
  }

  if (prediction.urls?.get) {
    for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
      await new Promise(r => setTimeout(r, POLL_DELAY_MS))
      const pollRes = await fetch(prediction.urls.get, {
        headers: { 'Authorization': `Token ${REPLICATE}` },
      })
      if (!pollRes.ok) throw new Error(`poll failed (${pollRes.status})`)
      const polled = await pollRes.json()
      if (polled.status === 'succeeded' && polled.output) {
        return await fetchAndEncode(pickOutputUrl(polled.output))
      }
      if (polled.status === 'failed' || polled.status === 'canceled') {
        throw new Error(`prediction ${polled.status}: ${polled.error || ''}`)
      }
    }
  }

  throw new Error(`NB2 timed out - status=${prediction.status}`)
}

// ═════════════════════════════════════════════════════════════════════
// MAIN
// ═════════════════════════════════════════════════════════════════════

async function main() {
  // A forced-framing run goes to its own directory. Overwriting the
  // production-framed render with a variant would destroy the comparison.
  const suffix = FRAMING ? `-${FRAMING}` : ''
  const runDir = path.join(OUT_ROOT, `groups-candidates-${stamp()}${suffix}`)

  const wantSubjects = SUBJ_ARG ?? DEFAULT_SUBJECTS
  const subjects = SUBJECTS.filter(s => wantSubjects.includes(s.key))

  const ids = ONLY ? CANDIDATES.filter(c => ONLY.includes(c.id)) : CANDIDATES
  if (ONLY) {
    const unknown = ONLY.filter(o => !CANDIDATES.some(c => c.id === o))
    if (unknown.length) throw new Error(`unknown candidate(s): ${unknown.join(', ')}`)
  }

  console.log('')
  console.log('=== GROUPS CANDIDATES ===')
  console.log(`  candidates : ${ids.length}`)
  console.log(`  dry run    : ${DRY_RUN ? 'YES - nothing will render' : 'no'}`)
  console.log(`  framing    : ${FRAMING ? FRAMING.toUpperCase() + ' (forced)' : 'by subject count'}`)
  console.log(`  output     : ${runDir}`)
  console.log('')

  if (!DRY_RUN && !REPLICATE) {
    console.error('REPLICATE_API_TOKEN is not set. Nothing to do.')
    process.exit(1)
  }

  const live = subjects.filter(s => {
    if (fs.existsSync(s.file)) return true
    console.warn(`  MISSING source, skipping "${s.key}": ${s.file}`)
    return false
  })
  if (!live.length) {
    console.error('No sources found. Check the CONFIG block.')
    process.exit(1)
  }

  for (const s of live) console.log(`  ${s.key.padEnd(10)} ${s.subjectCount} people   ${ids.length} renders`)
  console.log(`  ${'TOTAL'.padEnd(10)} ${live.length * ids.length} renders`)
  console.log('')

  fs.mkdirSync(runDir, { recursive: true })
  for (const s of live) fs.mkdirSync(path.join(runDir, s.key), { recursive: true })

  // Prompts written BEFORE any render. A render with no recoverable prompt
  // cannot be reasoned about later - the lesson from likeness-arms.
  const lines: string[] = [`GROUPS CANDIDATES - ${stamp()}`, '']
  for (const s of live) {
    for (const c of ids) {
      const p = buildPrompt(c, s.subjectCount)
      lines.push('='.repeat(70))
      lines.push(`${s.key} / ${c.id}   hash=${hash(p)}   ${p.length} chars`)
      lines.push('-'.repeat(70))
      lines.push(p, '')
    }
  }
  fs.writeFileSync(path.join(runDir, 'prompts.txt'), lines.join('\r\n'), 'utf8')
  console.log(`  prompts written: ${path.join(runDir, 'prompts.txt')}`)

  const csvPath = path.join(runDir, 'results.csv')
  if (!fs.existsSync(csvPath)) {
    fs.writeFileSync(csvPath,
      'subject,candidate,subject_count,prompt_hash,prompt_chars,ok,duration_ms,error,file\r\n',
      'utf8')
  }

  if (DRY_RUN) {
    console.log('')
    console.log('DRY RUN complete. Read prompts.txt, then run again without --dry-run.')
    return
  }

  let done = 0, failed = 0, skipped = 0
  const total = live.length * ids.length

  for (const s of live) {
    const b64 = fs.readFileSync(s.file).toString('base64')

    for (const c of ids) {
      const outFile = path.join(runDir, s.key, `${c.id}.jpg`)
      const label   = `${s.key}/${c.id}`

      if (fs.existsSync(outFile)) {
        skipped++
        console.log(`  [skip] ${label}`)
        continue
      }

      const prompt = buildPrompt(c, s.subjectCount)
      const t0 = Date.now()
      process.stdout.write(`  [${done + failed + 1}/${total}] ${label} ... `)

      try {
        const img = await callNB2(prompt, b64)
        fs.writeFileSync(outFile, Buffer.from(img, 'base64'))
        done++
        console.log(`ok  ${((Date.now() - t0) / 1000).toFixed(1)}s`)
        fs.appendFileSync(csvPath, [
          s.key, c.id, s.subjectCount, hash(prompt), prompt.length,
          true, Date.now() - t0, '', outFile,
        ].map(csvCell).join(',') + '\r\n', 'utf8')
      } catch (e: any) {
        failed++
        console.log(`FAILED ${e?.message || e}`)
        fs.appendFileSync(csvPath, [
          s.key, c.id, s.subjectCount, hash(prompt), prompt.length,
          false, Date.now() - t0, e?.message || String(e), '',
        ].map(csvCell).join(',') + '\r\n', 'utf8')
      }
    }
  }

  console.log('')
  console.log('=== DONE ===')
  console.log(`  rendered : ${done}`)
  console.log(`  failed   : ${failed}`)
  if (skipped) console.log(`  skipped  : ${skipped} (already on disk)`)
  console.log(`  images   : ${runDir}`)
  console.log('')
}

main().catch(e => {
  console.error('')
  console.error('FATAL:', e?.message || e)
  process.exit(1)
})
