#!/usr/bin/env node
// scripts/emit-effect-registry.js
//
// Reads lib/v1/portraits/effect-registry.ts and emits public/effect-registry.js
// for the standalone HTML lanes, which have no build step and cannot import TS.
//
//   node scripts/emit-effect-registry.js
//
// Parses the TS by regex rather than compiling it — no toolchain, no deps.
// If the registry's shape changes materially, this needs updating too.
// It fails loudly rather than emitting a partial file.

const fs   = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'effect-registry.ts');
const OUT = path.join(process.cwd(), 'public', 'effect-registry.js');

function die(msg) { console.error('\n[emit-registry] FAILED: ' + msg + '\n'); process.exit(1); }

if (!fs.existsSync(SRC)) die('source not found at ' + SRC);
const src = fs.readFileSync(SRC, 'utf8');

// ── pull an array literal by its exported name ───────────────────────────────
function arrayBlock(name) {
  const start = src.indexOf(`export const ${name}`);
  if (start === -1) die(`could not find "export const ${name}"`);
  // find the '=' that opens the initializer, NOT the '[' in a type like Silo[]
  const eq = src.indexOf('=', start);
  if (eq === -1) die(`no initializer for ${name}`);
  const open = src.indexOf('[', eq);
  if (open === -1) die(`no array literal after ${name}`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '[') depth++;
    else if (src[i] === ']') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  die(`unterminated array for ${name}`);
}

// ── parse `{ ... }` object literals out of a block ───────────────────────────
function objects(block) {
  const out = [];
  let depth = 0, start = -1;
  for (let i = 0; i < block.length; i++) {
    const c = block[i];
    if (c === '{') { if (depth === 0) start = i; depth++; }
    else if (c === '}') { depth--; if (depth === 0) out.push(block.slice(start, i + 1)); }
  }
  return out;
}

function str(obj, key) {
  // single-quoted, allowing \u escapes and escaped quotes
  const m = obj.match(new RegExp(`\\b${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  if (!m) return undefined;
  return m[1].replace(/\\'/g, "'").replace(/\\u([0-9a-fA-F]{4})/g,
    (_, h) => String.fromCharCode(parseInt(h, 16)));
}
function bool(obj, key) {
  const m = obj.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  return m ? m[1] === 'true' : undefined;
}
function num(obj, key) {
  const m = obj.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+)`));
  return m ? parseInt(m[1], 10) : undefined;
}
function clean(o) {
  Object.keys(o).forEach(k => { if (o[k] === undefined) delete o[k]; });
  return o;
}

// ── SILOS ────────────────────────────────────────────────────────────────────
const silos = objects(arrayBlock('SILOS')).map(o => clean({
  id:    str(o, 'id'),
  label: str(o, 'label'),
  line:  str(o, 'line'),
}));

// ── EFFECTS ──────────────────────────────────────────────────────────────────
const effects = objects(arrayBlock('EFFECTS')).map(o => clean({
  id:            str(o, 'id'),
  label:         str(o, 'label'),
  category:      str(o, 'category'),
  mode:          str(o, 'mode'),
  monolithic:    bool(o, 'monolithic'),
  body:          str(o, 'body'),
  refs:          num(o, 'refs'),
  framing:       str(o, 'framing'),
  likenessFloor: str(o, 'likenessFloor'),
  skipStaging:   bool(o, 'skipStaging'),
  skipUniversal: bool(o, 'skipUniversal'),
  genderedRefs:  bool(o, 'genderedRefs'),
  // `note` is deliberately NOT emitted — it is lane-internal, often long,
  // and has no business shipping to the browser.
}));

// ── POSES ────────────────────────────────────────────────────────────────────
const poses = objects(arrayBlock('POSES')).map(o => clean({
  id:       str(o, 'id'),
  label:    str(o, 'label'),
  preserve: bool(o, 'preserve'),
}));

// ── validate ─────────────────────────────────────────────────────────────────
const siloIds = new Set(silos.map(s => s.id));
const seen = new Set();
const errs = [];

if (!silos.length)   errs.push('no silos parsed');
if (!effects.length) errs.push('no effects parsed');
if (!poses.length)   errs.push('no poses parsed');

effects.forEach(e => {
  if (!e.id)                       errs.push('effect with no id');
  if (!e.label)                    errs.push(`${e.id}: no label`);
  if (!/^[a-z0-9_]+$/.test(e.id))  errs.push(`${e.id}: id must be snake_case a-z0-9_`);
  if (seen.has(e.id))              errs.push(`${e.id}: duplicate id`);
  seen.add(e.id);
  if (!siloIds.has(e.category))    errs.push(`${e.id}: unknown category "${e.category}"`);
  if (!['live','authored','todo'].includes(e.body)) errs.push(`${e.id}: bad body status`);
  if (/&[a-z]+;|&#/.test(e.label)) errs.push(`${e.id}: label contains an HTML entity — use plain unicode`);
});

if (errs.length) die('validation:\n  - ' + errs.join('\n  - '));

// ── emit ─────────────────────────────────────────────────────────────────────
const payload = {
  generatedAt: new Date().toISOString(),
  silos, effects, poses,
};

const js =
`/* GENERATED FILE — DO NOT EDIT.
   Source: lib/v1/portraits/effect-registry.ts  (CENG-owned)
   Regenerate: node scripts/emit-effect-registry.js
   Emitted: ${payload.generatedAt}

   Labels are plain unicode. Key on .id, never on .label.
   Offer only effects where body === 'live' — the gate refuses the rest. */
window.EFFECT_REGISTRY = ${JSON.stringify(payload, null, 2)};

/* convenience, matching the TS helpers */
window.EFFECT_REGISTRY.bySilo = function (siloId) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.category === siloId; });
};
window.EFFECT_REGISTRY.offerableBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.bySilo(siloId).filter(function (e) { return e.body === 'live'; });
};
window.EFFECT_REGISTRY.byId = function (id) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.id === id; })[0];
};

/* Gendered costume variants sit BEHIND a tile, not on one. Another Age has
   seven tiles and fourteen rows: victorian is the tile, victorian_woman is
   the woman side of its toggle. Draw tiles with tilesBySilo(); resolve the
   toggle with variantFor(). */
window.EFFECT_REGISTRY.isVariant = function (id) {
  return /_woman$/.test(id);
};
window.EFFECT_REGISTRY.tilesBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.bySilo(siloId).filter(function (e) {
    return !window.EFFECT_REGISTRY.isVariant(e.id);
  });
};
window.EFFECT_REGISTRY.offerableTilesBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.tilesBySilo(siloId).filter(function (e) {
    return e.body === 'live';
  });
};
window.EFFECT_REGISTRY.variantFor = function (id, subject) {
  if (subject !== 'woman') return window.EFFECT_REGISTRY.byId(id);
  return window.EFFECT_REGISTRY.byId(id + '_woman') || window.EFFECT_REGISTRY.byId(id);
};
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js, 'utf8');

// ── report ───────────────────────────────────────────────────────────────────
const live     = effects.filter(e => e.body === 'live').length;
const authored = effects.filter(e => e.body === 'authored').length;
const todo     = effects.filter(e => e.body === 'todo').length;
const refs     = effects.reduce((n, e) => n + (e.refs || 0), 0);

console.log(`\n[emit-registry] wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  silos    ${silos.length}`);
const variants = effects.filter(e => /_woman$/.test(e.id)).length;
console.log(`  effects  ${effects.length}   live ${live} · authored ${authored} · todo ${todo}`);
console.log(`  tiles    ${effects.length - variants}   (${variants} gendered variants behind toggles)`);
console.log(`  poses    ${poses.length}`);
console.log(`  refs     ${refs} plates approved`);

// Tiles, not rows. A gendered costume variant (`*_woman`) lives behind its
// base tile's men/women toggle and must not be counted as a tile of its own —
// Another Age is 7 tiles and 14 rows by design.
const isVariant = id => /_woman$/.test(id);

silos.forEach(s => {
  const rows  = effects.filter(e => e.category === s.id);
  const tiles = rows.filter(e => !isVariant(e.id)).length;
  const flag  = tiles === 7 ? '' : `   <-- ${tiles > 7 ? 'OVER' : 'UNDER'} by ${Math.abs(tiles - 7)}`;
  const extra = rows.length !== tiles ? `  (${rows.length} rows, ${rows.length - tiles} behind the toggle)` : '';
  console.log(`  ${s.id.padEnd(18)} ${tiles}${extra}${flag}`);
});
console.log('');
