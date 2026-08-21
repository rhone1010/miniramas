// scripts/batch-pets-wallpapers.ts
//
// PETS WALLPAPERS. The same thirty-four at 9:16, to H:.
//
// Bodies come from wallpapers-pets.ts, which is pets-catalog-35 with the
// composition paragraph swapped. Nothing here restates a body.
//
// Rich's list of 20 August. Thirty-two ported from Portraits, alabaster
// rebuilt from the fragment in pets-prompt.ts, clown written new. What the
// port changed and why is documented in lib/v1/pets/pets-catalog-35.ts.
//
//   npx tsx --env-file=.env.local scripts/batch-pets-wallpapers.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-pets-wallpapers.ts
//   npx tsx --env-file=.env.local scripts/batch-pets-wallpapers.ts --only clown
//   npx tsx --env-file=.env.local scripts/batch-pets-wallpapers.ts --only bronze,iron,ebony
//
// --only takes a comma-separated list, because a redo is almost never one
// effect. It is a list of ids and refuses on anything it does not know,
// rather than quietly rendering nothing.
//
// ── SIBLING OF batch-1to1.ts, DELIBERATELY SEPARATE ────────────────────
//
// Different catalog, different output root, and a room being BUILT rather
// than a format being tested. Folding it into the other script would mean
// one --only flag standing for two different kinds of work.
//
// ── IT IMPORTS THE CATALOG ─────────────────────────────────────────────
//
// Nothing here restates a body. The dinner-jacket error came from a
// manifest that had drifted from the engine without anybody noticing; a
// script that imports cannot drift.
//
// ── THE MANIFEST CARRIES FULL PROMPT TEXT ──────────────────────────────
//
// shoot-review.js reads j.prompt. A manifest of ids alone sends `undefined`
// to NB2 once per row. This has bitten before.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join, basename } from 'path'

import { PETS_WALLPAPERS as PETS_35, PETS_WALLPAPER_IDS as PETS_35_IDS } from '../lib/v1/wallpapers/wallpapers-pets'

// ─── CONFIG ─────────────────────────────────────────────────────

const ASPECT = '9:16'

// A subdirectory of the existing Pets previews on H:, per Rich. Nothing
// lands in D:\minramas\public\previews - these are candidates, not plates,
// until they have been looked at.
const OUT_ROOT = 'H:\\minramas\\public\\previews\\wallpapers\\pets'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// Sixty is Replicate's ceiling on Prefer: wait. Ninety returns a 422 on
// every row, which is how the first 1:1 batch failed eighteen times.
const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000
const CONCURRENCY = 3

// ─── SOURCES ────────────────────────────────────────────────────

const PETS_DIR = 'H:\\litenco_pets\\images\\'

const PETS = [
  'pets2_04.png', 'pets2_05.png', 'pets2_06.png', 'pets2_07.png', 'pets2_08.jpg',
  'Pets_01_01.png', 'Pets_01_02.png', 'Pets_01_03.png', 'Pets_01_04.png',
  'Pets_02_01.png', 'Pets_02_02.png', 'Pets_02_03.png', 'Pets_02_04.png',
  'Pets_03_01.png', 'Pets_03_02.png', 'Pets_03_03.png', 'Pets_03_04.png',
  'Pets_04_01.png', 'Pets_04_02.png', 'Pets_04_03.png', 'Pets_04_04.png',
  'Pets_05_01.png', 'Pets_05_02.png', 'Pets_05_03.png', 'Pets_05_04.png',
].map(s => PETS_DIR + s)

// ─── ROWS ───────────────────────────────────────────────────────

interface Row {
  effect:  string
  label:   string
  prompt:  string
  source:  string
  out:     string
}

function rows(): Row[] {
  return PETS_35_IDS.map((id, i) => {
    const fx = PETS_35[id]
    return {
      effect: id,
      label:  fx.label,
      // Body then avoid. No framing appended - these bodies carry their own
      // while they are being shot, so any one of them can be pasted into a
      // browser and tested alone.
      prompt: fx.body + (fx.avoid ? '\n' + fx.avoid : ''),
      // Cycled across the twenty-five sources, so the room is not
      // thirty-four pictures of the same golden retriever.
      source: PETS[i % PETS.length],
      out:    join(OUT_ROOT, `pets_${id}.jpg`),
    }
  })
}

// ─── NB2 ────────────────────────────────────────────────────────

async function callNB2(prompt: string, source: string, token: string): Promise<Buffer> {
  const b64 = readFileSync(source).toString('base64')
  const ext = source.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'

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
        image_input:   [`data:image/${ext};base64,${b64}`],
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
  if (only) {
    const want = only.split(',').map(s => s.trim()).filter(Boolean)
    const unknown = want.filter(w => !PETS_35_IDS.includes(w))
    if (unknown.length) {
      throw new Error(`unknown effect id(s): ${unknown.join(', ')}`)
    }
    all = all.filter(r => want.includes(r.effect))
  }
  if (!all.length) throw new Error('nothing to render')

  // Every source checked before the first render. A run that produces
  // thirty images and then stops on a missing file has spent thirty renders
  // to find out something a loop could have said in a second.
  const missing = [...new Set(all.map(r => r.source))].filter(p => !existsSync(p))
  if (missing.length) {
    console.error(`\nMISSING SOURCES (${missing.length}):`)
    for (const m of missing) console.error('  ' + m)
    process.exit(1)
  }

  mkdirSync(OUT_ROOT, { recursive: true })

  // Existing renders are NOT overwritten silently on a redo - the old one
  // goes to a dated sibling first, so a redo that turns out worse than the
  // original is recoverable.
  for (const r of all) {
    if (existsSync(r.out)) {
      const keep = join(OUT_ROOT, 'superseded')
      mkdirSync(keep, { recursive: true })
      let n = 1
      while (existsSync(join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))) n++
      renameSync(r.out, join(keep, `${basename(r.out, '.jpg')}_${String(n).padStart(3, '0')}.jpg`))
      console.log(`  kept  ${basename(r.out)} -> superseded/`)
    }
  }

  const manifestPath = join(OUT_ROOT, `manifest-pets-wallpapers-${Date.now()}.json`)
  writeFileSync(manifestPath, JSON.stringify(all, null, 2))

  console.log(`${all.length} pet effects at ${ASPECT}`)
  console.log(`  out       ${OUT_ROOT}`)
  console.log(`  manifest  ${manifestPath}`)

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    for (const r of all) console.log(`  ${r.effect.padEnd(18)} ${basename(r.source)}`)
    return
  }

  let done = 0, failed = 0
  const queue = [...all]

  async function worker() {
    while (queue.length) {
      const row = queue.shift()!
      try {
        const buf = await callNB2(row.prompt, row.source, token!)
        writeFileSync(row.out, buf)
        done++
        console.log(`[${done + failed}/${all.length}] ok   ${row.effect}`)
      } catch (e: any) {
        failed++
        console.error(`[${done + failed}/${all.length}] FAIL ${row.effect}: ${e.message}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

  console.log(`\n${done} rendered, ${failed} failed. -> ${OUT_ROOT}`)
}

main().catch(e => { console.error(e); process.exit(1) })
