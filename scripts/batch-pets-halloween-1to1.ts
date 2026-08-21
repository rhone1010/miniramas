// scripts/batch-pets-halloween-1to1.ts
//
// PETS HALLOWEEN AT 1:1. The twenty-seven, to H:.
//
// The room has a catalogue and no plates. The only pet Halloween plates
// that exist are 9:16, in public/previews/wallpapers/halloween-pets/, shot
// for the phone room. This is the square set.
//
//   npx tsx --env-file=.env.local scripts/batch-pets-halloween-1to1.ts --dry
//   npx tsx --env-file=.env.local scripts/batch-pets-halloween-1to1.ts
//   npx tsx --env-file=.env.local scripts/batch-pets-halloween-1to1.ts --only pethw_hellborn_beast
//   npx tsx --env-file=.env.local scripts/batch-pets-halloween-1to1.ts --only pethw_kraken_hound,pethw_phoenix_cat
//
// --only takes ids WITH the pethw_ prefix, because that is what they are
// called everywhere else and a script that accepts a different spelling of
// an id is a script that will eventually write a file under the wrong name.
//
// ── SIBLING OF batch-pets-wallpapers.ts ────────────────────────────────
//
// Same shape, three differences: 1:1 instead of 9:16, the main catalogue
// instead of the wallpaper one, and its own output root. Kept separate for
// the same reason those two are - one --only flag should not stand for two
// different kinds of work.
//
// ── IT IMPORTS THE CATALOGUE ───────────────────────────────────────────
//
// Nothing here restates a body. The dinner-jacket error came from a
// manifest that had drifted from the engine without anybody noticing; a
// script that imports cannot drift.
//
// ── NO FRAMING IS APPENDED, AND THAT IS THE POINT ──────────────────────
//
// Rich, 21 August: pets Halloween is working without constraints, so keep
// it that way. buildPetsHalloweenPrompt returns the body verbatim and this
// script sends exactly what it returns. What is shot here is what the room
// will render.
//
// Contrast the human 28, which append HALLOWEEN_MAIN_FRAMING.
//
// ── THE MANIFEST CARRIES FULL PROMPT TEXT ──────────────────────────────
//
// shoot-review.js reads j.prompt. A manifest of ids alone sends `undefined`
// to NB2 once per row. This has bitten before.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join, basename } from 'path'

import {
  PETS_HALLOWEEN_MAIN,
  PETS_HALLOWEEN_MAIN_ORDER,
  buildPetsHalloweenPrompt,
} from '../lib/v1/halloween/pets-halloween-catalog'

// ─── CONFIG ─────────────────────────────────────────────────────

// Not MAIN_ASPECT imported from render-aspect.ts, deliberately. A batch
// script is a camera: it shoots the shape it is told to shoot, and a shared
// constant changing under it would silently reshoot a whole room. The room
// itself reads MAIN_ASPECT. These two agree today and are meant to.
const ASPECT = '1:1'

// H:, not the repo. These are candidates, not plates, until Rich has looked
// at them. Placing them in public/previews/ is a separate deliberate step
// with a resize in front of it.
const OUT_ROOT = 'H:\\minramas\\public\\previews\\halloween-pets-1to1'

const REPLICATE_URL =
  'https://api.replicate.com/v1/models/google/nano-banana-2/predictions'

// Sixty is Replicate's ceiling on Prefer: wait. Ninety returns a 422 on
// every row, which is how the first 1:1 batch failed eighteen times.
const SYNC_WAIT   = 60
const POLL_MAX    = 40
const POLL_DELAY  = 2000
const CONCURRENCY = 3

// ─── SOURCES ────────────────────────────────────────────────────
//
// The same twenty-five animals the pet wallpaper shoot used, so the two
// rooms are recognisably the same pets in different registers.

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
  effect: string
  label:  string
  prompt: string
  source: string
  out:    string
}

function rows(): Row[] {
  return PETS_HALLOWEEN_MAIN_ORDER.map((id, i) => ({
    effect: id,
    label:  PETS_HALLOWEEN_MAIN[id].label,
    // Straight from the engine's own builder, so what is shot is exactly
    // what the room will send.
    prompt: buildPetsHalloweenPrompt(id),
    // Cycled across the twenty-five sources, so the room is not
    // twenty-seven pictures of the same dog.
    source: PETS[i % PETS.length],
    // THE PREFIX IS STRIPPED. The square set already existed when this
    // script was written on 21 August - twenty-seven files named
    // ancient_crypt_beast.jpg and so on, no prefix, matching the folder
    // convention that previews/wallpapers/halloween-pets/ also uses.
    //
    // The first version of this line kept the prefix, so a redo wrote
    // pethw_frost_wraith.jpg alongside an existing frost_wraith.jpg. The
    // superseded/ guard below never fired, because a different filename is
    // not a collision. Five forks of an approved set, silently.
    //
    // A batch script must write the name the room already reads. If the
    // convention ever changes, change it here and rename the set in one
    // pass - do not let two spellings live in one folder.
    out:    join(OUT_ROOT, `${id.replace(/^pethw_/, '')}.jpg`),
  }))
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
    const unknown = want.filter(w => !PETS_HALLOWEEN_MAIN_ORDER.includes(w))
    if (unknown.length) {
      throw new Error(
        `unknown effect id(s): ${unknown.join(', ')}\n` +
        `ids carry the pethw_ prefix, e.g. ${PETS_HALLOWEEN_MAIN_ORDER[0]}`,
      )
    }
    all = all.filter(r => want.includes(r.effect))
  }
  if (!all.length) throw new Error('nothing to render')

  // Every source checked before the first render. A run that produces
  // twenty images and then stops on a missing file has spent twenty renders
  // to find out something a loop could have said in a second.
  const missing = [...new Set(all.map(r => r.source))].filter(p => !existsSync(p))
  if (missing.length) {
    console.error(`\nMISSING SOURCES (${missing.length}):`)
    for (const m of missing) console.error('  ' + m)
    process.exit(1)
  }

  mkdirSync(OUT_ROOT, { recursive: true })

  // Existing renders are NOT overwritten silently on a redo - the old one
  // goes to a numbered sibling first, so a redo that turns out worse than
  // the original is recoverable.
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

  const manifestPath = join(OUT_ROOT, `manifest-pets-halloween-1to1-${Date.now()}.json`)
  writeFileSync(manifestPath, JSON.stringify(all, null, 2))

  console.log(`${all.length} pet Halloween effects at ${ASPECT}`)
  console.log(`  out       ${OUT_ROOT}`)
  console.log(`  manifest  ${manifestPath}`)

  if (dry) {
    console.log('\nDRY RUN. Nothing rendered.')
    for (const r of all) console.log(`  ${r.effect.padEnd(30)} ${basename(r.source)}`)
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
