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
// ---- SEVEN PER ROOM ---------------------------------------------------------
//
// groups.html slices each room at CAP = 7 and appends an upsell card as the
// eighth grid slot. A room with eight members silently loses whichever sorts
// last. The counts below are 7/7/7/6/7 and this script REFUSES to emit if any
// room exceeds seven - the failure is invisible on the page, so it has to be
// caught here.
//
// ---- PLATES DERIVE FROM THE ID ----------------------------------------------
//
// Every plate is public/previews/groups/groups_<id>.jpg. No lookup table.
// If a plate 404s the fix is the filename on disk, never a row in here.
// Five files currently do not match their id and must be renamed:
//   groups_gold -> groups_polished_gold        groups_watercolor -> groups_watercolour
//   groups_granite_lichen -> groups_lichen_granite
//   groups_driftwood -> groups_driftwood_resin groups_mosaic -> groups_family_mosaic

const fs   = require('fs');
const path = require('path');

const SRC = path.join(process.cwd(), 'lib', 'v1', 'groups', 'groups-effects.ts');
const OUT = path.join(process.cwd(), 'public', 'groups-registry.js');
const CAP = 7;

function die(msg) { console.error('\n[emit-groups] FAILED: ' + msg + '\n'); process.exit(1); }

if (!fs.existsSync(SRC)) die('source not found at ' + SRC);
const src = fs.readFileSync(SRC, 'utf8');

// ---- THE ROOMS --------------------------------------------------------------
// Labels and Curator lines locked by Rich, 24 August 2026.
//
// "Another Time" is gone. It held all six costume effects and every one of
// them was removed - each re-dressed the whole group and had to guess
// everybody's sex to do it, which nothing in the pipeline knows.
const ROOMS = [
  {
    id: 'cast_carved',
    label: 'Cast & Carved',
    line: 'Here are the Cast & Carved effects. Weight in the hand, and the honesty of real material.',
    members: ['bronze', 'reclaimed_bronze', 'ebony', 'stone', 'polished_gold', 'silver', 'chocolate'],
  },
  {
    id: 'made_by_hand',
    label: 'Made by Hand',
    line: "Here are the Made by Hand effects. Softer work, with the maker's hand still on it.",
    members: ['plushy', 'quilted', 'origami', 'layered_paper', 'clockwork', 'retro_robot', 'balloon_face'],
  },
  {
    id: 'painted_printed',
    label: 'Painted & Printed',
    line: 'Here are the Painted & Printed effects. Pressed, printed, and drawn.',
    members: ['cubism', 'art_nouveau', 'ukiyo_e', 'impressionist', 'watercolour', 'linocut', 'pencil_sketch'],
  },
  {
    id: 'light_lit',
    label: 'Light & Lit',
    line: 'Here are the Light & Lit effects. Glass and gas, lit from somewhere inside.',
    members: ['stained_glass', 'sea_glass', 'neon', 'ice', 'porcelain', 'wax'],
  },
  {
    id: 'grown_gathered',
    label: 'Grown & Gathered',
    line: 'Here are the Grown & Gathered effects. Gathered from somewhere, and still half wild.',
    members: ['petal_sculpture', 'lichen_granite', 'driftwood_resin', 'sand_form',
              'family_impressionism', 'family_mosaic', 'carved_family'],
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

const catalogue = entries.map(e => {
  const o = {
    id:     str(e.block, 'id') || e.key,
    label:  str(e.block, 'label'),
    intake: str(e.block, 'intake'),
  };
  const exp = num(e.block, 'expectedSubjects');
  if (exp !== undefined) o.expectedPhotos = exp;
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
    const row = { id: e.id, label: e.label, category: r.id, intake: e.intake, body: 'live' };
    if (e.expectedPhotos !== undefined) row.expectedPhotos = e.expectedPhotos;
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
   The five rooms and their membership are Rich's ruling of 24 August 2026
   and live in the emitter.

   "Another Time" is gone. It held six costume effects and all six were
   removed on 23 August: each re-dressed the whole group and had to guess
   everybody's sex to do it, and nothing in the pipeline knows who is who.

   SEVEN PER ROOM, MAXIMUM. groups.html slices each room at CAP = 7 and
   appends an upsell card as the eighth slot, so a room with eight members
   silently loses one. The emitter refuses rather than let that ship.

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

/* Intake, asked of an effect id. The uploader is the only caller. */
window.EFFECT_REGISTRY.intakeFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return (e && e.intake) || 'group_photo';
};
window.EFFECT_REGISTRY.isMultiPhoto = function (id) {
  return window.EFFECT_REGISTRY.intakeFor(id) === 'multi_photo';
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
