#!/usr/bin/env node
/**
 * check-previews.js — preview coverage report
 * Liten & Co · 2026-07-27
 *
 * Answers one question: of every preview image the workshop can request,
 * which exist on disk and which will 404?
 *
 * It reads DEMO_SUBJECT and PREVIEW_FILE out of the workshop HTML rather than
 * hardcoding them, so the checker cannot drift from the code it is checking.
 *
 *   node scripts/check-previews.js
 *   node scripts/check-previews.js public/portraits_recover2.html
 *   node scripts/check-previews.js --manifest      (also writes a skeleton)
 *
 * Exit 0 = full coverage. Exit 1 = gaps found.
 */

const fs   = require('fs');
const path = require('path');

const args     = process.argv.slice(2);
const wantMan  = args.includes('--manifest');
const givenSrc = args.find(a => !a.startsWith('--'));

const CANDIDATES = [
  givenSrc,
  'public/portraits.html',
  'public/portraits_recover2.html',
].filter(Boolean);

const PREVIEW_DIR = path.join('public', 'previews', 'portraits');

// ── locate the workshop file ───────────────────────────────────
const src = CANDIDATES.find(p => fs.existsSync(p));
if (!src) {
  console.error('No workshop HTML found. Tried:\n  ' + CANDIDATES.join('\n  '));
  process.exit(1);
}
const html = fs.readFileSync(src, 'utf8');

// ── extract a { ... } object literal by name, brace-balanced ────
function extractObject(name) {
  const m = new RegExp(name + '\\s*=\\s*\\{').exec(html);
  if (!m) return null;
  const start = html.indexOf('{', m.index);
  let depth = 0;
  for (let i = start; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') depth--;
    if (depth === 0) return html.slice(start, i + 1);
  }
  return null;
}

// key:'value' pairs — tolerant of quoting style and whitespace
function parsePairs(block) {
  const out = {};
  if (!block) return out;
  const re = /([A-Za-z_][\w]*)\s*:\s*['"]([^'"]*)['"]/g;
  let m;
  while ((m = re.exec(block))) out[m[1]] = m[2];
  return out;
}

const DEMO_SUBJECT = parsePairs(extractObject('DEMO_SUBJECT'));
const PREVIEW_FILE = parsePairs(extractObject('PREVIEW_FILE'));

if (!Object.keys(DEMO_SUBJECT).length) {
  console.error(`Could not read DEMO_SUBJECT from ${src}. Has the map been renamed?`);
  process.exit(1);
}

// ── what is actually on disk ───────────────────────────────────
if (!fs.existsSync(PREVIEW_DIR)) {
  console.error(`Preview directory not found: ${PREVIEW_DIR}`);
  process.exit(1);
}

const entries    = fs.readdirSync(PREVIEW_DIR, { withFileTypes: true });
const effectDirs = entries.filter(e => e.isDirectory()).map(e => e.name).sort();
const looseFiles = entries.filter(e => e.isFile()).map(e => e.name).sort();

// ── report ─────────────────────────────────────────────────────
const subjects = Object.values(DEMO_SUBJECT);          // e.g. m_adult_a
const buckets  = Object.keys(DEMO_SUBJECT);            // e.g. m_adult

console.log('');
console.log('=== PREVIEW COVERAGE ===');
console.log(`source      ${src}`);
console.log(`previews    ${PREVIEW_DIR}`);
console.log(`buckets     ${buckets.length} demographic (${subjects.length} distinct files)`);
console.log(`effect dirs ${effectDirs.length}`);
console.log('');

// 1. Demographic previews — the path that is 404ing today
console.log('--- demographic previews: {effect}/{subject}.jpg ---');
let demoHave = 0, demoWant = 0;
const perEffect = [];

for (const eff of effectDirs) {
  const dir   = path.join(PREVIEW_DIR, eff);
  const onDisk = fs.readdirSync(dir).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const hits   = subjects.filter(s =>
    onDisk.some(f => f.toLowerCase() === (s + '.jpg').toLowerCase()));
  demoHave += hits.length;
  demoWant += subjects.length;
  perEffect.push({ eff, onDisk, hits });

  const mark = hits.length === subjects.length ? 'OK  '
             : hits.length === 0               ? 'NONE'
             :                                   'PART';
  console.log(`  ${mark}  ${eff.padEnd(20)} ${hits.length}/${subjects.length}   files on disk: ${onDisk.join(', ') || '(none)'}`);
}

// 2. Generic fallback — {file}.jpg at the root
console.log('');
console.log('--- generic fallback: PREVIEW_FILE ---');
let genHave = 0;
const genMissing = [];
for (const [preset, file] of Object.entries(PREVIEW_FILE)) {
  const ok = looseFiles.some(f => f.toLowerCase() === file.toLowerCase());
  if (ok) genHave++;
  else genMissing.push(`${preset} -> ${file}`);
}
console.log(`  ${genHave}/${Object.keys(PREVIEW_FILE).length} present`);
for (const m of genMissing) console.log(`  MISSING  ${m}`);

// 3. Orphans — on disk, never requested
console.log('');
console.log('--- on disk but never requested ---');
let orphanCount = 0;
for (const { eff, onDisk } of perEffect) {
  const orphans = onDisk.filter(f =>
    !subjects.some(s => f.toLowerCase() === (s + '.jpg').toLowerCase()));
  if (orphans.length) {
    orphanCount += orphans.length;
    console.log(`  ${eff.padEnd(20)} ${orphans.join(', ')}`);
  }
}
if (!orphanCount) console.log('  (none)');

// 4. Presets with no directory at all
const knownPresets = new Set(Object.keys(PREVIEW_FILE));
const noDir = [...knownPresets].filter(p => !effectDirs.includes(p)).sort();
console.log('');
console.log('--- presets in PREVIEW_FILE with no preview directory ---');
console.log(noDir.length ? '  ' + noDir.join(', ') : '  (none)');

// ── verdict ────────────────────────────────────────────────────
console.log('');
console.log('=== SUMMARY ===');
console.log(`demographic previews  ${demoHave}/${demoWant}`);
console.log(`generic fallbacks     ${genHave}/${Object.keys(PREVIEW_FILE).length}`);
console.log(`orphaned files        ${orphanCount}`);

const clean = demoHave === demoWant && genMissing.length === 0;
console.log('');
console.log(clean
  ? 'PASS — every requestable preview resolves.'
  : 'GAPS — the workshop will 404 on the paths marked above.');

// ── optional manifest skeleton ─────────────────────────────────
if (wantMan) {
  const manifest = {};
  for (const { eff, onDisk } of perEffect) {
    manifest[eff] = {};
    for (const b of buckets) manifest[eff][b] = null;
    manifest[eff]._available = onDisk;
  }
  const out = path.join(PREVIEW_DIR, 'manifest.skeleton.json');
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2));
  console.log('');
  console.log(`wrote ${out}`);
  console.log('Fill each bucket with one of that effect\'s _available files, then');
  console.log('drop _available and rename to manifest.json.');
}

process.exit(clean ? 0 : 1);
