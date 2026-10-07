/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/groups/groups-effects.ts  (CENG-owned)
   Rooms:  scripts/emit-groups-registry.js  (the ROOMS table in that file)
   Regenerate: node scripts/emit-groups-registry.js
   Emitted: 2026-10-01T18:30:51.016Z

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
window.GROUPS_REGISTRY = {
  "generatedAt": "2026-10-01T18:30:51.016Z",
  "silos": [
    {
      "id": "portrait_collections",
      "label": "Portrait Collections",
      "line": "Separate portraits, brought together beautifully."
    },
    {
      "id": "crafted_collections",
      "label": "Crafted Collections",
      "line": "Individual moments, composed into something new."
    },
    {
      "id": "sculpted",
      "label": "Sculpted",
      "line": "Form, weight and extraordinary materials."
    },
    {
      "id": "material_magic",
      "label": "Material Magic",
      "line": "Familiar faces, transformed by the unexpected."
    },
    {
      "id": "made_by_hand",
      "label": "Made by Hand",
      "line": "Cut, folded, stitched and carefully crafted."
    },
    {
      "id": "artists_studio",
      "label": "The Artist's Studio",
      "line": "Drawing, painting and printmaking reimagined."
    },
    {
      "id": "curiosities",
      "label": "Curiosities",
      "line": "For when ordinary simply won't do."
    }
  ],
  "effects": [
    {
      "id": "art_nouveau_faces",
      "label": "Art Nouveau",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "charcoal_faces",
      "label": "Charcoal Portraits",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "colored_pencil_faces",
      "label": "Colored Pencil Portraits",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "impasto_faces",
      "label": "Oil Impasto",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "impressionist_faces",
      "label": "Impressionist Portraits",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "watercolor_faces",
      "label": "Watercolor Portraits",
      "category": "portrait_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "layered_paper_faces",
      "label": "Layered Paper Portraits",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "mosaic_faces",
      "label": "Mosaic",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "stained_glass_faces",
      "label": "Stained Glass",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "ukiyo_faces",
      "label": "Ukiyo-e Portraits",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ],
      "faces": true
    },
    {
      "id": "family_mosaic",
      "label": "Family Mosaic",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "layered_paper",
      "label": "Layered Paper",
      "category": "crafted_collections",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "bronze",
      "label": "Bronze",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "gold",
      "label": "Gold",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "silver",
      "label": "Silver",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "jade",
      "label": "Jade",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "stone",
      "label": "Stone",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "lichen_granite",
      "label": "Lichen Granite",
      "category": "sculpted",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "wax",
      "label": "Wax",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "chocolate",
      "label": "Chocolate",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "petal",
      "label": "Petal Sculpture",
      "category": "material_magic",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "carved",
      "label": "Carved",
      "category": "made_by_hand",
      "intake": "multi_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "quilted",
      "label": "Quilted",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "origami",
      "label": "Origami",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "stained_glass",
      "label": "Stained Glass",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "sheet_music",
      "label": "Sheet Music",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "art_nouveau",
      "label": "Art Nouveau",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "impressionist",
      "label": "Impressionist",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "watercolor",
      "label": "Watercolor",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "linocut",
      "label": "Linocut",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "ukiyo_e",
      "label": "Ukiyo-e",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "colored_pencil",
      "label": "Colored Pencil",
      "category": "artists_studio",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "art_deco",
      "label": "Art Deco",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "balloon",
      "label": "Balloon",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "driftwood_resin",
      "label": "Driftwood & Resin",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "neon",
      "label": "Neon",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    },
    {
      "id": "retro_robot",
      "label": "Atomic-Age Robot",
      "category": "curiosities",
      "intake": "group_photo",
      "body": "live",
      "formats": [
        "3:2"
      ]
    }
  ],
  "poses": [],
  "curated_ids": [
    "art_nouveau_faces",
    "carved",
    "driftwood_resin",
    "impasto_faces",
    "layered_paper",
    "mosaic_faces",
    "plushy",
    "stained_glass_faces",
    "stone",
    "wax"
  ]
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

/* The Pick-4 / flip set, resolved to full effect rows in Rich's order.
   Reads .curated (ids) through byId() rather than duplicating label/intake/
   formats here, so the two can never drift apart. */
window.EFFECT_REGISTRY.curated = function () {
  return window.EFFECT_REGISTRY.curated_ids
    .map(window.EFFECT_REGISTRY.byId)
    .filter(Boolean);
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
