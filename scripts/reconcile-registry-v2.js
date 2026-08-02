#!/usr/bin/env node
/*
 * reconcile-registry-v2.js — CENG · 2026-08-02
 *
 * v1 did regex row-surgery on effect-registry.ts and ate the
 * `export const EFFECTS: Effect[] = [` declaration. Twice now a regex has
 * half-eaten this file. v2 does not do string surgery.
 *
 * It brace-scans the EFFECTS array, parses every row into an object, applies
 * the plan as DATA, and re-emits the whole array. Anything it cannot parse it
 * reports and refuses to run. The file cannot come out half-eaten because it is
 * never partially edited — it is replaced wholesale between two fixed anchors.
 *
 *   node scripts/reconcile-registry-v2.js
 *   node scripts/reconcile-registry-v2.js --apply
 *
 * Reads silos-2026-08-02.json from the repo root.
 * After --apply:  node scripts/emit-effect-registry.js
 *                 npx tsc --noEmit        (baseline 60)
 */

const fs   = require('fs')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const ROOT  = process.cwd()
const REG    = path.join(ROOT, 'lib/v1/portraits/effect-registry.ts')
const BODIES = path.join(ROOT, 'lib/v1/portraits/portraits-bodies.ts')
const REFS   = path.join(ROOT, 'lib/v1/portraits/style-refs')
const PLAN   = path.join(ROOT, 'silos-2026-08-02.json')

const die = m => { console.error(`\n  FAIL  ${m}\n`); process.exit(1) }

for (const [p, w] of [[REG,'registry'],[BODIES,'bodies'],[PLAN,'plan']])
  if (!fs.existsSync(p)) die(`${w} not found: ${path.relative(ROOT,p)} — run from the repo root`)

const plan = JSON.parse(fs.readFileSync(PLAN,'utf8'))
const src  = fs.readFileSync(REG,'utf8')
const nl   = src.includes('\r\n') ? '\r\n' : '\n'

/* ── locate the EFFECTS array by its declaration, not by guessing ────────── */

const decl = /export const EFFECTS\s*:\s*Effect\[\]\s*=\s*\[/.exec(src)
if (!decl) die('could not find `export const EFFECTS: Effect[] = [`')

const openIdx = decl.index + decl[0].length - 1     // the '['

function matchBracket(s, i) {
  let d = 0, inS = null, inC = null
  for (; i < s.length; i++) {
    const c = s[i], n = s[i+1], p = s[i-1]
    if (inC === '//') { if (c === '\n') inC = null; continue }
    if (inC === '/*') { if (c === '*' && n === '/') { inC = null; i++ } continue }
    if (inS) { if (c === '\\') { i++; continue } if (c === inS) inS = null; continue }
    if (c === '/' && n === '/') { inC = '//'; i++; continue }
    if (c === '/' && n === '*') { inC = '/*'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue }
    if (c === '[' || c === '{') d++
    else if (c === ']' || c === '}') { d--; if (d === 0) return i }
  }
  return -1
}

const closeIdx = matchBracket(src, openIdx)
if (closeIdx < 0) die('EFFECTS array is unbalanced in the source file')

const head = src.slice(0, openIdx + 1)
const body = src.slice(openIdx + 1, closeIdx)
const tail = src.slice(closeIdx)

/* ── split the array body into rows, brace-aware ─────────────────────────── */

const rows = []
{
  let i = 0
  while (i < body.length) {
    if (body[i] !== '{') { i++; continue }
    const end = matchBracket(body, i)
    if (end < 0) die(`unbalanced row starting at offset ${i}`)
    rows.push(body.slice(i, end + 1))
    i = end + 1
  }
}
if (!rows.length) die('parsed zero rows — the array shape has changed')

/* ── field extraction, scoped to one row ─────────────────────────────────── */

const str  = (r, k) => { const m = new RegExp(`\\b${k}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(r); return m ? m[1] : null }
const num  = (r, k) => { const m = new RegExp(`\\b${k}\\s*:\\s*(\\d+)`).exec(r); return m ? +m[1] : null }
const bool = (r, k) => { const m = new RegExp(`\\b${k}\\s*:\\s*(true|false)`).exec(r); return m ? m[1] === 'true' : null }

const parsed = rows.map((raw, n) => {
  const id = str(raw, 'id')
  if (!id) die(`row ${n} has no id — cannot proceed safely`)
  return {
    raw, id,
    label:         str(raw, 'label'),
    category:      str(raw, 'category'),
    mode:          str(raw, 'mode'),
    monolithic:    bool(raw, 'monolithic'),
    body:          str(raw, 'body'),
    refs:          num(raw, 'refs'),
    framing:       str(raw, 'framing'),
    likenessFloor: str(raw, 'likenessFloor'),
    skipStaging:   bool(raw, 'skipStaging'),
    skipUniversal: bool(raw, 'skipUniversal'),
    genderedRefs:  bool(raw, 'genderedRefs'),
    note:          str(raw, 'note'),
  }
})

console.log(`\n  registry: ${path.relative(ROOT, REG)}`)
console.log(`  parsed:   ${parsed.length} rows`)
console.log(`  mode:     ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

/* ── the plan ────────────────────────────────────────────────────────────── */

const bodySrc = fs.readFileSync(BODIES,'utf8')
const HAS_BODY = new Set([...bodySrc.matchAll(/^  (\w+): \{/gm)].map(m => m[1]))
// renaissance_woman and wild_west_woman are LOCKED 07-30 in effects-batch2.json.
// They are not in portraits-bodies.ts only because they were not re-shot 08-01.
const ALSO_HAS_TEXT = new Set(['renaissance_woman','wild_west_woman'])

const SILO_OF = {}
for (const [s, ids] of Object.entries(plan.layout)) ids.forEach(i => { SILO_OF[i] = s })
plan.genderedVariants.ids.forEach(i => { SILO_OF[i] = 'another_age' })

const REMOVE   = new Set([...plan.remove.todos, ...plan.remove.cut])
const ID_MAP   = plan.idRenames
const SILO_MAP = plan.renames
const COSTUME  = new Set([...plan.layout.another_age, ...plan.genderedVariants.ids])

const refCount = id => {
  const d = path.join(REFS, id)
  if (!fs.existsSync(d)) return 0
  return fs.readdirSync(d).filter(f => /\.(jpe?g|png|webp)$/i.test(f)).length
}

/* ── transform ───────────────────────────────────────────────────────────── */

const kept = [], dropped = [], changes = []

for (const r of parsed) {
  if (REMOVE.has(r.id)) { dropped.push(r.id); continue }
  const before = { id: r.id, cat: r.category, body: r.body }

  if (ID_MAP[r.id]) { changes.push(`~ id  ${r.id} -> ${ID_MAP[r.id]}`); r.id = ID_MAP[r.id] }
  if (SILO_MAP[r.category]) r.category = SILO_MAP[r.category]

  const want = SILO_OF[r.id]
  if (!want) { console.log(`    ? ${r.id} is not in the approved layout — kept, REVIEW`) }
  else if (r.category !== want) { changes.push(`~ cat ${r.id.padEnd(22)} ${r.category} -> ${want}`); r.category = want }

  if ((HAS_BODY.has(r.id) || ALSO_HAS_TEXT.has(r.id)) && r.body !== 'live') {
    changes.push(`= ${r.id.padEnd(22)} body ${r.body} -> live`); r.body = 'live'
  }
  const n = refCount(r.id)
  if (n && n !== r.refs) { changes.push(`# ${r.id.padEnd(22)} refs ${r.refs} -> ${n}`); r.refs = n }

  kept.push(r)
}

const present = new Set(kept.map(r => r.id))
const adds = Object.keys(SILO_OF).filter(i => !present.has(i)).map(id => ({
  id,
  label:         plan.labelOverrides?.[id] || id.split('_').map(w => w[0].toUpperCase()+w.slice(1)).join(' '),
  category:      SILO_OF[id],
  mode:          COSTUME.has(id) ? 'costume' : 'material',
  monolithic:    !COSTUME.has(id),
  body:          (HAS_BODY.has(id) || ALSO_HAS_TEXT.has(id)) ? 'live' : 'todo',
  refs:          refCount(id),
  likenessFloor: 'strict',
  genderedRefs:  plan.genderedVariants.ids.includes(id) ? true : null,
  note:          'added 2026-08-02',
}))

/* ── report ──────────────────────────────────────────────────────────────── */

console.log(`  REMOVED (${dropped.length})`)
console.log('    ' + dropped.sort().join(', ') + '\n')
console.log(`  CHANGED (${changes.length})`)
changes.forEach(c => console.log('    ' + c))
console.log(`\n  ADDED (${adds.length})`)
adds.forEach(a => console.log(`    + ${a.id.padEnd(24)} ${a.category.padEnd(16)} ${a.refs} refs  ${a.body}`))

const final = [...kept, ...adds]
const counts = {}
final.forEach(r => { if (SILO_OF[r.id]) counts[r.category] = (counts[r.category]||0)+1 })
console.log('\n  CHECK')
let ok = true
for (const s of Object.keys(plan.layout)) {
  const want = s === 'another_age' ? 14 : 7
  const got  = counts[s] || 0
  if (got !== want) ok = false
  console.log(`    ${got === want ? ' ' : '!'} ${s.padEnd(18)} ${got}/${want}`)
}
const todo = final.filter(r => r.body !== 'live')
if (todo.length) console.log(`\n  STILL body!=live (${todo.length}): ${todo.map(r=>r.id).join(', ')}`)

/* ── emit ────────────────────────────────────────────────────────────────── */

function emit(r) {
  const f = [
    `id:'${r.id}'`,
    `label:'${(r.label||'').replace(/'/g,"\\'")}'`,
    `category:'${r.category}'`,
    `mode:'${r.mode||'material'}'`,
    `monolithic:${r.monolithic === null ? true : r.monolithic}`,
    `body:'${r.body}'`,
    `refs:${r.refs ?? 0}`,
    `likenessFloor:'${r.likenessFloor||'strict'}'`,
  ]
  if (r.framing)       f.push(`framing:'${r.framing}'`)
  if (r.skipStaging)   f.push(`skipStaging:true`)
  if (r.skipUniversal) f.push(`skipUniversal:true`)
  if (r.genderedRefs)  f.push(`genderedRefs:true`)
  if (r.note)          f.push(`note:'${r.note.replace(/'/g,"\\'")}'`)
  return `  { ${f.join(', ')} },`
}

const order = Object.keys(plan.layout)
const grouped = order.map(s => {
  const rs = final.filter(r => r.category === s)
  if (!rs.length) return ''
  const label = plan.labels[s] || s
  return `${nl}  // ── ${label} ${'─'.repeat(Math.max(2, 62 - label.length))}${nl}` +
         rs.map(emit).join(nl)
}).filter(Boolean).join(nl)

const orphans = final.filter(r => !order.includes(r.category))
const orphanBlock = orphans.length
  ? `${nl}${nl}  // ── NOT IN THE APPROVED LAYOUT — review ─────────────────${nl}` +
    orphans.map(emit).join(nl)
  : ''

const out = head + grouped + orphanBlock + nl + tail

/* ── gates ───────────────────────────────────────────────────────────────── */

if (matchBracket(out, openIdx) < 0) die('emitted array is unbalanced — refusing to write')
for (const must of ['export const EFFECTS: Effect[] = [', 'export const SILOS', 'export const POSES'])
  if (!out.includes(must)) die(`emit dropped a required declaration: ${must}`)
const outClose = matchBracket(out, openIdx)
const emittedSlice = out.slice(openIdx, outClose + 1)
const emitted = [...emittedSlice.matchAll(/\bid:'([a-z0-9_]+)',\s*label:/g)].length
if (emitted !== final.length) die(`emitted ${emitted} rows in EFFECTS, expected ${final.length}`)
console.log(`\n  gates ok — ${emitted} rows, brackets balanced, declarations intact`)

if (!APPLY) { console.log('\n  dry run — nothing written. Add --apply.\n'); process.exit(0) }
if (!ok) console.log('\n  ! silo counts are off — writing anyway, check the CHECK block')

const bak = REG + '.bak-' + Date.now()
fs.writeFileSync(bak, src, 'utf8')
fs.writeFileSync(REG, out, 'utf8')
console.log(`\n  backup:  ${path.relative(ROOT, bak)}`)
console.log(`  written: ${path.relative(ROOT, REG)}`)
console.log(`\n  ! SILOS[].line copy for the three renamed silos is now wrong — Rich to rewrite`)
console.log('\n  NEXT: node scripts/emit-effect-registry.js')
console.log('        npx tsc --noEmit          (baseline 60)\n')
