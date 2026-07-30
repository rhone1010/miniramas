# EFFECTS REVISION — Portraits
**Date:** 2026-07-29 · **Lane:** CENG · **Supersedes:** the flat 31-effect list

Companion doc: `CENG-CARRYOVER-2026-07-29-STYLE-REFS.md` holds every prompt body, the
ref-generation rules, and the engine-state finding. **This doc is the effect list only** —
built for CUI to render buttons against and CC to build the registry against.

---

## 1. STRUCTURE CHANGE

**Old:** flat list, 31 effects, three registers (`PRES` / `ARTISTS_PRES` /
`EXPERIMENTAL_EFFECTS`), only the third exposing a button list.

**New:** **8 silos × 7 effects = 56.** The Curator's first choice is the silo; the second is
the effect; the third is pose/expression.

**Blocker:** there is no unified effect catalog. Realistic lives in `MATERIAL_PHRASE`,
Artists in `ARTISTS_BLOCKS`, experimental in `EXPERIMENTAL_EFFECTS` — three shapes, three
builders. **One registry must exist, with `category` on every effect, before the UI can
render silos.** CC lane. This is the long pole.

---

## 2. STATUS KEY

| Mark | Meaning |
|---|---|
| ✅ | body + avoid written, ref plate shot and approved |
| ⬜ | body + avoid written, ref plate not shot |
| ✍️ | body + avoid **to author** |
| 🔁 | exists but needs a **rewrite** (previously failed) |

---

## 3. THE 56

### `earth_ore` — Earth & Ore — 7/7 REFS COMPLETE

| id | label | status |
|---|---|---|
| `bronze` | Bronze | ✅ |
| `iron` | Iron | ✅ |
| `stone` | **Quartzite** | ✅ |
| `alabaster` | Alabaster | ✅ |
| `jade` | Carved Jade | ✅ |
| `ebony` | Ebony | ✅ |
| `walnut` | Walnut | ✅ |

- **`pewter` REMOVED.** `jade` takes the slot.
- **`stone` relabeled Quartzite.** Keep the id — renaming touches `PortraitsPresetId`,
  `PRESET_LABELS`, `STYLE_MATERIALS`, and Pass 2 for zero gain. **Label change only.**
  Limestone was tested first and dropped (boring).
- **Pass 2 debt:** `PASS2_MATERIAL_REFINEMENT_BY_PRESET.stone` describes rough-chiseled
  stone with tool marks and colour bands — contradicts polished quartzite. Inert today
  (Pass 2 off for `stone`); rewrite before ever enabling.
- `jade` is a **new** effect: `monolithic: true`, matte/waxy nephrite lustre, bounded SSS.

### `artists_gallery` — The Artists Gallery — 6/7 REFS

| id | label | status |
|---|---|---|
| `impressionist` | Impressionist | ✅ |
| `watercolour` | Watercolour | ✅ |
| `folded_book` | Folded Book | ✅ |
| `charcoal_chalk` | Charcoal & Chalk | ✅ |
| `sheet_music` | Sheet Music | ✅ |
| `driftwood_resin` | Driftwood & Resin | ✅ |
| `pencil_sketch` | Pencil Sketch | ⬜ |

- **`torn_paper` REMOVED** — too close to `folded_book` and `sheet_music`.
  `watercolour` takes the slot (new; fills the transparent-pigment gap — nothing else in the
  catalog is translucent *pigment*).
- **`stained_glass` MOVED** → `light_glass`. It is glass.
- **Lock the spelling of `watercolour`** — it's a code identifier. UK spelling used
  throughout both docs.
- `pencil_sketch` carries `skipUniversal: true` — it owns its own composition (side-angle
  asymmetric emergence). Its ref prompt must be authored accordingly, not from the standard
  template.
- **Standing concern:** `folded_book` and `sheet_music` are both "portrait made of book
  pages." They survive as a pair (structural folding vs printed notation) but a customer may
  not see the difference. Watch the grid.

### `light_glass` — Light & Glass — OVER BY ONE ⚠️

| id | label | status |
|---|---|---|
| `cast_glass` | Cast Glass | ⬜ |
| `blown_glass` | Blown Glass | ⬜ |
| `stained_glass` | Stained Glass | ⬜ |
| `amber` | Amber | ⬜ |
| `ice` | Frost & Ice | ⬜ |
| `mercury` | Liquid Mercury | ⬜ |
| `fantasy_crystal` | Enchanted Crystal | ⬜ |
| `dichroic_glass` | Dichroic Glass | ✍️ |

**8 listed, 7 slots. Needs Rich's call:** is `cast_glass` in or out? It was authored this
session with one render behind it, and `blown_glass` is its nearest neighbour. If
`cast_glass` goes, `dichroic_glass` makes 7.

- **`volume_light` MOVED** → `far_future`. Reads as energy, not material.
- **All five translucent effects need the anti-ageing clause pair** (smoothed facial
  surface + bright alert eyes). Refraction turns creases into features and glass eyes lose
  the sclera catchlight, which reads as fatigue. See carryover §6.
- `ice` is `monolithic: true`.

### `myth_legend` — Myth & Legend

| id | label | status |
|---|---|---|
| `dragon_skin` | Dragon Skin | ⬜ |
| `fire_face` | Fire & Ember | ⬜ |
| `magic_energy` | Magic Energy | ⬜ |
| `armor` | Living Armor | ⬜ |
| `reclaimed_bronze` | Reclaimed Bronze | ⬜ |
| `golden_idol` | Golden Idol | ✍️ |
| `runestone` | Runestone | ✍️ |

- **`coral` MOVED** → `living_world`.
- **Duplicate flag:** `reclaimed_bronze` vs `bronze` — now in *different silos*, which makes
  it worse not better. Put them side by side; if they read the same to a customer, cut one.
- **`fire_face` folder rename required:** `fire-face` → `fire_face`. A hyphen means zero
  refs load, silently.

### `far_future` — Far & Future

| id | label | status |
|---|---|---|
| `retro_robot` | Atomic Age Robot | ⬜ |
| `cosmic` | Cosmic Bloom | ⬜ |
| `nebula_resin` | Nebula Resin | ⬜ |
| `neon` | Neon Drawing | ⬜ |
| `volume_light` | Volumetric Light | ⬜ |
| `wireframe` | Wireframe Model | ✍️ |
| `hologram` | Hologram | ✍️ |

- **`circuit` REMOVED** — never worked well; the face was overlaid with traces rather than
  built from them. **This retires Example B in
  `CENG-EFFECT-AUTHORING-BRIEF-2026-07-24.md`** — swap in `armor` or `dragon_skin` before
  handing that doc out again.
- **`deep_sea` REMOVED** (cut earlier).
- **Overlap flag:** `cosmic` / `nebula_resin` / `magic_energy` are all luminous and
  polychrome. Check side by side — `cosmic` may need to *replace* one rather than join it.
- `volume_light` is **tested and working** — do not edit the body. Needs
  `likenessFloor: 'bypass'`.

### `another_age` — Another Age — GENDERED REFS

| id | label | status |
|---|---|---|
| `elizabethan` | Elizabethan Portrait | ⬜ |
| `renaissance` | Renaissance Portrait | ✍️ |
| `deco_twenties` | Deco Twenties | ✍️ |
| `victorian` | Victorian Portrait | 🔁 |
| `samurai` | Samurai | ✍️ |
| `wild_west` | Wild West | ✍️ |
| `ancient_egypt` | Ancient Egypt | ✍️ |

New silo. All `mode: 'costume'`, all likeness-preserving. Period costume is the most popular
portrait-transform genre and was the largest commercial gap in the old taxonomy.

- **`elizabethan` DECIDED: 3D render, not painting.** The Holbein / Horenbout / Teerlinc /
  Toto / Penni painting direction is **dead**. Needs `skipExpression` — the tested prompt
  asks for neutral-period expression and `STUDIO_DIRECTIVES`' mandated settled smile
  overrode it in one of three test outputs.
- **`victorian` is a rewrite, not a first draft.** It was cut for failing. Root cause is the
  general costume failure: `mode: 'costume'` strips the material anchor, leaving nothing to
  resist NB2's photographic prior. **Fix: the body must name a *medium*** — hand-tinted
  photograph, painted oil portrait, albumen print — not just "Victorian styling." Same fix
  that made `elizabethan` work.
- **`samurai` and `ancient_egypt`** will drift toward ethnic recasting of the subject's
  features. The `avoid` must block this explicitly, or it's a support problem rather than a
  portrait.

### `living_world` — Living World — PARKED (Rich experimenting)

| id | label | status |
|---|---|---|
| `coral` | Living Reef | ⬜ |
| `flowing_water` | Flowing Water | ✍️ |
| `frozen_splash` | Frozen Splash | ✍️ |
| `moss_stone` | Moss & Stone | ✍️ |
| `blossom` | Blossom | ✍️ |
| `autumn_leaf` | Autumn Leaf | ✍️ |
| `butterfly_wing` | Butterfly Wing | ✍️ |

- **Water has historically failed.** Root cause is the same as `volume_light`: "made of
  water" reads as "wet person." **The body must say the water IS the structure and the
  silhouette breaks into spray and droplets.** `frozen_splash` is the easier win — a caught
  splash has real form to hold a likeness.
- `coral` needs `framing: 'statuesque'` — hands are specified, and every universal forbids
  them under bust framing.

### `handmade` — Handmade — GENDERED REFS

| id | label | status |
|---|---|---|
| `plushy` | Plushy | ⬜ |
| `chocolate` | Chocolate | ⬜ |
| `origami` | Folded Paper | ✍️ |
| `mosaic` | Tile Mosaic | ✍️ |
| `topiary` | Living Topiary | ✍️ |
| `wicker` | Woven Wicker | ✍️ |
| `embroidery` | Embroidery | ✍️ |

Absorbs the old `curiosities` silo, which was down to 2 after `circuit`, `elizabethan`, and
`plushy`/`chocolate` were reassigned.

---

## 4. CHANGE SUMMARY

### Removed (6)
| id | reason |
|---|---|
| `pewter` | Rich's call — thin |
| `torn_paper` | too similar to `folded_book` / `sheet_music` |
| `circuit` | never worked — traces overlaid on skin rather than constructing the face |
| `deep_sea` | cut earlier (bioluminescent not working out) |
| `victorian` (old body) | failed — returns as a rewrite |
| `haunted` | dropped — stock genre territory, and the refs destroyed the likeness they were meant to preserve |

### Added (18)
`jade` · `watercolour` · `dichroic_glass` · `golden_idol` · `runestone` · `wireframe` ·
`hologram` · `renaissance` · `deco_twenties` · `samurai` · `wild_west` · `ancient_egypt` ·
`flowing_water` · `frozen_splash` · `moss_stone` · `blossom` · `autumn_leaf` ·
`butterfly_wing` · `origami` · `mosaic` · `topiary` · `wicker` · `embroidery`
*(plus `volume_light`, `fire_face`, `coral`, `retro_robot`, `cosmic`, `cast_glass`, `ice` —
authored this session, bodies in the carryover)*

### Moved (3)
| id | from | to | reason |
|---|---|---|---|
| `stained_glass` | Artists Gallery | Light & Glass | it is glass |
| `volume_light` | Light & Glass | Far & Future | reads as energy, not material |
| `coral` | Myth & Legend | Living World | it is alive |

### Relabeled (1)
`stone` → **Quartzite** (label only; id unchanged)

---

## 5. SCHEMA FIELDS REQUIRED

```ts
category?:       SiloId    // the 8 above
styleRefs?:      boolean   // loader reads public/style-refs/portraits/<id>/
refSelector?:    'neutral' | 'gender'
framing?:        Framing   // per-effect override — coral needs 'statuesque'
likenessFloor?:  'strict' | 'relaxed' | 'bypass'
skipStaging?:    boolean   // effects carrying their own light source
```

`variants` (randomized costume selection) was considered and **killed** — it buys atmosphere
and costs determinism, support clarity, and a schema field. A customer hitting Recraft would
get a different character.

`skipExpression` is **superseded** by `EXPRESSION_BLOCK[choice]` — a lookup replacing the
EXPRESSION paragraph at the same tier position, same pattern `FRAMING_BLOCK` already uses.
Entries: `as_photographed` · `smiling` · `laughing` · `thoughtful` · `dramatic` · `goofy`.
Expression **cannot be appended** — `STUDIO_DIRECTIVES` mandates a settled smile and will
override any appended alternative.

---

## 6. GENDERED REFS

**Gendered only where the costume differs:** `another_age` and `handmade`. Neutral for the
six material silos. A doublet and a gown are different garments; bronze behaves identically
on anyone.

**Superseding consideration:** with a deliberately diverse ref set spanning race, age, and
gender, `refSelector` may be unnecessary entirely — diverse neutral plates mean no customer
sees a grid that excludes them, and it removes the misgendering failure surface completely.
**Revisit before building the selector.**

---

## 7. OPEN — BLOCKS THE TAXONOMY LOCK

1. **`cast_glass` in or out** — Light & Glass is at 8.
2. **`reclaimed_bronze` vs `bronze`** — duplicate?
3. **`cosmic` vs `nebula_resin` vs `magic_energy`** — overlap.
4. **`refSelector` at all** — see §6.

---

## 8. REMAINING WORK

**Bodies to author: 20** — 6 Another Age (incl. the `victorian` rewrite), 6 Living World,
5 Handmade, plus `golden_idol`, `runestone`, `wireframe`, `hologram`, `dichroic_glass`.

**Ref plates to shoot: ~42 effects.** Refs double as preview images — one shoot, one review
pass. Money cost ≈ $50; **the constraint is selection judgment**, roughly 8 hours, and it
doesn't compress.

**All existing preview images need regenerating** — the old set carries plaques and
sculpture-on-plinth staging that violates both the ref rules and copy law.
