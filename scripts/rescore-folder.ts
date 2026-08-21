// scripts/rescore-folder.ts
//
// SCORE EXISTING RENDERS WITH BOTH SCORERS, SIDE BY SIDE.
//
// Renders nothing. Reads images already on disk and asks v1 and v2 what
// they are worth, so the two can be compared against renders that have
// already been judged by eye.
//
//   npx tsx --env-file=.env.local scripts/rescore-folder.ts <folder>
//   npx tsx --env-file=.env.local scripts/rescore-folder.ts <folder> --source "H:\...\rich_1.jpg"
//   npx tsx --env-file=.env.local scripts/rescore-folder.ts <folder> --v2-only
//
// ── THE TEST THAT MATTERS ──────────────────────────────────────────────
//
// Two folders from 21 August:
//
//   H:\minramas\public\previews\likeness-arms\one       beard REMOVED
//   H:\minramas\public\previews\prompt-tests\victorian-likeness-test   beard KEPT
//
// v1 gave every image in both 8/10. A working scorer must separate them.
// If v2 scores the first group materially lower than the second, it is
// seeing the thing that was actually wrong. If it does not, v2 is no better
// and should not replace anything.
//
// THAT IS THE ONLY REASON THIS SCRIPT EXISTS. It is a measuring tool for a
// scorer, not a quality gate and not part of any pipeline.
//
// ── IT CHANGES NOTHING ─────────────────────────────────────────────────
//
// No renders, no writes into the repo, no edit to the live route. The
// route still calls v1. Swapping it is a separate deliberate change and
// should not happen until these numbers have been looked at.

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { join, basename, extname } from 'path'

import {
  scoreSingleFaceFidelity,
  scoreSingleFaceLikeness,
} from '../lib/v1/portraits/portraits-refine'

const DEFAULT_SOURCE = 'H:\\Download Backup\\rich_1.jpg'
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp'])

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

async function main() {
  const args   = process.argv.slice(2)
  const folder = args.find(a => !a.startsWith('--'))
  if (!folder) throw new Error('usage: rescore-folder.ts <folder> [--source <path>] [--v2-only]')
  if (!existsSync(folder)) throw new Error(`folder not found: ${folder}`)

  const source = args.includes('--source')
    ? args[args.indexOf('--source') + 1]
    : DEFAULT_SOURCE
  if (!existsSync(source)) throw new Error(`source not found: ${source}`)

  const v2Only = args.includes('--v2-only')

  const openaiApiKey = process.env.OPENAI_API_KEY
  if (!openaiApiKey) throw new Error('OPENAI_API_KEY not set')

  const files = readdirSync(folder)
    .filter(n => IMAGE_EXT.has(extname(n).toLowerCase()))
    .sort()
  if (!files.length) throw new Error(`no images in ${folder}`)

  const sourceB64 = readFileSync(source).toString('base64')

  console.log(`${files.length} image(s) in ${folder}`)
  console.log(`  source ${source}`)
  console.log(`  ${v2Only ? 'v2 only' : 'v1 and v2'}\n`)

  const rows: Record<string, unknown>[] = []

  for (const name of files) {
    const renderedB64 = readFileSync(join(folder, name)).toString('base64')

    let v1score: number | null = null
    if (!v2Only) {
      try {
        const v1 = await scoreSingleFaceFidelity({
          sourceImageB64: sourceB64, renderedImageB64: renderedB64, openaiApiKey,
        })
        v1score = v1.score
      } catch (e: any) {
        console.error(`  v1 failed on ${name}: ${e.message}`)
      }
    }

    try {
      const v2 = await scoreSingleFaceLikeness({
        sourceImageB64: sourceB64, renderedImageB64: renderedB64, openaiApiKey,
      })
      const t = v2.traits
      rows.push({
        file: name,
        v1: v1score, v2: v2.score,
        beard: t.beard, hairline: t.hairline, face_shape: t.face_shape,
        eyes: t.eyes, nose: t.nose, mouth: t.mouth, age: t.age,
        recognizable: t.recognizable,
        deductions: v2.deductions.join('; '),
        note: t.note,
      })
      console.log(
        `  ${basename(name).padEnd(34)} ` +
        (v2Only ? '' : `v1=${v1score ?? '--'} `) +
        `v2=${String(v2.score).padStart(2)}  ` +
        `beard=${t.beard} hairline=${t.hairline} shape=${t.face_shape}`,
      )
    } catch (e: any) {
      console.error(`  v2 failed on ${name}: ${e.message}`)
    }
  }

  if (!rows.length) { console.log('\nnothing scored'); return }

  const head = Object.keys(rows[0])
  const csv  = [head.join(',')]
    .concat(rows.map(r => head.map(h => csvCell(r[h])).join(',')))
    .join('\n')
  const out = join(folder, `rescore-${Date.now()}.csv`)
  writeFileSync(out, csv)

  const mean = (k: 'v1' | 'v2') => {
    const ns = rows.map(r => r[k]).filter((n): n is number => typeof n === 'number')
    return ns.length ? (ns.reduce((a, b) => a + b, 0) / ns.length).toFixed(2) : '--'
  }
  const spread = (k: 'v1' | 'v2') => {
    const ns = rows.map(r => r[k]).filter((n): n is number => typeof n === 'number')
    return ns.length ? `${Math.min(...ns)}-${Math.max(...ns)}` : '--'
  }

  console.log('\n─── SUMMARY ───')
  if (!v2Only) console.log(`  v1  mean=${mean('v1')}  range=${spread('v1')}`)
  console.log(`  v2  mean=${mean('v2')}  range=${spread('v2')}`)
  // A scorer that returns one value for everything is not scoring. The
  // range is the number to look at first, before the mean.
  console.log(`\ncsv  ${out}`)
}

main().catch(e => { console.error(e); process.exit(1) })
