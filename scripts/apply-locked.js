#!/usr/bin/env node
/*
 * apply-locked.js — CENG lane · 2026-08-01
 *
 * Merges the 2026-08-01 locked bodies into lib/v1/portraits/effect-registry.ts.
 *
 * DOES NOT WRITE unless you pass --write. Default is a dry run that prints
 * exactly what would change. Standing rule: never bulk-edit without a dry run.
 *
 *   node apply-locked.js locked-2026-08-01.json                    # dry run
 *   node apply-locked.js locked-2026-08-01.json --write            # apply
 *   node apply-locked.js locked-2026-08-01.json --emit-new=new.ts  # just the new ids
 *
 * Optional:
 *   --registry=PATH   default lib/v1/portraits/effect-registry.ts
 *   --idealism        also append the pending idealism line to the 8 listed ids
 *
 * After --write you MUST run:  node scripts/emit-effect-registry.js
 * Never edit public/effect-registry.js directly.
 */

const fs   = require('fs')
const path = require('path')

const argv     = process.argv.slice(2)
const SRC      = argv.find(a => !a.startsWith('--')) || 'locked-2026-08-01.json'
const WRITE    = argv.includes('--write')
const IDEALISM = argv.includes('--idealism')
const EMIT_NEW = (argv.find(a => a.startsWith('--emit-new=')) || '').split('=')[1] || null
const REGISTRY = (argv.find(a => a.startsWith('--registry=')) || '').split('=')[1]
                 || 'lib/v1/portraits/effect-registry.ts'

/* ---------- read the locked payload (BOM-tolerant) ---------- */

function readJson(p) {
  const raw = fs.readFileSync(p)
  if (raw[0] === 0xff && raw[1] === 0xfe) return JSON.parse(raw.toString('utf16le'))
  if (raw[0] === 0xfe && raw[1] === 0xff) throw new Error('UTF-16BE not supported')
  return JSON.parse(raw.toString('utf8').replace(/^\uFEFF/, ''))
}

const payload = readJson(SRC)
const locked  = payload.effects
const pending = payload.pending_idealism_append

console.log(`\nlocked bodies in payload: ${locked.length}`)
console.log(`registry target:          ${REGISTRY}`)
console.log(`mode:                     ${WRITE ? 'WRITE' : 'DRY RUN'}\n`)

/* ---------- classify against the existing registry ---------- */

let registrySrc = ''
try {
  registrySrc = fs.readFileSync(REGISTRY, 'utf8')
} catch {
  console.error(`  ! cannot read ${REGISTRY} — run from the repo root, or pass --registry=`)
  process.exit(1)
}

const existing = new Set()
for (const m of registrySrc.matchAll(/^\s*(?:id:\s*)?['"]?([a-z0-9_]+)['"]?\s*:\s*\{/gm)) {
  existing.add(m[1])
}
// fallback: also catch `id: 'foo',` shape
for (const m of registrySrc.matchAll(/\bid:\s*['"]([a-z0-9_]+)['"]/g)) existing.add(m[1])

const updates = locked.filter(e => existing.has(e.id))
const adds    = locked.filter(e => !existing.has(e.id))

console.log(`  updates (id already in registry): ${updates.length}`)
updates.forEach(e => console.log(`    ~ ${e.id.padEnd(28)} ${e.supersedes ? 'supersedes ' + e.supersedes : 'confirmed'}`))
console.log(`\n  adds (new id): ${adds.length}`)
adds.forEach(e => console.log(`    + ${e.id.padEnd(28)} silo=${e.silo}`))

/* ---------- render a TS entry ---------- */

const q = s => (s == null ? 'null' : '`' + String(s).replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`')

function entry(e) {
  const lines = [
    `  ${e.id}: {`,
    `    id:            '${e.id}',`,
    `    label:         ${q(e.label)},`,
    `    category:      '${e.silo}',`,
  ]
  if (e.gender) lines.push(`    refSelector:   '${e.gender}',`)
  lines.push(
    `    body:          ${q(e.body)},`,
    `    avoid:         ${q(e.avoid)},`,
    `    // locked 2026-08-01${e.supersedes ? ' — supersedes ' + e.supersedes : ''}`,
  )
  if (e.note) lines.push(`    // ${e.note.replace(/\n/g, ' ')}`)
  lines.push(`  },`)
  return lines.join('\n')
}

/* ---------- emit just the new ids, for hand-paste ---------- */

if (EMIT_NEW) {
  const out =
    `// CENG — new effect ids locked 2026-08-01\n` +
    `// Paste into EFFECT_REGISTRY in ${REGISTRY}, then run scripts/emit-effect-registry.js\n\n` +
    adds.map(entry).join('\n\n') + '\n'
  fs.writeFileSync(EMIT_NEW, out, 'utf8')
  console.log(`\nwritten: ${EMIT_NEW} (${adds.length} entries, ${(out.length / 1024).toFixed(0)} KB)`)
}

/* ---------- in-place body replacement for existing ids ---------- */
/* Conservative: only swaps the `body:` and `avoid:` values of a matched id.
 * Anything it cannot match unambiguously is reported and left alone. */

function replaceField(src, id, field, value) {
  // find the block for this id
  const idRe = new RegExp(`(^\\s*${id}\\s*:\\s*\\{)`, 'm')
  const m = idRe.exec(src)
  if (!m) return { src, ok: false, why: 'block not found' }

  // scan to the matching close brace
  let i = m.index + m[0].length, d = 1, inS = null
  for (; i < src.length && d > 0; i++) {
    const c = src[i], p = src[i - 1]
    if (inS) { if (c === inS && p !== '\\') inS = null; continue }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue }
    if (c === '{') d++
    else if (c === '}') d--
  }
  const block = src.slice(m.index, i)

  const fieldRe = new RegExp(`(\\n\\s*${field}\\s*:\\s*)(\`(?:[^\`\\\\]|\\\\.)*\`|'(?:[^'\\\\]|\\\\.)*'|"(?:[^"\\\\]|\\\\.)*"|null)`, 'm')
  if (!fieldRe.test(block)) return { src, ok: false, why: `no ${field}: field` }

  const newBlock = block.replace(fieldRe, (_, lead) => lead + q(value))
  return { src: src.slice(0, m.index) + newBlock + src.slice(i), ok: true }
}

if (WRITE) {
  let out = registrySrc
  const failed = []

  for (const e of updates) {
    let r = replaceField(out, e.id, 'body', e.body)
    if (!r.ok) { failed.push(`${e.id} body — ${r.why}`); continue }
    out = r.src
    r = replaceField(out, e.id, 'avoid', e.avoid)
    if (!r.ok) failed.push(`${e.id} avoid — ${r.why}`)
    else out = r.src
  }

  if (IDEALISM && pending) {
    for (const id of pending.apply_to) {
      const line = id === 'deco_twenties' ? pending.line_costume : pending.line_material
      const cur  = new RegExp(`\\n\\s*${id}\\s*:`).test(out)
      if (!cur) { failed.push(`${id} — not in registry, idealism line skipped`); continue }
      failed.push(`${id} — idealism append is MANUAL: insert "${line}" before the tail`)
    }
  }

  if (adds.length) {
    const anchor = out.lastIndexOf('}')
    out = out.slice(0, anchor) + '\n' + adds.map(entry).join('\n\n') + '\n' + out.slice(anchor)
  }

  const bak = REGISTRY + '.bak-' + new Date().toISOString().slice(0, 10)
  fs.writeFileSync(bak, registrySrc, 'utf8')
  fs.writeFileSync(REGISTRY, out, 'utf8')
  console.log(`\nbackup:  ${bak}`)
  console.log(`written: ${REGISTRY}`)
  if (failed.length) {
    console.log(`\nNEEDS HAND EDIT (${failed.length}):`)
    failed.forEach(f => console.log(`  ! ${f}`))
  }
  console.log(`\nNEXT: node scripts/emit-effect-registry.js`)
  console.log(`      git status  (named files only, never -A)\n`)
} else {
  console.log(`\ndry run only — nothing written. Add --write to apply.\n`)
}
