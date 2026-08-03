#!/usr/bin/env node
// scripts/verify-new-bodies.js — THROWAWAY. Delete _verify-DELETE-ME after use.
//
// Renders the 27 bodies written on 2026-08-02 so Rich can eyeball whether the
// medium is right — flat artwork vs three-dimensional object. That is the only
// failure mode this is looking for.
//
//   node scripts/verify-new-bodies.js <source-man.jpg> [source-woman.jpg]
//
// Costume effects render against the woman source if one is given, since the
// *_woman bodies need one. Everything else uses the man.
// Needs REPLICATE_API_TOKEN.

const fs   = require('fs');
const path = require('path');

const SRC_M = process.argv[2];
const SRC_W = process.argv[3] || process.argv[2];
if (!SRC_M || !fs.existsSync(SRC_M)) {
  console.error('usage: node scripts/verify-new-bodies.js <source-man.jpg> [source-woman.jpg]');
  process.exit(1);
}
const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('REPLICATE_API_TOKEN not set'); process.exit(1); }

const OUTDIR = path.join(process.cwd(), '_verify-DELETE-ME');
const BODIES = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'portraits-bodies.ts');
const PLATES = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'style-refs');

// Written 2026-08-02. Grouped so the contact sheet reads by silo.
const IDS = [
  // Earth & Ore
  'bronze', 'jade', 'reclaimed_bronze', 'stone',
  // Light & Glass
  'sea_glass', 'stained_glass', 'neon', 'polished_gold', 'mercury',
  // The Living World
  'coral', 'tidewood', 'driftwood_resin', 'lichen_granite', 'petal_sculpture', 'sandstone',
  // Made by Hand
  'plushy', 'chocolate',
  // The Artists Gallery
  'impressionist', 'watercolour', 'charcoal_chalk', 'sheet_music',
  // Ink & Paper
  'folded_book',
  // Fantasy & Future
  'fire_face',
  // Another Age
  'renaissance', 'renaissance_woman', 'wild_west', 'wild_west_woman',
];

const WOMEN = new Set(IDS.filter(id => id.endsWith('_woman')));

// ── bodies ───────────────────────────────────────────────────────────────────
const ts = fs.readFileSync(BODIES, 'utf8');
function bodyFor(id) {
  const re = new RegExp("\\n  " + id + ": \\{\\s*\\n\\s*id:\\s*'" + id +
    "',\\s*\\n\\s*body:\\s*`([\\s\\S]*?)`,\\s*\\n\\s*avoid:\\s*(null|`[\\s\\S]*?`),", 'm');
  const m = ts.match(re);
  if (!m) return null;
  return { body: m[1], avoid: m[2] === 'null' ? '' : m[2].slice(1, -1) };
}

// ── plates, with the _woman → base folder fallback ───────────────────────────
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
function plates(id) {
  let folder = id, subject = null;
  if (id.endsWith('_woman')) {
    subject = 'woman';
    if (!fs.existsSync(path.join(PLATES, id))) folder = id.slice(0, -'_woman'.length);
  }
  const dir = path.join(PLATES, folder);
  if (!fs.existsSync(dir)) return [];
  let files = fs.readdirSync(dir).filter(f => EXT.has(path.extname(f).toLowerCase())).sort();
  if (subject) {
    const m = files.filter(f => f.toLowerCase().includes('_' + subject));
    if (m.length) files = m;
  }
  return files.slice(0, 2).map(f => fs.readFileSync(path.join(dir, f)).toString('base64'));
}

// ── NB2 ──────────────────────────────────────────────────────────────────────
async function nb2(prompt, srcB64, refB64s) {
  const images = [srcB64, ...refB64s].map(b => `data:image/jpeg;base64,${b}`);
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json', Prefer: 'wait' },
    body: JSON.stringify({
      version: 'google/nano-banana-2',
      input: { prompt, image_input: images, aspect_ratio: '1:1' },
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  let out = j.output;
  if (Array.isArray(out)) out = out[0];
  if (!out) throw new Error('no output: ' + JSON.stringify(j).slice(0, 200));
  const img = await fetch(out);
  return Buffer.from(await img.arrayBuffer());
}

// ── run ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(path.join(OUTDIR, 'DELETE-THIS-FOLDER.txt'),
    'Throwaway verification renders, 2026-08-02. Safe to delete.\n');

  const bufM = fs.readFileSync(SRC_M).toString('base64');
  const bufW = fs.readFileSync(SRC_W).toString('base64');

  let ok = 0, fail = 0;
  const missing = [];

  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    const found = bodyFor(id);
    if (!found) { missing.push(id); console.log(`[${i + 1}/${IDS.length}] ${id}  NO BODY`); continue; }

    const prompt = found.body + (found.avoid ? '\n' + found.avoid : '');
    const src    = WOMEN.has(id) ? bufW : bufM;
    const refs   = plates(id);

    process.stdout.write(`[${i + 1}/${IDS.length}] ${id.padEnd(20)} refs=${refs.length} ... `);
    try {
      const buf = await nb2(prompt, src, refs);
      fs.writeFileSync(path.join(OUTDIR, `${String(i + 1).padStart(2, '0')}_${id}.jpg`), buf);
      console.log('ok');
      ok++;
    } catch (e) {
      console.log('FAILED — ' + e.message.slice(0, 100));
      fail++;
    }
  }

  console.log(`\ndone — ${ok} rendered, ${fail} failed` +
    (missing.length ? `, no body for: ${missing.join(', ')}` : ''));
  console.log('output: ' + OUTDIR + '   <-- DELETE WHEN DONE');
})();
