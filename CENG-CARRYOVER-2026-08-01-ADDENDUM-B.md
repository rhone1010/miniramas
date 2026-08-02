# CENG CARRYOVER — 2026-08-01 · ADDENDUM B (engine)

**Read `CENG-CARRYOVER-2026-08-01-V23.md` first.** That file covers the 37 locked
bodies and the silo model. This one covers everything that happened to the repo
afterwards, and it corrects two things in it.

---

## 0. START HERE TOMORROW

**One decision blocks everything else.** See §4. Five minutes to make, and the
loader, the generator rewire and the CUI handoff all depend on it.

Order after that: reconcile registry → wire the generator to `portraits-bodies.ts`
→ style-ref loader → plural refs → hand CUI a stable contract.

---

## 1. WHAT SHIPPED TO THE REPO

Four commits on `feature/store-commerce`.

### 1.1 Dead stages removed

`portraits-pass2.ts`, `portraits-expand.ts` and `portraits-gpt-image.ts` are
**deleted.** All three were dead at runtime already — `passTwoEnabled: false`,
`expandEnabled: false`, `generator: 'nb2'` on every style — but imported and
called, so they could not simply be dropped. `scripts/strip-dead-passes.py` cut
the three imports and the three call blocks with must-exist / must-not-exist
gates and a brace-balance check.

Also deleted: `app/api/v1/portraits/raw-gpt-image/route.ts` and its two scratch
copies, which imported the gpt-image module.

**Deliberately retained:** `lastRefined` / `lastRefineMs` / `lastExpanded` /
`lastExpandMs` / `lastExpandSkip`, and the `refined` / `refine_ms` / `expanded` /
`expand_ms` / `expand_skip` fields on `PortraitsGenerateResult`. Those reach the
route and the front end. Gutting the response shape is a separate job with CUI in
the room.

`PASS2_MATERIAL_REFINEMENT_BY_PRESET` went with pass2 — that was an exhaustive
`Record<PortraitsPresetId, …>` that every new preset would have had to extend.

### 1.2 Scratch directories removed

`_upload/`, `_route_upload/`, `_route-collection/` — flat May–June copies of every
route in the app. Verified stale (the live `portraits-generate-route.ts` is 29,405
bytes against the copy's 14,736). Deleted.

**tsc went 71 → 60.** Portraits contributes exactly one of the remaining 60:
`portraits-prompt.ts:43`, the `legacy_edition` key, which predates today.

Next easy win: `docs/GOVERNANCE/confirmPurchase-replacement.ts` throws 8 errors
because tsc compiles a docs folder as source. Excluding `docs/` in tsconfig takes
you to 52.

### 1.3 Style-refs split into two trees

`scripts/split-style-refs.js`. Rich's requirement: full-res plates must not be
scrapeable, but the same images serve the UI as previews.

| tree | what | size |
|---|---|---|
| `lib/v1/portraits/style-refs/<id>/` | full-res plates, **server only**, never web-served. The aux images NB2 receives. | 21.6 MB |
| `public/previews/effects/<id>/` | 400px long edge, JPEG q70, mozjpeg. Card thumbnails. | 2.1 MB |

90% smaller public. 56 folders, 92 plates. `public/style-refs/` is deleted.

**Renames applied** — folder names now match effect ids:

| was | now | why |
|---|---|---|
| `forest_gaurdian` | `forest_guardian` | typo |
| `deco_20s` | `deco_twenties` | |
| `persian` | `persian_court` | |
| `petals` | `petal_sculpture` | |
| `ebony_live_edge` | `ebony` | live-edge body supersedes the old one |
| `quartzite` | `stone` | **engine id really is `stone`** — only the LABEL is Quartzite. Renaming the id touches `PortraitsPresetId`, `PRESET_LABELS`, `STYLE_MATERIALS`. Not worth it. |

The superseded `ebony` and `stone` plates are in `_archive/style-refs-2026-08-01/`.
Cut effects (`alabaster`, `walnut`, `amber`, `blown_glass`, `haunted`,
`melted_wax`, `cosmic`, `volume_light`, `living_vines`) are archived there too,
not deleted.

**Filenames normalised** to `1_man.jpg` / `2_woman.jpg`. `renaissance` and
`quartzite` had been using `_male` / `_female`; a loader parsing gender from the
filename would have missed them.

### 1.4 portraits-bodies.ts

`lib/v1/portraits/portraits-bodies.ts` — 37 bodies, grouped by silo,
`{ id, body, avoid }` and nothing else. Compiles clean, no duplicate ids, every
literal parses, `buildEffectPrompt()` returns exactly the approved text.

**Nothing imports it yet.** See §3.

---

## 2. THE DESIGN RULING — BODIES ARE WHOLE

Rich's call, and it is the architectural decision of the session:

> "why make things more complex than they have to be."

Every body carries its own framing, background, lighting, likeness and
idealization language. **Nothing is prepended, appended or composed at request
time.** What is written in `portraits-bodies.ts` is what NB2 receives.

That retires, for Portraits:

- `framingBlock`, `CRAFT_PERSONALITY`, `HUE_LOCK`, `STUDIO_DIRECTIVES`, `COSTUME_DIRECTIVES`
- the `MATERIAL_PHRASE` / `ARTISTS_BLOCKS` / `EXPERIMENTAL_EFFECTS` three-way split
- the universal §1.3 tail as a separate concatenated block

**Measured effect:** bodies average **1,017 chars** against the ~2,700 that
`portraits-prompt.ts` was assembling. Range 555–1,870. That is §1.1 — succinct to
the point of clear direction — with a number on it.

The reasoning: each body was written and shot as a single paragraph against real
sources. Wrapping it in a universal stack ships a prompt that differs from the one
that was tested.

`portraits-experimental.ts` is Portraits-only — verified, nothing else in the repo
imports it, and Pets/Groups/Action have no experimental path. Safe to retire once
the generator no longer needs it.

---

## 3. WHAT IS NOT DONE

Four items, in dependency order. Nothing here is started.

**3.1 The generator still uses the old prompt path.** It calls
`buildPortraitsPrompt` from `portraits-prompt.ts`, which composes the old stack.
`portraits-bodies.ts` is orphaned. Today's 37 bodies are not reaching NB2.

**3.2 No style-ref loader exists.** The files are in place at
`lib/v1/portraits/style-refs/<id>/`; nothing reads them. Needs an id → base64[]
function with an in-memory cache.

**3.3 `callNB2` takes ONE ref.** Signature is `styleReferenceB64?: string`
(singular), and the generator builds the array from `req.style_reference_b64` —
supplied by the caller, never loaded from disk. Rich wants **1–2 aux images per
source**. Needs `styleReferenceB64s: string[]` and the imageInput concat updated.
NB2 caps at 14; 1 source + 2 refs is well inside.

**3.4 The registry disagrees with the bodies.** See §4 — this blocks 3.1–3.3.

---

## 4. THE BLOCKING DECISION — REGISTRY vs BODIES

`effect-registry.ts` holds **57 rows** across 8 silos:
`live 26 · authored 9 · todo 22`. `light_glass` is over by 1.

It is **not** the silo model in the V23 carryover. It still declares
`myth_legend`, `far_future`, `handmade` — the V23 §2 table proposes
`fantasy_future`, `made_by_hand`, `print_pattern`. **V23 §2 is a proposal, not
what is in the code.**

**25 locked bodies have no registry row:**
beaded · victorian_woman · forest_guardian · persian_court_woman · persian_court ·
quartzite · elizabethan_woman · ukiyo_e · cubism · daguerreotype · art_deco ·
art_nouveau · deco_twenties_woman · samurai_woman · balloon_face · quilted ·
petrified_wood · origami · porcelain · starfield · clockwork · oil_impasto ·
linocut · crystallized · sand_form

**45 registry rows have no locked body.** Some are naming only —
registry `balloon` = locked `balloon_face`; registry `stone` = locked `quartzite`;
registry `moss_stone` is retired in favour of `forest_guardian`. But most are the
22 `todo` rows: `dichroic_glass`, `golden_idol`, `runestone`, `wireframe`,
`digital_human`, `ancient_egypt`, `flowing_water`, `frozen_splash`, `blossom`,
`autumn_leaf`, `butterfly_wing`, `mosaic`, `topiary`, `wicker` and others.
Planned, never written, never shot.

**The question: which document is the catalog?**

*Option A — registry is the roadmap.* Add the 25 missing ids, mark today's 37
`body: 'live'`, leave the 22 todos as the backlog. Silos stay as named. CUI's
hierarchy is unchanged. Catalog is 82 rows, 37 offerable.

*Option B — today's 37 are the catalog.* Cut the 22 todos, rename the silos to the
V23 model, registry becomes an index of what exists. CUI has to re-key silo art
and labels.

I lean A — it is additive, `body: BodyStatus` already exists to gate exactly this,
and it does not send CUI back to rework the silo tiles. But the V23 silo model was
Rich's design decision this session, so this is his call.

**One inconsistency to fix either way:** I renamed
`oil_impasto_palette_knife` → `oil_impasto` in `portraits-bodies.ts` (Rich: the
short form is the better label) but **not** in `locked-2026-08-01.json`. Those two
files currently disagree.

---

## 5. TOOLING NOW IN `scripts/`

| script | what |
|---|---|
| `strip-dead-passes.py` | removed pass2/expand/gpt-image. Done, kept for the record. |
| `split-style-refs.js` | the two-tree split. Re-runnable if plates change. |
| `apply-locked.js` / `apply-locked-v2.js` | **do not use.** Written against the wrong assumption — that `effect-registry.ts` stores bodies. It does not; `body` is a `BodyStatus` enum. v1 also had an anchor bug that inserted inside a pose array. Kept only so the next instance does not rewrite them. |
| `tidy-root.js` | root cleanup. Run from the repo root, not `scripts/`. |
| `extract-effects.js` | the V22 extractor. Still valid. Always `--out`, never `>`. |

`.gitignore` now covers `_testpool/`, `_archive/`, `*.bak-*`, `*.bak2-*`.

**Still open:** whether `lib/v1/portraits/style-refs/` should be committed. It is
21.6 MB. Currently tracked. This is V22 §9 item 1 (Git LFS vs Supabase) arriving
in a concrete form.

---

## 6. CORRECTIONS TO THE V23 CARRYOVER

- **§2 silo table is a proposal**, not the state of the code. See §4.
- **§5 "how to apply"** is wrong end to end. `apply-locked.js` assumed the registry
  stores bodies. It does not. Ignore that section.
- **§4 item 3** listed `art_deco` as having no plates. It does now — Rich shot and
  saved it. `lichen_granite` and `mercury` also now have plates. **Every locked
  effect has at least one reference plate.**

---

## 7. STANDING, UNCHANGED

Rich's rules from V23 §8 all hold. Two worth repeating because they came up again:

**Do not over-constrain.** The measured result is in §2 — 1,017 chars against
2,700, and the shorter ones are the ones that shot clean.

**Never bulk-move or bulk-delete without a dry run showing exactly what will be
touched.** Every script this session defaulted to dry run. That caught the
`apply-locked` anchor bug before it reached anything that mattered, and caught the
`ebony` / `quartzite` folder collisions before the split ran.
