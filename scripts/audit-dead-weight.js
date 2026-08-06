/* scripts/audit-dead-weight.js — 2026-08-05 · CUI V25
 *
 * What is in this repo that should not deploy.
 *
 * IT DELETES NOTHING AND MOVES NOTHING.
 *   Rich's rule: nothing leaves these machines for the foreseeable future.
 *   This reports, and writes two artefacts for him to review and run — or
 *   not:
 *
 *     scripts/out/vercelignore.suggested   what to stop uploading
 *     scripts/out/archive-moves.ps1        what to move to the backup drive
 *
 *   Neither runs itself. Read them, edit them, then decide.
 *
 * WHAT IT LOOKS FOR
 *
 *   1 · Superseded stage revisions. public/ holds every build from s75
 *       onward and all of them deploy. An old one still takes money at old
 *       prices, and a tester who bookmarked one is still on it a fortnight
 *       later. Only the current file and a named stable entry point should
 *       reach Vercel.
 *
 *   2 · Series that are not in the Aug 9 scope. Portraits, Pets, Groups,
 *       Action and Mobile Wallpapers ship. Everything else — houses,
 *       landscapes, sportsmem, moments, structures — is code nobody calls,
 *       and it is the code most likely to break a build with an import to a
 *       file that was renamed a month ago.
 *
 *   3 · Unreferenced lib files. Nothing in app/ or lib/ imports them.
 *
 *   4 · Broken imports. An import with no file behind it FAILS THE BUILD.
 *       These are not clutter; they are the reason a deploy dies. Reported
 *       first and separately.
 *
 *   5 · Weight. Bytes per category, so the size of the problem is a number
 *       rather than a feeling.
 *
 * RUN
 *   node scripts/audit-dead-weight.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTDIR = path.join(__dirname, 'out');

/* What actually ships on Aug 9. Locked 2026-07-27. */
const LAUNCH_SERIES = ['portraits', 'pets', 'groups', 'action', 'actionmini', 'wallpapers'];

/* Series folders that exist and are not in scope. Not deleted — Groups is
   months away and will want its own folder back one day. */
const OUT_OF_SCOPE = ['houses', 'landscapes', 'sportsmem', 'moments', 'structures'];

const CODE = /\.(ts|tsx|js|jsx)$/;
const SKIP_DIRS = new Set(['node_modules', '.next', '.git', '.vercel', 'out']);

function walk(dir, hits = []) {
  if (!fs.existsSync(dir)) return hits;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, hits);
    else hits.push(p);
  }
  return hits;
}

const rel = (p) => path.relative(ROOT, p).replace(/\\/g, '/');
const kb = (n) => (n / 1024).toFixed(0) + 'kb';
const mb = (n) => (n / 1024 / 1024).toFixed(1) + 'MB';

const all = walk(path.join(ROOT, 'app'))
  .concat(walk(path.join(ROOT, 'lib')))
  .concat(walk(path.join(ROOT, 'components')));

const code = all.filter((p) => CODE.test(p));

// ── read every import once ──────────────────────────────────────────────────
const imports = new Map();   // file -> [resolved targets, unresolved specifiers]
const referenced = new Set();
const broken = [];

for (const file of code) {
  const text = fs.readFileSync(file, 'utf8');
  const specs = [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
  for (const spec of specs) {
    if (!spec.startsWith('@/') && !spec.startsWith('./') && !spec.startsWith('../')) continue;
    const base = spec.startsWith('@/')
      ? path.join(ROOT, spec.slice(2))
      : path.resolve(path.dirname(file), spec);

    const found = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx']
      .map((ext) => base + ext)
      .concat([base])
      .find((c) => fs.existsSync(c) && fs.statSync(c).isFile());

    if (found) referenced.add(path.resolve(found));
    else broken.push({ file: rel(file), spec });
  }
  imports.set(file, specs);
}

// ── 1 · the stage revisions ─────────────────────────────────────────────────
const pub = path.join(ROOT, 'public');
const stages = fs.existsSync(pub)
  ? fs.readdirSync(pub).filter((f) => /^litenco-stage-.*\.html$/.test(f)).sort()
  : [];
const current = stages[stages.length - 1] || null;
const oldStages = stages.filter((f) => f !== current);
const oldStageBytes = oldStages.reduce((n, f) => n + fs.statSync(path.join(pub, f)).size, 0);

/* Anything else in public/ that looks like a superseded build. */
const otherHtml = fs.existsSync(pub)
  ? fs.readdirSync(pub).filter((f) => f.endsWith('.html') && !/^litenco-stage-/.test(f))
  : [];

// ── 2 · out-of-scope series ─────────────────────────────────────────────────
const seriesDirs = [];
for (const s of OUT_OF_SCOPE) {
  for (const where of [path.join(ROOT, 'lib', 'v1', s), path.join(ROOT, 'app', 'api', 'v1', s),
                       path.join(ROOT, 'app', s)]) {
    if (fs.existsSync(where)) {
      const files = walk(where);
      seriesDirs.push({
        dir: rel(where),
        files: files.length,
        bytes: files.reduce((n, f) => n + fs.statSync(f).size, 0),
      });
    }
  }
}

// ── 3 · unreferenced lib files ──────────────────────────────────────────────
/* A route.ts or page.tsx is reached by the router, not by an import, so
   never count those as unreferenced. */
const orphans = code
  .filter((p) => rel(p).startsWith('lib/'))
  .filter((p) => !referenced.has(path.resolve(p)))
  .map((p) => ({ file: rel(p), bytes: fs.statSync(p).size }))
  .sort((a, b) => b.bytes - a.bytes);

// ── report ──────────────────────────────────────────────────────────────────
console.log('\n════ BROKEN IMPORTS — these fail the build ════');
if (!broken.length) console.log('  none');
broken.forEach((b) => console.log(`  ${b.file}\n    → ${b.spec}`));

console.log('\n════ SUPERSEDED STAGE REVISIONS ════');
console.log(`  current: ${current || 'none found'}`);
console.log(`  ${oldStages.length} older revisions, ${mb(oldStageBytes)}`);
if (otherHtml.length) console.log(`  other html in public/: ${otherHtml.join(', ')}`);

console.log('\n════ SERIES NOT IN THE AUG 9 SCOPE ════');
if (!seriesDirs.length) console.log('  none');
seriesDirs.forEach((s) => console.log(`  ${s.dir.padEnd(34)} ${String(s.files).padStart(3)} files  ${kb(s.bytes)}`));

console.log('\n════ LIB FILES NOTHING IMPORTS ════');
if (!orphans.length) console.log('  none');
orphans.slice(0, 40).forEach((o) => console.log(`  ${kb(o.bytes).padStart(7)}  ${o.file}`));
if (orphans.length > 40) console.log(`  … and ${orphans.length - 40} more`);
console.log(`  ${orphans.length} files, ${mb(orphans.reduce((n, o) => n + o.bytes, 0))}`);

// ── the two artefacts ───────────────────────────────────────────────────────
if (!fs.existsSync(OUTDIR)) fs.mkdirSync(OUTDIR, { recursive: true });

const ignore = [
  '# .vercelignore — SUGGESTED. Review before using.',
  '#',
  '# Files listed here are not uploaded to Vercel. They are NOT deleted, NOT',
  '# untracked, and still on disk and in git. This is the mechanism for',
  '# "keep it, do not ship it".',
  '#',
  '# Generated ' + new Date().toISOString().slice(0, 10) + ' by scripts/audit-dead-weight.js',
  '',
  '# Every stage revision except the current one. An old build still takes',
  '# money at old prices.',
  ...oldStages.map((f) => 'public/' + f),
  '',
  '# Build scripts and their records — the repo keeps them, Vercel has no use',
  '# for them.',
  'scripts/',
  '',
  '# Working notes.',
  'docs/',
  '_recovery/',
  '',
  '# Series not in the Aug 9 scope. REVIEW EACH ONE: excluding a folder that',
  '# something still imports will fail the build rather than slim it.',
  ...seriesDirs.map((s) => '# ' + s.dir),
  '',
].join('\n');

fs.writeFileSync(path.join(OUTDIR, 'vercelignore.suggested'), ignore + '\n', 'utf8');

const moves = [
  '# archive-moves.ps1 — SUGGESTED. Read it before running it.',
  '#',
  '# Moves, never deletes. Set $ARCHIVE to the backup drive first.',
  '# Everything remains in git history regardless.',
  '#',
  '# Generated ' + new Date().toISOString().slice(0, 10),
  '',
  '$ARCHIVE = "E:\\liten-archive"    # <-- set this',
  '$STAMP   = Get-Date -Format "yyyy-MM-dd"',
  '$DEST    = Join-Path $ARCHIVE $STAMP',
  '',
  'if (-not (Test-Path $ARCHIVE)) { Write-Error "Archive drive not found: $ARCHIVE"; exit 1 }',
  'New-Item -ItemType Directory -Force -Path "$DEST\\public" | Out-Null',
  '',
  '# ── superseded stage revisions ──────────────────────────────────────────',
  ...oldStages.map((f) => `Move-Item "public\\${f}" "$DEST\\public\\" -Force`),
  '',
  '# ── series not in scope ─────────────────────────────────────────────────',
  '# COMMENTED OUT. Groups returns one day and these are the folders it wants.',
  '# Uncomment only what you are sure of, and run the audit again afterwards.',
  ...seriesDirs.map((s) => `# Move-Item "${s.dir.replace(/\//g, '\\')}" "$DEST\\" -Force`),
  '',
  'Write-Host "Moved to $DEST"',
  '',
].join('\n');

fs.writeFileSync(path.join(OUTDIR, 'archive-moves.ps1'), moves, 'utf8');

console.log('\n════ WRITTEN, NOT RUN ════');
console.log('  scripts/out/vercelignore.suggested');
console.log('  scripts/out/archive-moves.ps1');
console.log('\nNothing was moved and nothing was deleted.');
if (broken.length) {
  console.log('\nFix the broken imports first — the rest is housekeeping, those are a');
  console.log('failed deploy.');
}
