/* GENERATED FILE — DO NOT EDIT.
   Source: lib/v1/portraits/effect-registry.ts  (CENG-owned)
   Regenerate: node scripts/emit-effect-registry.js
   Emitted: 2026-08-02T22:50:05.304Z

   Labels are plain unicode. Key on .id, never on .label.
   Offer only effects where body === 'live' — the gate refuses the rest. */
window.EFFECT_REGISTRY = {
  "generatedAt": "2026-08-02T22:50:05.304Z",
  "silos": [
    {
      "id": "earth_ore",
      "label": "Earth & Ore",
      "line": "Here are the Earth & Ore finishes. Weight, grain, and the honesty of real material."
    },
    {
      "id": "light_glass",
      "label": "Light & Glass",
      "line": "Here are the Light & Glass finishes. Translucent, and lit from within."
    },
    {
      "id": "living_world",
      "label": "The Living World",
      "line": "Here are The Living World finishes. Grown rather than made."
    },
    {
      "id": "made_by_hand",
      "label": "Made by Hand",
      "line": "Here are the Made by Hand finishes. Softer work, and the maker’s hand still on it."
    },
    {
      "id": "artists_gallery",
      "label": "The Artists Gallery",
      "line": "Here are the Artists Gallery finishes. A maker’s hand, left visible."
    },
    {
      "id": "ink_paper",
      "label": "Ink & Paper",
      "line": "Here are the Ink & Paper finishes. Pressed, printed, and drawn."
    },
    {
      "id": "fantasy_future",
      "label": "Fantasy & Future",
      "line": "Here are the Fantasy & Future finishes. For a sitting with some nerve to it."
    },
    {
      "id": "another_age",
      "label": "Another Age",
      "line": "Here are the Another Age finishes. A sitting in a century not your own."
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
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "stone",
      "label": "Quartzite",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 3,
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
      "id": "reclaimed_bronze",
      "label": "Reclaimed Bronze",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "petrified_wood",
      "label": "Petrified Wood",
      "category": "earth_ore",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "cast_glass",
      "label": "Cast Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "relaxed"
    },
    {
      "id": "stained_glass",
      "label": "Stained Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "relaxed"
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "live",
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
      "refs": 1,
      "likenessFloor": "relaxed"
    },
    {
      "id": "neon",
      "label": "Neon Drawing",
      "category": "light_glass",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "polished_gold",
      "label": "Polished Gold",
      "category": "light_glass",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "driftwood_resin",
      "label": "Driftwood & Resin",
      "category": "living_world",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
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
      "id": "tidewood",
      "label": "Tidewood",
      "category": "living_world",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "lichen_granite",
      "label": "Lichen Granite",
      "category": "living_world",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "petal_sculpture",
      "label": "Petal Sculpture",
      "category": "living_world",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "sand_form",
      "label": "Sand Form",
      "category": "living_world",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "sandstone",
      "label": "Sandstone",
      "category": "living_world",
      "mode": "material",
      "monolithic": true,
      "body": "todo",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 1,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "chocolate",
      "label": "Chocolate",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "balloon_face",
      "label": "Balloon",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "relaxed",
      "genderedRefs": true
    },
    {
      "id": "quilted",
      "label": "Quilted",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "origami",
      "label": "Origami",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "beaded",
      "label": "Beaded",
      "category": "made_by_hand",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
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
      "id": "oil_impasto",
      "label": "Oil Impasto",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "linocut",
      "label": "Linocut",
      "category": "artists_gallery",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "folded_book",
      "label": "Folded Book",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "magic_energy",
      "label": "Magic Energy",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "relaxed"
    },
    {
      "id": "ukiyo_e",
      "label": "Ukiyo E",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "cubism",
      "label": "Cubism",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "art_deco",
      "label": "Art Deco",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "art_nouveau",
      "label": "Art Nouveau",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "daguerreotype",
      "label": "Daguerreotype",
      "category": "ink_paper",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 1,
      "likenessFloor": "strict"
    },
    {
      "id": "dragon_skin",
      "label": "Dragon Skin",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "fire_face",
      "label": "Fire & Ember",
      "category": "fantasy_future",
      "mode": "costume",
      "monolithic": false,
      "body": "authored",
      "refs": 2,
      "likenessFloor": "strict",
      "skipStaging": true
    },
    {
      "id": "retro_robot",
      "label": "Atomic Age Robot",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "forest_guardian",
      "label": "Forest Guardian",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "starfield",
      "label": "Starfield",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "crystallized",
      "label": "Crystallized",
      "category": "fantasy_future",
      "mode": "material",
      "monolithic": true,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "elizabethan",
      "label": "Elizabethan Portrait",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 2,
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
      "refs": 4,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "deco_twenties",
      "label": "Deco Twenties",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "victorian",
      "label": "Victorian Portrait",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 4,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "samurai",
      "label": "Samurai",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 2,
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
      "refs": 2,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "persian_court",
      "label": "Persian Court",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 2,
      "likenessFloor": "strict"
    },
    {
      "id": "victorian_woman",
      "label": "Victorian Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "renaissance_woman",
      "label": "Renaissance Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "persian_court_woman",
      "label": "Persian Court Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "wild_west_woman",
      "label": "Wild West Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "deco_twenties_woman",
      "label": "Deco Twenties Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "samurai_woman",
      "label": "Samurai Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
    },
    {
      "id": "elizabethan_woman",
      "label": "Elizabethan Woman",
      "category": "another_age",
      "mode": "costume",
      "monolithic": false,
      "body": "live",
      "refs": 0,
      "likenessFloor": "strict",
      "genderedRefs": true
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
