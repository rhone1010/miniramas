const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const FILE = 'lib/v1/portraits/portraits-bodies.ts';
const args = process.argv.slice(2).filter(a => a !== '--full');
const FULL = process.argv.includes('--full');

const FROM = args[0] || 'HEAD~1';
const TO   = args[1] || 'HEAD';

function at(ref) {
  try {
    return execSync(`git show ${ref}:${FILE}`, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch {
    console.error(`\ncannot read ${FILE} at ${ref} — is the ref right?\n`);
    process.exit(1);
  }
}

function parse(src) {
  const out = {};
  const re = /\n {2}([a-z0-9_]+): \{\s*\n\s*id:\s*'\1',\s*\n\s*body:\s*`([\s\S]*?)`,\s*\n\s*avoid:\s*(null|`[\s\S]*?`),/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    out[m[1]] = { body: m[2].trim(), avoid: m[3] === 'null' ? '' : m[3].slice(1, -1).trim() };
  }
  return out;
}

const MARKERS = [
  ['atelier',      'old-world artist'],
  ['no-props',     'No held objects'],
  ['live edge',    'live edge'],
  ['knife canvas', 'palette knife on canvas'],
  ['symphony',     'symphony hall'],
  ['garment line', "own garment carries through"],
];

function marks(t) {
  return MARKERS.filter(([, tok]) => t.includes(tok)).map(([name]) => name);
}

const A = parse(at(FROM));
const B = parse(at(TO));

const added   = Object.keys(B).filter(k => !(k in A)).sort();
const removed = Object.keys(A).filter(k => !(k in B)).sort();
const changed = Object.keys(B)
  .filter(k => k in A && (A[k].body !== B[k].body || A[k].avoid !== B[k].avoid))
  .sort();
const same = Object.keys(B).filter(k => k in A && A[k].body === B[k].body && A[k].avoid === B[k].avoid);

const lines = [];
const p = s => { lines.push(s); console.log(s); };

p('');
p(`bodies-changed  ${FROM} -> ${TO}`);
p(`  ${Object.keys(A).length} bodies before, ${Object.keys(B).length} after`);
p(`  ${changed.length} changed | ${added.length} added | ${removed.length} removed | ${same.length} untouched`);
p('');

if (added.length) {
  p(`ADDED (${added.length})`);
  added.forEach(k => p(`  ${k.padEnd(20)} ${String(B[k].body.length).padStart(5)} chars   ${marks(B[k].body).join(' | ')}`));
  p('');
}
if (removed.length) {
  p(`REMOVED (${removed.length})`);
  removed.forEach(k => p(`  ${k}`));
  p('');
}
if (changed.length) {
  p(`CHANGED (${changed.length})`);
  p(`  ${'effect'.padEnd(20)} ${'before'.padStart(6)} ${'after'.padStart(6)}   gained / lost`);
  changed.forEach(k => {
    const was = marks(A[k].body), now = marks(B[k].body);
    const gained = now.filter(x => !was.includes(x)).map(x => '+' + x);
    const lost   = was.filter(x => !now.includes(x)).map(x => '-' + x);
    const note   = [...gained, ...lost].join(' ') ||
      (A[k].avoid !== B[k].avoid && A[k].body === B[k].body ? 'avoid only' : 'text');
    p(`  ${k.padEnd(20)} ${String(A[k].body.length).padStart(6)} ${String(B[k].body.length).padStart(6)}   ${note}`);
  });
  p('');
}
if (!changed.length && !added.length && !removed.length) {
  p('no body changed between these two refs.');
  p('');
}

if (FULL && (changed.length || added.length)) {
  p('---');
  p('');
  [...added, ...changed].sort().forEach(k => {
    p(`### ${k}`);
    p('');
    p(B[k].body);
    p('');
    if (B[k].avoid) { p(`*avoid:* ${B[k].avoid}`); p(''); }
  });
}

const out = path.join(process.cwd(), 'bodies-changed.md');
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log(`written: ${path.relative(process.cwd(), out)}\n`);