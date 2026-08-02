#!/usr/bin/env node
/*
 * extract-effects.js — CENG lane · 2026-07-30
 *
 * Reads the live engine .ts files and emits ONE merged effect registry as JSON.
 * Never invents text. Every body/avoid is lifted verbatim from source.
 *
 * Usage:   node extract-effects.js [repoRoot] [--series=portraits] > effects-registry.json
 *          node extract-effects.js D:\minramas > effects-registry.json
 *
 * Groups / Pets / Portraits all declare MATERIAL_PHRASE, PRESET_LABELS etc.
 * --series picks which one wins. Defaults to portraits.
 *
 * Progress + warnings go to stderr, JSON to stdout, so redirection is clean.
 *
 * READ-ONLY. Touches nothing.
 */

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const argv   = process.argv.slice(2)
const ROOT   = argv.find(a => !a.startsWith('--')) || process.cwd()
const SERIES = (argv.find(a => a.startsWith('--series=')) || '--series=portraits').split('=')[1].toLowerCase()

// _recovery holds git worktree checkpoints carrying identical const names —
// legitimate, but they make every lookup ambiguous. Skipped.
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', 'dist', 'build', 'out', '.turbo', '_recovery'])

/* ---------- find the files by content, not by path ---------- */

function walk(dir, hits) {
  let entries
  try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return hits }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), hits)
    } else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) {
      hits.push(path.join(dir, e.name))
    }
  }
  return hits
}

const NEEDLES = [
  'MATERIAL_PHRASE',
  'ARTISTS_BLOCKS',
  'ARTISTS_PRESETS',
  'EXPERIMENTAL_EFFECTS',
  'PRESET_LABELS',
  'PRESET_TIER',
  'STYLE_MATERIALS',
  'STYLE_LABELS',
]

const files = walk(ROOT, [])
const index = new Map()   // needle -> [filepaths]

for (const f of files) {
  let src
  try { src = fs.readFileSync(f, 'utf8') } catch { continue }
  for (const n of NEEDLES) {
    if (new RegExp('(const|let|var)\\s+' + n + '\\b').test(src)) {
      if (!index.has(n)) index.set(n, [])
      index.get(n).push(f)
    }
  }
}

/* Groups, Pets and Portraits all declare MATERIAL_PHRASE / PRESET_LABELS / etc.
 * Prefer whichever candidate path contains the series token. */
function locate(needle) {
  const hits = index.get(needle) || []
  if (hits.length === 0) {
    warn(`NOT FOUND: ${needle} — no .ts file under ${ROOT} declares it`)
    return null
  }
  const onSeries = hits.filter(h => rel(h).toLowerCase().includes(SERIES))
  if (onSeries.length === 1) return onSeries[0]
  if (onSeries.length > 1) {
    warn(`AMBIGUOUS within "${SERIES}": ${needle} in ${onSeries.length} files, using the first:`)
    onSeries.forEach(h => warn(`    ${rel(h)}`))
    return onSeries[0]
  }
  warn(`${needle}: no candidate path contains "${SERIES}" — falling back to ${rel(hits[0])}`)
  if (hits.length > 1) hits.forEach(h => warn(`    candidate: ${rel(h)}`))
  return hits[0]
}

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/')
const warnings = []
function warn(m) { warnings.push(m); process.stderr.write('  ! ' + m + '\n') }

/* ---------- balanced-scan an initializer out of TS source ---------- */
/* Comment- and string-aware so a brace inside a prompt body can't end the scan. */

function sliceInitializer(src, name) {
  const decl = new RegExp('(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\b')
  const m = decl.exec(src)
  if (!m) return null

  // Walk from the declaration to the '=' that opens the initializer,
  // skipping over any type annotation (which may itself contain < > { }).
  let i = m.index + m[0].length
  let depth = 0
  while (i < src.length) {
    const c = src[i]
    if (c === '<' || c === '{' || c === '[' || c === '(') depth++
    else if (c === '>' || c === '}' || c === ']' || c === ')') depth--
    else if (c === '=' && depth === 0 && src[i + 1] !== '=' && src[i - 1] !== '=' &&
             src[i - 1] !== '!' && src[i - 1] !== '<' && src[i - 1] !== '>') { i++; break }
    i++
  }
  while (i < src.length && /\s/.test(src[i])) i++

  const open = src[i]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null

  const start = i
  let d = 0
  let inS = null           // "'", '"', '`'
  let inC = null           // '//' or '/*'
  let tmplDepth = 0        // ${ ... } nesting inside a template literal

  for (; i < src.length; i++) {
    const c = src[i], n = src[i + 1], p = src[i - 1]

    if (inC === '//') { if (c === '\n') inC = null; continue }
    if (inC === '/*') { if (c === '*' && n === '/') { inC = null; i++ } continue }

    if (inS) {
      if (c === '\\') { i++; continue }
      if (inS === '`' && c === '$' && n === '{') { tmplDepth++; i++; continue }
      if (inS === '`' && c === '}' && tmplDepth > 0) { tmplDepth--; continue }
      if (c === inS && tmplDepth === 0) inS = null
      continue
    }

    if (c === '/' && n === '/') { inC = '//'; i++; continue }
    if (c === '/' && n === '*') { inC = '/*'; i++; continue }
    if (c === '"' || c === "'" || c === '`') { inS = c; continue }

    if (c === open) d++
    else if (c === close) { d--; if (d === 0) return src.slice(start, i + 1) }
  }
  return null
}

/* ---------- evaluate a data-only literal safely ---------- */
/* Unresolved identifiers (e.g. ${BUST_UNIVERSAL}) become «NAME» and get reported,
 * so an interpolated body is visible rather than silently mangled. */

function evalLiteral(code, label) {
  const seen = new Set()
  const sandbox = new Proxy({}, {
    has: () => true,
    get: (_t, prop) => {
      if (prop === Symbol.unscopables) return undefined
      const k = String(prop)
      if (k === 'undefined') return undefined
      seen.add(k)
      return '\u00ab' + k + '\u00bb'
    },
  })
  let out
  try {
    out = vm.runInNewContext('(' + code + ')', sandbox, { timeout: 5000 })
  } catch (e) {
    warn(`EVAL FAILED for ${label}: ${e.message}`)
    return null
  }
  if (seen.size) {
    warn(`${label} interpolates ${seen.size} external identifier(s): ${[...seen].join(', ')} — placeholders written as \u00abNAME\u00bb`)
  }
  return out
}

function load(needle) {
  const file = locate(needle)
  if (!file) return { value: null, file: null }
  const src = fs.readFileSync(file, 'utf8')
  const code = sliceInitializer(src, needle)
  if (!code) { warn(`Could not slice initializer for ${needle} in ${rel(file)}`); return { value: null, file } }
  return { value: evalLiteral(code, needle), file }
}

/* ---------- pull everything ---------- */

process.stderr.write(`\nCENG effect extraction — root: ${ROOT} · series: ${SERIES}\n\n`)

const materialPhrase = load('MATERIAL_PHRASE')
const artistsBlocks  = load('ARTISTS_BLOCKS')
const artistsPresets = load('ARTISTS_PRESETS')
const experimental   = load('EXPERIMENTAL_EFFECTS')
const presetLabels   = load('PRESET_LABELS')
const presetTier     = load('PRESET_TIER')
const styleMaterials = load('STYLE_MATERIALS')
const styleLabels    = load('STYLE_LABELS')

/* ---------- merge into one registry ---------- */

const registry = {}

function put(id, patch) {
  if (!registry[id]) registry[id] = { id }
  Object.assign(registry[id], patch)
}

// which STYLE_MATERIALS bucket does a preset belong to (legacy grouping)
const legacyStyleOf = {}
if (styleMaterials.value) {
  for (const [style, ids] of Object.entries(styleMaterials.value)) {
    if (Array.isArray(ids)) ids.forEach(id => { legacyStyleOf[id] = style })
  }
}

// 1. Realistic — MATERIAL_PHRASE (flat id -> string)
if (materialPhrase.value) {
  for (const [id, phrase] of Object.entries(materialPhrase.value)) {
    put(id, {
      register:     'realistic',
      sourceFile:   rel(materialPhrase.file),
      shape:        'MATERIAL_PHRASE',
      body:         phrase,
      avoid:        null,
      legacyStyle:  legacyStyleOf[id] ?? null,
    })
  }
}

// 2. Artists — ARTISTS_BLOCKS (id -> { transformation, avoid, tail, skipUniversal? })
if (artistsBlocks.value) {
  for (const [id, b] of Object.entries(artistsBlocks.value)) {
    put(id, {
      register:       'artists',
      sourceFile:     rel(artistsBlocks.file),
      shape:          'ARTISTS_BLOCKS',
      body:           b.transformation ?? null,
      avoid:          b.avoid ?? null,
      tail:           b.tail ?? null,
      skipUniversal:  b.skipUniversal ?? false,
      legacyStyle:    legacyStyleOf[id] ?? 'artists',
    })
  }
}

// 3. Experimental — EXPERIMENTAL_EFFECTS (array of { id, label, monolithic, mode?, body, avoid })
if (Array.isArray(experimental.value)) {
  for (const e of experimental.value) {
    if (!e || !e.id) continue
    put(e.id, {
      register:     'experimental',
      sourceFile:   rel(experimental.file),
      shape:        'EXPERIMENTAL_EFFECTS',
      label:        e.label ?? null,
      monolithic:   e.monolithic ?? null,
      mode:         e.mode ?? 'material',
      body:         e.body ?? null,
      avoid:        e.avoid ?? null,
      legacyStyle:  legacyStyleOf[e.id] ?? null,
    })
  }
}

// labels + tier from shared
for (const [id, row] of Object.entries(registry)) {
  if (presetLabels.value && presetLabels.value[id] != null && row.label == null) row.label = presetLabels.value[id]
  if (presetTier.value   && presetTier.value[id]   != null) row.tier = presetTier.value[id]
  if (row.label == null) row.label = null
  // fields the new registry needs, present but unset — CENG/Rich fill these
  row.category      = row.category      ?? null   // the 8 silos
  row.styleRefs     = row.styleRefs     ?? null
  row.refSelector   = row.refSelector   ?? null
  row.framing       = row.framing       ?? null
  row.likenessFloor = row.likenessFloor ?? null
  row.skipStaging   = row.skipStaging   ?? null
}

/* ---------- report ---------- */

const rows = Object.values(registry).sort((a, b) =>
  (a.register + a.id).localeCompare(b.register + b.id))

const byRegister = rows.reduce((m, r) => (m[r.register] = (m[r.register] || 0) + 1, m), {})
const dupes = rows.filter(r => r.shape == null)
const noBody = rows.filter(r => !r.body)

process.stderr.write('\n' + '-'.repeat(60) + '\n')
process.stderr.write(`effects found: ${rows.length}\n`)
for (const [k, v] of Object.entries(byRegister)) process.stderr.write(`  ${k.padEnd(14)} ${v}\n`)
process.stderr.write(`\nfiles read:\n`)
for (const [n, f] of [['MATERIAL_PHRASE', materialPhrase.file], ['ARTISTS_BLOCKS', artistsBlocks.file],
                      ['EXPERIMENTAL_EFFECTS', experimental.file], ['PRESET_LABELS', presetLabels.file]]) {
  process.stderr.write(`  ${n.padEnd(22)} ${f ? rel(f) : '(not found)'}\n`)
}
if (noBody.length) {
  process.stderr.write(`\nno body text (${noBody.length}): ${noBody.map(r => r.id).join(', ')}\n`)
}
if (warnings.length) process.stderr.write(`\nwarnings: ${warnings.length}\n`)
process.stderr.write('-'.repeat(60) + '\n\n')

process.stdout.write(JSON.stringify({
  generated:  new Date().toISOString(),
  root:       ROOT,
  counts:     byRegister,
  total:      rows.length,
  warnings,
  effects:    rows,
}, null, 2) + '\n')
