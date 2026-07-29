#!/usr/bin/env node
/* boot.js — SESSION BOOT REPORT
 * CUI V22 · 2026-07-27
 *
 *   cd D:\minramas
 *   node scripts/boot.js
 *
 * Writes BOOT-REPORT.md at the repo root and prints it. Paste it at the start
 * of every session, together with docs/SURFACES/portraits/PORTRAITS-SPEC.
 *
 * Everything in the report is read from disk at run time. It exists so that no
 * claim about this repository has to be taken on anyone's word — not a
 * carryover doc, not a memory, not mine.
 *
 * Reads only. Writes one file. Runs git in read-only modes.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const R = process.cwd();
const out = [];
const say = (s = '') => out.push(s);

const rel  = p => path.relative(R, p).replace(/\\/g, '/');
const read = p => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } };
const git  = c => { try { return execSync(`git ${c}`, {cwd:R, encoding:'utf8', stdio:['ignore','pipe','ignore']}).trim(); } catch { return null; } };

function walk(dir, out = [], depth = 0) {
  if (depth > 6) return out;
  let entries;
  try { entries = fs.readdirSync(dir, {withFileTypes:true}); } catch { return out; }
  for (const e of entries) {
    if (['node_modules','.git','.next','archive'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out, depth + 1); else out.push(p);
  }
  return out;
}

function measure(p) {
  const raw = read(p);
  if (raw === null) return null;
  const s = raw;
  // ids are counted in markup only — a string inside a <script> is not an element
  const markup = raw.replace(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g, '');
  const ids = [...markup.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map(m => m[1])
                .filter(i => !i.includes('${'));
  return {
    lines: s.split('\n').length,
    ids: new Set(ids).size,
    dupIds: [...new Set(ids.filter((x,i) => ids.indexOf(x) !== i))],
    fetch: (s.match(/\bfetch\s*\(/g) || []).length,
    funcs: (s.match(/\bfunction\s+[A-Za-z0-9_$]+/g) || []).length,
    bytes: Buffer.byteLength(s),
    mtime: fs.statSync(p).mtime.toISOString().slice(0,10),
  };
}

say(`# BOOT REPORT`);
say('');
say(`Generated ${new Date().toISOString().replace('T',' ').slice(0,16)} from disk.`);
say(`**Everything below is machine-read this run.** Where a document disagrees`);
say(`with this report, the report is right and the document is corrected today.`);
say('');

/* ── 1 · GIT ─────────────────────────────────────────────────────────── */
say('## 1 · Repository state');
say('');
const branch = git('rev-parse --abbrev-ref HEAD');
const ahead  = git('rev-list --count @{u}..HEAD');
const behind = git('rev-list --count HEAD..@{u}');
const last   = git('log -1 --format=%h\\ %ad\\ %s --date=short');
say(`- Branch: \`${branch || '?'}\``);
say(`- Last commit: ${last || '?'}`);

if (ahead && +ahead > 0) {
  say(`- ⚠ **${ahead} commit(s) unpushed.** Nothing here exists off this machine.`);
} else if (ahead !== null) {
  say(`- Pushed and current with origin.`);
}
if (behind && +behind > 0) say(`- ${behind} commit(s) behind origin.`);

const porcelain = git('status --porcelain') || '';
const dirty = porcelain.split('\n').filter(Boolean);
const untracked = dirty.filter(l => l.startsWith('??')).map(l => l.slice(3));
const modified  = dirty.filter(l => !l.startsWith('??')).map(l => l.slice(3));

if (untracked.length) {
  say('');
  say(`- ⚠ **${untracked.length} untracked path(s).** Untracked means it exists`);
  say(`  nowhere but this disk. This is how fifteen days of work was nearly lost.`);
  untracked.slice(0,25).forEach(f => say(`  - \`${f}\``));
  if (untracked.length > 25) say(`  - …and ${untracked.length-25} more`);
}
if (modified.length) {
  say('');
  say(`- ${modified.length} modified, uncommitted:`);
  modified.slice(0,15).forEach(f => say(`  - \`${f}\``));
  if (modified.length > 15) say(`  - …and ${modified.length-15} more`);
}
if (!dirty.length) say('- Working tree clean.');
say('');

/* ── 2 · SURFACES ────────────────────────────────────────────────────── */
say('## 2 · Surfaces — what exists, measured');
say('');
say('| File | Lines | ids | fetch | fn | Modified |');
say('|---|---|---|---|---|---|');

const surfaces = [
  ...walk(path.join(R,'public')).filter(p => p.endsWith('.html')),
  ...walk(path.join(R,'docs')).filter(p => p.endsWith('.html')),
].sort();

for (const p of surfaces) {
  const m = measure(p);
  if (!m) continue;
  const flag = m.dupIds.length ? ' ⚠dup' : '';
  say(`| \`${rel(p)}\` | ${m.lines} | ${m.ids}${flag} | ${m.fetch} | ${m.funcs} | ${m.mtime} |`);
}
say('');
say('A file with 0 fetch calls is a **prototype** — a specification, never wired.');
say('A file with fetch calls is an **engine**. Never drop one onto the other.');
say('');

/* ── 3 · COMPONENT REGISTRY ──────────────────────────────────────────── */
say('## 3 · Component registry — ask before building');
say('');
say('Before building any UI, check this list. Reinventing something that already');
say('exists has cost real time more than once.');
say('');
const docsDir = path.join(R,'docs');
if (fs.existsSync(docsDir)) {
  const groups = {};
  for (const p of walk(docsDir)) {
    const parts = rel(p).split('/');
    const key = parts.slice(0, parts.length - 1).join('/');
    (groups[key] = groups[key] || []).push(parts[parts.length-1]);
  }
  Object.keys(groups).sort().forEach(k => {
    say(`- \`${k}/\``);
    groups[k].sort().forEach(f => say(`  - ${f}`));
  });
} else {
  say('_no docs/ directory_');
}
say('');

/* ── 4 · ENGINE TRUTH ────────────────────────────────────────────────── */
say('## 4 · Engine truth — effect lists, read from lib/');
say('');
say('Three lists guard the same door. When they disagree, effects go missing.');
say('');

function extractList(file, re, label, blockStart) {
  let s = read(path.join(R, file));
  if (s === null) { say(`- \`${file}\` — **not found**`); return []; }
  if (blockStart) {                       // scope to one declaration, not the file
    const i = s.indexOf(blockStart);
    if (i < 0) { say(`- \`${file}\` — \`${blockStart}\` not found`); return []; }
    // works for both object and array declarations
    // anchor on the assignment, so a type annotation like Foo[] is skipped
    let j = s.indexOf('=', i);
    if (j < 0) j = i;
    while (j < s.length && s[j] !== '{' && s[j] !== '[') j++;
    let open = '', close = '';
    open = s[j]; close = open === '{' ? '}' : ']';
    let d = 0, k = j;
    for (; k < s.length; k++) {
      if (s[k] === open) d++;
      else if (s[k] === close) { d--; if (!d) break; }
    }
    s = s.slice(j, k + 1);
  }
  const ids = [...s.matchAll(re)].map(m => m[1]);
  const uniq = [...new Set(ids)];
  say(`- **${label}** — \`${file}\` — ${uniq.length} entries`);
  say(`  \`${uniq.join(', ')}\``);
  return uniq;
}

const presets = extractList(
  'lib/v1/portraits/portraits-shared.ts',
  /([a-z_]+):\s*'[^']*'/g,
  'PRESET_LABELS — /generate accepts these',
  'PRESET_LABELS');
const curated = extractList(
  'lib/v1/portraits/portraits-effect-curator.ts',
  /preset:\s*'([a-z_]+)'/g,
  'EFFECT_CATALOG — the Curator can recommend these');
const experimental = extractList(
  'lib/v1/portraits/portraits-experimental.ts',
  /id:\s*'([a-z_]+)'/g,
  'EXPERIMENTAL_EFFECTS — needs isExperimentalEffect() at the guard',
  'EXPERIMENTAL_EFFECTS');

say('');
const invisible = presets.filter(p => !curated.includes(p));
if (invisible.length) {
  say(`⚠ **${invisible.length} preset(s) render but the Curator cannot offer them:**`);
  say(`\`${invisible.join(', ')}\``);
  say('The Curator is the customer path — an effect it cannot name is invisible.');
}
say('');

/* ── 5 · CATALOGUE RECONCILIATION ────────────────────────────────────── */
say('## 5 · Catalogue vs engine');
say('');
const catPath = path.join(R,'docs/SYSTEM/portraits-catalogue.js');
const cat = read(catPath);
if (!cat) {
  say('- `docs/SYSTEM/portraits-catalogue.js` — **not found**');
} else {
  let M = null;
  try { M = new Function(cat + ' return {CATALOGUE,EFFECTS_FLAT};')(); } catch(e) {
    say(`- catalogue failed to evaluate: ${e.message}`);
  }
  if (M) {
    const engine = new Set([...presets, ...experimental]);
    const flat = M.EFFECTS_FLAT;
    say(`- ${M.CATALOGUE.length} silos · ${flat.length} effects`);
    const backed = flat.filter(e => engine.has(e.id));
    say(`- **${backed.length}/${flat.length} render today.**`);
    const none = flat.filter(e => !engine.has(e.id));
    if (none.length) say(`- No prompt yet: \`${none.map(e=>e.id).join(', ')}\``);
    const orphan = [...engine].filter(id => !flat.some(e => e.id === id));
    if (orphan.length) say(`- ⚠ Engine has, catalogue does not: \`${orphan.join(', ')}\``);
    const ghost = flat.filter(e => e.engine && !engine.has(e.id));
    if (ghost.length) say(`- ⚠ **Catalogue claims engine support it does not have:** \`${ghost.map(e=>e.id).join(', ')}\``);
  }
}
say('');

/* ── 6 · ASSETS ──────────────────────────────────────────────────────── */
say('## 6 · Assets');
say('');
for (const d of ['public/textures','public/icons','public/previews/portraits']) {
  const p = path.join(R, d);
  if (!fs.existsSync(p)) { say(`- \`${d}/\` — **missing**`); continue; }
  const f = fs.readdirSync(p);
  say(`- \`${d}/\` — ${f.length} item(s)`);
  if (f.length && f.length <= 12) say(`  \`${f.join(', ')}\``);
}
say('');

/* ── 7 · REFERENCED BUT ABSENT ───────────────────────────────────────── */
say('## 7 · Referenced but absent');
say('');
const refs = new Set();
for (const p of surfaces) {
  const s = read(p) || '';
  for (const m of s.matchAll(/url\((\/[^)'"]+\.(?:png|jpg|jpeg|svg|webp))\)/g)) refs.add(m[1]);
  for (const m of s.matchAll(/src="(\/[^"]+\.(?:png|jpg|jpeg|svg|webp))"/g)) refs.add(m[1]);
}
const absent = [...refs].filter(u => !fs.existsSync(path.join(R,'public',u)));
if (absent.length) {
  say(`${absent.length} asset(s) referenced by a surface but not on disk:`);
  absent.slice(0,30).forEach(u => say(`- \`${u}\``));
} else {
  say('None — every referenced asset resolves.');
}
say('');

/* ── 8 · STANDING GATES ──────────────────────────────────────────────── */
/* ── 7b · THE STAGE CONTRACT ─────────────────────────────────────────── */
say('## 7b · Stage contract');
say('');
const contractFile = walk(path.join(R,'public'))
  .filter(p => /litenco-stage-\d{4}-\d{2}-\d{2}-s\d+\.html$/.test(p))
  .sort().pop();
if (!contractFile) {
  say('- no stage file found in public/');
} else {
  say(`- canonical: \`${rel(contractFile)}\``);
  const cs = read(contractFile) || '';
  const css = (cs.match(/<style>[\s\S]*?<\/style>/g) || []).join('\n')
                .replace(/\/\*[\s\S]*?\*\//g, '');
  const rows = [
    ['body is a block',        !/(^|[};\s])body\s*\{[^}]*display\s*:\s*(flex|grid)/.test(css)],
    ['root type has a 16px floor', /--type-min\s*:\s*1[6-9]px|font-size\s*:\s*clamp\(\s*1[6-9]px/.test(css)],
    ['stage reads --stage-w',  /\.stage\s*\{[^}]*width\s*:\s*var\(--stage-w\)/.test(css)],
    ['ground is fixed',        /\.ground\s*\{[^}]*position\s*:\s*fixed/.test(css)],
    ['masthead tracks the gutter', /padding-inline\s*:\s*var\(--stage-gutter\)/.test(css)],
  ];
  rows.forEach(([label, ok]) => say(`- ${ok ? '✓' : '⚠'} ${label}`));
  say('');
  say('Run `node scripts/gate-stage.js ' + rel(contractFile) + '` for the full check.');
}
say('');

say('## 8 · Standing gates');
say('');
say('Cumulative. A gate added because something broke is never removed.');
say('');
say('- All declared `fetch()` calls present; no id lost; function count not decreased');
say('- No duplicate ids · `node --check` clean · style braces balanced · boots in jsdom');
say('- Radius ≤ 8px, except 999px where the constrained dimension is ≤ 72px, or a true circle');
say('- `[hidden]{display:none!important}` present — a display rule must not beat the attribute');
say('- No horizontal `min-width` ≥ 1200px without a release breakpoint below it');
say('- Cormorant never below 1.333rem, never above weight 400');
say('- Grid track sets never sum to 100% alongside a gap');
say('- No percentage padding used as vertical reserve');
say('- Bench tooling never ported forward into a surface');
  say('- body is never a flex or grid container — the stage becomes a flex item');
  say('- only :root may size type with clamp(), and its floor is 16px');
  say('- a fixed-px container must size its own type, not inherit rem');
say('');

/* ── 9 · THE THREE RULES ─────────────────────────────────────────────── */
say('## 9 · Rules that exist because they were broken');
say('');
say('1. **Verification.** No claim about this repo, the engine, or another lane is');
say('   stated as fact unless read that day from live source. Absence from an');
say('   upload is not evidence of absence.');
say('2. **Ask before building.** Check §3 first. The masthead, entry gate, account,');
say('   print shop and portraits surfaces already exist.');
say('3. **Commit and push at every acceptance.** Named files, never `git add -A`.');
say('');

const text = out.join('\n');
fs.writeFileSync(path.join(R,'BOOT-REPORT.md'), text, 'utf8');
console.log(text);
console.log('\n— written to BOOT-REPORT.md —');
