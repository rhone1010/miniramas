#!/usr/bin/env node
/*
 * apply-locked-v2.js — CENG · 2026-08-01
 *
 * Fixes the v1 anchor bug: v1 inserted before the LAST '}' in the file, which
 * landed inside an unrelated array and ate a closing brace.
 *
 * v2 finds the registry object by name and balanced-scans to ITS closing brace.
 *
 *   node apply-locked-v2.js locked-2026-08-01.json                    # dry run
 *   node apply-locked-v2.js locked-2026-08-01.json --write
 *   node apply-locked-v2.js locked-2026-08-01.json --anchor=EFFECT_REGISTRY
 *
 * REVERT FIRST if v1 already ran:
 *   copy lib\v1\portraits\effect-registry.ts.bak-2026-08-02 lib\v1\portraits\effect-registry.ts
 */

const fs = require('fs')

const argv     = process.argv.slice(2)
const SRC      = argv.find(a => !a.startsWith('--')) || 'locked-2026-08-01.json'
const WRITE    = argv.includes('--write')
const EMIT_NEW = (argv.find(a => a.startsWith('--emit-new=')) || '').split('=')[1] || null
const ANCHOR   = (argv.find(a => a.startsWith('--anchor='))   || '').split('=')[1] || null
const REGISTRY = (argv.find(a => a.startsWith('--registry=')) || '').split('=')[1]
                 || 'lib/v1/portraits/effect-registry.ts'

function readJson(p) {
  const raw = fs.readFileSync(p)
  if (raw[0] === 0xff && raw[1] === 0xfe) return JSON.parse(raw.toString('utf16le'))
  return JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''))
}

const payload = readJson(SRC)
const locked  = payload.effects
let src = fs.readFileSync(REGISTRY, 'utf8')

/* ---------- balanced scan from a given '{' ---------- */
function matchBrace(s, open) {
  let d = 0, inS = null, inC = null
  for (let i = open; i < s.length; i++) {
    const c = s[i], n = s[i + 1], p = s[i - 1]
    if (inC === '//') { if (c === '\n') inC = null; continue }
    if (inC === '/*') { if (c === '*' && n === '/') { inC = null; i++ } continue }
    if (inS) { if (c === '\\') { i++; continue } if (c === inS) inS = null; continue }
    if (c === '/' && n === '/') { inC = '//'; i++; continue }
    if (c === '/' && n === '*') { inC = '/*'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue }
    if (c === '{') d++
    else if (c === '}') { d--; if (d === 0) return i }
  }
  return -1
}

/* ---------- locate the registry object ---------- */
/* Prefer --anchor. Otherwise pick the top-level const whose body contains the
 * most `id:` keys — that is the effect map, not a pose list. */

function findRegistry() {
  const cands = []
  for (const m of src.matchAll(/(?:export\s+)?const\s+([A-Z_][A-Z0-9_]*)\s*(?::[^=]+)?=\s*\{/g)) {
    const open = src.indexOf('{', m.index + m[0].length - 1)
    const close = matchBrace(src, open)
    if (close < 0) continue
    const body = src.slice(open, close)
    cands.push({ name: m[1], open, close, ids: (body.match(/\bid:\s*['"`]/g) || []).length })
  }
  if (ANCHOR) {
    const hit = cands.find(c => c.name === ANCHOR)
    if (!hit) { console.error(`  ! --anchor=${ANCHOR} not found. Candidates: ${cands.map(c=>c.name).join(', ')}`); process.exit(1) }
    return hit
  }
  cands.sort((a, b) => b.ids - a.ids)
  return cands[0]
}

const reg = findRegistry()
if (!reg) { console.error('  ! no registry object found — pass --anchor=NAME'); process.exit(1) }

console.log(`\nregistry file:   ${REGISTRY}`)
console.log(`registry object: ${reg.name}  (${reg.ids} id: keys)`)
console.log(`mode:            ${WRITE ? 'WRITE' : 'DRY RUN'}\n`)

/* ---------- which ids already exist INSIDE that object ---------- */
const regBody = src.slice(reg.open, reg.close + 1)
const existing = new Set()
for (const m of regBody.matchAll(/\bid:\s*['"`]([a-z0-9_]+)['"`]/g)) existing.add(m[1])

const updates = locked.filter(e => existing.has(e.id))
const adds    = locked.filter(e => !existing.has(e.id))

console.log(`  updates: ${updates.length}`)
updates.forEach(e => console.log(`    ~ ${e.id}`))
console.log(`\n  adds: ${adds.length}`)
adds.forEach(e => console.log(`    + ${e.id.padEnd(28)} silo=${e.silo}`))

const q = s => (s == null ? 'null'
  : '`' + String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`')

function entry(e) {
  const L = [
    `  ${e.id}: {`,
    `    id:            '${e.id}',`,
    `    label:         ${q(e.label)},`,
    `    category:      '${e.silo}',`,
  ]
  if (e.gender) L.push(`    refSelector:   '${e.gender}',`)
  L.push(
    `    body:          ${q(e.body)},`,
    `    avoid:         ${q(e.avoid)},`,
    `    // locked 2026-08-01${e.supersedes ? ' — supersedes ' + e.supersedes : ''}`,
  )
  if (e.note) L.push(`    // ${e.note.replace(/\n/g, ' ')}`)
  L.push(`  },`)
  return L.join('\n')
}

if (EMIT_NEW) {
  const out = `// new ids locked 2026-08-01 — paste inside ${reg.name}\n\n` +
              adds.map(entry).join('\n\n') + '\n'
  fs.writeFileSync(EMIT_NEW, out, 'utf8')
  console.log(`\nwritten: ${EMIT_NEW} (${adds.length} entries)`)
}

/* ---------- field swap, scoped to a single id block ---------- */
function replaceField(s, id, field, value) {
  const re = new RegExp(`(^[ \\t]*${id}\\s*:\\s*)\\{`, 'm')
  const m = re.exec(s)
  if (!m) return { s, ok: false, why: 'block not found' }
  const open  = s.indexOf('{', m.index + m[1].length)
  const close = matchBrace(s, open)
  if (close < 0) return { s, ok: false, why: 'unbalanced block' }
  const block = s.slice(open, close + 1)
  const fRe = new RegExp(`(\\n\\s*${field}\\s*:\\s*)(\`(?:[^\`\\\\]|\\\\.)*\`|'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|null)`)
  if (!fRe.test(block)) return { s, ok: false, why: `no ${field}: field` }
  return { s: s.slice(0, open) + block.replace(fRe, (_, lead) => lead + q(value)) + s.slice(close + 1), ok: true }
}

if (WRITE) {
  const failed = []
  let out = src

  for (const e of updates) {
    let r = replaceField(out, e.id, 'body', e.body)
    if (!r.ok) { failed.push(`${e.id} body — ${r.why}`); continue }
    out = r.s
    r = replaceField(out, e.id, 'avoid', e.avoid)
    if (r.ok) out = r.s; else failed.push(`${e.id} avoid — ${r.why}`)
  }

  if (adds.length) {
    // re-locate the registry in the mutated source, then insert before ITS close
    src = out
    const r2 = findRegistry()
    // step back over trailing whitespace so we sit right after the last entry
    let ins = r2.close
    while (ins > 0 && /\s/.test(out[ins - 1])) ins--
    const needsComma = out[ins - 1] !== ',' && out[ins - 1] !== '{'
    out = out.slice(0, ins) + (needsComma ? ',' : '') + '\n\n' +
          adds.map(entry).join('\n\n') + '\n' + out.slice(ins)
  }

  const bak = REGISTRY + '.bak2-' + Date.now()
  fs.writeFileSync(bak, src, 'utf8')
  fs.writeFileSync(REGISTRY, out, 'utf8')
  console.log(`\nbackup:  ${bak}`)
  console.log(`written: ${REGISTRY}`)
  if (failed.length) { console.log(`\nNEEDS HAND EDIT:`); failed.forEach(f => console.log(`  ! ${f}`)) }
  console.log(`\nNEXT: npx tsc --noEmit   then   node scripts/emit-effect-registry.js\n`)
} else {
  console.log(`\ndry run only — add --write to apply.\n`)
}
