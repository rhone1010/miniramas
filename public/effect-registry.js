/* GENERATED FILE — DO NOT EDIT.
   Source: lib/v1/portraits/effect-registry.ts  (CENG-owned)
   Regenerate: node scripts/emit-effect-registry.js
   Emitted: 2026-08-02T07:16:36.657Z

   Labels are plain unicode. Key on .id, never on .label.
   Offer only effects where body === 'live' — the gate refuses the rest. */
window.EFFECT_REGISTRY = {
  "generatedAt": "2026-08-02T07:16:36.657Z",
  "silos": [
    {
      "id": "earth_ore",
      "label": "Earth & Ore",
      "line": "Here are the Earth & Ore finishes. Weight, grain, and the honesty of real material."
    },
    {
      "id": "artists_gallery",
      "label": "The Artists Gallery",
      "line": "Here are the Artists Gallery finishes. A maker’s hand, left visible."
    },
    {
      "id": "light_glass",
      "label": "Light & Glass",
      "line": "Here are the Light & Glass finishes. Translucent, and lit from within."
    },
    {
      "id": "myth_legend",
      "label": "Myth & Legend",
      "line": "Here are the Myth & Legend finishes. For a sitting with some nerve to it."
    },
    {
      "id": "far_future",
      "label": "Far & Future",
      "line": "Here are the Far & Future finishes. Cool metals and further horizons."
    },
    {
      "id": "another_age",
      "label": "Another Age",
      "line": "Here are the Another Age finishes. A sitting in a century not your own."
    },
    {
      "id": "living_world",
      "label": "Living World",
      "line": "Here are the Living World finishes. Grown rather than made."
    },
    {
      "id": "handmade",
      "label": "Handmade",
      "line": "Here are the Handmade finishes. Softer work, and made by hand."
    }
  ],
  "effects": [
    {
      "id": "bronze",
      "label": "Bronze",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "iron",
      "label": "Iron",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "stone",
      "label": "Quartzite",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "alabaster",
      "label": "Alabaster",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "jade",
      "label": "Carved Jade",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "authored",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "ebony",
      "label": "Ebony",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "walnut",
      "label": "Walnut",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "impressionist",
      "label": "Impressionist",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "watercolour",
      "label": "Watercolour",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": false,
      "body": "authored",
      "refs": 1,
      "likenessFloor": "relaxed"
    },
    {
      "id": "folded_book",
      "label": "Folded Book",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "charcoal_chalk",
      "label": "Charcoal & Chalk",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "sheet_music",
      "label": "Sheet Music",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "driftwood_resin",
      "label": "Driftwood & Resin",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "pencil_sketch",
      "label": "Pencil Sketch",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "skipUniversal": true
    },
    {
      "id": "cast_glass",
      "label": "Cast Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "authored",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "blown_glass",
      "label": "Blown Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "stained_glass",
      "label": "Stained Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "amber",
      "label": "Amber",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "authored",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "mercury",
      "label": "Liquid Mercury",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "fantasy_crystal",
      "label": "Enchanted Crystal",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "dichroic_glass",
      "label": "Dichroic Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "dragon_skin",
      "label": "Dragon Skin",
      "category": "myth_legend",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "fire_face",
      "label": "Fire & Ember",
      "category": "myth_legend",
      "mode": "costume",
      "monolithic": false,
      "body": "authored",
      "refs": 3,
      "likenessFloor": "strict",
      "skipStaging": true
    },
    {
      "id": "magic_energy",
      "label": "Magic Energy",
      "category": "myth_legend",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "armor",
      "label": "Living Armor",
      "category": "myth_legend",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "reclaimed_bronze",
      "label": "Reclaimed Bronze",
      "category": "myth_legend",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "golden_idol",
      "label": "Golden Idol",
      "category": "myth_legend",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "runestone",
      "label": "Runestone",
      "category": "myth_legend",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "retro_robot",
      "label": "Atomic Age Robot",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "authored",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "cosmic",
      "label": "Cosmic Bloom",
      "category": "far_future",
      "mode": "costume",
      "monolithic": false,
      "body": "authored",
      "refs": 2,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "nebula_resin",
      "label": "Nebula Resin",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "neon",
      "label": "Neon Drawing",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "volume_light",
      "label": "Volumetric Light",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "authored",
      "refs": 3,
      "likenessFloor": "bypass",
      "skipStaging": true
    },
    {
      "id": "wireframe",
      "label": "Wireframe Model",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "digital_human",
      "label": "Digital Human",
      "category": "far_future",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "elizabethan",
      "label": "Elizabethan Portrait",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 3,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "renaissance",
      "label": "Renaissance Portrait",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "deco_twenties",
      "label": "Deco Twenties",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "victorian",
      "label": "Victorian Portrait",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "samurai",
      "label": "Samurai",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "wild_west",
      "label": "Wild West",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "ancient_egypt",
      "label": "Ancient Egypt",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "coral",
      "label": "Living Reef",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "authored",
      "refs": 2,
      "framing": "statuesque",
      "likenessFloor": "strict"
    },
    {
      "id": "flowing_water",
      "label": "Flowing Water",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "frozen_splash",
      "label": "Frozen Splash",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "moss_stone",
      "label": "Moss & Stone",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict"
    },
    {
      "id": "blossom",
      "label": "Blossom",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "autumn_leaf",
      "label": "Autumn Leaf",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "butterfly_wing",
      "label": "Butterfly Wing",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed"
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "handmade",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "chocolate",
      "label": "Chocolate",
      "category": "handmade",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "balloon",
      "label": "Balloon",
      "category": "handmade",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "mosaic",
      "label": "Tile Mosaic",
      "category": "handmade",
      "mode": "material",
      "monolithic": false,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "topiary",
      "label": "Living Topiary",
      "category": "handmade",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "wicker",
      "label": "Woven Wicker",
      "category": "handmade",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "melted_wax",
      "label": "Melted Wax",
      "category": "handmade",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 3,
      "likenessFloor": "relaxed"
    }
  ],
  "poses": [
    {
      "id": "as_photographed",
      "label": "Keep My Pose",
      "preserve": true
    },
    {
      "id": "smiling",
      "label": "Smiling"
    },
    {
      "id": "laughing",
      "label": "Laughing"
    },
    {
      "id": "thoughtful",
      "label": "Thoughtful"
    },
    {
      "id": "dramatic",
      "label": "Dramatic"
    },
    {
      "id": "goofy",
      "label": "Goofy"
    }
  ]
};

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
