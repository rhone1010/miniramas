# CC DIRECTIVE — LANDSCAPES · 2026-07-10
**Locked elements: obey `MASTER-LOCKED-ELEMENTS` (current version).** Proto: **`landscapes-proto.html`**.

## 0. METHOD
- Landscapes = universal four-column shell (Master List §7) + Landscapes content swap.
  Environment-IS-the-piece: no subject, outpaint stays (locked dependency).
- FIDELITY LAW (§10): copy proto blocks verbatim; no rename/reorder/value-substitution/regeneration.
  Recreation = INTERPRETATION failure. Copy from `landscapes-proto.html`.

## 0.5 CONTENT SWAP — LITERAL (Master List §13)
- **Delete** the Portraits control blocks (framing/pose); **copy** the Landscapes blocks from
  `landscapes-proto.html`. Do NOT mutate a Portraits block into a Landscapes block.
- **Preview paths:** no `previews/portraits/…` (or other series) path may remain — grep to zero;
  Landscapes uses `previews/landscapes/<id>/…` only.
- **Upload copy (locked, verbatim):** "Add a photo of a place" / "A landscape, a view, a spot that
  matters to you."
- **Recipe text (locked):** "A {finish} landscape, [atmosphere,] {environment}." Copy the recipe
  logic from the proto verbatim.

## 1. EFFECT TABS (from proto) — 2
- **Surfaces (5):** Wet & Luminous · Soft & Diffused · Hard & Raking · Layered & Atmospheric · Lush & Saturated
- **Materials (7):** Bronze · Museum Quality · Alabaster · Glass · Carved Stone · Carved Wood · Watercolor Wood
- Thumbs from `previews/landscapes/<id>/1.jpg` (Master List §9).

## 2. CONTROLS
- **The light (Atmosphere):** As Is · Golden Hour · Dusk · Storm* · Night*  (*premium tier).
- **The setting (Environment):** In Environment (`in_situ`) · Desk (`controlled`). "In Environment"
  is the locked label — never "In-Situ" (Master List §6).
- **Aspect ratio (8, wider canvas):** 3:2 (default) · 16:9 · 4:3 · 5:4 · 1:1 · 4:5 · 3:4 · 9:16.
- **Camera / Scale / Beam** live behind **More options** (not primary).

## 3. S1
- **No subject-pick** (scene, no face) — the stage must not mount. Wire to `landscapes-analyze` (scene
  metadata), not `faces`.

## 4. PIPELINE
- **Outpaint stays** (Stability AI, breathing room) — pre-resize to ≤1MP before send. Not substitutable.
- `scale` valid values `close_up | fill` only (Master List §11).

## 5. OPEN (Rich — pending)
- Direction under discussion: make Landscapes material/artsy-based (mirror Houses' Materials/Curiosities/
  Artists) and demote the 5 natural surfaces. Current proto ships Surfaces+Materials. **Confirm before
  CC builds** if the artsy pivot is adopted — it changes the tabs.

## 6. RECONCILE LIVE `landscapes.html`
Price → $4.99; fonts → Manrope+Cormorant; tokens → brand hex; tiers → Web/Print/Collector;
plaque stripped; confirm "In Environment" (never In-Situ).

## 7. DEFINITION OF DONE (Master List gate)
Checklist passes · zero INTERPRETATION/REGRESSION · `node --check` + build · screenshot · git diff
reviewed · independent review clean.
