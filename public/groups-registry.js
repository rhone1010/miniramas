/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/groups/groups-effects.ts  (CENG-owned)
   Regenerate: node scripts/emit-groups-registry.js

   THE SILOS ARE NOT IN THE SOURCE. groups-effects.ts is a flat catalogue of
   twenty-eight with no grouping field. The four rooms below, and which
   effect sits in which, are Rich's ruling of 19 August 2026 and live here
   because there is nowhere else for them to live. Adding a `category` to
   the engine catalogue would put a glass decision inside CENG's file.

   Seven in each room. That is deliberate and it is what makes the floor
   lay out - Portraits runs seven to eight per room and the card grid is
   built for it.

   INTAKE IS THE ONE FIELD THAT CHANGES THE UPLOADER.
     group_photo  one photograph containing everybody      24 effects
     multi_photo  one photograph per person                 4 effects
   Family Impressionism and Layered Paper expect five. Sending a single
   group shot to a multi_photo effect produces one face repeated.

   PLATES DERIVE FROM THE ID. Every plate is public/previews/groups/
   groups_<id>.jpg, lowercase, .jpg, verified against the directory on
   19 August 2026 - twenty-eight files, twenty-eight ids, no exceptions.
   The `plate` field and its lookup table are gone. They existed because
   the legacy set carried _01 and _02 suffixes, mixed .jpg and .jpeg, seven
   names that were not the id, and one capital U that worked on Windows and
   would have 404'd on Vercel. That set has been archived off and the
   contract CENG wrote is now true.
   If a plate ever fails to load, the fix is the filename on disk, not a
   row in here.

   Every effect here is live. There is no `body: 'pending'` state in Groups
   the way there is in Portraits - CENG shipped twenty-eight approved and
   cut the two that were not (Iron, Dragon Skin), so the catalogue and the
   offer are the same list. offerableBySilo() is kept anyway, because the
   page calls it and the day one is withdrawn this is where it happens.

   Labels are plain unicode. Key on .id, never on .label. */
window.GROUPS_REGISTRY = {
  "generatedAt": "2026-08-19T00:00:00.000Z",
  "silos": [
    {
      "id": "cast_carved",
      "label": "Cast & Carved",
      "line": "Here are the Cast & Carved effects. Everybody in one material, worked as a single piece."
    },
    {
      "id": "made_by_hand",
      "label": "Made by Hand",
      "line": "Here are the Made by Hand effects. Softer work, and the maker's hand still on it."
    },
    {
      "id": "painted_printed",
      "label": "Painted & Printed",
      "line": "Here are the Painted & Printed effects. Brush, block and ink."
    },
    {
      "id": "another_time",
      "label": "Another Time",
      "line": "Here are the Another Time effects. Your family, sat for a portrait in a century not your own."
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
      "id": "reclaimed_bronze",
      "label": "Reclaimed Bronze",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "cast_carved",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "carved_family",
      "label": "Carved Family",
      "category": "cast_carved",
      "intake": "multi_photo",
      "body": "live"
    },
    {
      "id": "retro_robot",
      "label": "Atomic-Age Robot",
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
      "id": "folded_book",
      "label": "Folded Book",
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
      "id": "balloon_face",
      "label": "Balloon",
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
      "id": "pencil_sketch",
      "label": "Pencil Sketch",
      "category": "made_by_hand",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
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
      "id": "family_impressionism",
      "label": "Family Impressionism",
      "category": "painted_printed",
      "intake": "multi_photo",
      "body": "live",
      "expectedPhotos": 5
    },
    {
      "id": "family_mosaic",
      "label": "The Family Mosaic",
      "category": "painted_printed",
      "intake": "multi_photo",
      "body": "live"
    },
    {
      "id": "neon",
      "label": "Neon",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "painted_printed",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "victorian",
      "label": "Victorian",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "elizabethan",
      "label": "Elizabethan",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "renaissance",
      "label": "Renaissance",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "persian_court",
      "label": "Persian Court",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "samurai",
      "label": "Samurai",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "wild_west",
      "label": "Wild West",
      "category": "another_time",
      "intake": "group_photo",
      "body": "live"
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "another_time",
      "intake": "group_photo",
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

/* GROUPS HAS NO GENDERED VARIANTS. Portraits carries victorian and
   victorian_woman as two rows behind one tile; the Groups bodies were
   merged from those pairs into one each, and the plates are flat. These
   three exist so shared floor code does not have to test for them, and
   they are the identity function on purpose. */
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
