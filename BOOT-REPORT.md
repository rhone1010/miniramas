# BOOT REPORT

Generated 2026-07-29 04:31 from disk.
**Everything below is machine-read this run.** Where a document disagrees
with this report, the report is right and the document is corrected today.

## 1 · Repository state

- Branch: `feature/store-commerce`
- Last commit: ?
- Pushed and current with origin.

- ⚠ **2 untracked path(s).** Untracked means it exists
  nowhere but this disk. This is how fifteen days of work was nearly lost.
  - `_recovery/pipeline/010_credits_v4.sql`
  - `scripts/boot.js`

- 6 modified, uncommitted:
  - `recovery/at-19c3157`
  - `_recovery/at-d023aef`
  - `app/api/v1/credits/balance/route.ts`
  - `app/api/v1/credits/gate/route.ts`
  - `app/api/v1/credits/refund/route.ts`
  - `scripts/gate-stage.js`

## 2 · Surfaces — what exists, measured

| File | Lines | ids | fetch | fn | Modified |
|---|---|---|---|---|---|
| `docs/SURFACES/account/litenco-account-2026-07-24-r7.html` | 347 | 2 | 0 | 0 | 2026-07-26 |
| `docs/SURFACES/entry-gate/litenco-entrygate-2026-07-24-r1.html` | 375 | 21 | 0 | 3 | 2026-07-27 |
| `docs/SURFACES/masthead/litenco-masthead-2026-07-24-r2.html` | 286 | 7 | 0 | 0 | 2026-07-26 |
| `docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html` | 1896 | 67 | 0 | 70 | 2026-07-26 |
| `docs/SURFACES/print-shop/litenco-printshop-2026-07-24-r28.html` | 1693 | 66 ⚠dup | 0 | 11 | 2026-07-26 |
| `public/actionmini.html` | 2266 | 50 | 4 | 35 | 2026-07-20 |
| `public/groups-testbench.html` | 286 | 18 | 1 | 12 | 2026-07-12 |
| `public/groups.html` | 464 | 11 | 0 | 10 | 2026-07-11 |
| `public/houses.html` | 4069 | 67 | 2 | 67 | 2026-06-07 |
| `public/index.html` | 552 | 20 | 0 | 12 | 2026-07-08 |
| `public/interiors.html` | 122 | 16 | 1 | 8 | 2026-05-06 |
| `public/landscapes.html` | 2230 | 36 | 1 | 42 | 2026-05-07 |
| `public/liten-prompt-bench-v3.html` | 273 | 13 | 0 | 35 | 2026-07-19 |
| `public/pet-wallpaper.html` | 483 | 16 | 2 | 15 | 2026-07-11 |
| `public/pets.html` | 5939 | 89 | 3 | 106 | 2026-07-09 |
| `public/portrait-wallpaper.html` | 486 | 16 | 2 | 15 | 2026-07-11 |
| `public/portraits-b1.html` | 8821 | 143 | 9 | 201 | 2026-07-27 |
| `public/portraits-b2.html` | 8877 | 143 | 10 | 203 | 2026-07-27 |
| `public/portraits-b4.html` | 10308 | 216 | 10 | 273 | 2026-07-28 |
| `public/portraits_recover2.html` | 8825 | 143 | 9 | 201 | 2026-07-27 |
| `public/print-config.html` | 436 | 9 | 0 | 3 | 2026-05-30 |
| `public/sportsmem.html` | 371 | 11 | 1 | 4 | 2026-05-06 |

A file with 0 fetch calls is a **prototype** — a specification, never wired.
A file with fetch calls is an **engine**. Never drop one onto the other.

## 3 · Component registry — ask before building

Before building any UI, check this list. Reinventing something that already
exists has cost real time more than once.

- `docs/CONTENT/`
  - portraits-prompt-reference.md
- `docs/GOVERNANCE/`
  - LIVE-FILE-LEDGER.md
  - LOCKED-DECISIONS-2026-07-27.md
  - PROCEDURES-AND-LANES-2026-07-27.md
- `docs/SURFACES/account/`
  - litenco-account-2026-07-24-r7.html
- `docs/SURFACES/entry-gate/`
  - litenco-entrygate-2026-07-24-r1.html
- `docs/SURFACES/masthead/`
  - MASTHEAD-DIRECTIVE-v1.md
  - litenco-masthead-2026-07-24-r2.html
- `docs/SURFACES/portraits/`
  - PORTRAITS-SPEC-2026-07-27-v2.md
  - litenco-portraits-2026-07-24-r81.html
- `docs/SURFACES/print-shop/`
  - CLAW-TICKET-PRINTSHOP-PRODUCTS-2026-07-24.md
  - litenco-printshop-2026-07-24-r28.html
- `docs/SYSTEM/`
  - CC-TICKET-FOCAL-POINT-2026-07-24.md
  - CREDITS-AND-CODES-SPEC-v4.md
  - PROJECT-KNOWLEDGE-TRIAGE-2026-07-24.md
  - SURFACE-TOKENS-2026-07-28.md
  - gate0.js
  - portraits-catalogue.js
- `docs/tasks/`
  - engine-items-8b-11.md

## 4 · Engine truth — effect lists, read from lib/

Three lists guard the same door. When they disagree, effects go missing.

- **PRESET_LABELS — /generate accepts these** — `lib/v1/portraits/portraits-shared.ts` — 17 entries
  `plushy, bronze, iron, alabaster, stone, ebony, walnut, impressionist, torn_paper, folded_book, charcoal_chalk, pencil_sketch, sheet_music, pewter, chocolate, stained_glass, driftwood_resin`
- **EFFECT_CATALOG — the Curator can recommend these** — `lib/v1/portraits/portraits-effect-curator.ts` — 12 entries
  `bronze, alabaster, stone, ebony, walnut, iron, impressionist, torn_paper, folded_book, charcoal_chalk, pencil_sketch, sheet_music`
- **EXPERIMENTAL_EFFECTS — needs isExperimentalEffect() at the guard** — `lib/v1/portraits/portraits-experimental.ts` — 14 entries
  `deep_sea, circuit, reclaimed_bronze, mercury, blown_glass, amber, neon, nebula_resin, dragon_skin, magic_energy, armor, elizabethan, victorian, fantasy_crystal`

⚠ **5 preset(s) render but the Curator cannot offer them:**
`plushy, pewter, chocolate, stained_glass, driftwood_resin`
The Curator is the customer path — an effect it cannot name is invisible.

## 5 · Catalogue vs engine

- 6 silos · 36 effects
- **23/36 render today.**
- No prompt yet: `cast_glass, frost_ice, liquid_mercury, enchanted_crystal, volumetric_light, fire_ember, living_armor, living_reef, silicon_circuit, atomic_robot, cosmic_bloom, neon_drawing, elizabethan_portrait`
- ⚠ Engine has, catalogue does not: `deep_sea, circuit, mercury, neon, armor, elizabethan, victorian, fantasy_crystal`

## 6 · Assets

- `public/textures/` — 16 item(s)
- `public/icons/` — 29 item(s)
- `public/previews/portraits/` — 25 item(s)

## 7 · Referenced but absent

4 asset(s) referenced by a surface but not on disk:
- `/rewards-insets/'+inset+'.png`
- `/previews/source/wide-shot.jpg`
- `/previews/source/portrait.jpg`
- `/previews/source/blank.jpg`

## 7b · Stage contract

- no stage file found in public/

## 8 · Standing gates

Cumulative. A gate added because something broke is never removed.

- All declared `fetch()` calls present; no id lost; function count not decreased
- No duplicate ids · `node --check` clean · style braces balanced · boots in jsdom
- Radius ≤ 8px, except 999px where the constrained dimension is ≤ 72px, or a true circle
- `[hidden]{display:none!important}` present — a display rule must not beat the attribute
- No horizontal `min-width` ≥ 1200px without a release breakpoint below it
- Cormorant never below 1.333rem, never above weight 400
- Grid track sets never sum to 100% alongside a gap
- No percentage padding used as vertical reserve
- Bench tooling never ported forward into a surface
- body is never a flex or grid container — the stage becomes a flex item
- only :root may size type with clamp(), and its floor is 16px
- a fixed-px container must size its own type, not inherit rem

## 9 · Rules that exist because they were broken

1. **Verification.** No claim about this repo, the engine, or another lane is
   stated as fact unless read that day from live source. Absence from an
   upload is not evidence of absence.
2. **Ask before building.** Check §3 first. The masthead, entry gate, account,
   print shop and portraits surfaces already exist.
3. **Commit and push at every acceptance.** Named files, never `git add -A`.
