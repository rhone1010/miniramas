// scripts/emit-likeness-drafts.ts
//
// RESTRUCTURE THE BODIES FOR LIKENESS. Writes .txt drafts. Changes nothing.
//
//   npx tsx scripts/emit-likeness-drafts.ts
//   npx tsx scripts/emit-likeness-drafts.ts --only ebony,iron,stone
//
// Output: H:\minramas\prompts\drafts\<id>.txt, one per effect, plus a
// _REPORT.txt saying what was removed from each.
//
// ── IT DOES NOT TOUCH portraits-bodies.ts ─────────────────────────────
//
// These are DRAFTS for Rich to read, edit in Notepad and shoot. Nothing
// installs itself. A wording that wins here still goes into the engine as a
// deliberate patch with his sign-off, which is the standing rule for every
// line of prompt text in this repo.
//
// ── WHAT IT CHANGES, AND WHY EACH ─────────────────────────────────────
//
// 1. THE BEAUTIFICATION LANGUAGE COMES OUT.
//
//    Most bodies carry "Clear the skin - blemishes, spots and blotchiness
//    go" and many say "idealized". NB2 already over-smooths and slims
//    whoever it is given; practitioners writing headshot prompts add a
//    skin-TEXTURE instruction to every prompt to fight that lean. We were
//    pushing the same way the model already leans.
//
//    It shows in the 21 August run: oil_impasto passed and Rich's note was
//    "but younger, ideal". persian_court came back heavier and reshaped.
//    Those are the instructions working exactly as written.
//
//    Removed here, and a texture line put in its place.
//
// 2. IDENTITY MOVES TO THE FRONT, AND IS LOCKED AGAIN AT THE BACK.
//
//    Our bodies open with the material and close with likeness. The field
//    consensus is the reverse - identity anchor first, before wardrobe or
//    lighting, then the style, then a consistency lock at the end.
//
//    Both, then. IDENTITY_LEAD opens, the body runs, IDENTITY_LOCK closes.
//    Rich's rule that the later instruction wins is respected: the lock is
//    last and it is the one that says do not beautify.
//
// 3. THE LOCK NAMES FEATURES RATHER THAN ASKING FOR "THE SAME FACE".
//
//    Proven here on 21 August: the victorian body with a named beard and
//    hairline clause kept both, four renders out of four, where the
//    original lost the beard three times out of three.
//
//    NOTE THE LIMIT. Naming what to PRESERVE works. DESCRIBING the face -
//    "he has a broad jaw and grey stubble" - fights the photograph and
//    blends toward a stranger. Every line below names a category to keep,
//    and none of them describes the man.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { join } from 'path'
import { EFFECT_BODIES, listBodyIds } from '../lib/v1/portraits/portraits-bodies'

const OUT_DIR = 'H:\\minramas\\prompts\\drafts'

// The twenty shot on 21 August. Spans the failure modes: solid darks where
// a beard cannot read, translucents, painted mediums, metals, four costumes.
const DEFAULT_SET = [
  'ebony', 'iron', 'stone', 'bronze', 'polished_gold', 'jade',
  'sea_glass', 'ice', 'cast_glass', 'watercolour', 'oil_impasto',
  'pencil_sketch', 'impressionist', 'charcoal_chalk', 'victorian',
  'wild_west', 'persian_court', 'samurai', 'retro_robot', 'plushy',
]

// ── RICH'S TEXT STARTS HERE. EDIT THE .txt FILES, NOT THIS. ───────────
//
// These two blocks are a DRAFT. They are in code only so twenty files can
// be written at once; once written, the .txt is the thing that gets shot
// and this file is finished with.

const IDENTITY_LEAD =
  `This is a portrait of one specific man, and the photograph is the only ` +
  `record of who he is. Everything below describes what to make him OUT OF ` +
  `and what to put around him. None of it describes his face. His face comes ` +
  `from the photograph and does not change.`

const IDENTITY_LOCK =
  `Recreate this person as exactly as possible within the guidelines of the ` +
  `effect. Keep his hair colour, hairline and hairstyle, his eyes and the ` +
  `spacing between them, and his jawline exactly as they are in the ` +
  `photograph.\n` +
  `This is his best day in front of a camera. The light, the lens and the ` +
  `moment have all gone right and he is the best version of himself - but he ` +
  `is still himself. Nothing about his face has been changed to get there.\n` +
  `Where you are unsure, do not age him.`

// ── THE FOURTH DRAFT, AND WHY IDEALISM CAME BACK ──────────────────────
//
// Rich, 21 August. The first three drafts each fixed one fault and caused
// another, and the pattern is worth stating because it will recur.
//
//   draft 1  named the beard hard, named the lines around the eyes
//            -> full grey beard, aged him a decade
//   draft 2  softened both
//            -> still a full grey beard, still aged
//   draft 3  removed both entirely
//            -> stubble and grey still arriving, and nothing pulling back
//
// Mentioning a feature makes NB2 render the emphatic version of it. Removing
// the mention does not undo that, because the bodies had ALREADY had their
// "clear the skin" and "idealized" language stripped - so there was nothing
// left pulling the other way at all.
//
// IDEALISM IS BACK, BUT AS FLATTERING CIRCUMSTANCE RATHER THAN FLATTERING
// SURGERY. The old language - "Clear the skin, blemishes and blotchiness go",
// "idealized and beautiful" - told the model to CHANGE HIM. This tells it the
// light and the lens went right and he is the best version of HIMSELF. Same
// warmth, and it points at the photograph instead of away from it.
//
// AGE IS HANDLED BY DIRECTION, NOT BY DESCRIPTION. "Where you are unsure, do
// not age him" gives the model somewhere to fall when it cannot tell. Every
// previous attempt named age as a thing to preserve, and naming it produced
// it. This never says the word old.
//
// FACIAL HAIR IS NOT MENTIONED AT ALL. Three drafts proved that any sentence
// pointing at the jaw returns a beard, because "facial hair" means beard to
// this model and stubble is not something it reaches for. What is named
// instead is hair COLOUR - which is the fault Rich actually flagged, grey
// arriving where his hair is not grey - and colour covers the beard by
// implication without ever aiming at it.
//
// If a specific effect must never carry stubble, that belongs in that
// effect's own body, not here. retro_robot is the standing example: a tin
// toy has no hair on its face, and the general lock is the wrong place to
// say so.

// Sentences that push the model the way it already leans. Matched literally
// and reported per effect, so nothing is removed silently.
const BEAUTIFY_CUTS = [
  `Clear the skin — blemishes, spots and blotchiness go. `,
  `Clear the skin — blemishes, spots and blotchiness go.`,
  `Refine temporary skin imperfections without changing his identity. `,
  `Refine temporary skin imperfections without changing her identity. `,
  `Idealized and beautiful. `,
  `Photographic and highly idealized`,
  `Make the portrait sumptuous, theatrical and slightly idealized`,
  `and highly idealized`,
]

// Replacements rather than deletions where the sentence carries something
// else worth keeping.
const BEAUTIFY_SWAPS: [string, string][] = [
  [`Photographic and highly idealized`, `Photographic`],
  [`Make the portrait sumptuous, theatrical and slightly idealized`,
   `Make the portrait sumptuous and theatrical`],
  [`and highly idealized`, ``],
]

function restructure(id: string): { text: string; removed: string[] } {
  const fx = EFFECT_BODIES[id]
  if (!fx) throw new Error(`no body for ${id}`)

  let body = fx.body
  const removed: string[] = []

  for (const [from, to] of BEAUTIFY_SWAPS) {
    if (body.includes(from)) {
      body = body.split(from).join(to)
      removed.push(`swapped: "${from}" -> "${to || '(nothing)'}"`)
    }
  }
  for (const cut of BEAUTIFY_CUTS) {
    if (body.includes(cut)) {
      body = body.split(cut).join('')
      removed.push(`removed: "${cut.trim()}"`)
    }
  }

  const parts = [IDENTITY_LEAD, '', body.trim()]
  if (fx.avoid) parts.push('', fx.avoid.trim())
  parts.push('', IDENTITY_LOCK)

  return { text: parts.join('\n'), removed }
}

function main() {
  const args = process.argv.slice(2)
  const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null

  const known = listBodyIds()
  let ids = only ? only.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_SET
  const unknown = ids.filter(i => !known.includes(i))
  if (unknown.length) throw new Error(`unknown effect id(s): ${unknown.join(', ')}`)

  mkdirSync(OUT_DIR, { recursive: true })

  const report: string[] = [
    `Likeness drafts — ${new Date().toISOString()}`,
    `${ids.length} effect(s). Source: lib/v1/portraits/portraits-bodies.ts (unchanged).`,
    ``,
    `Every file is IDENTITY_LEAD, then the body with beautification language`,
    `removed, then its avoid line if it had one, then IDENTITY_LOCK.`,
    ``,
  ]

  for (const id of ids) {
    const { text, removed } = restructure(id)
    const path = join(OUT_DIR, `${id}.txt`)

    // Never overwritten. An edited draft is Rich's work and a re-run of this
    // script must not destroy it.
    if (existsSync(path)) {
      const keep = join(OUT_DIR, 'superseded')
      mkdirSync(keep, { recursive: true })
      let n = 1
      while (existsSync(join(keep, `${id}_${String(n).padStart(3, '0')}.txt`))) n++
      renameSync(path, join(keep, `${id}_${String(n).padStart(3, '0')}.txt`))
    }

    writeFileSync(path, text)
    report.push(`${id}  (${text.length} chars)`)
    if (removed.length) for (const r of removed) report.push(`    ${r}`)
    else report.push(`    nothing removed — this body carried no beautification language`)
    report.push('')
    console.log(`  ${id.padEnd(18)} ${String(text.length).padStart(5)} chars, ${removed.length} cut(s)`)
  }

  writeFileSync(join(OUT_DIR, '_REPORT.txt'), report.join('\n'))
  console.log(`\n${ids.length} draft(s) -> ${OUT_DIR}`)
  console.log(`report -> ${join(OUT_DIR, '_REPORT.txt')}`)
}

main()
