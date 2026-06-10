// lib/bench/bench-source-gen.ts
//
// Generates a synthetic source-photo corpus for bench calibration runs.
// Produces images that read as uncurated customer phone photos with a
// CONTROLLED distribution — the thing real scraped photos can't give:
//   * gender split enforced (default 55% female — the calibration run
//     targets the female + bronze/mixed_metals drift question)
//   * deliberate quality spread: ~60% clean, ~40% flawed (blur, harsh
//     backlight, dim indoor, partial occlusion, busy background)
//   * varied age, setting, pose, hair
//   * optional mismatch seeds (houses, pets, landscapes, groups) to
//     exercise Gate 0
//
// Synthetic faces also sidestep privacy entirely — no real person's
// photo enters the test corpus.
//
// Caveat worth knowing: generated photos lack true sensor noise and
// JPEG-of-a-real-camera artifacts. For launch-grade confidence, top the
// corpus up with 20-30 real photos (your own, friends who've okayed it,
// or candid-style shots from Pexels — their license covers this use).
//
// Usage:
//   npm run bench:gen -- --out D:\minramas\bench-sources\calibration --n 100
//   npm run bench:gen -- --out <dir> --n 100 --mismatches 8
//
// Cost: gpt-image-1 medium ≈ $0.06/image → 100 ≈ $6.

import OpenAI from 'openai'
import * as fs from 'fs/promises'
import * as path from 'path'

// ─── DISTRIBUTION TABLES ─────────────────────────────────────────

const FEMALE_SHARE = 0.55

const AGES = [
  'in her early 20s', 'in her 30s', 'in her 40s', 'in her late 50s', 'in her 60s',
]
const AGES_M = AGES.map(a => a.replace('her', 'his'))

const LOOKS_F = [
  'long straight dark hair', 'shoulder-length curly hair', 'a blonde ponytail',
  'short cropped hair', 'braided hair', 'wavy auburn hair', 'a headscarf',
]
const LOOKS_M = [
  'short dark hair', 'curly hair', 'a beard and glasses', 'a shaved head',
  'gray hair', 'shoulder-length hair', 'a baseball cap',
]

const SETTINGS = [
  'standing in a backyard', 'sitting on a couch at home', 'at a kitchen table',
  'on a city sidewalk', 'at a park', 'on a beach', 'leaning on a car',
  'at a restaurant table', 'on an apartment balcony', 'in front of a garage',
  'on a hiking trail', 'at a backyard barbecue', 'sitting on front porch steps',
]

const POSES = [
  'smiling at the camera', 'laughing mid-conversation', 'looking off to the side',
  'caught mid-gesture', 'arms crossed, relaxed', 'holding a coffee cup',
  'a candid unposed moment', 'leaning forward slightly',
]

// Weighted quality conditions. 'clean' dominates; the rest exist to
// exercise the intake gate. Weights sum to 1.
const CONDITIONS: Array<{ weight: number; text: string; tag: string }> = [
  { weight: 0.60, tag: 'clean',    text: 'good natural light, in focus, subject fills much of the frame' },
  { weight: 0.10, tag: 'blur',     text: 'slight motion blur, the photo was taken quickly' },
  { weight: 0.08, tag: 'backlit',  text: 'harsh backlight from a bright window or sun behind the subject' },
  { weight: 0.08, tag: 'dim',      text: 'dim indoor lighting, grainy and underexposed' },
  { weight: 0.07, tag: 'far',      text: 'subject small in the frame, photographed from a distance' },
  { weight: 0.07, tag: 'busy',     text: 'cluttered busy background with other people passing behind' },
]

const MISMATCH_PROMPTS = [
  'amateur phone photo of a two-story suburban house from the street, daytime',
  'amateur phone photo of a golden retriever sitting in a living room',
  'amateur phone photo of a cat on a windowsill',
  'amateur phone photo of a mountain lake landscape, no people',
  'amateur phone photo of a craftsman bungalow with a front porch',
  'casual group photo of three friends standing together in a park, all facing camera',
  'amateur phone photo of a beach at sunset, no people',
  'casual photo of a family of four posing together in a backyard',
]

const BASE_STYLE =
  'Casual amateur smartphone photograph, realistic, ordinary everyday snapshot, ' +
  'not professional, no studio lighting, natural colors. Vertical orientation.'

// ─── GENERATION ──────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function pickCondition(): { text: string; tag: string } {
  const r = Math.random()
  let acc = 0
  for (const c of CONDITIONS) {
    acc += c.weight
    if (r <= acc) return c
  }
  return CONDITIONS[0]
}

function buildPersonPrompt(): { prompt: string; tag: string } {
  const female = Math.random() < FEMALE_SHARE
  const age  = female ? pick(AGES) : pick(AGES_M)
  const look = female ? pick(LOOKS_F) : pick(LOOKS_M)
  const cond = pickCondition()
  const who  = female ? 'a woman' : 'a man'
  return {
    prompt:
      `${BASE_STYLE} One person only: ${who} ${age} with ${look}, ` +
      `${pick(SETTINGS)}, ${pick(POSES)}. ${cond.text}.`,
    tag: `${female ? 'f' : 'm'}-${cond.tag}`,
  }
}

async function generateOne(openai: InstanceType<typeof OpenAI>, prompt: string): Promise<Buffer> {
  const res = await openai.images.generate({
    model:   'gpt-image-1',
    prompt,
    size:    '1024x1536',
    quality: 'medium',
    n:       1,
  })
  const b64 = res.data?.[0]?.b64_json
  if (!b64) throw new Error('no image data returned')
  return Buffer.from(b64, 'base64')
}

async function main(): Promise<void> {
  const outIdx = process.argv.indexOf('--out')
  const nIdx   = process.argv.indexOf('--n')
  const misIdx = process.argv.indexOf('--mismatches')

  const outDir     = outIdx >= 0 ? process.argv[outIdx + 1] : null
  const total      = nIdx   >= 0 ? Number(process.argv[nIdx + 1])   : 100
  const mismatches = misIdx >= 0 ? Number(process.argv[misIdx + 1]) : 0

  if (!outDir) { console.error('usage: bench:gen -- --out <dir> [--n 100] [--mismatches 8]'); process.exit(1) }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  await fs.mkdir(outDir, { recursive: true })

  const estCents = (total + mismatches) * 6
  console.log(`[gen] target: ${total} person photos + ${mismatches} mismatch seeds → ${outDir}`)
  console.log(`[gen] estimated cost ≈ $${(estCents / 100).toFixed(2)}`)

  let done = 0
  let failed = 0

  for (let i = 0; i < total; i++) {
    const { prompt, tag } = buildPersonPrompt()
    try {
      const buf = await generateOne(openai, prompt)
      const name = `person-${String(i + 1).padStart(3, '0')}-${tag}.jpg`
      await fs.writeFile(path.join(outDir, name), buf)
      done++
      console.log(`[gen] ${done + failed}/${total} ${name}`)
    } catch (e: unknown) {
      failed++
      console.warn(`[gen] ${i + 1} failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  for (let i = 0; i < mismatches; i++) {
    const prompt = `${MISMATCH_PROMPTS[i % MISMATCH_PROMPTS.length]}. ${BASE_STYLE}`
    try {
      const buf = await generateOne(openai, prompt)
      const name = `mismatch-${String(i + 1).padStart(2, '0')}.jpg`
      await fs.writeFile(path.join(outDir, name), buf)
      console.log(`[gen] mismatch ${i + 1}/${mismatches} ${name}`)
    } catch (e: unknown) {
      console.warn(`[gen] mismatch ${i + 1} failed: ${e instanceof Error ? e.message : 'unknown'}`)
    }
  }

  console.log(`[gen] complete: ${done} person photos, ${failed} failed. Filenames carry gender+condition tags (f-clean, m-blur, ...) so you can audit the distribution at a glance.`)
}

if (require.main === module) {
  main().catch(e => { console.error(e); process.exit(1) })
}
