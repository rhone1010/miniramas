# CENG CARRYOVER — 2026-08-02 · ADDENDUM C

Read `CENG-CARRYOVER-2026-08-01-V23.md`, then `ADDENDUM-B`, then this.
This one closes §4 of Addendum B and opens one new problem.

---

## 1. §4 IS DECIDED — OPTION A, WITH THREE SILO RENAMES

Rich approved the 8×7 layout 2026-08-02. It is data, in `silos-2026-08-02.json`.
Do not re-derive it; read the file.

| silo | id | contents |
|---|---|---|
| Earth & Ore | `earth_ore` | bronze · iron · stone · jade · ebony · petrified_wood · reclaimed_bronze |
| Light & Glass | `light_glass` | ice · cast_glass · sea_glass · stained_glass · neon · polished_gold · mercury |
| The Living World | `living_world` | coral · tidewood · driftwood_resin · lichen_granite · petal_sculpture · sand_form · sandstone |
| Made by Hand | `made_by_hand` | plushy · chocolate · balloon_face · quilted · origami · porcelain · beaded |
| The Artists Gallery | `artists_gallery` | impressionist · watercolour · charcoal_chalk · pencil_sketch · oil_impasto · linocut · sheet_music |
| Ink & Paper | `ink_paper` | ukiyo_e · cubism · art_deco · art_nouveau · daguerreotype · folded_book · magic_energy |
| Fantasy & Future | `fantasy_future` | dragon_skin · fire_face · forest_guardian · retro_robot · clockwork · starfield · crystallized |
| Another Age | `another_age` | victorian · renaissance · persian_court · wild_west · deco_twenties · samurai · elizabethan — **men ⇄ women toggle**, 7 tiles, 14 rows |

**49 non-costume across 7 silos, exactly 7 each. It fits with nothing left over.**

Three id renames: `myth_legend` → `fantasy_future`, `far_future` → `ink_paper`,
`handmade` → `made_by_hand`. Two effect renames: `balloon` → `balloon_face`,
`oil_impasto_palette_knife` → `oil_impasto`.

25 rows removed — 16 todos never written, 9 cut effects still marked `live`
(`alabaster`, `walnut`, `blown_glass`, `amber`, `cosmic`, `volume_light`,
`armor`, `fantasy_crystal`, `nebula_resin`).

**Do not reopen this.** It took most of a session and I confused Rich twice by
flip-flopping on whether the numbers worked. They work. The layout is closed.

---

## 2. THE SCRIPT

`scripts/reconcile-registry.js`, driven by `silos-2026-08-02.json`. Dry run
default. Tested against the real registry — all eight silos land exactly.

```
node scripts/reconcile-registry.js
node scripts/reconcile-registry.js --apply
node scripts/emit-effect-registry.js
npx tsc --noEmit          # baseline 60
```

Result on the test run: **25 removed, 31 added, 6 recategorised, 7 flipped to
live.** The `refs:` counts come from the plates on disk at
`lib/v1/portraits/style-refs/<id>/`, so run it from the repo root or they all
read 0.

It does **not** touch `SILOS[].line` — the Curator's copy for the three renamed
silos is now wrong and is Rich's to rewrite. It does not touch prompt text; that
only ever lives in `portraits-bodies.ts`.

---

## 3. THE NEW PROBLEM — 27 EFFECTS HAVE NO BODY IN `portraits-bodies.ts`

This is the thing to solve next.

`portraits-bodies.ts` holds the 37 bodies locked 2026-08-01. The approved layout
needs **56 effects with prompts**. The other 27 are alive and working, but their
text lives in the old engine constants — `MATERIAL_PHRASE`, `ARTISTS_BLOCKS`,
`EXPERIMENTAL_EFFECTS` — reached through `buildPortraitsPrompt`.

bronze · stone · jade · reclaimed_bronze · sea_glass · stained_glass · neon ·
polished_gold · mercury · coral · tidewood · driftwood_resin · lichen_granite ·
petal_sculpture · sandstone · plushy · chocolate · impressionist · watercolour ·
charcoal_chalk · sheet_music · folded_book · fire_face · renaissance · wild_west ·
renaissance_woman · wild_west_woman

Two of those — `renaissance_woman` and `wild_west_woman` — have no captured body
anywhere. They exist as gendered rows in the layout and as plates on disk, but the
text was never logged. **They need writing.** Everything else has working text
that just needs moving.

**Three ways to go:**

*A. Port all 27 into `portraits-bodies.ts`.* One lookup path, one file, the
§2-Addendum-B "bodies are whole" ruling applies to everything. Cleanest end state.
Cost: 27 bodies extracted from the engine and checked, and the composed ones
(`ARTISTS_BLOCKS` builds from transformation + avoid + tail) have to be flattened
into whole bodies, which changes what NB2 receives. **Anything flattened must be
re-shot before it is trusted.**

*B. Generator reads both.* `portraits-bodies.ts` first, fall through to
`buildPortraitsPrompt`. Zero risk to the 27 working effects, ships tomorrow. Cost:
two prompt systems live at once, which is the thing this session was trying to end.

*C. Port the 8 that are simple, dual-path the rest.* The `MATERIAL_PHRASE` ones
are already flat strings and port with no behaviour change. The `ARTISTS_BLOCKS`
ones compose and are the risky group.

**Recommend B for launch, A after.** Nine days out is the wrong moment to re-shoot
27 working effects. Ship dual-path, port in the quiet after.

---

## 4. WHAT IS STILL NOT DONE

From Addendum B §3, unchanged:

1. **Generator still uses the old prompt path.** `portraits-bodies.ts` is
   orphaned — nothing imports it. Today's 37 bodies are not reaching NB2.
2. **No style-ref loader.** Plates are at `lib/v1/portraits/style-refs/<id>/`;
   nothing reads them. Needs id → base64[] with an in-memory cache.
3. **`callNB2` takes ONE ref** — `styleReferenceB64?: string`, built from
   `req.style_reference_b64`. Rich wants 1–2 aux per source. Needs
   `styleReferenceB64s: string[]`.

Order: reconcile → dual-path the generator → loader → plural refs → hand CUI the
contract.

---

## 5. POST-LAUNCH CANDIDATE

**`ink_stroke`** — drafted 2026-08-02 from Rich's idea, never shot. Minimal sumi-e
brushstrokes floating free in air, wet glossy ink catching specular highlights,
droplets hanging and falling. Body is in the 2026-08-02 session log. It was drafted
to fill a slot that turned out not to exist — I had double-listed `sheet_music`.
Good effect, no home. Keep it for the first post-launch addition.

---

## 6. ONE THING TO DO DIFFERENTLY

I told Rich the catalog was complete, then that it wasn't, then that it was —
three times, across two sessions. The cause each time was reporting a count before
reconciling the sources it came from. The bodies file, the registry and the ref
folders were three different pictures of the catalog and I quoted whichever one I
had just read.

Reconcile first, then report one number.
