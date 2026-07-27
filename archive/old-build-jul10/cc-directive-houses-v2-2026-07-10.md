# CC DIRECTIVE — HOUSES v2 · 2026-07-10
**Locked elements: obey `MASTER-LOCKED-ELEMENTS` (current version). It wins on every element it names.**
Supersedes `cc-directive-houses-buildout-v1` (pre-shell, pre-Master-List). Proto: **`houses-proto.html`**.

## 0. METHOD (non-negotiable)
- Houses = the **universal four-column shell** (Master List §7) + Houses effect content. Build/inherit
  the shell exactly as the Portraits shell-rebuild produced it; this directive is the **content swap**.
- **FIDELITY LAW (Master List §10):** copy proto blocks **verbatim** — do not rename classes/IDs,
  substitute CSS values, collapse to utilities, reorder, or **regenerate** a block with the same class
  names. Recreation = INTERPRETATION failure even if it looks identical. Move blocks, don't author them.
- Copy from `houses-proto.html` (HTML entities + inline SVG present — corruption on retype).

## 0.5 CONTENT SWAP — LITERAL (Master List §13)
- **Delete** the Portraits control blocks (framing/pose row, setting) entirely; **copy** the Houses
  blocks from `houses-proto.html`. Do NOT mutate a Portraits block into a Houses block.
- **Preview paths:** no `previews/portraits/…` (or any other series) path may remain anywhere in
  Houses — must grep to zero; Houses uses `previews/houses/<id>/…` only.
- **Upload copy (locked, copy verbatim):** "Add a photo of your home" / "A clear view of the whole
  facade works best."
- **Recipe text (locked):** Artists → "An {effect} rendering of your home." · all others →
  "A {material} house, {setting}, {time of day}." Copy the recipe logic from the proto verbatim.

## 1. EFFECT TABS (from proto `MATS`) — 5
- **Materials (8):** Bronze · Walnut · Alabaster · Glass · Carved Wood · Carved Stone · Wax · Iron
- **Curiosities (10):** Dollhouse · Amber Inclusion · Enchanted Crystal · Ukiyo-e · Art Nouveau ·
  Cubism · Daguerreotype · Art Deco · Gingerbread · Snow Globe
- **Seasons (4):** Spring · Summer · Fall · Winter
- **Events (5):** Haunted · Fire · Alien · Explosion · Abandoned
- **Artists (4):** Impressionist · Watercolor · Charcoal & Chalk · Pen & Ink
- Labels + card one-liners are LOCKED in `houses-effect-card-copy-v1` — use verbatim. Disc/thumb art
  from `previews/houses/<id>/1.jpg` (Master List §9).

## 2. CONTROLS (replace the pose row)
- **The setting:** Gradient (`desk`) · Room In House (`room_in_house`) · In Environment (`in_situ`).
  "In Environment" is the locked label — never "In-Situ" (Master List §6).
- **Time of day:** Day · Night.
- **Aspect ratio (8, wider canvas):** 3:2 (default) · 16:9 · 4:3 · 5:4 · 1:1 · 4:5 · 3:4 · 9:16.

## 3. BEHAVIOR LOCKS (wired in proto)
- Night-forced (ToD hidden/held Night): Haunted · Fire · Alien · Snow Globe.
- Gradient-forced setting: Snow Globe.
- **Artists tab AND the 5 ownScene curiosities hide Setting + Time of day.** Per the CENG engine
  pass, `ukiyo_e · art_nouveau · cubism · daguerreotype · art_deco` are `ownScene===true` and
  bypass environment + time-of-day exactly like Artists. `amber_inclusion` + `enchanted_crystal`
  are NOT ownScene — they keep Setting + ToD. **Extend the artists-hide rule to fire on
  `preset.ownScene===true`; surface the `ownScene` boolean in the client presets/catalog payload
  (fallback: hardcode the 5 ids).**
- Artist `preset_id`s stay long: `impressionist_oil` · `watercolor_study` · `charcoal_chalk` ·
  `pen_ink` (labels Impressionist / Watercolor / Charcoal & Chalk / Pen & Ink). `dollhouse`,
  `gingerbread`, `snow_globe` live in Curiosities only — remove from Materials so they don't double.

## 4. S1
- **No subject-pick** (scene, not face) — wire to `houses-analyze` (facade quality/coverage), not `faces`.
- Keep multi-angle upload (up to 4 sources). Crop overlay drops "Tap a face".

## 5. ENGINE (CENG-owned — cross-ref `CENG→CUI Houses Engine Pass Contract v1`)
- 31 presets landed (Materials 8 · Curiosities 10 · Seasons 4 · Events 5 · Artists 4). Labels +
  descriptions are engine-owned in `HOUSES_EFFECT_CATALOG` — **UI renders, does not re-author.**
- Drops (deleted from engine): `scaled_architectural` (Museum), `watercolor_wood` (Painted Wood) —
  remove from all UI lists/tiles. Relabel `watercolor_study` tile → "Watercolor".
- Refine/outpaint forced OFF for ownScene by the engine — UI does not gate these.
- **Preview renders (content task):** 9 new ids need tiles at `previews/houses/<id>/1-4.jpg` then
  copied to `public/previews/`: walnut, iron, amber_inclusion, enchanted_crystal, ukiyo_e,
  art_nouveau, cubism, daguerreotype, art_deco. None exist yet — must be generated.

## 5.1 ASPECT RATIO — RESOLVED
- **Decision (Rich):** environment/group silos breathe in a larger canvas → Houses uses the full
  **8-ratio set** (`3:2 default · 16:9 · 4:3 · 5:4 · 1:1 · 4:5 · 3:4 · 9:16`), matching the CENG
  engine enum. Same set applies to Groups + Landscapes. `houses-generate-route` validates against
  this 8-value enum.

## 6. RECONCILE LIVE `houses.html`
Purge to Master List: price → $4.99; fonts → Manrope+Cormorant (strip Inter/JetBrains/system stack);
tokens → brand hex; tiers → Web/Print/Collector; plaque fully stripped.

## 7. DEFINITION OF DONE (Master List gate)
Checklist passes · zero INTERPRETATION/REGRESSION · `node --check` + build pass · screenshot ·
git diff reviewed · independent review clean. "Looks right" is not a state.
