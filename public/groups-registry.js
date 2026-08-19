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
      "plate": "groups_bronze_01.jpg",
      "body": "live"
    },
    {
      "id": "ebony",
      "label": "Ebony",
      "category": "cast_carved",
      "intake": "group_photo",
      "plate": "groups_ebony_01.jpg",
      "body": "live"
    },
    {
      "id": "stone",
      "label": "Stone",
      "category": "cast_carved",
      "intake": "group_photo",
      "plate": "groups_stone_01.jpg",
      "body": "live"
    },
    {
      "id": "reclaimed_bronze",
      "label": "Reclaimed Bronze",
      "category": "cast_carved",
      "intake": "group_photo",
      "plate": "groups_reclaimed_bronze_01.jpg",
      "body": "live"
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "cast_carved",
      "intake": "group_photo",
      "plate": "groups_porcelain_01.jpeg",
      "body": "live"
    },
    {
      "id": "carved_family",
      "label": "Carved Family",
      "category": "cast_carved",
      "intake": "multi_photo",
      "plate": "groups_wood_carved_01.jpg",
      "body": "live"
    },
    {
      "id": "retro_robot",
      "label": "Atomic-Age Robot",
      "category": "cast_carved",
      "intake": "group_photo",
      "plate": "groups_retro_robot_01.jpeg",
      "body": "live"
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_plushy.jpg",
      "body": "live"
    },
    {
      "id": "folded_book",
      "label": "Folded Book",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_folded_book.jpg",
      "body": "live"
    },
    {
      "id": "origami",
      "label": "Origami",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_origami_01.jpeg",
      "body": "live"
    },
    {
      "id": "balloon_face",
      "label": "Balloon",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_balloon_01.jpeg",
      "body": "live"
    },
    {
      "id": "layered_paper",
      "label": "Layered Paper",
      "category": "made_by_hand",
      "intake": "multi_photo",
      "plate": "groups_cut_paper_01.jpg",
      "body": "live",
      "expectedPhotos": 5
    },
    {
      "id": "pencil_sketch",
      "label": "Pencil Sketch",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_pencil_01.jpeg",
      "body": "live"
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
      "category": "made_by_hand",
      "intake": "group_photo",
      "plate": "groups_sea_glass_01.jpeg",
      "body": "live"
    },
    {
      "id": "cubism",
      "label": "Cubism",
      "category": "painted_printed",
      "intake": "group_photo",
      "plate": "groups_cubism_01.jpg",
      "body": "live"
    },
    {
      "id": "art_nouveau",
      "label": "Art Nouveau",
      "category": "painted_printed",
      "intake": "group_photo",
      "plate": "groups_art_nouveau.jpg",
      "body": "live"
    },
    {
      "id": "ukiyo_e",
      "label": "Ukiyo-e",
      "category": "painted_printed",
      "intake": "group_photo",
      "plate": "groups_Ukiyo-e_01.jpg",
      "body": "live"
    },
    {
      "id": "family_impressionism",
      "label": "Family Impressionism",
      "category": "painted_printed",
      "intake": "multi_photo",
      "plate": "groups_impressionism_1.jpg",
      "body": "live",
      "expectedPhotos": 5
    },
    {
      "id": "family_mosaic",
      "label": "The Family Mosaic",
      "category": "painted_printed",
      "intake": "multi_photo",
      "plate": "groups_mosaic_01.jpg",
      "body": "live"
    },
    {
      "id": "neon",
      "label": "Neon",
      "category": "painted_printed",
      "intake": "group_photo",
      "plate": "groups_neon_01.jpeg",
      "body": "live"
    },
    {
      "id": "ice",
      "label": "Frost & Ice",
      "category": "painted_printed",
      "intake": "group_photo",
      "plate": "groups_frost_ice_01.jpeg",
      "body": "live"
    },
    {
      "id": "victorian",
      "label": "Victorian",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_victorian_01.jpeg",
      "body": "live"
    },
    {
      "id": "elizabethan",
      "label": "Elizabethan",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_elizabethan_01.jpeg",
      "body": "live"
    },
    {
      "id": "renaissance",
      "label": "Renaissance",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_renaissance_02.jpeg",
      "body": "live"
    },
    {
      "id": "persian_court",
      "label": "Persian Court",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_persian_01.jpeg",
      "body": "live"
    },
    {
      "id": "samurai",
      "label": "Samurai",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_samurai_01.jpeg",
      "body": "live"
    },
    {
      "id": "wild_west",
      "label": "Wild West",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_wild_west.jpeg",
      "body": "live"
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "another_time",
      "intake": "group_photo",
      "plate": "groups_clockwork.jpeg",
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

/* The plate for an effect, whole path. Never build one from an id. */
window.EFFECT_REGISTRY.plateFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return (e && e.plate) ? '/previews/groups/' + e.plate : '';
};

/* Intake, asked of an effect id. The uploader is the only caller. */
window.EFFECT_REGISTRY.intakeFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  return (e && e.intake) || 'group_photo';
};
window.EFFECT_REGISTRY.isMultiPhoto = function (id) {
  return window.EFFECT_REGISTRY.intakeFor(id) === 'multi_photo';
};
