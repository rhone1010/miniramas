// plates-for-subject.js
// Liten and Co - STEP 2. Which plate does each effect actually serve?
//
// Reimplements the live loader's selection rule exactly:
//   - resolve `<id>_woman` to its base folder when it has none of its own
//   - filter filenames on "_man" / "_woman"
//   - fall back to the full set when the subject has no match
//   - cap at MAX_STYLE_REFS (2)
//
// Reads only filenames. No renders, no API calls, nothing written except
// a CSV. Run it before wiring subject, and again after, to see the change.
//
//   node plates-for-subject.js
//   node plates-for-subject.js --tree previews
//
// The MIXED column is the fault that broke renaissance and victorian:
// a man plate and a woman plate served together as one style reference.

const fs   = require('fs')
const path = require('path')

const REPO = 'D:\\minramas'
const TREES = {
  'style-refs': path.join(REPO, 'lib', 'v1', 'portraits', 'style-refs'),
  'previews':   path.join(REPO, 'public', 'previews', 'effects'),
}

const args    = process.argv.slice(2)
const treeArg = args.indexOf('--tree')
const TREE    = treeArg >= 0 ? args[treeArg + 1] : 'style-refs'
const ROOT    = TREES[TREE]

const MAX_STYLE_REFS = 2
const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp']
const OUT = path.join(REPO, `plates-for-subject-${TREE}.csv`)

function filesIn(dir) {
  try {
    return fs.readdirSync(dir)
      .filter(n => IMAGE_EXT.includes(path.extname(n).toLowerCase()))
      .sort()
  } catch { return null }
}

function resolveFolder(effectId) {
  if (effectId.endsWith('_woman')) {
    if (fs.existsSync(path.join(ROOT, effectId))) return { folder: effectId, subject: 'woman' }
    return { folder: effectId.slice(0, -'_woman'.length), subject: 'woman' }
  }
  return { folder: effectId, subject: undefined }
}

function served(effectId, subject) {
  const r     = resolveFolder(effectId)
  const files = filesIn(path.join(ROOT, r.folder))
  if (files === null) return { plates: [], why: 'NO FOLDER' }
  if (files.length === 0) return { plates: [], why: 'EMPTY' }

  const subj = subject || r.subject
  if (subj) {
    const token   = `_${subj}`
    const matched = files.filter(n => n.toLowerCase().includes(token))
    if (matched.length > 0) return { plates: matched.slice(0, MAX_STYLE_REFS), why: 'filtered' }
    return { plates: files.slice(0, MAX_STYLE_REFS), why: 'FALLBACK - no ' + subj + ' plate' }
  }
  return { plates: files.slice(0, MAX_STYLE_REFS), why: 'unfiltered' }
}

function genderOf(name) {
  const n = name.toLowerCase()
  if (n.includes('_woman')) return 'w'
  if (n.includes('_man'))   return 'm'
  return '?'
}

function isMixed(plates) {
  const g = new Set(plates.map(genderOf))
  return g.has('m') && g.has('w')
}

function main() {
  if (!ROOT || !fs.existsSync(ROOT)) {
    console.log(`\nTree not found. Use --tree style-refs or --tree previews.\n`)
    return
  }

  const ids = fs.readdirSync(ROOT, { withFileTypes: true })
    .filter(d => d.isDirectory()).map(d => d.name).sort()

  const rows = ids.map(id => {
    const none  = served(id, undefined)
    const man   = served(id, 'man')
    const woman = served(id, 'woman')
    return {
      id,
      none:  none.plates.join(' '),
      mixed: isMixed(none.plates) ? 'MIXED' : '',
      man:   man.plates.join(' '),
      manWhy:   man.why.startsWith('FALLBACK') ? 'fallback' : '',
      woman: woman.plates.join(' '),
      womanWhy: woman.why.startsWith('FALLBACK') ? 'fallback' : '',
    }
  })

  const w = Math.max(...rows.map(r => r.id.length)) + 2
  const pw = Math.max(24, ...rows.map(r => r.none.length)) + 2

  console.log(`\ntree: ${TREE}   (${rows.length} effects)\n`)
  console.log('effect'.padEnd(w) + 'subject=none'.padEnd(pw) + 'MIXED'.padEnd(8) +
              'subject=man'.padEnd(pw) + 'subject=woman')
  console.log('-'.repeat(w + pw * 3 + 8))

  for (const r of rows) {
    console.log(
      r.id.padEnd(w) +
      r.none.padEnd(pw) +
      r.mixed.padEnd(8) +
      (r.man   + (r.manWhy   ? ' *' : '')).padEnd(pw) +
      (r.woman + (r.womanWhy ? ' *' : '')),
    )
  }

  const mixed    = rows.filter(r => r.mixed)
  const noMan    = rows.filter(r => r.manWhy)
  const noWoman  = rows.filter(r => r.womanWhy)

  console.log('')
  console.log(`MIXED with subject=none : ${mixed.length}`)
  if (mixed.length) console.log('  ' + mixed.map(r => r.id).join(', '))
  console.log(`no man plate            : ${noMan.length}`)
  if (noMan.length) console.log('  ' + noMan.map(r => r.id).join(', '))
  console.log(`no woman plate          : ${noWoman.length}`)
  if (noWoman.length) console.log('  ' + noWoman.map(r => r.id).join(', '))
  console.log('')
  console.log('* = fell back to the full set, that gender has no plate')

  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`
  fs.writeFileSync(OUT,
    'effect,subject_none,mixed,subject_man,man_fallback,subject_woman,woman_fallback\n' +
    rows.map(r => [r.id, r.none, r.mixed, r.man, r.manWhy, r.woman, r.womanWhy].map(esc).join(',')).join('\n') + '\n')

  console.log(`csv : ${OUT}\n`)
}

main()
