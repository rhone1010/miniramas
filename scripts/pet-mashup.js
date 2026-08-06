#!/usr/bin/env node
// scripts/pet-mashup.js — THROWAWAY. Not part of the build.
//
// Renders the 49 non-costume Portraits bodies against a pet photograph, with
// the human-specific phrasing mechanically swapped for animal phrasing. The
// point is a ruling: does the material register survive on fur, or is this a
// rewrite from the ground up.
//
//   node scripts/pet-mashup.js <source.jpg> [outdir]
//
// Needs REPLICATE_API_TOKEN in the environment. Writes one jpg per effect
// plus prompts.txt so you can see exactly what each one was asked.

const fs   = require('fs');
const path = require('path');

const SRC_IMG = process.argv[2];
const OUTDIR  = process.argv[3] || path.join(process.cwd(), '_petmash');
if (!SRC_IMG || !fs.existsSync(SRC_IMG)) {
  console.error('usage: node scripts/pet-mashup.js <source.jpg> [outdir]');
  process.exit(1);
}
const TOKEN = process.env.REPLICATE_API_TOKEN;
if (!TOKEN) { console.error('REPLICATE_API_TOKEN not set'); process.exit(1); }

const BODIES = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'portraits-bodies.ts');
const PLATES = path.join(process.cwd(), 'lib', 'v1', 'portraits', 'style-refs');

// ── the 49 non-costume effects ───────────────────────────────────────────────
const IDS = [
  'bronze','iron','stone','jade','ebony','petrified_wood','reclaimed_bronze',
  'ice','cast_glass','sea_glass','stained_glass','neon','polished_gold','mercury',
  'coral','tidewood','driftwood_resin','lichen_granite','petal_sculpture','sand_form','sandstone',
  'plushy','chocolate','balloon_face','quilted','origami','porcelain','beaded',
  'impressionist','watercolour','charcoal_chalk','pencil_sketch','oil_impasto','linocut','sheet_music',
  'ukiyo_e','cubism','art_deco','art_nouveau','daguerreotype','folded_book','magic_energy',
  'dragon_skin','fire_face','forest_guardian','retro_robot','clockwork','starfield','crystallized',
];

// ── read the bodies out of the TS ────────────────────────────────────────────
const ts = fs.readFileSync(BODIES, 'utf8');
function bodyFor(id) {
  const re = new RegExp("\\n  " + id + ": \\{\\s*\\n\\s*id:\\s*'" + id + "',\\s*\\n\\s*body:\\s*`([\\s\\S]*?)`,\\s*\\n\\s*avoid:\\s*(null|`[\\s\\S]*?`),", 'm');
  const m = ts.match(re);
  if (!m) return null;
  const avoid = m[2] === 'null' ? '' : m[2].slice(1, -1);
  return { body: m[1], avoid };
}

// ── human → animal. Order matters; longest phrases first. ────────────────────
const SWAPS = [
  // framing — the big one. Pets are full-body, not busts.
  [/Framed from mid-chest to the top of the head, both shoulders and upper arms fully rendered\./g,
   'The whole animal is in frame, nose to tail, standing or sitting as in the source.'],
  [/Frame from mid-chest to the top of the head\./g,
   'The whole animal is in frame, nose to tail.'],
  [/framed from mid-chest to the top of the head\.?/gi,
   'the whole animal in frame, nose to tail.'],
  [/Framed from mid-chest to the top of the head/g,
   'The whole animal in frame, nose to tail'],

  // garment — pets have none.
  [/ The subject's own garment carries through in the same material\./g, ''],
  [/The garment (is|in) [^.]*\./g, ''],
  [/, the garment[^.]*\./g, '.'],
  [/ and the garment[^.]*\./g, '.'],
  [/the garment and background/g, 'the background'],
  [/garment, /g, ''],
  [/, garment/g, ''],
  [/garment/g, 'body'],

  // skin / hair → coat. Markings are identity for an animal.
  [/Clear the skin — blemishes, spots and blotchiness go\./g,
   'The coat markings are identity — reproduce every patch, spot and blaze exactly as in the source.'],
  [/No skin, no real hair\./g, 'No fur, no wet nose, no real eyes.'],
  [/no skin, no real hair\.?/gi, 'no fur, no wet nose, no real eyes.'],
  [/the real hairstyle's direction and length/g, "the coat's real direction and length"],
  [/following the real hairstyle/g, 'following the real lie of the coat'],
  [/the real hairstyle/g, 'the real lie of the coat'],
  [/the person's actual hairstyle/g, "the animal's actual coat"],
  [/Hair is /g, 'The coat is '],
  [/hair is /g, 'the coat is '],
  [/The hair /g, 'The coat '],
  [/\bhair\b/g, 'coat'],
  [/\bskin\b/g, 'coat'],

  // face parts an animal doesn't have in the same way
  [/the eyes, nose or mouth/g, 'the eyes, nose or muzzle'],
  [/brow, nose, cheek and lip/g, 'brow, muzzle, cheek and jaw'],
  [/the brow, nose and lip/g, 'the brow, muzzle and jaw'],
  [/brow, nose and lip/g, 'brow, muzzle and jaw'],
  [/\bLips are\b/g, 'The muzzle is'],
  [/\blips are\b/g, 'the muzzle is'],
  [/\bthe lip\b/g, 'the muzzle'],
  [/\bshoulders\b/g, 'shoulders and flanks'],

  // subject wording
  [/the subject a /g, 'the animal a '],
  [/the subject into /g, 'the animal into '],
  [/the subject as /g, 'the animal as '],
  [/the subject out of /g, 'the animal out of '],
  [/\bthe subject\b/g, 'the animal'],
  [/\bthe person\b/g, 'the animal'],
  [/the person reads clearly/g, 'the animal reads clearly'],
  [/\bbust\b/g, 'sculpture'],
  [/\bBust\b/g, 'Sculpture'],
  [/\bportrait\b/g, 'animal portrait'],

  // identity clause
  [/Never reshape, enlarge eyes, correct asymmetry or de-age\./g,
   'Never reshape the head, change the breed, alter the markings or restyle the coat.'],
  [/Keep permanent structure: lines, scars and the natural asymmetry of the face\./g,
   'Keep the exact head shape, ear set, muzzle length and eye spacing of this animal.'],
  [/Preserve natural facial character, asymmetry and expression\./g,
   'Preserve the exact breed character, ear set and expression of this animal.'],
];

const PET_HEAD = 'This is an animal, not a person. ';
const PET_TAIL = ' Breed, markings and proportions must match the source photograph exactly — this specific animal, not a generic one of its kind. Four legs, correct anatomy, tail present if the animal has one.';

function toPet(text) {
  let t = text;
  for (const [re, to] of SWAPS) t = t.replace(re, to);
  t = t.replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  return PET_HEAD + t + PET_TAIL;
}

// ── plates ───────────────────────────────────────────────────────────────────
const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp']);
function plates(id) {
  const dir = path.join(PLATES, id);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => EXT.has(path.extname(f).toLowerCase())).sort().slice(0, 1)
    .map(f => fs.readFileSync(path.join(dir, f)).toString('base64'));
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
  if (!out) throw new Error('no output: ' + JSON.stringify(j).slice(0, 300));
  const img = await fetch(out);
  return Buffer.from(await img.arrayBuffer());
}

// ── run ──────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(OUTDIR, { recursive: true });
  const srcB64 = fs.readFileSync(SRC_IMG).toString('base64');
  const log = [];
  let ok = 0, fail = 0, missing = [];

  for (let i = 0; i < IDS.length; i++) {
    const id = IDS[i];
    const found = bodyFor(id);
    if (!found) { missing.push(id); console.log(`[${i + 1}/${IDS.length}] ${id}  NO BODY`); continue; }

    const prompt = toPet(found.body) + (found.avoid ? '\n' + toPet(found.avoid) : '');
    log.push(`=== ${id} ===\n${prompt}\n`);

    process.stdout.write(`[${i + 1}/${IDS.length}] ${id} ... `);
    try {
      const buf = await nb2(prompt, srcB64, plates(id));
      fs.writeFileSync(path.join(OUTDIR, `${String(i + 1).padStart(2, '0')}_${id}.jpg`), buf);
      console.log('ok');
      ok++;
    } catch (e) {
      console.log('FAILED — ' + e.message.slice(0, 120));
      fail++;
    }
  }

  fs.writeFileSync(path.join(OUTDIR, 'prompts.txt'), log.join('\n'), 'utf8');
  console.log(`\ndone — ${ok} rendered, ${fail} failed${missing.length ? ', no body for: ' + missing.join(', ') : ''}`);
  console.log('output: ' + OUTDIR);
})();
