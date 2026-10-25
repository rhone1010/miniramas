// The Groups ceramic-mug composition experiment (authorized paid NB2.1 test, 2026-10-24). Nothing here touches the live Gift Shop, an order or manufacturing.
//   npx tsx --env-file=<env> scripts/mug-experiment/run.ts [--only count:effect,...]
// Outputs per case under E:/Dev/_recovery-staging/mug-experiment/cases/<count>_<effect>/ ; index in .../index.json

import fs from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { generateMasterInProcess } from '../../lib/v1/gift/real'
import { analyzeSourceSet } from '../../lib/v1/groups/groups-refine'
import { GROUPS_EFFECTS } from '../../lib/v1/groups/groups-effects'
import { BAND, FACES, WRAP, buildBand, curvatureDiagnostic, rawOf, renderMug, toWrap } from './lib'

const ROOT = 'E:/Dev/_recovery-staging/mug-experiment'
// Effects: the three named in the brief, resolved from the authoritative Groups registry (lib/v1/groups/groups-effects.ts; labels as in public/groups-registry.js).
const EFFECTS = [
  { id: 'impressionist', name: 'Impressionism', note: 'registry label "Impressionist" (intake group_photo). "Impressionist Portraits" (impressionist_faces) is a different, multi-photo effect and was not used.' },
  { id: 'mosaic_faces', name: 'Mosaic', note: 'registry label exactly "Mosaic" (intake multi_photo, faces: one portrait panel per person). "Family Mosaic" (family_mosaic) is a different effect and was not used.' },
  { id: 'action_figures', name: 'Action Figures', note: 'registry label "Action Figures" (intake group_photo)' },
] as const
const SOURCES: Record<number, { file: string | null; people: number; note: string }> = {
  1: { file: 'E:/Dev/liten-auth-return-preview-20261005/LitenBench/sources/portrait_2_Blonde_laughing_denim_jacket.jpg', people: 1, note: 'one person (LitenBench source library)' },
  2: { file: null, people: 2, note: 'GAP: no genuine photograph with exactly two people exists in the project source libraries (H:/litenco groups, LitenBench, calibration sources); not fabricated' },
  4: { file: 'H:/litenco groups/October/groups__02.jpg', people: 4, note: 'four people (plus a dog) on porch steps; 506 x 320' },
  6: { file: 'H:/litenco groups/October/source_groups_12.jpeg', people: 6, note: 'six colleagues in an office; 1200 x 896' },
  8: { file: 'H:/litenco groups/October/source_groups_8.jpeg', people: 8, note: 'eight family members in a garden (counted by eye and by the analyzer); 1200 x 896' },
  10: { file: 'H:/litenco groups/October/groups__08.jpg', people: 10, note: 'ten people (plus dogs) on a deck, "Shore house"; 506 x 357, low resolution; the analyzer also counts 10' },
  12: { file: 'H:/litenco groups/October/source_groups_6.jpeg', people: 12, note: 'twelve people on cottage stairs, counted by eye (the analyzer says 11); 1024 x 1024' },
  16: { file: null, people: 16, note: 'GAP: the largest genuine single photograph in the libraries has 14 people (liten_groups__03_03, 384 px wide, retired); no 16-person photograph exists; not fabricated' },
}
// Composition strategy per count. 1..5: two-sided (the SAME composition on the two template faces, background continued between them). 6..16: full wrap (one compact group in the primary face, scenery continued around).
const STRATEGY = (n: number) => (n <= 5 ? 'two_sided' : 'full_wrap') as 'two_sided' | 'full_wrap'
// Groups formats allowed per head count (groupsFormatAllowed): <=3 {9:16,2:3,1:1}; <=9 not 9:16; >=10 {4:3,3:2,16:9}. The view window is about 930 px wide and the band 1034 high (a roughly square window), so 1:1 where allowed, else 4:3.
const FORMAT = (n: number) => (n <= 9 ? '1:1' : '4:3')
/** Measured with the numbered grid through the cylindrical preview renderer (calibration/): each face shows file columns about [centre-465, centre+465] on a linear scale. A panel 880 wide keeps 25 px inside each edge. */
const VIEW_WINDOW = 930, PANEL_W = 880
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex')
const arg = process.argv.indexOf('--only'), only = arg > 0 ? new Set(process.argv[arg + 1].split(',')) : null

async function runCase(n: number, effect: typeof EFFECTS[number]) {
  const dir = `${ROOT}/cases/${String(n).padStart(2, '0')}_${effect.id}`; fs.mkdirSync(dir, { recursive: true })
  const src = SOURCES[n], strategy = STRATEGY(n), format = FORMAT(n)
  const meta: any = { count: n, effect: effect.id, effectName: effect.name, effectNote: effect.note, strategy, format, source: src.file, sourceNote: src.note, startedAt: new Date().toISOString(),
    effectBodySha256: sha(Buffer.from((GROUPS_EFFECTS as any)[effect.id].body)), view: { windowPx: VIEW_WINDOW, panelPx: PANEL_W, frontCentre: FACES.front, backCentre: FACES.back } }
  if (!src.file) { meta.status = 'gap'; fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1)); return meta }
  const bytes = fs.readFileSync(src.file); fs.writeFileSync(`${dir}/source${path.extname(src.file)}`, bytes)
  const jpeg = await sharp(bytes).rotate().jpeg({ quality: 92 }).toBuffer()
  let out: Awaited<ReturnType<typeof generateMasterInProcess>> | null = null; const errors: string[] = []
  const prev = fs.existsSync(`${dir}/meta.json`) ? JSON.parse(fs.readFileSync(`${dir}/meta.json`, 'utf8')) : null
  if (process.argv.includes('--reuse') && prev?.status === 'done' && fs.existsSync(`${dir}/raw-nb21.png`)) { out = { imageB64: fs.readFileSync(`${dir}/raw-nb21.png`).toString('base64'), generation: prev.generation }; meta.reusedRaw = true; meta.technicalFailures = prev.technicalFailures ?? []; errors.push(...(prev.technicalFailures ?? [])); meta.routeAttempts = prev.routeAttempts }
  for (let attempt = 1; attempt <= 3 && !out; attempt++) {                                       // bounded retries for TECHNICAL failures only (a route error), never for aesthetics
    try { out = await generateMasterInProcess({ series: 'groups', sourceB64: jpeg.toString('base64'), effectId: effect.id, aspect: format, userId: 'mug-experiment', peopleCount: n, exactAspect: true }) }
    catch (e: any) { errors.push(String(e?.message ?? e).slice(0, 200)); console.log(`  [${n}/${effect.id}] attempt ${attempt} failed: ${errors.at(-1)}`) }
  }
  if (!meta.reusedRaw) { meta.routeAttempts = errors.length + (out ? 1 : 0); meta.technicalFailures = errors }
  if (!out) { meta.status = 'failed'; fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1)); return meta }
  const raw = Buffer.from(out.imageB64, 'base64'), rm = await sharp(raw).metadata()
  fs.writeFileSync(`${dir}/raw-nb21.png`, await sharp(raw).png().toBuffer())
  meta.raw = { width: rm.width, height: rm.height, sha256: sha(raw) }; meta.generation = out.generation
  // cost: no invoice or Replicate price is available to this codebase; the application's own model (COLLECTION-RECOVERY doc): NB2 5c + score 1c per internal attempt, plus detection/gates/aesthetic about 4c
  const internal = (out.generation as any)?.attempts ?? 1; meta.cost = { basis: 'application cost model, not an invoice', internalAttempts: internal, routeCalls: meta.routeAttempts, estimatedCents: meta.routeAttempts * (4 + 6 * internal) }
  // the wrap
  const centres = strategy === 'two_sided' ? [FACES.front, FACES.back] : [FACES.front]
  const { band, panels } = await buildBand(raw, centres, PANEL_W)
  const wrap = await toWrap(band); fs.writeFileSync(`${dir}/wrap-2670x1110.png`, wrap)
  meta.wrap = { width: WRAP.w, height: WRAP.h, sha256: sha(wrap), panels, margins: { topPx: BAND.y, bottomPx: WRAP.h - BAND.y - BAND.h } }
  // previews from the SAME wrap file
  fs.writeFileSync(`${dir}/preview-front.png`, await renderMug(wrap, FACES.front, `${dir}-front`)); fs.writeFileSync(`${dir}/preview-back.png`, await renderMug(wrap, FACES.back, `${dir}-back`))
  fs.writeFileSync(`${dir}/curvature-front.png`, await curvatureDiagnostic(wrap, FACES.front, `front face (column ${FACES.front}): +-90 degrees, orthographic cylinder, diagnostic only`)); fs.writeFileSync(`${dir}/curvature-back.png`, await curvatureDiagnostic(wrap, FACES.back, `back face (column ${FACES.back}): +-90 degrees, orthographic cylinder, diagnostic only`))
  // checks
  const w = await rawOf(wrap), whiteRow = (y: number) => { let ok = true; for (let x = 0; x < w.w; x += 7) { const i = (y * w.w + x) * 3; if (w.data[i] < 253 || w.data[i + 1] < 253 || w.data[i + 2] < 253) ok = false } return ok }
  const marginsOk = [0, 10, BAND.y - 1, BAND.y + BAND.h, WRAP.h - 10, WRAP.h - 1].every(whiteRow) && !whiteRow(BAND.y + 5)
  let visionCount: number | null = null
  try { const r: any = await analyzeSourceSet({ primaryB64: (await sharp(raw).jpeg({ quality: 90 }).toBuffer()).toString('base64'), openaiApiKey: process.env.OPENAI_API_KEY || '' }); visionCount = r.total_subjects } catch (e: any) { meta.visionError = String(e?.message ?? e).slice(0, 120) }
  meta.checks = { expectedSubjects: src.people, analyzerCountOfRawComposition: visionCount, countMatches: visionCount === src.people, marginsWhite38: marginsOk, singleWrapFileForBothPreviews: true, wrapSha256: meta.wrap.sha256,
    mapping: 'front preview centres file column 2069, back preview 598; both rolled from the one wrap file by the same function', note: 'faces, duplication, curvature and background continuity are reviewed visually (see notes.md)' }
  meta.status = 'done'; meta.finishedAt = new Date().toISOString()
  fs.writeFileSync(`${dir}/meta.json`, JSON.stringify(meta, null, 1))
  console.log(`  [${n}/${effect.id}] done raw=${rm.width}x${rm.height} attempts=${internal} analyzer=${visionCount}/${src.people} margins=${marginsOk}`)
  return meta
}

async function main() {
  fs.mkdirSync(ROOT, { recursive: true })
  const jobs = Object.keys(SOURCES).map(Number).flatMap(n => EFFECTS.map(e => ({ n, e }))).filter(j => !only || only.has(`${j.n}:${j.e.id}`))
  const results: any[] = []; let next = 0
  const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; console.log(`case ${j.n} / ${j.e.id} (${STRATEGY(j.n)}, ${FORMAT(j.n)})`); results.push(await runCase(j.n, j.e).catch(e => ({ count: j.n, effect: j.e.id, status: 'error', error: String(e?.message ?? e) }))) } }
  await Promise.all(Array.from({ length: 3 }, worker))
  results.sort((a, b) => a.count - b.count || String(a.effect).localeCompare(String(b.effect)))
  const prior = fs.existsSync(`${ROOT}/index.json`) ? JSON.parse(fs.readFileSync(`${ROOT}/index.json`, 'utf8')) : []
  const merged = [...prior.filter((p: any) => !results.some(r => r.count === p.count && r.effect === p.effect)), ...results].sort((a, b) => a.count - b.count || String(a.effect).localeCompare(String(b.effect)))
  fs.writeFileSync(`${ROOT}/index.json`, JSON.stringify(merged.map(r => ({ count: r.count, effect: r.effect, status: r.status, strategy: r.strategy, format: r.format, raw: r.raw, cost: r.cost, checks: r.checks, quality: r.generation?.quality, attempts: r.generation?.attempts })), null, 1))
  console.log('DONE', merged.length, 'cases;', merged.filter(r => r.status === 'done').length, 'generated')
}
main()
