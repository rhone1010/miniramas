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
 * ⚠ ENGINE RECONCILIATION REQUIRED. The `id` values below are CUI's derivation
 * from Rich's labels. They must be checked against the live engine preset ids
 * before build 3. Where the engine disagrees, the ENGINE wins and this file is
 * corrected. Effects with `engine:false` are known-or-suspected missing.
 */

const CATALOGUE = [
  {
    id: 'earth_ore',
    label: 'Earth & Ore',
    effects: [
      { id: 'bronze',    label: 'Bronze',    engine: true  },
      { id: 'iron',      label: 'Iron',      engine: true  },
      { id: 'stone',     label: 'Stone',     engine: true  },
      { id: 'alabaster', label: 'Alabaster', engine: true  },
      { id: 'pewter',    label: 'Pewter',    engine: false }, // needs MATERIAL_REGISTER
      { id: 'ebony',     label: 'Ebony',     engine: true  },
      { id: 'walnut',    label: 'Walnut',    engine: true  }
    ]
  },
  {
    id: 'artists_gallery',
    label: 'The Artists Gallery',
    effects: [
      { id: 'impressionist',    label: 'Impressionist',     engine: true  },
      { id: 'torn_paper',       label: 'Torn Paper',        engine: true  },
      { id: 'folded_book',      label: 'Folded Book',       engine: true  },
      { id: 'charcoal_chalk',   label: 'Charcoal & Chalk',  engine: true  },
      { id: 'pencil_sketch',    label: 'Pencil Sketch',     engine: true  },
      { id: 'sheet_music',      label: 'Sheet Music',       engine: true  },
      { id: 'stained_glass',    label: 'Stained Glass',     engine: false }, // needs MATERIAL_REGISTER
      { id: 'driftwood_resin',  label: 'Driftwood & Resin', engine: false }  // needs MATERIAL_REGISTER
    ]
  },
  {
    id: 'light_glass',
    label: 'Light & Glass',
    effects: [
      { id: 'cast_glass',        label: 'Cast Glass',        engine: false },
      { id: 'blown_glass',       label: 'Blown Glass',       engine: true  },
      { id: 'amber',             label: 'Amber',             engine: true  },
      { id: 'frost_ice',         label: 'Frost & Ice',       engine: false },
      { id: 'liquid_mercury',    label: 'Liquid Mercury',    engine: true  },
      { id: 'enchanted_crystal', label: 'Enchanted Crystal', engine: true  }, // was Fantasy Crystal
      { id: 'volumetric_light',  label: 'Volumetric Light',  engine: false }
    ]
  },
  {
    id: 'myth_legend',
    label: 'Myth & Legend',
    effects: [
      { id: 'dragon_skin',      label: 'Dragon Skin',      engine: true  },
      { id: 'fire_ember',       label: 'Fire & Ember',     engine: false },
      { id: 'magic_energy',     label: 'Magic Energy',     engine: true  },
      { id: 'living_armor',     label: 'Living Armor',     engine: true  },
      { id: 'living_reef',      label: 'Living Reef',      engine: false },
      { id: 'reclaimed_bronze', label: 'Reclaimed Bronze', engine: true  }
    ]
  },
  {
    id: 'far_future',
    label: 'Far & Future',
    effects: [
      { id: 'silicon_circuit',  label: 'Silicon Circuit',  engine: true  },
      { id: 'atomic_robot',     label: 'Atomic Age Robot', engine: false },
      { id: 'cosmic_bloom',     label: 'Cosmic Bloom',     engine: false },
      { id: 'nebula_resin',     label: 'Nebula Resin',     engine: true  },
      { id: 'neon_drawing',     label: 'Neon Drawing',     engine: true  }
    ]
  },
  {
    id: 'curiosities',
    label: 'Curiosities',
    effects: [
      { id: 'plushy',                label: 'Plushy',                engine: true  },
      { id: 'chocolate',             label: 'Chocolate',             engine: false }, // tier on hold
      { id: 'elizabethan_portrait',  label: 'Elizabethan Portrait',  engine: false }
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

/* ── ECONOMICS — 10 credits per image, locked ────────────────────────────── */

const CREDITS_PER_IMAGE = 10;

const CREDIT_BLOCKS = [
  { credits: 10,  images: 1,  usd: 4.99  },
  { credits: 20,  images: 2,  usd: 8.98  },
  { credits: 30,  images: 3,  usd: 12.72 },
  { credits: 50,  images: 5,  usd: 18.71 },
  { credits: 100, images: 10, usd: 34.93 }  // THE STUDIO, −30%
];

/** Volume arc: −10% at 2, −15% at 3, −20% at 4, −25% at 5, −1%/image to −30% at 10. */
function discountFor(images) {
  if (images <= 1) return 0;
  if (images === 2) return 0.10;
  if (images === 3) return 0.15;
  if (images === 4) return 0.20;
  if (images >= 10) return 0.30;
  return 0.25 + (images - 5) * 0.01;
}
function usdFor(images) {
  return +(4.99 * images * (1 - discountFor(images))).toFixed(2);
}
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
