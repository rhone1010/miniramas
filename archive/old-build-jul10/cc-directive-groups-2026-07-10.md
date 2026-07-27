# CC DIRECTIVE — GROUPS · 2026-07-10
**Locked elements: obey `MASTER-LOCKED-ELEMENTS` (current version).** Proto: **`groups-proto.html`**.

## 0. METHOD
- Groups = universal four-column shell (Master List §7) + Groups content swap. It is a **Portraits
  clone for multiple people** — same effect taxonomy, no style axis.
- FIDELITY LAW (§10): copy proto blocks verbatim; no rename/reorder/value-substitution/regeneration.
  Recreation = INTERPRETATION failure. Copy from `groups-proto.html`.

## 0.5 CONTENT SWAP — LITERAL (Master List §13)
- **Delete** the Portraits control blocks (framing/pose, setting); **copy** the Groups blocks from
  `groups-proto.html`. Do NOT mutate a Portraits block into a Groups block.
- **Preview paths:** no `previews/portraits/…` (or other series) path may remain — grep to zero;
  Groups uses `previews/groups/<id>/…` only.
- **Upload copy (locked, verbatim):** "Add a photo of your group" / "Everyone in one clear photo —
  I'll craft them together."
- **Recipe text (locked):** "Your group in {material}, {setting}." Copy the recipe logic from the
  proto verbatim.

## 1. EFFECT TABS (our 3-tab design; CENG catalog folded in) — 3
Our naming/layout/categorization; CENG dictates which effects exist + the material/experimental
lane. Cut effects (do NOT surface): torn_paper, folded_book, sheet_music, deep_sea, circuit,
mercury, neon, dragon_skin, mixed_metals.
- **Earth & Ore (13) — Materials lane (Setting shown):** Bronze · Iron · Ebony · Walnut · Stone ·
  Alabaster · Marble · Wood · Terracotta · Wax · Resin · Reclaimed Bronze · Plushy
- **Artists (8) — Experimental lane (own-scene, Setting hidden):** Impressionist · Ukiyo-e ·
  Art Nouveau · Cubism · Charcoal & Chalk · Pencil Sketch · Daguerreotype · Film Noir
- **Curiosities (8) — MIXED lane:** Blown Glass · Amber · Nebula Resin · Enchanted Crystal
  (`fantasy_crystal`) — *Materials, Setting shown* · Magic Energy · Armor · Elizabethan · Victorian
  — *Experimental, Setting hidden*
- Thumbs from `previews/groups/<id>/1.jpg`. New ids need renders (CENG §5 — content task).

## 1.5 LANE BEHAVIOR (engine-bound — CENG contract)
- **Setting hide is per-EFFECT, not per-tab.** Experimental ids (`ukiyo_e, art_nouveau, cubism,
  daguerreotype, film_noir, impressionist, charcoal_chalk, pencil_sketch, armor, elizabethan,
  victorian, magic_energy`) are own-scene → **hide the Setting picker + plaque**, recipe swaps to
  "Your group, rendered as {effect}." Materials → Setting shown, recipe "Your group in {material},
  {setting}."
- **Route field `experimental_effect`:** when the selected effect is experimental, send
  `experimental_effect: <id>` and the generator ignores `preset_id`/`location_id` (send a
  placeholder preset_id or make it optional). `scale` still applies; `plaque_text` only if non-empty.
- **plushy** still force-locks Plushy Shelf. **Costume** (armor/elizabethan/victorian) keep REAL
  faces — period/armor group portraits, not material transforms.

## 2. CONTROLS
- **The setting:** Pedestal · Mantel · Tea House. **Plushy material forces Plushy Shelf** (locked).
- **Scale:** Filled · With Margin. **Aspect ratio (8, wider canvas):** 3:2 (default) · 16:9 · 4:3 · 5:4 · 1:1 · 4:5 · 3:4 · 9:16.
- **No pose row** (group crafted as photographed).

## 3. REMOVED (do not port / strip from live)
- **No Tribal** (tribal_wall_masks, tribal_statue) and **no style axis** (Realistic / People Resolving).
- **No group-size / count / arrangement control** — number is auto-detected; everyone crafted together
  (one unit, flat $4.99, no per-person).

## 4. OPEN (Rich to confirm — do not silently decide)
- Earth & Ore is a 12-material merge (Portraits + Groups-native) — prune list if desired.
- "People Resolving" was dropped with Tribal — reinstate as an effect/tab only if Rich says so.
- Curiosities carried over whole from Portraits — cut any that read single-subject if Rich flags them.

## 5. RECONCILE LIVE `groups.html`
Strip Tribal + style axis + count control; price → $4.99; "Download" → Web/Print/Collector;
fonts → Manrope+Cormorant (strip Inter/JetBrains); tokens → brand hex; plaque stripped.

## 6. DEFINITION OF DONE (Master List gate)
Checklist passes · zero INTERPRETATION/REGRESSION · `node --check` + build · screenshot · git diff
reviewed · independent review clean.
