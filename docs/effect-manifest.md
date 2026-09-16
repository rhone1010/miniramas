# Effect manifest — the catalog as the branch has it

Built 2026-09-16 from the working tree of `feat/discovery-curator-pass2`, by reading the files listed under **Sources** below. Nothing here is carried over from an earlier note: every column is read from code or from the files on disk. Where two sources disagree, the disagreement is listed under **Inconsistencies** rather than settled here.

Canonical IDs are the `snake_case` ids the engine keys on. Customer-facing labels are separate and never substituted for an id.

## Totals

| | |
|---|---|
| Effects in the registry | **66** |
| Live | **62** |
| Not live | 4 (`petrified_wood` todo, `cast_glass` todo, `driftwood_resin` todo, `beaded` todo) |
| Of those, `_woman` twins of another effect | 7 (`victorian_woman`, `renaissance_woman`, `persian_court_woman`, `wild_west_woman`, `deco_twenties_woman`, `samurai_woman`, `elizabethan_woman`) |
| Distinct base effects (twins folded in) | 59 |
| Curated universe | **25** |
| Foyer flip frames | **26** |
| Foyer free-generation pool | **6** |
| Foyer fan cards | **6** |
| Tiles in portraits.html | 55 (+ 7 reached by subject) |
| Tiles in Discovery | 55 (+ 7 reached by subject) |

### Live effects by silo

Tiles are what a customer sees in a room. A `_woman` twin is not its own tile on either surface — the subject resolver reaches it from the base tile — so "live" and "tiles" differ wherever a silo has twins. portraits.html also caps a room at `CAP = 7` tiles.

| Silo | Label | Live | Tiles | Tile IDs | Twins |
|---|---|---|---|---|---|
| `another_age` | Another Age | 14 | 7 | `elizabethan`, `renaissance`, `deco_twenties`, `victorian`, `samurai`, `wild_west`, `persian_court` | `victorian_woman`, `renaissance_woman`, `persian_court_woman`, `wild_west_woman`, `deco_twenties_woman`, `samurai_woman`, `elizabethan_woman` |
| `earth_ore` | Earth & Ore | 7 | 7 | `bronze`, `iron`, `stone`, `jade`, `ebony`, `reclaimed_bronze`, `crystallized` | — |
| `light_glass` | Light & Glass | 7 | 7 | `stained_glass`, `ice`, `mercury`, `neon`, `sea_glass`, `polished_gold`, `mosaic_portrait` | — |
| `living_world` | The Living World | 7 | 7 | `coral`, `tidewood`, `lichen_granite`, `petal_sculpture`, `sand_form`, `sandstone`, `fire_face` | — |
| `made_by_hand` | Made by Hand | 6 | 6 | `plushy`, `chocolate`, `balloon_face`, `quilted`, `origami`, `porcelain` | — |
| `artists_gallery` | The Artists Gallery | 7 | 7 | `impressionist`, `watercolour`, `charcoal_chalk`, `sheet_music`, `pencil_sketch`, `oil_impasto`, `linocut` | — |
| `ink_paper` | Ink & Paper | 7 | 7 | `folded_book`, `magic_energy`, `ukiyo_e`, `cubism`, `art_deco`, `art_nouveau`, `daguerreotype` | — |
| `fantasy_future` | Fantasy & Future | 7 | 7 | `dragon_skin`, `retro_robot`, `forest_guardian`, `clockwork`, `starfield`, `action_figure`, `designer_vinyl` | — |

### The six the foyer can generate free

`lib/v1/foyer/foyer-policy.ts` → `FOYER_REVEAL_EFFECTS`. Product authority, not derived from the fan or the flip deck.

| # | ID | Label | Silo |
|---|---|---|---|
| 1 | `plushy` | Plushy | `made_by_hand` |
| 2 | `impressionist` | Impressionist | `artists_gallery` |
| 3 | `stained_glass` | Stained Glass | `light_glass` |
| 4 | `action_figure` | Action Figure | `fantasy_future` |
| 5 | `designer_vinyl` | Vinyl Figure | `fantasy_future` |
| 6 | `mosaic_portrait` | Mosaic | `light_glass` |

### The six fan cards

`public/foyer.html` → `FAN`, resolved through `FLIP_EFFECT`. These are pictures already made, not effects the foyer generates.

| # | Flip | Effect ID | Label |
|---|---|---|---|
| 1 | `flip_23` | `sheet_music` | Sheet Music |
| 2 | `flip_26` | `victorian` | Victorian Portrait |
| 3 | `flip_24` | `stained_glass` | Stained Glass |
| 4 | `flip_13` | `elizabethan` | Elizabethan Portrait |
| 5 | `flip_06` | `designer_vinyl` | Vinyl Figure |
| 6 | `flip_16` | `art_nouveau` | Art Nouveau |

## Every effect

`prompt` — a body in `portraits-bodies.ts`. `man`/`woman`/`@2x` — files in `public/previews/effects/<id>/`. `plate` — a Curated card draws its art from `/previews/curated/<id>/` where one was shot, and otherwise falls back to the effects manifest. `flip` / `pool` / `fan` — the foyer.

| ID | Label | Status | Silo | Prompt | man | woman | man@2x | woman@2x | Portraits | Discovery | Curated | Plate | Flip | Pool | Fan |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `action_figure` | Action Figure | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | yes | manifest fallback | — | yes | — |
| `art_deco` | Art Deco | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_17` | — | phone grid |
| `art_nouveau` | Art Nouveau | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_16` | — | 6 |
| `balloon_face` | Balloon | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_15` | — | — |
| `beaded` | Beaded | todo | `made_by_hand` | — | — | — | — | — | — | — | — | — | — | — | — |
| `bronze` | Bronze | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `cast_glass` | Cast Glass | todo | `light_glass` | — | — | — | — | — | — | — | — | (plate, unused) | — | — | — |
| `charcoal_chalk` | Charcoal & Chalk | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `chocolate` | Chocolate | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `clockwork` | Clockwork | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `coral` | Living Reef | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `crystallized` | Crystallized | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | — | (plate, unused) | `flip_14` | — | — |
| `cubism` | Cubism | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | yes | manifest fallback | — | — | — |
| `daguerreotype` | Daguerreotype | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `deco_twenties` | Deco Twenties | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | — | (plate, unused) | `flip_21` | — | — |
| `deco_twenties_woman` | Deco Twenties Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `designer_vinyl` | Vinyl Figure | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | yes | manifest fallback | `flip_06` | yes | 5 |
| `dragon_skin` | Dragon Skin | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `driftwood_resin` | Driftwood & Resin | todo | `living_world` | — | — | — | — | — | — | — | — | — | — | — | — |
| `ebony` | Ebony | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `elizabethan` | Elizabethan Portrait | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_13` | — | 4 |
| `elizabethan_woman` | Elizabethan Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `fire_face` | Fire & Ember | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `folded_book` | Folded Book | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `forest_guardian` | Forest Guardian | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `ice` | Frost & Ice | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_11` | — | phone grid |
| `impressionist` | Impressionist | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_10` | yes | — |
| `iron` | Iron | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_12` | — | — |
| `jade` | Carved Jade | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `lichen_granite` | Lichen Granite | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `linocut` | Linocut | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_19` | — | — |
| `magic_energy` | Magic Energy | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `mercury` | Liquid Mercury | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `mosaic_portrait` | Mosaic | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | yes | manifest fallback | — | yes | — |
| `neon` | Neon Drawing | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_09` | — | — |
| `oil_impasto` | Oil Impasto | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_08` | — | — |
| `origami` | Origami | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_07` | — | — |
| `pencil_sketch` | Pencil Sketch | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `persian_court` | Persian Court | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `persian_court_woman` | Persian Court Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `petal_sculpture` | Petal Sculpture | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | (plate, unused) | — | — | — |
| `petrified_wood` | Petrified Wood | todo | `earth_ore` | — | — | — | — | — | — | — | — | — | — | — | — |
| `plushy` | Plushy | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_05` | yes | — |
| `polished_gold` | Polished Gold | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `porcelain` | Porcelain | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | — | (plate, unused) | `flip_20` | — | — |
| `quilted` | Quilted | live | `made_by_hand` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_03` | — | — |
| `reclaimed_bronze` | Reclaimed Bronze | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_02` | — | — |
| `renaissance` | Renaissance Portrait | live | `another_age` | yes | yes | yes | — | — | tile | tile | yes | dedicated | `flip_04` | — | — |
| `renaissance_woman` | Renaissance Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `retro_robot` | Atomic Age Robot | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_01` | — | — |
| `samurai` | Samurai | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `samurai_woman` | Samurai Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `sand_form` | Sand Form | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | (plate, unused) | `flip_22` | — | — |
| `sandstone` | Sandstone | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `sea_glass` | Sea Glass | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `sheet_music` | Sheet Music | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_23` | — | 1 |
| `stained_glass` | Stained Glass | live | `light_glass` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_24` | yes | 3 |
| `starfield` | Starfield | live | `fantasy_future` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `stone` | Quartzite | live | `earth_ore` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_25` | — | — |
| `tidewood` | Tidewood | live | `living_world` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `ukiyo_e` | Ukiyo E | live | `ink_paper` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `victorian` | Victorian Portrait | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_26` | — | 2 |
| `victorian_woman` | Victorian Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |
| `watercolour` | Watercolour | live | `artists_gallery` | yes | yes | yes | yes | yes | tile | tile | — | — | — | — | — |
| `wild_west` | Wild West | live | `another_age` | yes | yes | yes | yes | yes | tile | tile | yes | dedicated | `flip_27` | — | — |
| `wild_west_woman` | Wild West Woman | live | `another_age` | yes | — | — | — | — | via subject | via subject | — | — | — | — | — |

## Inconsistencies

Nothing here has been resolved — this is an inventory, and each of these is for Rich to rule on.

### Sources that disagree

- `REVEAL_POOL` in public/foyer-DATA.js still names flips that are no longer in the deck: flip_18 ("Cast Glass"). Nothing reads REVEAL_POOL — it is demo data left from the glass prototype — but it now describes a deck that does not exist.

### Preview plates that break the set's convention

The effects set is shot to a 400px long edge, and an `@2x` should be the same picture at twice the size. These are measured from the files, not assumed. A plate that breaks the convention is not a bug on its own — nothing reads `@2x` today — but a 1x and an `@2x` that are different renders no longer describe one picture.

- `balloon_face` man.jpg is 400x497; the set's convention is a 400px long edge
- `balloon_face` man.jpg is 400x497 (0.80) but man@2x.jpg is 900x900 (1.00) — the @2x is not the same picture at twice the size
- `balloon_face` woman.jpg is 400x497; the set's convention is a 400px long edge
- `balloon_face` woman.jpg is 400x497 (0.80) but woman@2x.jpg is 900x900 (1.00) — the @2x is not the same picture at twice the size
- `clockwork` man.jpg is 1017x1008; the set's convention is a 400px long edge
- `clockwork` man.jpg is 1017x1008 (1.01) but man@2x.jpg is 900x922 (0.98) — the @2x is not the same picture at twice the size
- `clockwork` woman.jpg is 1017x1012; the set's convention is a 400px long edge
- `clockwork` woman.jpg is 1017x1012 (1.00) but woman@2x.jpg is 900x935 (0.96) — the @2x is not the same picture at twice the size
- `elizabethan` man.jpg is 1003x1046; the set's convention is a 400px long edge
- `elizabethan` man.jpg is 1003x1046 (0.96) but man@2x.jpg is 900x900 (1.00) — the @2x is not the same picture at twice the size
- `elizabethan` woman.jpg is 400x497; the set's convention is a 400px long edge
- `elizabethan` woman.jpg is 400x497 (0.80) but woman@2x.jpg is 900x900 (1.00) — the @2x is not the same picture at twice the size
- `deco_twenties` man.jpg is 1014x1021; the set's convention is a 400px long edge
- `deco_twenties` woman.jpg is 1015x1017; the set's convention is a 400px long edge
- `samurai` woman.jpg is 1018x1017; the set's convention is a 400px long edge
- `persian_court` man.jpg is 992x1007; the set's convention is a 400px long edge

## Sources

| What | File |
|---|---|
| IDs, labels, status, silos | `lib/v1/portraits/effect-registry.ts` (CENG source) and the generated `public/effect-registry.js` |
| Prompt bodies | `lib/v1/portraits/portraits-bodies.ts` → `EFFECT_BODIES` |
| Preview plates | `public/previews/effects/<id>/` on disk, and `public/previews/effects-manifest.json` |
| Portraits offer gate | `public/portraits.html` → `ROUTE_ACCEPTS` + `craftable()`, against `portraits-shared.ts` → `PRESET_LABELS` |
| Discovery rooms | `public/discovery-consolidated-draft.html` → `buildSilosFromRegistry()`, which keeps `body === "live"` |
| Curated universe and plates | same file → `CURATED_UNIVERSE`, `CURATED_PLATES`, and `public/previews/curated/` on disk |
| Foyer flip deck | `public/foyer.html` → `FLIP_EFFECT`, `FAN`, `MOSAIC_MORE`; `public/foyer-DATA.js` → `FLIPS`; `public/previews/foyer-flip-male/` |
| Foyer free reveal | `lib/v1/foyer/foyer-policy.ts` → `FOYER_REVEAL_EFFECTS` |

This document is an inventory, so it goes stale the moment one of the sources above moves. It was produced by a script that reads all of them; the script is not committed (this pass was documentation only), so ask for it if the manifest should be rebuildable on demand rather than by hand.

