#!/usr/bin/env node
/*
 * reconcile-registry.js — CENG · 2026-08-02
 *
 * Brings lib/v1/portraits/effect-registry.ts in line with what actually exists:
 * the 8x7 layout Rich approved 2026-08-02 (silos-2026-08-02.json) and the 37
 * prompt bodies in portraits-bodies.ts.
 *
 * WHAT IT DOES
 *   1. renames 3 silo ids     myth_legend -> fantasy_future
 *                             far_future  -> ink_paper
 *                             handmade    -> made_by_hand
 *   2. removes 25 rows        16 never-written todos + 9 cut effects still
 *                             marked live
 *   3. renames 2 effect ids   balloon -> balloon_face
 *                             oil_impasto_palette_knife -> oil_impasto
 *   4. re-categorises every surviving row to its approved silo
 *   5. adds the missing rows  body:'live', refs from the plates on disk
 *   6. flips body status      'live' for anything in portraits-bodies.ts
 *
 * WHAT IT DOES NOT DO
 *   · touch prompt text — that lives in portraits-bodies.ts, never here
 *   · touch SILOS[].line — the Curator copy is Rich's, left alone but the
 *     three renamed ids are reported so he can rewrite them
 *   · wire the generator — separate job, see the carryover
 *
 * DRY RUN by default.
 *
 *   node scripts/reconcile-registry.js
 *   node scripts/reconcile-registry.js --apply
 *
 * After --apply:  node scripts/emit-effect-registry.js
 *                 npx tsc --noEmit        (baseline 60; expect no new errors)
 */

const fs   = require('fs')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const ROOT  = process.cwd()

const REG    = path.join(ROOT, 'lib/v1/portraits/effect-registry.ts')
const BODIES = path.join(ROOT, 'lib/v1/portraits/portraits-bodies.ts')
const REFS   = path.join(ROOT, 'lib/v1/portraits/style-refs')
const PLAN   = path.join(ROOT, 'silos-2026-08-02.json')

for (const [p, what] of [[REG,'registry'], [BODIES,'bodies'], [PLAN,'layout plan']]) {
  if (!fs.existsSync(p)) { console.error(`  ! ${what} not found: ${path.relative(ROOT,p)}`); process.exit(1) }
}

const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'))
let src = fs.readFileSync(REG, 'utf8')
const orig = src

/* ---- what has a body ---- */
const bodySrc = fs.readFileSync(BODIES, 'utf8')
const HAS_BODY = new Set([...bodySrc.matchAll(/^  (\w+): \{/gm)].map(m => m[1]))

/* ---- what has plates ---- */
function refCount(id) {
  const d = path.join(REFS, id)
  if (!fs.existsSync(d)) return 0
  return fs.readdirSync(d).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).length
}

/* ---- target: id -> silo ---- */
const SILO_OF = {}
for (const [silo, ids] of Object.entries(plan.layout)) ids.forEach(i => { SILO_OF[i] = silo })
plan.genderedVariants.ids.forEach(i => { SILO_OF[i] = 'another_age' })

const REMOVE  = new Set([...plan.remove.todos, ...plan.remove.cut])
const ID_MAP  = plan.idRenames
const SILO_MAP = plan.renames

console.log(`\n  registry: ${path.relative(ROOT, REG)}`)
console.log(`  bodies:   ${HAS_BODY.size}`)
console.log(`  mode:     ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

/* ---- parse existing rows ---- */
const ROW = /\{\s*id:'([a-z0-9_]+)',[\s\S]*?\n\s*\},?/g
const existing = [...src.matchAll(/\bid:'([a-z0-9_]+)',\s*label:'([^']*)',\s*category:'([a-z_]+)'/g)]
  .map(m => ({ id: m[1], label: m[2], cat: m[3] }))
const byId = Object.fromEntries(existing.map(r => [r.id, r]))

/* ---- 1. silo id renames ---- */
console.log('  SILO RENAMES')
for (const [from, to] of Object.entries(SILO_MAP)) {
  const n = (src.match(new RegExp(`'${from}'`, 'g')) || []).length
  console.log(`    ~ ${from.padEnd(16)} -> ${to.padEnd(16)} ${n} occurrence(s)`)
  if (APPLY) src = src.split(`'${from}'`).join(`'${to}'`)
}
console.log(`    ! SILOS[].line copy for these three is now wrong — Rich to rewrite`)

/* ---- 2. effect id renames ---- */
console.log('\n  ID RENAMES')
for (const [from, to] of Object.entries(ID_MAP)) {
  if (!byId[from]) { console.log(`    - ${from} not in registry`); continue }
  console.log(`    ~ ${from} -> ${to}`)
  if (APPLY) src = src.replace(new RegExp(`id:'${from}'`, 'g'), `id:'${to}'`)
}

/* ---- 3. removals ---- */
console.log('\n  REMOVE')
let removed = 0
for (const id of [...REMOVE].sort()) {
  if (!byId[id]) { console.log(`    - ${id.padEnd(20)} not present`); continue }
  const re = new RegExp(`[ \\t]*\\{\\s*id:'${id}',[\\s\\S]*?\\n[ \\t]*\\},?\\r?\\n`, 'm')
  if (!re.test(src)) { console.log(`    ! ${id.padEnd(20)} row not matched — HAND EDIT`); continue }
  console.log(`    x ${id}`)
  if (APPLY) src = src.replace(re, '')
  removed++
}

/* ---- 4. re-categorise + flip body status ---- */
console.log('\n  RECATEGORISE / STATUS')
let recat = 0, flipped = 0
for (const r of existing) {
  const id = ID_MAP[r.id] || r.id
  if (REMOVE.has(r.id)) continue
  const want = SILO_OF[id]
  if (!want) { console.log(`    ? ${id.padEnd(22)} not in the approved layout — REVIEW`); continue }
  const now = SILO_MAP[r.cat] || r.cat
  if (now !== want) {
    console.log(`    ~ ${id.padEnd(22)} ${now} -> ${want}`)
    if (APPLY) src = src.replace(
      new RegExp(`(id:'${id}',\\s*label:'[^']*',\\s*category:')[a-z_]+(')`),
      `$1${want}$2`)
    recat++
  }
  if (HAS_BODY.has(id)) {
    const re = new RegExp(`(id:'${id}',[\\s\\S]{0,400}?body:')(authored|todo)(')`)
    if (re.test(src)) {
      console.log(`    = ${id.padEnd(22)} body -> live`)
      if (APPLY) src = src.replace(re, `$1live$3`)
      flipped++
    }
  }
}

/* ---- 5. additions ---- */
console.log('\n  ADD')
const present = new Set(existing.map(r => ID_MAP[r.id] || r.id).filter(i => !REMOVE.has(i)))
const wanted  = Object.keys(SILO_OF)
const adds    = wanted.filter(i => !present.has(i))

const LABEL = id => id.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
const COSTUME = new Set([...plan.layout.another_age, ...plan.genderedVariants.ids])

function row(id) {
  const silo = SILO_OF[id]
  const n    = refCount(id)
  const gen  = plan.genderedVariants.ids.includes(id)
  return `  { id:'${id}', label:'${LABEL(id)}', category:'${silo}', ` +
         `mode:'${COSTUME.has(id) ? 'costume' : 'material'}', monolithic:${!COSTUME.has(id)}, ` +
         `body:'${HAS_BODY.has(id) ? 'live' : 'todo'}', refs:${n}, likenessFloor:'strict'` +
         (gen ? `, genderedRefs:true` : '') +
         ` },   // added 2026-08-02`
}

for (const id of adds) {
  const n = refCount(id)
  console.log(`    + ${id.padEnd(24)} ${SILO_OF[id].padEnd(16)} ${n} refs` +
              `${HAS_BODY.has(id) ? '' : '   NO BODY'}`)
}

if (APPLY && adds.length) {
  const anchor = src.lastIndexOf(']', src.indexOf('export const POSES'))
  if (anchor < 0) { console.error('  ! could not find the EFFECTS array close'); process.exit(1) }
  let ins = anchor
  while (ins > 0 && /\s/.test(src[ins - 1])) ins--
  src = src.slice(0, ins) + '\n\n  // ── added 2026-08-02 — reconcile to the approved 8x7 layout\n' +
        adds.map(row).join('\n') + '\n' + src.slice(ins)
}

/* ---- verify ---- */
console.log('\n  CHECK')
const finalIds = APPLY
  ? [...src.matchAll(/\bid:'([a-z0-9_]+)',\s*label:/g)].map(m => m[1])
  : [...present, ...adds]
const counts = {}
for (const id of finalIds) {
  const s = SILO_OF[id]
  if (s) counts[s] = (counts[s] || 0) + 1
}
let ok = true
for (const silo of Object.keys(plan.layout)) {
  const want = silo === 'another_age' ? 14 : 7
  const got  = counts[silo] || 0
  const flag = got === want ? ' ' : '!'
  if (got !== want) ok = false
  console.log(`    ${flag} ${silo.padEnd(18)} ${got}/${want}`)
}
console.log(`    ${'another_age holds 7 tiles + 7 gendered rows'}`)

const noBody = wanted.filter(i => !HAS_BODY.has(i))
if (noBody.length) {
  console.log(`\n  NO PROMPT BODY (${noBody.length}) — these are in portraits-prompt.ts or the`)
  console.log('  older engine constants, not portraits-bodies.ts. Port them or leave the')
  console.log('  generator reading both:')
  console.log('    ' + noBody.join(', '))
}

console.log(`\n  ${removed} removed, ${adds.length} added, ${recat} recategorised, ${flipped} flipped to live`)

if (!APPLY) {
  console.log('\n  dry run — nothing written. Add --apply.\n')
  process.exit(0)
}

if (!ok) console.log('\n  ! silo counts are off — check the REVIEW lines above')

const bak = REG + '.bak-' + new Date().toISOString().slice(0, 10)
fs.writeFileSync(bak, orig, 'utf8')
fs.writeFileSync(REG, src, 'utf8')
console.log(`\n  backup:  ${path.relative(ROOT, bak)}`)
console.log(`  written: ${path.relative(ROOT, REG)}`)
console.log('\n  NEXT: node scripts/emit-effect-registry.js')
console.log('        npx tsc --noEmit          (baseline 60)')
console.log('        git status                (named files only)\n')
