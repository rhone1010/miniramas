/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/pets/pets-catalog-35.ts  (CENG-owned)
   Shape copied from public/groups-registry.js, 21 August 2026.

   PETS ON MAIN. 34 effects, 1:1.

   NOTE THE SOURCE FILENAME. It is pets-catalog-35.ts and it holds
   THIRTY-FOUR. The file was named while the list was still 35 and one was
   cut; the name was left alone rather than break every import. Do not read
   a count out of it.

   ── POSES IS EMPTY, AND FOR A DIFFERENT REASON THAN HALLOWEEN ───────
   Pets has no pose step at all - unlike Portraits, which has one, and
   unlike Halloween, where Rich dropped it on 21 August. Pets never had
   one: an animal is photographed as it was, and re-staging it is not
   something the room offers.
   DO NOT BUILD A POSE FLOOR FOR THIS ROOM.

   ── PLATES DERIVE FROM THE ID ───────────────────────────────────────
   public/previews/pets/pets_<id>.jpg, lowercase, .jpg. Verified against
   the directory on 21 August 2026: thirty-four files, thirty-four ids, no
   suffixes, no mixed extensions, no exceptions - every filename minus its
   pets_ prefix matches a catalogue id exactly.
   There is no plate field and no lookup table, and none should be added.
   If a plate ever fails to load, the fix is the filename on disk.

   Contrast public/halloween-registry.js, which CANNOT do this - its plates
   carry a man_ or woman_ prefix that is not derivable from the id, so each
   row there names its own file.

   ── THE SPELLING IS plushy ──────────────────────────────────────────
   Not plushie. The id, the label, the plate filename and every reference
   in lib/v1/pets agree. Anything reading plushie resolves to nothing.

   ── THE ROOM SPLIT IS NOT SETTLED ───────────────────────────────────
   One silo below, holding all 34, and its `line` is EMPTY - curator copy
   is Rich's and none has been written for this room.
   34 will not lay out on a floor built for 14. Groups runs seven per room
   across four rooms and the material families here would carry a similar
   split - the cast and carved, the hand-made, the painted, the periods -
   but which effect sits in which room is Rich's ruling, not a guess made
   in a generated file.
   Until then every effect answers to one category so the floor renders
   rather than paints empty.

   Every body is live. There is no pending state here.
   Labels are plain unicode. Key on .id, never on .label. */
window.PETS_REGISTRY = {
  "generatedAt": "2026-08-21T00:00:00.000Z",
  "silos": [
    {
      "id": "cast_carved",
      "label": "Cast & Carved",
      "line": "Here are the Cast & Carved effects. Your animal in one material, worked as a single piece.",
      "plate": "/previews/pets/pets_stone.jpg"
    },
    {
      "id": "by_hand",
      "label": "Made by Hand",
      "line": "Here are the Made by Hand effects. Softer work, with the maker's hand still on it.",
      "plate": "/previews/pets/pets_quilted.jpg"
    },
    {
      "id": "painted",
      "label": "Painted",
      "line": "Here are the Painted effects. Pencil, pigment and brushwork, each with its own hand.",
      "plate": "/previews/pets/pets_impressionist.jpg"
    },
    {
      "id": "another_time",
      "label": "Another Time",
      "line": "Here are the Another Time effects. Your animal, made in a time not its own.",
      "plate": "/previews/pets/pets_elizabethan.jpg"
    },
    {
      "id": "make_believe",
      "label": "Make Believe",
      "line": "Here are the Make Believe effects. A few stranger ways to become someone else.",
      "plate": "/previews/pets/pets_clockwork.jpg"
    }
  ],
  "effects": [
    {
      "id": "bronze",
      "label": "Bronze",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "ebony",
      "label": "Ebony",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "plushy",
      "label": "Plushy",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "stone",
      "label": "Stone",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "alabaster",
      "label": "Alabaster",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "victorian",
      "label": "Victorian",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "clown",
      "label": "Clown",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "elizabethan",
      "label": "Elizabethan",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "persian_court",
      "label": "Persian Court",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "pencil_sketch",
      "label": "Pencil Sketch",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "impressionist",
      "label": "Impressionist",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "oil_impasto",
      "label": "Impasto Oil",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "sea_glass",
      "label": "Sea Glass",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "ice",
      "label": "Ice & Frost",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "cubism",
      "label": "Cubism",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "art_nouveau",
      "label": "Art Nouveau",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "deco_twenties",
      "label": "Deco Twenties",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "samurai",
      "label": "Samurai",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "stained_glass",
      "label": "Stained Glass",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "neon",
      "label": "Neon",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "polished_gold",
      "label": "Polished Gold",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "driftwood_resin",
      "label": "Driftwood & Resin",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "origami",
      "label": "Origami",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "porcelain",
      "label": "Porcelain",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "retro_robot",
      "label": "Retro Robot",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "clockwork",
      "label": "Clockwork",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "forest_guardian",
      "label": "Forest Guardian",
      "category": "make_believe",
      "body": "live"
    },
    {
      "id": "iron",
      "label": "Iron",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "jade",
      "label": "Carved Jade",
      "category": "cast_carved",
      "body": "live"
    },
    {
      "id": "art_deco",
      "label": "Art Deco",
      "category": "another_time",
      "body": "live"
    },
    {
      "id": "ukiyo_e",
      "label": "Ukiyo-e",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "watercolour",
      "label": "Watercolour",
      "category": "painted",
      "body": "live"
    },
    {
      "id": "sheet_music",
      "label": "Sheet Music",
      "category": "by_hand",
      "body": "live"
    },
    {
      "id": "quilted",
      "label": "Quilted",
      "category": "by_hand",
      "body": "live"
    }
  ],
  "poses": []
};

/* The page reads window.EFFECT_REGISTRY. Pets points the same name at its
   own catalogue, exactly as Groups does - the page is one Series at a time
   and never holds two. */
window.EFFECT_REGISTRY = window.PETS_REGISTRY;

/* convenience, matching the Groups and Portraits registries so the floor
   code is shared */
window.EFFECT_REGISTRY.bySilo = function (siloId) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.category === siloId; });
};
window.EFFECT_REGISTRY.offerableBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.bySilo(siloId).filter(function (e) { return e.body === 'live'; });
};
window.EFFECT_REGISTRY.byId = function (id) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.id === id; })[0];
};

/* PETS HAS NO GENDERED VARIANTS. Portraits carries victorian and
   victorian_woman as two rows behind one tile; nothing here does. These
   four exist so shared floor code does not have to test for them and they
   are the identity function on purpose. */
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function (id) {
  return window.EFFECT_REGISTRY.byId(id);
};

/* The plate for an effect, whole path. Derived from the id - see the
   header. Unknown ids return empty rather than a path that will 404, so a
   card with no effect behind it paints as a card with no picture rather
   than a broken image. */
window.EFFECT_REGISTRY.PLATE_DIR = '/previews/pets/';
window.EFFECT_REGISTRY.plateFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  if (!e) { return ''; }
  return window.EFFECT_REGISTRY.PLATE_DIR + 'pets_' + e.id + '.jpg';
};

/* Intake. One photograph of one animal. Present so the uploader can ask
   the same question it asks Groups. */
window.EFFECT_REGISTRY.intakeFor = function () { return 'single_photo'; };
window.EFFECT_REGISTRY.isMultiPhoto = function () { return false; };
