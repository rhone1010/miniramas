// lib/v1/print/upscale/calibration/run-upscale-calibration.ts
//
// Calibration harness for the print upscale stage. OFFLINE TOOL, not part of the app.
//
// It runs the SAME resumable job processor the shop uses (process.ts), with in-memory job and file stores,
// so what is measured is the production logic: composition, target megapixels, the provider call, output
// validation, the exact print file, the deterministic checks, and the OpenAI inspection. Enhancement settings
// are compared side by side on 20 representative images.
//
// DEFAULT IS A DRY RUN: no network, no cost. It selects the images, prints the plan and the cost estimate,
// and writes the gallery shell. A paid run needs BOTH --live and --yes-paid, the provider's key in the
// environment (REPLICATE_API_TOKEN, or PRUNA_API_KEY with --provider pruna) and OPENAI_API_KEY, and is refused
// when the worst-case estimate is not under --max-cost (default $5).
//
// Each finished run is appended to runs.jsonl; --resume <folder> skips them and repeats only what is missing.
// Keys are read from the environment and never printed or written. Output stays under the calibration folder.
//
//   npx tsx --env-file=.env.local lib/v1/print/upscale/calibration/run-upscale-calibration.ts \
//        [--dir "E:\print upscale calibration"] [--provider replicate|pruna] [--configs off,details,realism]
//        [--native-mp 1.5] [--include-xl] [--set cases.json] [--live --yes-paid] [--resume <folder>] [--max-cost 5]

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { DEFAULT_SETTINGS, type UpscaleSettings } from '../settings'
import { makeProvider } from '../providers'
import { inspectUpscale } from '../qa'
import { collect, execute } from './harness'
import { CONFIGS, DEFAULT_CONFIGS, buildPlan, estimateTotals, renderGallery, selectCases, toCsv, type Candidate, type CaseSpec, type RunRecord } from './calibration-lib'
import { printPlan } from '../../geometry'
import { getLaunchSku } from '../../sku-map'

const arg = (n: string, d?: string) => { const i = process.argv.indexOf('--' + n); return i > -1 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? 'true' : process.argv[i + 1]) : d }
const DIR = arg('dir', 'E:\\print upscale calibration')!
const BATCH_LOG = arg('log', 'E:\\Nb2.1 Output\\nb21_manifest_log.csv')!
const PROVIDER = (arg('provider', 'replicate') === 'pruna' ? 'pruna' : 'replicate') as 'replicate' | 'pruna'
const CONFIG_NAMES = (arg('configs', DEFAULT_CONFIGS.join(','))!).split(',').map(s => s.trim()).filter(c => c in CONFIGS)
const NATIVE_MP = Number(arg('native-mp', '1.5')) || 1.5
const LIVE = process.argv.includes('--live') && process.argv.includes('--yes-paid')
const MAX_COST = Number(arg('max-cost', '5'))
const RESUME = arg('resume')

function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []; let cur: string[] = [], f = '', q = false
  const t = text.replace(/^\uFEFF/, '')
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true
    else if (c === ',') { cur.push(f); f = '' }
    else if (c === '\n') { cur.push(f.replace(/\r$/, '')); rows.push(cur); cur = []; f = '' }
    else f += c
  }
  if (f || cur.length) { cur.push(f.replace(/\r$/, '')); rows.push(cur) }
  const [h, ...rest] = rows.filter(r => r.some(x => x.trim()))
  return rest.map(r => Object.fromEntries(h.map((k, i) => [k.trim(), r[i] ?? ''])))
}

function loadPool(): Candidate[] {
  if (!fs.existsSync(BATCH_LOG)) throw new Error('Batch log not found (needed to choose images): ' + BATCH_LOG + '. Use --set to supply cases.')
  return parseCsv(fs.readFileSync(BATCH_LOG, 'utf8'))
    .filter(r => r.status === 'succeeded' && fs.existsSync(r.output) && ['portraits', 'pets', 'groups'].includes(r.category))
    .map(r => ({ series: r.category as Candidate['series'], effect: r.effect, path: r.output, ratio: r.ratio }))
}

async function main() {
  fs.mkdirSync(DIR, { recursive: true })
  const cases: CaseSpec[] = arg('set') ? JSON.parse(fs.readFileSync(arg('set')!, 'utf8')) : selectCases(loadPool(), { nativeMp: NATIVE_MP, includeXl: process.argv.includes('--include-xl') })
  if (!CONFIG_NAMES.length) throw new Error('No valid configurations. Choose from: ' + Object.keys(CONFIGS).join(', '))
  const base: UpscaleSettings = { ...DEFAULT_SETTINGS, provider: PROVIDER }
  const { rows, skipped } = buildPlan(cases, CONFIG_NAMES, base)
  const est = estimateTotals(rows)
  console.log(`Cases: ${cases.length} (${['portraits', 'groups', 'pets'].map(s => s + ' ' + cases.filter(c => c.series === s).length).join(', ')})  configurations: ${CONFIG_NAMES.join(', ')}  provider: ${PROVIDER}`)
  console.log(`Planned runs: ${rows.length}${skipped.length ? `  (skipped ${skipped.length}: ${skipped.map(s => s.caseId + ' ' + s.reason).join('; ')})` : ''}`)
  console.log(`Cost estimate: upscale $${est.upscaleUsd.toFixed(2)} + inspection $${est.qaUsd.toFixed(2)} = $${est.expectedUsd.toFixed(2)} expected, $${est.worstUsd.toFixed(2)} worst case. Limit $${MAX_COST}. Replicate's own rate for this model is unverified; the estimate uses Pruna's published tiers.`)
  console.log(`Mode: ${LIVE ? 'LIVE (paid)' : 'DRY RUN (no network, no cost)'}`)

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const out = RESUME ? path.resolve(RESUME) : path.join(DIR, 'results', `run-${stamp}-${LIVE ? 'live' : 'dryrun'}`)
  if (!RESUME) { if (fs.existsSync(out)) throw new Error('Refusing to reuse an existing results folder: ' + out); fs.mkdirSync(out, { recursive: true }) }
  else if (!fs.existsSync(out) || !path.resolve(out).startsWith(path.resolve(DIR))) throw new Error('--resume must name an existing folder under ' + DIR)

  const runsPath = path.join(out, 'runs.jsonl')
  const done = new Map<string, RunRecord>()
  if (fs.existsSync(runsPath)) for (const l of fs.readFileSync(runsPath, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l) as RunRecord; if (r.status !== 'api_error') done.set(r.caseId + '|' + r.config, r) }
  if (done.size) console.log(`Resuming: ${done.size} runs already recorded; they will not be repeated.`)

  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ cases, configs: CONFIG_NAMES, provider: PROVIDER, nativeMp: NATIVE_MP, estimate: est, skipped }, null, 1))

  if (LIVE) {
    if (!(est.worstUsd < MAX_COST)) throw new Error(`Refusing to run live: worst-case estimate $${est.worstUsd.toFixed(2)} is not under $${MAX_COST}.`)
    if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not set')
    if (PROVIDER === 'replicate' && !process.env.REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN is not set')
    if (PROVIDER === 'pruna' && !process.env.PRUNA_API_KEY) throw new Error('PRUNA_API_KEY is not set')
    await execute({
      providerName: PROVIDER, configNames: CONFIG_NAMES, makeProvider: () => makeProvider(PROVIDER),
      inspect: (input, meter) => inspectUpscale(input, { fetchImpl: async (u, init) => { const res = await fetch(u, init); try { const j: any = await res.clone().json(); meter.add(j?.usage?.prompt_tokens ?? 0, j?.usage?.completion_tokens ?? 0) } catch { /* not JSON */ } return res } }),
    }, cases, out, runsPath, done)
  }

  // ── results and gallery (also for a dry run: every row says "not run") ──
  const records = collect(cases, CONFIG_NAMES, done)
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(records, null, 1))
  fs.writeFileSync(path.join(out, 'results.csv'), toCsv(records.map(r => ({ ...r, params: JSON.stringify(r.params), warnings: r.warnings.map(w => w.code).join(';'), qaDefects: r.qaDefects.map(d => d.code).join(';'), files: '' })) as any,
    ['caseId', 'series', 'effect', 'size', 'finish', 'config', 'provider', 'predictionId', 'targetMp', 'sourcePpi', 'upscaleMs', 'wallMs', 'costUsdEst', 'qaCostUsd', 'status', 'qaVerdict', 'reviewReason', 'warnings', 'qaDefects', 'error', 'params']))
  fs.writeFileSync(path.join(out, 'review-gallery.html'), renderGallery(records, { title: 'Print upscale calibration', mode: LIVE || RESUME ? 'live' : 'dry-run', generated: path.basename(out), provider: PROVIDER }))
  const measured = records.reduce((s, r) => s + (r.costUsdEst ?? 0) + (r.qaCostUsd ?? 0), 0)
  fs.writeFileSync(path.join(out, 'api-usage-report.md'), `# Upscale calibration usage\n\nRun: ${path.basename(out)} (${LIVE || RESUME ? 'live' : 'dry run'})\nProvider: ${PROVIDER}\nRuns recorded: ${records.filter(r => r.status !== 'not_run').length} of ${records.length}\nEstimated upscale cost (published tiers; the provider reports no price): $${records.reduce((s, r) => s + (r.costUsdEst ?? 0), 0).toFixed(3)}\nMeasured inspection cost (OpenAI token usage): $${records.reduce((s, r) => s + (r.qaCostUsd ?? 0), 0).toFixed(3)}\nTotal: $${measured.toFixed(3)} (planned expected $${est.expectedUsd.toFixed(2)}, worst case $${est.worstUsd.toFixed(2)})\n\nCompare with your Replicate and OpenAI billing: the upscale figure is an estimate, not an invoice.\n`)
  console.log('Wrote', out)
}


main().catch(e => { console.error('FAILED:', e.message); process.exit(1) })
