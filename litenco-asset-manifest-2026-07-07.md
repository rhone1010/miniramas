# LITEN & CO — ASSET MANIFEST (Homepage) · for Claude Code port
**2026-07-07 · repo: `D:\minramas\` · maps every homepage image slot → real repo path.**

The mockup ships images as inlined base64 for preview only. On port, Claude Code replaces base64 → real `<img src>` / `next/image` paths using this table. **Map by taxonomy ID, never by literal filename** (icon and preview filenames differ — see notes).

---

## 0 · TWO BLOCKERS (fix before wiring paths)

1. **`previews/` is at the repo root, NOT under `public/`.** Next.js only serves `public/`. Either move `previews/` → `public/previews/` (then the web paths below are correct), or add a static route/rewrite. Icons are already correct: `public/icons/` → `/icons/...`.
2. **Icon filenames ≠ preview folders.** Icons use hyphens + display names (`Icon_Effect__0007_Torn-Paper.png`); preview folders use snake_case taxonomy IDs (`torn_paper/`). Two don't even match by name: icon `0009_Charcoal` → folder `charcoal_chalk`; icon `0019_Nebula` → folder `nebula_resin`. Resolve via the ID column below.

---

## 1 · EFFECT PREVIEWS + ICONS (24, by taxonomy ID)
Previews: portrait rendered per effect, 4 variants each — `/previews/portraits/<id>/<1-4>.jpg` (flat copies: `/previews/_flat/<id>_<n>.jpg`). Icons: `/icons/...`.

| taxonomy id | gallery | preview (variant 1) | icon |
|---|---|---|---|
| ebony | Earth & Ore | /previews/portraits/ebony/1.jpg | /icons/Icon_Effect__0000_Ebony.png |
| walnut | Earth & Ore | /previews/portraits/walnut/1.jpg | /icons/Icon_Effect__0001_Walnut.png |
| stone | Earth & Ore | /previews/portraits/stone/1.jpg | /icons/Icon_Effect__0002_Stone.png |
| bronze | Earth & Ore | /previews/portraits/bronze/1.jpg | /icons/Icon_Effect__0003_Bronze.png |
| iron | Earth & Ore | /previews/portraits/iron/1.jpg | /icons/Icon_Effect__0004_Iron.png |
| alabaster | Earth & Ore | /previews/portraits/alabaster/1.jpg | /icons/Icon_Effect__0005_Alabaster.png |
| impressionist | Artists Gallery | /previews/portraits/impressionist/1.jpg | /icons/Icon_Effect__0006_Impressionist.png |
| torn_paper | Artists Gallery | /previews/portraits/torn_paper/1.jpg | /icons/Icon_Effect__0007_Torn-Paper.png |
| folded_book | Artists Gallery | /previews/portraits/folded_book/1.jpg | /icons/Icon_Effect__0008_Folded-Book.png |
| charcoal_chalk | Artists Gallery | /previews/portraits/charcoal_chalk/1.jpg | /icons/Icon_Effect__0009_Charcoal.png |  ⚠ name≠folder
| pencil_sketch | Artists Gallery | /previews/portraits/pencil_sketch/1.jpg | /icons/Icon_Effect__0010_Pencil-Sketch.png |
| sheet_music | Artists Gallery | /previews/portraits/sheet_music/1.jpg | /icons/Icon_Effect__0011_Sheet-Music.png |
| deep_sea | Curiosities | /previews/portraits/deep_sea/1.jpg | /icons/Icon_Effect__0012_Deep-Sea.png |
| circuit | Curiosities | /previews/portraits/circuit/1.jpg | /icons/Icon_Effect__0013_Circuit.png |
| reclaimed_bronze | Curiosities | /previews/portraits/reclaimed_bronze/1.jpg | /icons/Icon_Effect__0014_Reclaimed-Bronze.png |
| mercury | Curiosities | /previews/portraits/mercury/1.jpg | /icons/Icon_Effect__0015_Mercury.png |
| blown_glass | Curiosities | /previews/portraits/blown_glass/1.jpg | /icons/Icon_Effect__0016_Blown-Glass.png |
| amber | Curiosities | /previews/portraits/amber/1.jpg | /icons/Icon_Effect__0017_Amber.png |
| neon | Curiosities | /previews/portraits/neon/1.jpg | /icons/Icon_Effect__0018_Neon.png |
| nebula_resin | Curiosities | /previews/portraits/nebula_resin/1.jpg | /icons/Icon_Effect__0019_Nebula.png |  ⚠ name≠folder
| dragon_skin | Curiosities | /previews/portraits/dragon_skin/1.jpg | /icons/Icon_Effect__0020_Dragon-Skin.png |
| magic_energy | Curiosities | /previews/portraits/magic_energy/1.jpg | /icons/Icon_Effect__0021_Magic-Energy.png |
| fantasy_crystal | Curiosities | /previews/portraits/fantasy_crystal/1.jpg | /icons/Icon_Effect__0022_Fantasy-Crystal.png |
| armor | Curiosities | /previews/portraits/armor/1.jpg | /icons/Icon_Effect__0023_Armor.png |

Variants: swap the trailing `/1.jpg` for `/2.jpg`–`/4.jpg`. Manifest of all: `previews/portraits/bake-grid-manifest.json`.

---

## 2 · HOMEPAGE SLOT → ASSET MAP

**Wired now (assets present in tree):**
- **Artist Portrait bundle crossfade** → the 6 Artists-Gallery previews: `/previews/portraits/{impressionist,torn_paper,folded_book,charcoal_chalk,pencil_sketch,sheet_music}/1.jpg`. (This is the correct "effect previews, not icons" set.)
- **Advanced disc grids / any effect icon** → `/icons/Icon_Effect__*.png` per the table.
- **Pose figures** (Bust/Signature/Statuesque) → `/icons/Icon_Pose__000{0,1,2}_*.png`.

**Path NEEDED (not in the tree you sent) — flagged, do not guess:**
- **Logo mark** (nav + footer lockup) → not in tree. Likely `public/` (e.g. `public/litenco-logo-ink.png`). Send path.
- **Groups-in-Material bundle** + **See-It-Happen stage renders** for Groups (×4 materials), Houses–Fall, Action–Ceramic → these are **group/house/action** renders; the tree only has **portrait** previews. Send their directory (expected sibling: `previews/groups/`, `previews/houses/`, `previews/action/`?).
- **Gallery tiles** (Houses, Landscapes, Portrait, Groups, Action, Artist Series) → tile hero renders; not in tree. Send paths (or reuse a `previews/<series>/` render).
- **Source demo photos** ("Your photograph" insets) → demo source images; send path.

---

## 3 · PORT PROCEDURE (for Claude Code)
1. Confirm/move `previews/` under `public/` (blocker #1).
2. Replace each inlined `data:image/...;base64,...` in the homepage with the mapped web path above; use `next/image` with width/height for the large renders.
3. For effect slots, resolve the file via **taxonomy ID → column** (blocker #2), not the icon's display filename.
4. Leave the flagged "path needed" slots as TODO markers; do not substitute a wrong image (no-filler law).
5. Re-run the 50%-overlay check (Rich's PNG over the built page) to confirm no drift.

---

## 4 · EXTRACTION RULE (resolves the "path-needed" slots — 2026-07-07)
The flagged slots (logo, Groups/Houses/Action stage renders, gallery tiles, source photos) are **already real renders baked into the mockup as base64** — not placeholders. Do NOT leave them as TODO and do NOT substitute stock.

**Procedure:** extract each non-taxonomy `data:image` from the mockup and write it to `public/homepage/` with a sensible name (e.g. `public/homepage/tile-houses.jpg`, `public/homepage/stage-groups-mixed-metals.jpg`, `public/homepage/logo-ink.png`, `public/homepage/source-1.jpg`), then reference `/homepage/<name>`. Keep the alt text from the mockup.

**Split:**
- **Effect/finish slots → `previews/` tree** (taxonomy, §1): the Artist Portrait bundle crossfade wires to the six Artists-Gallery previews `/previews/portraits/{impressionist,torn_paper,folded_book,charcoal_chalk,pencil_sketch,sheet_music}/1.jpg`. **Override the mockup here** — its Artist bundle is a 3-image stand-in; replace with these six.
- **Everything else → extracted `/homepage/*`** (real baked renders).

Only genuinely swap-later item: if canonical taxonomy-named Groups/Houses/Action *series* previews get produced, repoint those `/homepage/*` slots at a `previews/<series>/` tree. Until then the extracted renders are correct and shippable.
