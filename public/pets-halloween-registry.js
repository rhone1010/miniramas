/* GENERATED FILE - DO NOT EDIT BY HAND.
   Source: lib/v1/halloween/pets-halloween-catalog.ts  (CENG-owned)
   Shape copied from public/groups-registry.js, 21 August 2026.

   PETS HALLOWEEN ON MAIN. 27 effects, 1:1.

   ── THIS IS THE SECOND OF TWO PET ROOMS ─────────────────────────────
   Rich, 21 August: Pets in the nav opens a chooser - Pets Portraits or
   Pets Halloween. Two pages, so two registries. The other is
   public/pets-registry.js, 34 effects, plates at /previews/pets/.
   Both point window.EFFECT_REGISTRY at themselves, so a page loads ONE of
   these and never both. Loading both would leave whichever came second
   holding the name.

   ── ONE ROUTE SERVES BOTH HALLOWEEN ROOMS ───────────────────────────
   POST /api/v1/halloween/generate takes these 27 AND the human 28. The
   pethw_ prefix separates them and the generator branches on it. There is
   no pets-halloween endpoint and there should not be one.

   ── THE IDS CARRY pethw_. THE PLATES DO NOT ─────────────────────────
   Plate is /previews/halloween-pets/<id minus pethw_>.jpg - the folder name
   already says what the prefix says. Verified against the directory on
   21 August 2026: twenty-seven files, twenty-seven ids, exact match both
   ways, no orphans.
   ALWAYS SEND THE PREFIXED ID TO THE ROUTE. The stripping happens for the
   filename and nowhere else. A pet id with the prefix dropped is a 400.

   ── POSES IS EMPTY ──────────────────────────────────────────────────
   Rich dropped the pose stage in Halloween on 21 August, both rooms. The
   bodies stage themselves - charging through a dying field, surging
   through a ruined cemetery. DO NOT BUILD A POSE FLOOR FOR THIS ROOM.

   ── NO FRAMING, AND THAT IS DELIBERATE ──────────────────────────────
   The human Halloween room appends a chest-to-head framing line. This room
   appends nothing, on Rich's ruling of 21 August: it is working without
   constraints, so keep it that way. Nothing on the glass should offer a
   framing control here.

   ── THE ROOM SPLIT IS NOT SETTLED ───────────────────────────────────
   One silo below, holding all 27, and its `line` is EMPTY - curator copy is
   Rich's and none has been written. 27 will not lay out on a floor built
   for 14. Rooms, membership and lines are Rich's ruling.

   Every body is live. There is no pending state here.
   Labels are plain unicode. Key on .id, never on .label. */
window.PETS_HALLOWEEN_REGISTRY = {
  "generatedAt": "2026-08-21T00:00:00.000Z",
  "silos": [
    {
      "id": "pets_halloween",
      "label": "Pets Halloween",
      "line": ""
    }
  ],
  "effects": [
    {
      "id": "pethw_harvest_god_beast",
      "label": "Harvest God's Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_graveyard_guardian",
      "label": "Graveyard Guardian",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_hellborn_beast",
      "label": "Hellborn Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_blood_moon_beast",
      "label": "Blood Moon Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_storm_wraith",
      "label": "Storm Wraith",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_banshee_familiar",
      "label": "Banshee's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_thorn_king_beast",
      "label": "Thorn King's Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_drowned_revenant",
      "label": "Drowned Revenant",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_witch_familiar",
      "label": "Witch's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_shadow_beast",
      "label": "Shadow Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_plague_beast",
      "label": "Plague Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_frost_wraith",
      "label": "Frost Wraith",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_bone_collector_beast",
      "label": "Bone Collector's Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_swamp_revenant",
      "label": "Swamp Revenant",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_raven_lord_familiar",
      "label": "Raven Lord's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_demon_familiar",
      "label": "Demon's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_ancient_crypt_beast",
      "label": "Ancient Crypt Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_headless_horseman_familiar",
      "label": "Headless Horseman's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_nightmare_creature",
      "label": "Nightmare Creature",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_spirit_caller",
      "label": "Spirit Caller",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_the_soul_eater",
      "label": "The Soul Eater",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_spider_queen_familiar",
      "label": "Spider Queen's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_the_possessed",
      "label": "The Possessed",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_gargoyle_beast",
      "label": "Gargoyle Beast",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_phantom_of_the_forest",
      "label": "Phantom of the Forest",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_vampire_familiar",
      "label": "The Vampire's Familiar",
      "category": "pets_halloween",
      "body": "live"
    },
    {
      "id": "pethw_death_companion",
      "label": "Death's Companion",
      "category": "pets_halloween",
      "body": "live"
    }
  ],
  "poses": []
};

/* The page reads window.EFFECT_REGISTRY. Pets Halloween points the same
   name at its own catalogue, exactly as Groups and Pets do - the page is
   one Series at a time and never holds two. */
window.EFFECT_REGISTRY = window.PETS_HALLOWEEN_REGISTRY;

/* convenience, matching the other registries so the floor code is shared */
window.EFFECT_REGISTRY.bySilo = function (siloId) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.category === siloId; });
};
window.EFFECT_REGISTRY.offerableBySilo = function (siloId) {
  return window.EFFECT_REGISTRY.bySilo(siloId).filter(function (e) { return e.body === 'live'; });
};
window.EFFECT_REGISTRY.byId = function (id) {
  return window.EFFECT_REGISTRY.effects.filter(function (e) { return e.id === id; })[0];
};

/* NO VARIANTS. Nothing in this room sits behind a tile with a twin. These
   four exist so shared floor code does not have to test for them and they
   are the identity function on purpose. */
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function (id) {
  return window.EFFECT_REGISTRY.byId(id);
};

/* The plate for an effect, whole path. The pethw_ prefix comes OFF for the
   filename and only for the filename - see the header. Unknown ids return
   empty rather than a path that will 404, so a card with no effect behind
   it paints as a card with no picture rather than a broken image. */
window.EFFECT_REGISTRY.PLATE_DIR = '/previews/halloween-pets/';
window.EFFECT_REGISTRY.plateFor = function (id) {
  var e = window.EFFECT_REGISTRY.byId(id);
  if (!e) { return ''; }
  return window.EFFECT_REGISTRY.PLATE_DIR + e.id.replace(/^pethw_/, '') + '.jpg';
};

/* Intake. One photograph of one animal. */
window.EFFECT_REGISTRY.intakeFor = function () { return 'single_photo'; };
window.EFFECT_REGISTRY.isMultiPhoto = function () { return false; };
