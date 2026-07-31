/* PORTRAITS CATALOGUE — single source of truth for silos and effects
 * CUI V22 · 2026-07-27 · build 0
 *
 * Four consumers read this and nothing else:
 *   1. the silo pill strip
 *   2. the effect grid inside a silo
 *   3. the Advanced rail (flat)
 *   4. the My Collection filter
 *
 * Adding an effect is one line here plus an art file at
 *   /previews/portraits/<siloId>/<effectId>.jpg
 * No markup change, no rebuild.
 *
 * RECONCILED against lib/v1/portraits/portraits-shared.ts (PRESET_LABELS, 17 entries)
 * and portraits-effect-curator.ts (EFFECT_CATALOG, 12 entries), read 2026-07-27.
 *   engine:true  = present in PRESET_LABELS, /generate will accept it
 *   curator:true = present in EFFECT_CATALOG, the Curator can recommend it
 * Effects with engine:false may still exist on the experimental path —
 * portraits-experimental.ts read 2026-07-27 — 14 EXPERIMENTAL_EFFECTS, fully written.
 *   path:'preset'       = PRESET_LABELS, the /generate main path
 *   path:'experimental' = EXPERIMENTAL_EFFECTS, needs isExperimentalEffect() at the guard
 *   path:'none'         = no prompt exists anywhere yet
 * IDS COME FROM THE ENGINE. LABELS COME FROM RICH.
 *
 * ⚠ ORIGINAL NOTE. The `id` values below are CUI's derivation
 * from Rich's labels. They must be checked against the live engine preset ids
 * before build 3. Where the engine disagrees, the ENGINE wins and this file is
 * corrected. Effects with `engine:false` are known-or-suspected missing.
 */

const CATALOGUE = [
  {
    id: 'earth_ore',
    label: 'Earth & Ore',
    effects: [
      { id: 'bronze',    label: 'Bronze',    engine: true , curator: true , path: 'preset' },
      { id: 'iron',      label: 'Iron',      engine: true , curator: true , path: 'preset' },
      { id: 'stone',     label: 'Stone',     engine: true , curator: true , path: 'preset' },
      { id: 'alabaster', label: 'Alabaster', engine: true , curator: true , path: 'preset' },
      { id: 'pewter',    label: 'Pewter',    engine: true , curator: false, path: 'preset' }, // needs MATERIAL_REGISTER
      { id: 'ebony',     label: 'Ebony',     engine: true , curator: true , path: 'preset' },
      { id: 'walnut',    label: 'Walnut',    engine: true , curator: true , path: 'preset' }
    ]
  },
  {
    id: 'artists_gallery',
    label: 'The Artists Gallery',
    effects: [
      { id: 'impressionist',    label: 'Impressionist',     engine: true , curator: true , path: 'preset' },
      { id: 'torn_paper',       label: 'Torn Paper',        engine: true , curator: true , path: 'preset' },
      { id: 'folded_book',      label: 'Folded Book',       engine: true , curator: true , path: 'preset' },
      { id: 'charcoal_chalk',   label: 'Charcoal & Chalk',  engine: true , curator: true , path: 'preset' },
      { id: 'pencil_sketch',    label: 'Pencil Sketch',     engine: true , curator: true , path: 'preset' },
      { id: 'sheet_music',      label: 'Sheet Music',       engine: true , curator: true , path: 'preset' },
      { id: 'stained_glass',    label: 'Stained Glass',     engine: true , curator: false, path: 'preset' }, // needs MATERIAL_REGISTER
      { id: 'driftwood_resin',  label: 'Driftwood & Resin', engine: true , curator: false, path: 'preset' }  // needs MATERIAL_REGISTER
    ]
  },
  {
    id: 'light_glass',
    label: 'Light & Glass',
    effects: [
      { id: 'cast_glass',        label: 'Cast Glass',        engine: false, curator: false, path: 'none'       },
      { id: 'blown_glass',       label: 'Blown Glass',       engine: true , curator: false, path: 'experimental' },
      { id: 'amber',             label: 'Amber',             engine: true , curator: false, path: 'experimental' },
      { id: 'frost_ice',         label: 'Frost & Ice',       engine: false, curator: false, path: 'none'       },
      { id: 'mercury',    label: 'Liquid Mercury',    engine: true , curator: false, path: 'experimental' },
      { id: 'fantasy_crystal', label: 'Enchanted Crystal', engine: true , curator: false, path: 'experimental' }, // was Fantasy Crystal
      { id: 'volumetric_light',  label: 'Volumetric Light',  engine: false, curator: false, path: 'none'       }
    ]
  },
  {
    id: 'myth_legend',
    label: 'Myth & Legend',
    effects: [
      { id: 'dragon_skin',      label: 'Dragon Skin',      engine: true , curator: false, path: 'experimental' },
      { id: 'fire_ember',       label: 'Fire & Ember',     engine: false, curator: false, path: 'none'       },
      { id: 'magic_energy',     label: 'Magic Energy',     engine: true , curator: false, path: 'experimental' },
      { id: 'armor',     label: 'Living Armor',     engine: true , curator: false, path: 'experimental' },
      { id: 'living_reef',      label: 'Living Reef',      engine: false, curator: false, path: 'none'       },
      { id: 'reclaimed_bronze', label: 'Reclaimed Bronze', engine: true , curator: false, path: 'experimental' }
    ]
  },
  {
    id: 'far_future',
    label: 'Far & Future',
    effects: [
      { id: 'circuit',  label: 'Silicon Circuit',  engine: true , curator: false, path: 'experimental' },
      { id: 'atomic_robot',     label: 'Atomic Age Robot', engine: false, curator: false, path: 'none'       },
      { id: 'cosmic_bloom',     label: 'Cosmic Bloom',     engine: false, curator: false, path: 'none'       },
      { id: 'nebula_resin',     label: 'Nebula Resin',     engine: true , curator: false, path: 'experimental' },
      { id: 'neon',     label: 'Neon Drawing',     engine: true , curator: false, path: 'experimental' }
    ]
  },
  {
    id: 'seventh',
    label: 'Seventh room',
    effects: []
  },
  {
    id: 'eighth',
    label: 'Eighth room',
    effects: []
  },
  {
    id: 'curiosities',
    label: 'Curiosities',
    effects: [
      { id: 'plushy',                label: 'Plushy',                engine: true , curator: false, path: 'preset' },
      { id: 'chocolate',             label: 'Chocolate',             engine: true , curator: false, path: 'preset' }, // tier on hold
      { id: 'elizabethan',  label: 'Elizabethan Portrait',  engine: true , curator: false, path: 'experimental' }
    ]
  }
];

/* ── DERIVED ─────────────────────────────────────────────────────────────── */

const EFFECTS_FLAT = CATALOGUE.flatMap(s =>
  s.effects.map(e => ({ ...e, silo: s.id, siloLabel: s.label }))
);

const EFFECT_BY_ID = Object.fromEntries(EFFECTS_FLAT.map(e => [e.id, e]));
const SILO_BY_ID   = Object.fromEntries(CATALOGUE.map(s => [s.id, s]));

/** Label for a preset id. Never uppercase the id — that bug reached Stripe. */
function effectLabel(id) {
  return EFFECT_BY_ID[id] ? EFFECT_BY_ID[id].label : id;
}

/** Art path for a silo pill or an effect tile. */
function effectArt(id) {
  const e = EFFECT_BY_ID[id];
  return e ? `/previews/portraits/${e.silo}/${e.id}.jpg` : '';
}
function siloArt(siloId) {
  return `/previews/portraits/${siloId}/_silo.jpg`;
}

/* ── COLLECTION FILTER — the locked five, not the old seven ──────────────── */

const COLLECTION_FILTERS = [
  { id: 'all',        label: 'View All'          },
  { id: 'portraits',  label: 'Portraits'         },
  { id: 'pets',       label: 'Pets'              },
  { id: 'groups',     label: 'Groups'            },
  { id: 'action',     label: 'Action'            },
  { id: 'wallpapers', label: 'Mobile Wallpapers' }
];

/* ── ECONOMICS ───────────────────────────────────────────────────────────────
 * Corrected 2026-07-30, ruled by Rich.
 *
 * 10 credits per image, $4.99 base. THE LADDER BELONGS TO THE PURCHASE AND
 * NOWHERE ELSE. An image costs 10 credits whether it is the first or the
 * thirtieth — the arithmetic is flat by construction and there is no room in
 * it for a percentage. Quoting a saving at craft time tells the customer they
 * are saving twice, which is not true. COMMERCE-AND-IDENTITY §2.
 *
 * WHAT CHANGED
 *   · seven blocks became five. Seven is a spreadsheet; five is a choice.
 *     The old curve was also finest where people spend least — four blocks
 *     across 25 discount points between 10 and 50, two blocks across 15
 *     between 100 and 300.
 *   · the ceiling is 45% at 300, which the old table did not reach.
 *   · discountFor() and usdFor() are now PURCHASE-ONLY and named so. The craft
 *     path calls creditsFor() and nothing else. Leaving general-purpose
 *     discount helpers in scope is how the double-count got in the first time.
 */

const CREDITS_PER_IMAGE = 10;
const BASE_USD = 4.99;

/* Five blocks. Each step drops the per-image price by roughly 50 cents, which
   is a figure a customer can feel; the discount climbs 15/10/10/10 instead of
   the old 10/5/10/5/8/7. 60 is marked because a five-block screen with nothing
   highlighted makes the customer do the arithmetic. */
const CREDIT_BLOCKS = [
  { credits: 10,  images: 1,  pct: 0,    usd: 4.99,  per: 4.99 },
  { credits: 30,  images: 3,  pct: 0.15, usd: 12.72, per: 4.24 },
  { credits: 60,  images: 6,  pct: 0.25, usd: 22.46, per: 3.74, recommended: true },
  { credits: 120, images: 12, pct: 0.35, usd: 38.92, per: 3.24 },
  { credits: 300, images: 30, pct: 0.45, usd: 82.34, per: 2.74 }
];

/** THE PURCHASE PATH ONLY. Never call these from the workshop. */
function purchaseDiscountFor(credits) {
  const b = CREDIT_BLOCKS.find(x => x.credits === credits);
  return b ? b.pct : 0;
}
function purchaseUsdFor(credits) {
  const b = CREDIT_BLOCKS.find(x => x.credits === credits);
  return b ? b.usd : +(BASE_USD * (credits / CREDITS_PER_IMAGE)).toFixed(2);
}

/** THE CRAFT PATH. Credits only — no percentage, no dollars. */
function creditsFor(images) {
  return images * CREDITS_PER_IMAGE;
}

function tierFor(images) {
  return images >= 10 ? 'THE STUDIO' : 'THE SERIES';
}

/* ── QUALITY GATE — the engine's scale, not a percentage ─────────────────── */

const PASS_SINGLE  = 8;    // ≥8/10, single face
const PASS_RELAXED = 7;    // outside the top 70% of figures, multi-face
const TOP_RATIO    = 0.70;

/* ── PIECE ID — auto-assigned, immutable, system-wide ────────────────────── */

function pieceId(series, effectId, seq) {
  const eff = (EFFECT_BY_ID[effectId] ? EFFECT_BY_ID[effectId].label : effectId)
    .replace(/[^A-Za-z0-9]+/g, '');
  return `${series}-${eff}-${String(seq).padStart(4, '0')}`;
}
