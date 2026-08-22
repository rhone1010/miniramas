/* HAND-WRITTEN, unlike the other registries in this folder. There is no
   catalogue behind a chooser - it holds two doors, not effects.

   Written by scripts/build-pets-chooser.py, 21 August 2026.

   THE SHAPE IS A REGISTRY ON PURPOSE. The chooser is the silo floor with
   two cards on it, so it reads whatever the floor reads. `effects` is
   empty and stays empty; `href` is the field the floor does not normally
   see, and siloCard() and openSilo() in pets-chooser.html are the two
   places that look for it.

   THE LINES ARE EMPTY. Rich's voice, and two are owed.

   THE PICTURES ARE A GUESS and neither is used as a room front inside the
   room it leads to - a card that repeats the picture of a card one click
   deeper reads as a mistake. Two strings. */
window.PETS_CHOOSER_REGISTRY = {
  "generatedAt": "2026-08-21T00:00:00.000Z",
  "silos": [
    {
      "id": "pets_portraits",
      "label": "Pets Portraits",
      "line": "",
      "plate": "/previews/pets/pets_victorian.jpg",
      "href": "/pets/portraits"
    },
    {
      "id": "pets_halloween",
      "label": "Pets Halloween",
      "line": "",
      "plate": "/previews/halloween-pets/death_companion.jpg",
      "href": "/pets/halloween"
    }
  ],
  "effects": [],
  "poses": []
};

window.EFFECT_REGISTRY = window.PETS_CHOOSER_REGISTRY;

/* The same four the other registries carry, so the shared floor code does
   not have to test for a chooser. bySilo answers empty, which is correct:
   there is nothing craftable on this screen. */
window.EFFECT_REGISTRY.bySilo = function () { return []; };
window.EFFECT_REGISTRY.offerableBySilo = function () { return []; };
window.EFFECT_REGISTRY.byId = function () { return undefined; };
window.EFFECT_REGISTRY.isVariant = function () { return false; };
window.EFFECT_REGISTRY.tilesBySilo = window.EFFECT_REGISTRY.bySilo;
window.EFFECT_REGISTRY.offerableTilesBySilo = window.EFFECT_REGISTRY.offerableBySilo;
window.EFFECT_REGISTRY.variantFor = function () { return undefined; };

/* No effect has a plate here because no effect exists. The ROOM plates are
   on the silo rows above, which is where siloArt() looks. */
window.EFFECT_REGISTRY.PLATE_DIR = '';
window.EFFECT_REGISTRY.plateFor = function () { return ''; };
window.EFFECT_REGISTRY.intakeFor = function () { return 'single_photo'; };
window.EFFECT_REGISTRY.isMultiPhoto = function () { return false; };
