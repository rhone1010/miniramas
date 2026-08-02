#!/usr/bin/env node
/*
 * tidy-root.js — CENG · 2026-08-01
 *
 * Clears the session debris out of D:\minramas root.
 *
 *   MOVE    one-off tooling -> scripts/
 *   DELETE  .bak files and empty/malformed artefacts
 *   IGNORE  scratch directories, appended to .gitignore
 *   KEEP    the two files that are the session's actual output
 *
 * DRY RUN by default. Nothing moves, deletes or is written without --apply.
 *
 *   node tidy-root.js
 *   node tidy-root.js --apply
 *
 * Scratch dirs are IGNORED, not deleted. _upload/ _route_upload/ and
 * _route-collection/ look like dead scratch copies and account for ~12 of the
 * 70 tsc errors, but deleting a directory you may still want is not a call
 * this script makes. It reports them; you decide.
 */

const fs   = require('fs')
const path = require('path')

const APPLY = process.argv.includes('--apply')
const ROOT  = process.cwd()

const MOVE = [
  'split-style-refs.js',
  'strip-dead-passes.py',
  'apply-locked.js',
  'apply-locked-v2.js',
  'extract-effects.js',
  'Clean-StyleRefs.ps1',
  'Invoke-SourceBatch.ps1',
  'Invoke-EffectBatch.ps1',
  'tidy-root.js',            // itself, last
]

const DELETE = [
  'new-effects.ts',                                       // emitted empty
  'effects-registry.json',                                // UTF-16 BOM, unreadable as JSON
  'lib/v1/portraits/effect-registry.ts.bak-2026-08-02',
  'lib/v1/portraits/portraits-generator.ts.bak-2026-08-01',
]

const KEEP = [
  'locked-2026-08-01.json',
  'CENG-CARRYOVER-2026-08-01-V23.md',
]

const IGNORE = [
  '_testpool/',
  '_upload/',
  '_route_upload/',
  '_route-collection/',
  '_archive/',
  '*.bak-*',
  '*.bak2-*',
]

// reported, never touched
const REVIEW = ['_upload', '_route_upload', '_route-collection']

const SCRIPTS = path.join(ROOT, 'scripts')
const rel = p => path.relative(ROOT, p).replace(/\\/g, '/')
const kb  = n => (n / 1024).toFixed(0) + 'K'

console.log(`\n  root: ${ROOT}`)
console.log(`  mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

/* ---- 1. move tooling into scripts/ ---- */
console.log('  MOVE -> scripts/')
let moved = 0
for (const f of MOVE) {
  const from = path.join(ROOT, f)
  if (!fs.existsSync(from)) { console.log(`    - ${f.padEnd(30)} absent`); continue }
  const to = path.join(SCRIPTS, path.basename(f))
  if (fs.existsSync(to)) { console.log(`    ! ${f.padEnd(30)} scripts/ already has it, skipping`); continue }
  console.log(`    ~ ${f}`)
  if (APPLY) {
    if (!fs.existsSync(SCRIPTS)) fs.mkdirSync(SCRIPTS, { recursive: true })
    fs.renameSync(from, to)
  }
  moved++
}

/* ---- 2. delete artefacts ---- */
console.log('\n  DELETE')
let killed = 0, freed = 0
for (const f of DELETE) {
  const p = path.join(ROOT, ...f.split('/'))
  if (!fs.existsSync(p)) { console.log(`    - ${f.padEnd(56)} absent`); continue }
  const size = fs.statSync(p).size
  console.log(`    x ${f.padEnd(56)} ${kb(size).padStart(7)}`)
  if (APPLY) fs.unlinkSync(p)
  killed++; freed += size
}

// sweep any other .bak-* the session left behind
console.log('\n  SWEEP .bak')
const sweep = []
;(function walk(d, depth) {
  if (depth > 3) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (['node_modules', '.next', '.git', '_recovery'].includes(e.name)) continue
      walk(path.join(d, e.name), depth + 1)
    } else if (/\.bak2?-/.test(e.name)) {
      sweep.push(path.join(d, e.name))
    }
  }
})(ROOT, 0)
if (!sweep.length) console.log('    - none found')
for (const p of sweep) {
  if (DELETE.some(d => path.join(ROOT, ...d.split('/')) === p)) continue
  const size = fs.statSync(p).size
  console.log(`    x ${rel(p).padEnd(56)} ${kb(size).padStart(7)}`)
  if (APPLY) fs.unlinkSync(p)
  killed++; freed += size
}

/* ---- 3. .gitignore ---- */
console.log('\n  GITIGNORE')
const gi = path.join(ROOT, '.gitignore')
let giSrc = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : ''
const lines = giSrc.split(/\r?\n/).map(l => l.trim())
const add = IGNORE.filter(x => !lines.includes(x))
if (!add.length) {
  console.log('    - all entries already present')
} else {
  add.forEach(x => console.log(`    + ${x}`))
  if (APPLY) {
    const block = '\n# CENG session debris — 2026-08-01\n' + add.join('\n') + '\n'
    fs.writeFileSync(gi, giSrc.replace(/\s*$/, '\n') + block, 'utf8')
  }
}

/* ---- 4. keep ---- */
console.log('\n  KEEP (commit these)')
for (const f of KEEP) {
  const p = path.join(ROOT, f)
  console.log(`    ${fs.existsSync(p) ? '=' : '!'} ${f}${fs.existsSync(p) ? '' : '   MISSING'}`)
}

/* ---- 5. review ---- */
console.log('\n  REVIEW — scratch dirs, ignored but NOT deleted')
for (const d of REVIEW) {
  const p = path.join(ROOT, d)
  if (!fs.existsSync(p)) { console.log(`    - ${d} absent`); continue }
  let n = 0
  ;(function c(x) {
    for (const e of fs.readdirSync(x, { withFileTypes: true })) {
      if (e.isDirectory()) c(path.join(x, e.name)); else n++
    }
  })(p)
  console.log(`    ? ${d.padEnd(22)} ${n} files — nothing imports these; delete by hand if dead`)
}

console.log(`\n  ${moved} moved, ${killed} deleted (${kb(freed)}), ${add.length} gitignore entries`)
if (!APPLY) {
  console.log('\n  dry run — nothing changed. Add --apply.\n')
} else {
  console.log('\n  NEXT: npx tsc --noEmit    then    git status\n')
}
