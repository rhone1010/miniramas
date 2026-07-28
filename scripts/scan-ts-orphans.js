/* scan-ts-orphans.js — which .ts files under lib/ and app/ is anything importing?
 * CUI V22 · 2026-07-27
 *
 *   cd D:\minramas
 *   node scripts/scan-ts-orphans.js
 *
 * Reads only. Deletes nothing. Route files (app/**\/route.ts) are entry points —
 * Next.js loads them by convention, so they are never orphans.
 */
const fs = require('fs'), path = require('path');

const ROOTS = ['lib', 'app', 'scripts'];
const SRC_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs']);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === '.git') continue;
      walk(p, out);
    } else if (SRC_EXT.has(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

const files = ROOTS.flatMap(r => walk(r));
const corpus = files.map(f => ({ f, text: fs.readFileSync(f, 'utf8') }));

const isRoute = f => /[\\/](route|page|layout|middleware)\.tsx?$/.test(f);
const isTest  = f => /\.(test|spec)\.[tj]sx?$/.test(f);

const orphans = [], used = [];

for (const f of files) {
  if (!f.startsWith('lib') && !f.startsWith('app')) continue;
  if (isRoute(f) || isTest(f)) continue;

  const base = path.basename(f).replace(/\.(tsx?|jsx?|mjs)$/, '');
  const dirName = path.dirname(f).split(path.sep).pop();

  // an importer names it either by file stem or as dir/stem
  const needle = new RegExp(
    `from\\s+['"\`][^'"\`]*(${escape(dirName)}/)?${escape(base)}['"\`]|` +
    `import\\(['"\`][^'"\`]*${escape(base)}['"\`]\\)`,
  );

  const importers = corpus.filter(c => c.f !== f && needle.test(c.text)).map(c => c.f);
  if (importers.length === 0) orphans.push(f);
  else used.push({ f, n: importers.length });
}

function escape(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

console.log(`scanned ${files.length} source files under ${ROOTS.join(', ')}`);
console.log(`imported by something: ${used.length}`);
console.log(`\nNO IMPORTER FOUND — ${orphans.length}`);
orphans.sort().forEach(f => console.log('  ' + f));
console.log(`
Not proof of dead code. Check each before removing:
  - loaded dynamically by a string built at runtime
  - a type-only file some builds elide
  - genuinely orphaned
Archive rather than delete. Nothing here was modified.`);
