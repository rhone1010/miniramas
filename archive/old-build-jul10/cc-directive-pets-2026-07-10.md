# CC DIRECTIVE — PETS · 2026-07-10
**Locked elements: obey `MASTER-LOCKED-ELEMENTS` (current version).** Proto: **`pets-proto.html`**.

## 0. METHOD
- Pets = universal four-column shell (Master List §7) + Pets content swap.
- FIDELITY LAW (§10): copy proto blocks verbatim; no rename/reorder/value-substitution/regeneration.
  Recreation = INTERPRETATION failure. Copy from `pets-proto.html`.

## 0.5 CONTENT SWAP — LITERAL (Master List §13)
- **Delete** the Portraits control blocks (framing/pose, setting); **copy** the Pets blocks from
  `pets-proto.html`. Do NOT mutate a Portraits block into a Pets block.
- **Preview paths:** no `previews/portraits/…` (or other series) path may remain — grep to zero;
  Pets uses `previews/pets/<id>/…` only.
- **Upload copy (locked, verbatim):** "Add a photo of your pet" / "A clear, well-lit photo of the
  whole animal works best."
- **Recipe text (locked):** 2D curiosity → "Your pet as a {label} piece." · 3D curiosity →
  "Your pet as {label}, {setting}." · materials → "Your pet in {material}, [pose,] {setting}."
  Copy the recipe logic from the proto verbatim.

## 1. EFFECT TABS (from proto) — 2
- **Materials (7):** Ceramic · Plushy · Walnut · Stone · Bronze · Metals · Alabaster
  (Felted Wool retired — do not reintroduce).
- **Curiosities (13, grouped by 4 render modes):**
  - Sculpture: Amber Inclusion · Garden Statue · Blown Art Glass · Enchanted Crystal · Topiary
  - The Real Animal: Regal · Elizabethan Ruff · Sailor
  - As Artwork: Ukiyo-e · Art Nouveau · Cubism
  - As Photograph: Daguerreotype · Film Noir
- Thumbs from `previews/pets/<id>/1.jpg` (Master List §9).

## 2. CONTROLS
- **The setting:** Gallery · Natural · Atmospheric · Home.
- **The pose (7 Actions):** As Photographed · Sleeping · Jumping · Running · Playing · Sitting Proud · Funny.
- **Scale:** Filled · With Margin. **Aspect ratio:** 3:4 (default) · 1:1 · 4:3.

## 3. BEHAVIOR LOCKS (wired in proto)
- **2D curiosities (As Artwork / As Photograph) hide Setting + Pose** — a flat piece has no scene/pose.
  3D modes (Sculpture / The Real Animal) keep them.

## 4. S1
- Subject = one animal; coat/breed **detected, not picked**. No human-face markers.

## 5. FLAGS (fix during build)
- **`regal` / `elizabethan_ruff` / `sailor` carry `mode:'2d_art'` in `pets-experimental.ts` but belong
  to `real_animal`** (real animal + regalia, not a flat painting). Correct the mode field to real_animal.
- **Plaque still present in `pets-shared.ts` core** — apply the product-wide plaque cut (Master List §4).
- Curiosities have no card copy yet — one-liners are a CUI follow-up (post-upload Suggested grid).

## 6. RECONCILE LIVE `pets.html`
Price → $4.99; fonts → Manrope+Cormorant; tokens → brand hex; tiers → Web/Print/Collector;
plaque stripped; "Download" terminology removed.

## 7. DEFINITION OF DONE (Master List gate)
Checklist passes · zero INTERPRETATION/REGRESSION · `node --check` + build · screenshot · git diff
reviewed · independent review clean.
