/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/groups/groups-effects.ts  (CENG-owned)
   Rooms:  scripts/emit-groups-registry.js  (the ROOMS table in that file)
   Regenerate: node scripts/emit-groups-registry.js
   Emitted: 2026-08-24T21:14:01.060Z

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
window.GROUPS_REGISTRY = {
  "generatedAt": "2026-08-24T21:14:01.060Z",
  "silos": [
    {
      "id": "cast_carved",
      "label": "Cast & Carved",
      "line": "Here are the Cast & Carved effects. Weight in the hand, and the honesty of real material."
    },
    {
      "id": "made_by_hand",
      "label": "Made by Hand",
      "line": "Here are the Made by Hand effects. Softer work, with the maker's hand still on it."
    },
    {
      "id": "painted_printed",
      "label": "Painted & Printed",
      "line": "Here are the Painted & Printed effects. Pressed, printed, and drawn."
    },
    {
      "id": "light_lit",
      "label": "Light & Lit",
      "line": "Here are the Light & Lit effects. Glass and gas, lit from somewhere inside."
    },
    {
      "id": "grown_gathered",
      "label": "Grown & Gathered",
      "line": "Here are the Grown & Gathered effects. Gathered from somewhere, and still half wild."
    }
  ],
  "effects": [
    {
      "id": "bronze",
      "label": "Bronze",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "reclaimed_bronze",
      "label": "Reclaimed Bronze",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "ebony",
      "label": "Ebony",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "stone",
      "label": "Stone",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "polished_gold",
      "label": "Polished Gold",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "silver",
      "label": "Silver",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "chocolate",
      "label": "Chocolate",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "quilted",
      "label": "Quilted",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "origami",
      "label": "Origami",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "layered_paper",
      "label": "Layered Paper",
      "category": "made_by_hand",
      "intake": "multi_photo",
      "body": "live",
      "expectedPhotos": 5
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "retro_robot",
      "label": "Atomic-Age Robot",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "balloon_face",
      "label": "Balloon",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "cubism",
      "label": "Cubism",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "art_nouveau",
      "label": "Art Nouveau",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "ukiyo_e",
      "label": "Ukiyo-e",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "impressionist",
      "label": "Impressionist",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "watercolour",
      "label": "Watercolour",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "linocut",
      "label": "Linocut",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "pencil_sketch",
      "label": "Pencil Sketch",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "stained_glass",
      "label": "Stained Glass",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "neon",
      "label": "Neon",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "wax",
      "label": "Wax",
      "category": "light_lit",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "petal_sculpture",
      "label": "Petal Sculpture",
      "category": "grown_gathered",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "lichen_granite",
      "label": "Lichen Granite",
      "category": "grown_gathered",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "driftwood_resin",
      "label": "Driftwood & Resin",
      "category": "grown_gathered",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "sand_form",
      "label": "Sand Form",
      "category": "grown_gathered",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "family_impressionism",
      "label": "Family Impressionism",
      "category": "grown_gathered",
      "intake": "multi_photo",
      "body": "live",
      "expectedPhotos": 5
    },
    {
      "id": "family_mosaic",
      "label": "The Family Mosaic",
      "category": "grown_gathered",
      "intake": "multi_photo",
      "body": "live"
    },
    {
      "id": "carved_family",
      "label": "Carved Family",
      "category": "grown_gathered",
      "intake": "multi_photo",
      "body": "live"
    }
  ],
  "poses": []
};

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
