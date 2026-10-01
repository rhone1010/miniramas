#!/usr/bin/env node
// scripts/emit-groups-registry.js
//
// Reads lib/v1/groups/groups-effects.ts and emits public/groups-registry.js
// for the Groups room page, which has no build step and cannot import TS.
//
//   node scripts/emit-groups-registry.js
//
// WHY THIS EXISTS NOW. public/groups-registry.js has always carried the
// header "Regenerate: node scripts/emit-groups-registry.js" and that script
// has never existed. The file was hand-maintained under a DO NOT EDIT
// banner, which is why it still listed twenty-eight effects including six
// costume ones removed from the catalogue on 23 August.
//
// Parses the TS by regex rather than compiling it - no toolchain, no deps,
// same approach as emit-effect-registry.js. Fails loudly rather than
// emitting a partial file.
//
// ---- THE ROOMS LIVE HERE, NOT IN THE CATALOGUE -----------------------------
//
// groups-effects.ts has no `category` field and should not gain one. The
// original registry header states the reason and it still holds: which room
// an effect sits in is a glass decision, and putting it in the engine
// catalogue would put a glass decision inside CENG's file.
//
// So ROOMS below is the single place room membership is written down.
// Rich's ruling, 24 August 2026.
//
// ---- SIX PER ROOM -----------------------------------------------------------
//
// September catalog: 7 silos × 6 effects = 42. groups.html slices each room
// at CAP and appends an upsell card as the next grid slot. A room with more
// members than CAP silently loses the extras. This script REFUSES to emit if
// any room exceeds CAP.
//
// ---- PLATES DERIVE FROM THE ID ----------------------------------------------
//
// Every plate is public/previews/groups/groups_<id>.jpg. No lookup table.
// If a plate 404s the fix is the filename on disk, never a row in here.

const fs   = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'lib', 'v1', 'groups', 'groups-effects.ts');
const OUT = path.join(process.cwd(), 'public', 'groups-registry.js');
const CAP = 6;

function die(msg) { console.error('\n[emit-groups] FAILED: ' + msg + '\n'); process.exit(1); }

if (!fs.existsSync(SRC)) die('source not found at ' + SRC);
const src = fs.readFileSync(SRC, 'utf8');

// ---- THE ROOMS --------------------------------------------------------------
// Labels and Curator lines locked by Rich, 24 August 2026.
//
// ROOMS — 7 silos × 6 effects = 42 for the September catalog.
// Rich's final assignment, September 2026.
const ROOMS = [
  {
    id: 'portrait_collections',
    label: 'Portrait Collections',
    line: 'Separate portraits, brought together beautifully.',
    members: ['art_nouveau_faces', 'charcoal_faces', 'colored_pencil_faces', 'impasto_faces', 'impressionist_faces', 'watercolor_faces'],
  },
  {
    id: 'crafted_collections',
    label: 'Crafted Collections',
    line: 'Individual moments, composed into something new.',
    members: ['layered_paper_faces', 'mosaic_faces', 'stained_glass_faces', 'ukiyo_faces', 'family_mosaic', 'layered_paper'],
  },
  {
    id: 'sculpted',
    label: 'Sculpted',
    line: 'Form, weight and extraordinary materials.',
    members: ['bronze', 'gold', 'silver', 'jade', 'stone', 'lichen_granite'],
  },
  {
    id: 'material_magic',
    label: 'Material Magic',
    line: 'Familiar faces, transformed by the unexpected.',
    members: ['ice', 'sea_glass', 'porcelain', 'wax', 'chocolate', 'petal'],
  },
  {
    id: 'made_by_hand',
    label: 'Made by Hand',
    line: 'Cut, folded, stitched and carefully crafted.',
    members: ['carved', 'quilted', 'origami', 'plushy', 'stained_glass', 'sheet_music'],
  },
  {
    id: 'artists_studio',
    label: "The Artist's Studio",
    line: 'Drawing, painting and printmaking reimagined.',
    members: ['art_nouveau', 'impressionist', 'watercolor', 'linocut', 'ukiyo_e', 'colored_pencil'],
  },
  {
    id: 'curiosities',
    label: 'Curiosities',
    line: 'For when ordinary simply won\'t do.',
    members: ['art_deco', 'balloon', 'clockwork', 'driftwood_resin', 'neon', 'retro_robot'],
  },
];

// ---- PARSE ------------------------------------------------------------------
// Top-level catalogue entries are two-space indented. A nested brace inside a
// body template literal would break a naive scan, so entries are matched by
// their own closing "  }," at the same indent.
const entries = [];
const re = /^ {2}([a-z0-9_]+): \{([\s\S]*?)^ {2}\},/gm;
let m;
while ((m = re.exec(src)) !== null) {
  entries.push({ key: m[1], block: m[2] });
}
if (!entries.length) die('no effects parsed from ' + SRC);

function str(block, key) {
  const mm = block.match(new RegExp(`\\b${key}\\s*:\\s*'((?:[^'\\\\]|\\\\.)*)'`));
  return mm ? mm[1].replace(/\\'/g, "'") : undefined;
}
function num(block, key) {
  const mm = block.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+)`));
  return mm ? parseInt(mm[1], 10) : undefined;
}
function arr(block, key) {
  const mm = block.match(new RegExp(`\\b${key}\\s*:\\s*\\[([^\\]]*?)\\]`));
  if (!mm) return undefined;
  const items = mm[1].match(/'([^']*)'/g);
  return items ? items.map(s => s.replace(/'/g, '')) : [];
}

function bool(block, key) {
  const mm = block.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  return mm ? mm[1] === 'true' : undefined;
}

const catalogue = entries.map(e => {
  const o = {
    id:     str(e.block, 'id') || e.key,
    label:  str(e.block, 'label'),
    intake: str(e.block, 'intake'),
  };
  const exp = num(e.block, 'expectedSubjects');
  if (exp !== undefined) o.expectedPhotos = exp;
  const fmts = arr(e.block, 'formats');
  // Default to ['3:2'] when absent — canonical landscape format.
  o.formats = fmts && fmts.length ? fmts : ['3:2'];
  const f = bool(e.block, 'faces');
  if (f) o.faces = true;
  return o;
});

// ---- VALIDATE ---------------------------------------------------------------
const errs = [];
const byId = {};
catalogue.forEach(e => {
  if (!e.label)  errs.push(`${e.id}: no label in the catalogue`);
  if (!e.intake) errs.push(`${e.id}: no intake in the catalogue`);
  if (byId[e.id]) errs.push(`${e.id}: duplicate id`);
  if (/&[a-z]+;|&#/.test(e.label || '')) errs.push(`${e.id}: label contains an HTML entity - use plain unicode`);
  byId[e.id] = e;
});

// Every catalogue effect must be in exactly one room, and every room member
// must exist. An effect in no room never renders; an id in a room that is not
// in the catalogue paints a card the route will refuse.
const placed = {};
ROOMS.forEach(r => {
  if (r.members.length > CAP) {
    errs.push(`room "${r.id}" has ${r.members.length} members, CAP is ${CAP} - ` +
              `groups.html slices at CAP and the last one would never render`);
  }
  r.members.forEach(id => {
    if (!byId[id]) errs.push(`room "${r.id}" lists "${id}", which is not in the catalogue`);
    if (placed[id]) errs.push(`"${id}" is in two rooms: ${placed[id]} and ${r.id}`);
    placed[id] = r.id;
  });
});
catalogue.forEach(e => {
  if (!placed[e.id]) errs.push(`"${e.id}" is in the catalogue but in no room - it will never render`);
});

if (errs.length) die('validation:\n  - ' + errs.join('\n  - '));

// ---- BUILD ------------------------------------------------------------------
// Emitted in room order so the page's own ordering matches this file.
const effects = [];
ROOMS.forEach(r => {
  r.members.forEach(id => {
    const e = byId[id];
    const row = { id: e.id, label: e.label, category: r.id, intake: e.intake, body: 'live', formats: e.formats };
    if (e.expectedPhotos !== undefined) row.expectedPhotos = e.expectedPhotos;
    if (e.faces) row.faces = true;
    effects.push(row);
  });
});

const payload = {
  generatedAt: new Date().toISOString(),
  silos: ROOMS.map(r => ({ id: r.id, label: r.label, line: r.line })),
  effects,
  poses: [],
};

const js =
`/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/groups/groups-effects.ts  (CENG-owned)
   Rooms:  scripts/emit-groups-registry.js  (the ROOMS table in that file)
   Regenerate: node scripts/emit-groups-registry.js
   Emitted: ${payload.generatedAt}

   THE ROOMS ARE NOT IN THE SOURCE. groups-effects.ts is a flat catalogue
   with no grouping field and should not gain one - which room an effect
   sits in is a glass decision and does not belong in the engine's file.
   The seven rooms and their membership are Rich's assignment and live
   in the emitter.

   SIX PER ROOM, MAXIMUM. September catalog: 7 silos x 6 effects = 42.
   groups.html slices each room at CAP and appends an upsell card as
   the next slot, so a room exceeding CAP silently loses effects. The
   emitter refuses rather than let that ship.

   INTAKE IS THE ONE FIELD THAT CHANGES THE UPLOADER.
     group_photo  one photograph containing everybody
     multi_photo  one photograph per person
   Sending a single group shot to a multi_photo effect produces one face
   repeated.

   PLATES DERIVE FROM THE ID. Every plate is public/previews/groups/
   groups_<id>.jpg, lowercase, .jpg. There is no lookup table and there
   must never be one. If a plate fails to load, the fix is the filename on
   disk.

   Labels are plain unicode. Key on .id, never on .label. */
window.GROUPS_REGISTRY = ${JSON.stringify(payload, null, 2)};

/* The page reads window.EFFECT_REGISTRY. Groups points the same name at its
   own catalogue rather than renaming several hundred call sites - the page
   is one Series at a time and never holds two. */
window.EFFECT_REGISTRY = window.GROUPS_REGISTRY;

/* convenience, matching the Portraits registry so the floor code is shared */
window.EFFECT_REGISTRY.bySilo = function (siloId) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.category === siloId; });
};
window.EFFECT_REGISTRY.offerableBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.bySilo(siloId).filter(function (e) { return e.body === 'live'; });
};
window.EFFECT_REGISTRY.byId = function (id) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.id === id; })[0];
};

/* GROUPS HAS NO GENDERED VARIANTS AND NO LONGER HAS ANYTHING TO INFER SEX
   FOR. The six costume effects that needed a men/women toggle are gone;
   every remaining effect re-materialises the clothes each person is already
   wearing. These four are the identity function on purpose, so shared floor
   code does not have to test for a toggle that cannot exist here. */
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function (id) {
  return window.EFFECT_REGISTRY.byId(id);
};

/* The plate for an effect, whole path. Derived from the id - see the header.
   Unknown ids return empty rather than a path that will 404, so a card with
   no effect behind it paints as a card with no picture rather than a broken
   image. */
window.EFFECT_REGISTRY.PLATE_DIR = '/previews/groups/';
window.EFFECT_REGISTRY.plateFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  if (!e) { return ''; }
  return window.EFFECT_REGISTRY.PLATE_DIR + 'groups_' + e.id + '.jpg';
};

/* Formats supported by an effect. Default ['3:2'] when absent. */
window.EFFECT_REGISTRY.formatsFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return (e && e.formats) || ['3:2'];
};
/* Whether Mobile (9:16) is allowed for a given effect + group count.
   Central rule — mirrors lib/v1/groups/groups-shared.ts mobileFormatAllowed. */
window.EFFECT_REGISTRY.mobileAllowed = function (id, groupCount) {
  return groupCount <= 3 && window.EFFECT_REGISTRY.formatsFor(id).indexOf('9:16') >= 0;
};

/* Intake, asked of an effect id. The uploader is the only caller. */
window.EFFECT_REGISTRY.intakeFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return (e && e.intake) || 'group_photo';
};
window.EFFECT_REGISTRY.isMultiPhoto = function (id) {
  return window.EFFECT_REGISTRY.intakeFor(id) === 'multi_photo';
};

/* Faces — explicit flag from the catalogue, never inferred from the id.
   Faces effects use the shared 3-8 portrait-panel layout. */
window.EFFECT_REGISTRY.isFaces = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return !!(e && e.faces);
};
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, js, 'utf8');

// ---- REPORT -----------------------------------------------------------------
console.log(`\n[emit-groups] wrote ${path.relative(process.cwd(), OUT)}`);
console.log(`  catalogue  ${catalogue.length} effects`);
console.log(`  rooms      ${ROOMS.length}`);
ROOMS.forEach(r => {
  const flag = r.members.length === CAP ? '' : `   (${CAP - r.members.length} slot(s) spare)`;
  console.log(`    ${r.id.padEnd(18)} ${r.members.length}${flag}`);
});
const multi = effects.filter(e => e.intake === 'multi_photo');
console.log(`  multi_photo ${multi.length}: ${multi.map(e => e.id).join(', ')}`);

// Plates are checked but never fixed here - a missing plate is a card with no
// picture, not a broken page, and renaming files is not this script's job.
const dir = path.join(process.cwd(), 'public', 'previews', 'groups');
if (fs.existsSync(dir)) {
  const missing = effects.filter(e => !fs.existsSync(path.join(dir, 'groups_' + e.id + '.jpg')));
  if (missing.length) {
    console.log(`\n  PLATES MISSING (${missing.length}) - these cards will paint empty:`);
    missing.forEach(e => console.log(`    groups_${e.id}.jpg`));
  } else {
    console.log(`  plates     all ${effects.length} present`);
  }
}
console.log('');
