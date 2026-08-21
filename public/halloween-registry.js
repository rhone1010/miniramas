/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/halloween/halloween-catalog.ts  (CENG-owned)
   Shape copied from public/groups-registry.js, 21 August 2026.

   HALLOWEEN ON MAIN. 28 effects, 1:1. Ids and labels are lifted from the
   catalogue and are the same ids the wallpaper Halloween room uses - the
   two catalogues were forked on 20 August and share every id.

   ── POSES IS EMPTY AND STAYS EMPTY ──────────────────────────────────
   Rich, 21 August: drop the pose in Halloween. The engine matches - 
   halloween-generator.ts appends no pose phrase and the route carries no
   pose_id field. The 28 bodies stage themselves, and a pose appended after
   a body is the later instruction on the same axis.
   DO NOT BUILD A POSE FLOOR FOR THIS ROOM. If one appears on the glass it
   will send a field the route drops on the floor.

   ── PLATES CARRY A GENDER PREFIX. THIS ROOM IS THE EXCEPTION ─────────
   Groups derives its plate as groups_<id>.jpg and Portraits derives its
   own. Halloween CANNOT: the plates are public/previews/halloween/
   man_<id>.jpg for fourteen of them and woman_<id>.jpg for the other
   fourteen.
   There is ONE plate per effect. The prefix is a property of the FILE -
   whichever sitter rendered best - and NOT a gender axis on the effect.
   There is no man/woman choice in this room and no variant behind a tile.
   plateGender is therefore data, not a rule, and it is the one field in
   here that cannot be derived from the id. It was read off the directory
   on 21 August: 28 files, 28 ids, every filename minus its prefix matching
   an id exactly.
   If a plate 404s, fix the filename on disk OR the prefix on the row -
   check which is wrong before changing either.

   ── THE ROOM SPLIT IS NOT SETTLED ───────────────────────────────────
   One silo below, holding all 28, and its `line` is EMPTY - curator copy
   is Rich's and none has been written for this room.
   28 will not lay out on a floor built for 14. Groups runs seven per room
   across four rooms; the wallpaper Halloween room carries the same 28 and
   its own notes call for a toggle between halves.
   So this needs Rich's ruling - the rooms, which effect sits in which, and
   a line for each. Until then every effect answers to one category so the
   floor renders rather than paints empty.

   Every body is live. There is no pending state here.
   Labels are plain unicode. Key on .id, never on .label. */
window.HALLOWEEN_REGISTRY = {
  "generatedAt": "2026-08-21T00:00:00.000Z",
  "silos": [
    {
      "id": "creatures",
      "label": "Creatures",
      "line": "Here are the Creatures. Beasts, monsters and things better left in the dark."
    },
    {
      "id": "restless_dead",
      "label": "Restless Dead",
      "line": "Here are the Restless Dead. Some elegant, some cursed, none quite finished."
    },
    {
      "id": "old_magic",
      "label": "Old Magic",
      "line": "Here is the Old Magic. Witches, wraiths and powers that have been waiting a very long time."
    },
    {
      "id": "harvest",
      "label": "Harvest",
      "line": "Here is the Harvest. Old gods, hollow things and what comes out after dark."
    }
  ],
  "effects": [
    {
      "id": "lantern_keeper",
      "label": "Lantern Keeper",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "moon_beast",
      "label": "Moon Beast",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "clockwork_corpse",
      "label": "Clockwork Corpse",
      "category": "restless_dead",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "elegant_vampire",
      "label": "Elegant Vampire",
      "category": "restless_dead",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "harvest_god",
      "label": "Harvest God",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "werewolf",
      "label": "Werewolf",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "eclipse",
      "label": "Eclipse",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "ghoul",
      "label": "Ghoul",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "living_cathedral",
      "label": "Living Cathedral",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "gothic_witch",
      "label": "Gothic Witch",
      "category": "old_magic",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "headless_horseman",
      "label": "Headless Horseman",
      "category": "restless_dead",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "swamp_creature",
      "label": "Swamp Creature",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "haunted_scarecrow",
      "label": "Haunted Scarecrow",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "raven_monarch",
      "label": "Raven King / Queen",
      "category": "old_magic",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "ghost_pirate",
      "label": "Ghost Pirate",
      "category": "restless_dead",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "spider_monarch",
      "label": "Spider King / Queen",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "dark_wizard",
      "label": "Dark Wizard",
      "category": "old_magic",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "demon_lord",
      "label": "Demon Lord",
      "category": "creatures",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "ice_wraith",
      "label": "Ice Wraith",
      "category": "old_magic",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "necromancer",
      "label": "Necromancer",
      "category": "old_magic",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "shadow_monarch",
      "label": "Shadow King / Queen",
      "category": "old_magic",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "cursed_knight",
      "label": "Cursed Knight",
      "category": "restless_dead",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "the_ferryman",
      "label": "The Ferryman",
      "category": "restless_dead",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "porcelain_doll",
      "label": "Living Porcelain Doll",
      "category": "restless_dead",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "moth_monarch",
      "label": "Moth King / Queen",
      "category": "creatures",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "hollow_tree",
      "label": "The Hollow Tree",
      "category": "harvest",
      "plateGender": "woman",
      "body": "live"
    },
    {
      "id": "night_bloom",
      "label": "The Night Bloom",
      "category": "harvest",
      "plateGender": "man",
      "body": "live"
    },
    {
      "id": "halloween_monarch",
      "label": "Lord / Lady of Halloween",
      "category": "old_magic",
      "plateGender": "woman",
      "body": "live"
    }
  ],
  "poses": []
};

/* The page reads window.EFFECT_REGISTRY. Halloween points the same name at
   its own catalogue, exactly as Groups does - the page is one Series at a
   time and never holds two. */
window.EFFECT_REGISTRY = window.HALLOWEEN_REGISTRY;

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

/* HALLOWEEN HAS NO GENDERED VARIANTS. Portraits carries victorian and
   victorian_woman as two rows behind one tile. Nothing here does - the
   gender on a row names a FILE, not a variant. These four exist so shared
   floor code does not have to test for them and they are the identity
   function on purpose. */
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function (id) {
  return window.EFFECT_REGISTRY.byId(id);
};

/* The plate for an effect, whole path. NOT derived from the id alone - see
   the header. Unknown ids, and any row somehow missing its prefix, return
   empty rather than a path that will 404, so a card with no effect behind
   it paints as a card with no picture rather than a broken image. */
window.EFFECT_REGISTRY.PLATE_DIR = '/previews/halloween/';
window.EFFECT_REGISTRY.plateFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  if (!e || !e.plateGender) { return ''; }
  return window.EFFECT_REGISTRY.PLATE_DIR + e.plateGender + '_' + e.id + '.jpg';
};

/* Intake. Every effect in this room takes one photograph of one person.
   Present so the uploader can ask the same question it asks Groups. */
window.EFFECT_REGISTRY.intakeFor = function () { return 'single_photo'; };
window.EFFECT_REGISTRY.isMultiPhoto = function () { return false; };
