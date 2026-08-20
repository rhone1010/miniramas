// scripts/batch-1to1.ts
//
// THE 1:1 SHOOT. 101 renders across four rooms, at square, to H:.
//
//   Groups            28
//   Halloween human   28
//   Halloween pets    27
//   Pets              18
//
// Run:
//   npx tsx --env-file=.env.local scripts/batch-1to1.ts
//   npx tsx --env-file=.env.local scripts/batch-1to1.ts --only groups
//   npx tsx --env-file=.env.local scripts/batch-1to1.ts --dry
//
// ── IT IMPORTS THE ENGINE, IT DOES NOT REIMPLEMENT IT ──────────────────
//
// Every prompt below comes from the same builder the live route calls.
// Nothing here restates a body, a framing clause or an assembly order.
//
// This is not tidiness. The dinner-jacket error came from a manifest that
// assigned male bodies to female sources because the script skipped
// resolvePresetForSubject — a reimplementation that had drifted from the
// engine without anybody noticing. A script that imports cannot drift.
//
// ── THE MANIFEST CARRIES FULL PROMPT TEXT ──────────────────────────────
//
// shoot-review.js reads j.prompt. A manifest of effect ids alone sends
// `undefined` to NB2 once per row. This has bitten before; every row here
// carries the assembled string.
//
// ── THE HALLOWEEN PHONE CLAUSE IS STRIPPED ─────────────────────────────
//
// All 55 Halloween bodies were written for 9:16 and say so — "Keep subject
// in lower 2/3 of image to allow for phone UI elements" in the human room,
// "Exclude the subject from the upper 1/3. This is a mobile wallpaper" in
// the pet room.
//
// At 1:1 that leaves a third of a square deliberately empty, which reads
// as a mistake rather than as composition.
//
// STRIPPED HERE, NOT IN THE BODIES. The bodies are locked and this is a
// test, so nothing on disk changes until Rich has seen the renders. If the
// square holds, the strip becomes a real edit to those files; if it does
// not, nothing was lost.
//
// Known risk, stated in advance: the top-third content in those bodies —
// antlers breaking the moon, bare branches, swarming moths — was written
// to fill a tall empty band that does not exist at 1:1. Those effects may
// need more than a strip.
//
// ── NOTHING LANDS IN public/previews ───────────────────────────────────
//
// Everything goes to H:. A test render that writes into the live preview
// folder is a plate before anybody has looked at it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, basename } from 'path'

import { GROUPS_EFFECTS, buildGroupsPrompt } from '../lib/v1/groups/groups-effects'
import { HALLOWEEN_WALLPAPERS } from '../lib/v1/wallpapers/wallpapers-halloween'
import { PETS_HALLOWEEN_WALLPAPERS } from '../lib/v1/wallpapers/wallpapers-pets-halloween'
import { buildPetsPrompt } from '../lib/v1/pets/pets-prompt'
import { buildPetExperimentalPrompt } from '../lib/v1/pets/pets-experimental'

// ─── CONFIG ─────────────────────────────────────────────────────

const ASPECT   = '1:1'
const OUT_ROOT = 'H:\\minramas\\public\\previews'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000
const CONCURRENCY = 3      // Replicate tolerates more; this keeps the log readable

// ─── SOURCES ────────────────────────────────────────────────────
//
// Labelled by Rich, 20 August, from the folder thumbnails. The human
// Halloween room is gendered pairs, and a script that guesses the sex of a
// source is the dinner-jacket error waiting to happen again — so it is
// stated here rather than inferred from a filename.

const NEW = 'H:\\Liten Co New Source Images\\'
const OLD = 'C:\\Users\\richh\\Downloads\\Liten Source\\'

const MEN = [
  NEW + 'Source__0000_Layer-2.png',
  NEW + 'Source__0001_Layer-3.png',
  NEW + 'Source__0002_Layer-4.png',
  NEW + 'Source__0003_Layer-5.png',
  NEW + 'Source__0004_Layer-6.png',
  OLD + '3af63815-0126-4cbd-832a-d560d5fb0b95.png',
  OLD + 'f232f6c9-075d-4511-9824-3ac0d79f96b7.png',
  OLD + 'ad683f33-da28-450d-a8a2-50a6239da727.png',
  OLD + 'P_59.jpg',
  OLD + '8586761e-c5f0-4f80-b37d-a9559a6ff72f.jpg',
  OLD + 'Screenshot 2026-07-30 180854.jpg',
  OLD + 'Screenshot 2026-07-30 151052.jpg',
  OLD + 'Screenshot 2026-07-29 224549.jpg',
  OLD + 'Screenshot 2026-07-29 195239.jpg',
  OLD + 'Screenshot 2026-07-29 193559.jpg',
  OLD + 'Screenshot 2026-07-29 185041.jpg',
]

const WOMEN = [
  NEW + 'Source__0005_Layer-7.png',
  NEW + 'Source__0006_Layer-8.png',
  NEW + 'Source__0007_Layer-9.png',
  NEW + 'Source__0008_Layer-10.png',
  NEW + 'Source__0009_Layer-11.png',
  OLD + 'bbf51db2-b1a6-43ac-b6d7-895b1552b259.png',
  OLD + '1231dasd.jpg',
  OLD + 'Source1a.jpg',
  OLD + 'tmpx0raj313.jpeg',
  OLD + 'Screenshot 2026-07-30 181047.jpg',
  OLD + 'Screenshot 2026-07-29 195854.jpg',
  OLD + 'Screenshot 2026-07-29 194726.jpg',
  OLD + 'Screenshot 2026-07-29 194002.jpg',
  OLD + 'Screenshot 2026-07-29 174546.jpg',
  OLD + 'Screenshot 2026-07-29 173451.jpg',
]

const GROUPS_DIR = 'H:\\litenco groups\\images\\'
const GROUPS = [
  '01_02','01_03','01_04','01_05','02_01','02_02','02_03','02_04',
  '03_03','03_04','03_05','04_01','04_02','04_03','04_04',
].map(s => `${GROUPS_DIR}liten_groups__${s}.jpg`)

const PETS_DIR = 'H:\\litenco_pets\\images\\'
const PETS = [
  'pets2_04.png','pets2_05.png','pets2_06.png','pets2_07.png','pets2_08.jpg',
  'Pets_01_01.png','Pets_01_02.png','Pets_01_03.png','Pets_01_04.png',
  'Pets_02_01.png','Pets_02_02.png','Pets_02_03.png','Pets_02_04.png',
  'Pets_03_01.png','Pets_03_02.png','Pets_03_03.png','Pets_03_04.png',
  'Pets_04_01.png','Pets_04_02.png','Pets_04_03.png','Pets_04_04.png',
  'Pets_05_01.png','Pets_05_02.png','Pets_05_03.png','Pets_05_04.png',
].map(s => PETS_DIR + s)

/** Rich cut these on 2 August and again on 20 August. On disk, out of the
 *  shoot. daguerreotype stays — he named two of the three. */
const PETS_EXPERIMENTAL_CUT = new Set(['amber_inclusion', 'film_noir'])

const PETS_MATERIALS = [
  'bronze','alabaster','mixed_metals','ceramic','plushy','stone','walnut',
] as const

const PETS_EXPERIMENTAL = [
  'garden_statue','blown_glass','enchanted_crystal','topiary','regal',
  'elizabethan_ruff','sailor','ukiyo_e','art_nouveau','cubism','daguerreotype',
] as const

// ─── THE PHONE CLAUSE ───────────────────────────────────────────
//
// Every sentence in the Halloween bodies that exists only because a phone
// has a clock at the top and icons at the bottom. Matched as whole
// sentences so nothing else in the body is disturbed.
//
// Reported per body: if a strip removes nothing, that body says it some
// other way and needs looking at by eye rather than by regex.

const PHONE_PATTERNS: RegExp[] = [
  /\s*Keep subject in lower 2\/3 of image to allow for phone UI elements\.?/gi,
  /\s*Exclude the subject from the upper 1\/3 of the image\.?/gi,
  /\s*This is a mobile wallpaper\.?/gi,
  /\s*Do not include phone elements\.?/gi,
]

function stripPhone(body: string): { text: string; hits: number } {
  let hits = 0
  let text = body
  for (const p of PHONE_PATTERNS) {
    const before = text
    text = text.replace(p, '')
    if (text !== before) hits++
  }
  return { text: text.replace(/\n{3,}/g, '\n\n').trim(), hits }
}

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  room:     string
  effect:   string
  label:    string
  prompt:   string
  sources:  string[]
  out:      string
  /** Recorded so a body that says its framing some other way is visible in
   *  the manifest rather than discovered in a render. */
  strip_hits?: number
}

function rows(): Row[] {
  const out: Row[] = []
  let mi = 0, wi = 0, gi = 0, pi = 0

  // ── GROUPS ──
  //
  // buildGroupsPrompt appends the runtime framing clause from the subject
  // count. Five is the count the source set actually holds; the composites
  // take the same group shot, which Rich confirmed works.
  for (const id of Object.keys(GROUPS_EFFECTS)) {
    const fx = GROUPS_EFFECTS[id]
    out.push({
      room:    'groups',
      effect:  id,
      label:   fx.label,
      prompt:  buildGroupsPrompt({ effectId: id as any, subjectCount: 5 }),
      sources: [GROUPS[gi++ % GROUPS.length]],
      out:     join(OUT_ROOT, 'groups-1to1', `groups_${id}.jpg`),
    })
  }

  // ── HALLOWEEN, HUMAN ──
  //
  // Alternating man and woman so both are exercised across the room. The
  // bodies are not gendered — the PLATES are — so this is about coverage
  // rather than correctness.
  for (const id of Object.keys(HALLOWEEN_WALLPAPERS)) {
    const fx = HALLOWEEN_WALLPAPERS[id]
    const { text, hits } = stripPhone(fx.body + (fx.avoid ? '\n' + fx.avoid : ''))
    const male = out.filter(r => r.room === 'halloween').length % 2 === 0
    out.push({
      room:       'halloween',
      effect:     id,
      label:      fx.label,
      prompt:     text,
      sources:    [male ? MEN[mi++ % MEN.length] : WOMEN[wi++ % WOMEN.length]],
      out:        join(OUT_ROOT, 'halloween-1to1', `${male ? 'man' : 'woman'}_${id}.jpg`),
      strip_hits: hits,
    })
  }

  // ── HALLOWEEN, PETS ──
  for (const id of Object.keys(PETS_HALLOWEEN_WALLPAPERS)) {
    const fx = PETS_HALLOWEEN_WALLPAPERS[id]
    const { text, hits } = stripPhone(fx.body + (fx.avoid ? '\n' + fx.avoid : ''))
    out.push({
      room:       'halloween-pets',
      effect:     id,
      label:      fx.label,
      prompt:     text,
      sources:    [PETS[pi++ % PETS.length]],
      out:        join(OUT_ROOT, 'halloween-pets-1to1', `${id.replace(/^pethw_/, '')}.jpg`),
      strip_hits: hits,
    })
  }

  // ── PETS ──
  //
  // No strip: the Pets bodies carry no aspect language at all. Framing is
  // "full body nose to tail, no animal cropped", which a square suits.
  for (const id of PETS_MATERIALS) {
    out.push({
      room:    'pets',
      effect:  id,
      label:   id,
      prompt:  buildPetsPrompt({
        presetId:      id as any,
        environmentId: 'gallery',
        scale:         'close_up',
        plaqueText:    null,
        subjectCount:  1,
      }),
      sources: [PETS[pi++ % PETS.length]],
      out:     join(OUT_ROOT, 'pets-1to1', `pets_${id}.jpg`),
    })
  }

  for (const id of PETS_EXPERIMENTAL) {
    if (PETS_EXPERIMENTAL_CUT.has(id)) continue
    out.push({
      room:    'pets',
      effect:  id,
      label:   id,
      prompt:  buildPetExperimentalPrompt({ effectId: id as any, count: 1 }),
      sources: [PETS[pi++ % PETS.length]],
      out:     join(OUT_ROOT, 'pets-1to1', `pets_${id}.jpg`),
    })
  }

  return out
}

// ─── NB2 ────────────────────────────────────────────────────────

async function callNB2(prompt: string, sources: string[], token: string): Promise<Buffer> {
  const images = sources.map(p => {
    const b64 = readFileSync(p).toString('base64')
    const ext = p.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
    return `data:image/${ext};base64,${b64}`
  })

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
        image_input:   images,
        aspect_ratio:  ASPECT,
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

// ─── RUN ────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const dry  = args.includes('--dry')
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

  const token = process.env.REPLICATE_API_TOKEN
  if (!token && !dry) throw new Error('REPLICATE_API_TOKEN not set')

  let all = rows()
  if (only) all = all.filter(r => r.room === only)

  // Every source must exist before anything renders. A run that produces
  // sixty images and then stops on a missing file has spent sixty renders
  // to find out something a loop could have said in a second.
  const missing = [...new Set(all.flatMap(r => r.sources))].filter(p => !existsSync(p))
  if (missing.length) {
    console.error(`\nMISSING SOURCES (${missing.length}):`)
    for (const m of missing) console.error('  ' + m)
    process.exit(1)
  }

  for (const dir of new Set(all.map(r => join(r.out, '..')))) {
    mkdirSync(dir, { recursive: true })
  }

  // The manifest carries FULL PROMPT TEXT per row. shoot-review.js reads
  // j.prompt; a manifest of ids sends undefined to NB2 once per row.
  const manifestPath = join(OUT_ROOT, `manifest-1to1-${Date.now()}.json`)
  writeFileSync(manifestPath, JSON.stringify(all, null, 2))
  console.log(`manifest -> ${manifestPath}`)

  // Bodies whose phone clause did not match anything say it some other way.
  const unstripped = all.filter(r => r.strip_hits === 0)
  if (unstripped.length) {
    console.warn(`\n${unstripped.length} Halloween bodies had NOTHING stripped — check by eye:`)
    for (const r of unstripped) console.warn(`  ${r.room}/${r.effect}`)
    console.warn('')
  }

  console.log(`${all.length} rows at ${ASPECT}`)
  for (const room of new Set(all.map(r => r.room))) {
    console.log(`  ${room.padEnd(16)} ${all.filter(r => r.room === room).length}`)
  }

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    return
  }

  let done = 0, failed = 0
  const queue = [...all]

  async function worker(n: number) {
    while (queue.length) {
      const row = queue.shift()!
      const tag = `${row.room}/${row.effect}`
      try {
        const buf = await callNB2(row.prompt, row.sources, token!)
        writeFileSync(row.out, buf)
        done++
        console.log(`[${done + failed}/${all.length}] ok   ${tag} -> ${basename(row.out)}`)
      } catch (e: any) {
        failed++
        console.error(`[${done + failed}/${all.length}] FAIL ${tag}: ${e.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, (_, i) => worker(i)))

  console.log(`\n${done} rendered, ${failed} failed. -> ${OUT_ROOT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
