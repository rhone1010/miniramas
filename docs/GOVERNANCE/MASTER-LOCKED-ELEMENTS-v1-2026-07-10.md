# MASTER LIST — LOCKED ELEMENTS · v1 · 2026-07-10
**The canonical registry of locked rules for Liten & Co. Perpetually updated.**

**GOVERNANCE:**
- This list is included **by reference at the top of every carryover and every CC/CENG directive.**
  ("Locked elements: obey MASTER-LOCKED-ELEMENTS current version.")
- When a rule locks, **add it here — edit in place, never regenerate the file** (regeneration risks
  clobbering). Bump the date. Note the change in the changelog at the bottom.
- On any conflict between a directive, a proto, or the repo and this list, **this list wins** for
  the elements it names. A proto still wins on layout/visual specifics it uniquely defines.
- `_PRODUCTION-BIBLE.md` §5 points to this file; this is the authoritative copy.

---

## 1. TYPOGRAPHY
- **Two typefaces ONLY: Manrope (sans/ledger) + Cormorant Garamond (serif/voice).** No Inter, no
  JetBrains Mono, no Karla, no named system stack (`-apple-system`/`Segoe UI`). Generic keyword
  fallback (`sans-serif`/`serif`) is allowed. No mono role unless explicitly added by Rich.
- Production tokens: `--sans:'Manrope',sans-serif;` · `--serif:'Cormorant Garamond',Georgia,serif;`.
- Garamond renders ~⅓ smaller than sans at the same px — **size serif UP.** Floors: serif body 22px
  (never <20); serif UI pills/controls 18px+; mono/sans labels ≥12px; no body text <16px.
  Undersized type is a recurring critical rejection — when in doubt, size up.

## 2. PRICE
- **Base $4.99 flat.** No $3.99 / $3.89 / $3.39 / $2.99 anywhere. Plain display — NO
  "founding/rising/studio-rate" copy, no phantom discount.
- Multi-person Portraits (GATED, not live): +$1.50 per additional person on crafted count →
  4.99 / 6.49 / 7.99. Groups = flat $4.99 (group is one unit, no per-person).
- Interpretive / Artists-Gallery / gpt-image-1 styles = premium tier (adder TBD by Rich).

## 3. RESOLUTION TIERS
- **Web Quality (included) / Print Quality (+$2.00) / Collector Print (+$4.99).**
- Retired terminology — do NOT use: "Download", "High Quality", "Print Ready".

## 4. PLAQUE / NAMING
- **Plaque / inscription CUT product-wide.** Clean unmarked base always. `plaque_text` null/clean;
  nothing renders text into the image.
- Piece **name = metadata only** → `collection_pieces.label` (+ id). One name per craft batch,
  never fed to the prompt, never rendered. Empty → "Untitled [series noun]".
- Moderation = hard server gate + client mirror. Substring for unambiguous terms; **word-boundary
  (`\bword\b`) for short/embeddable terms** (Essex/Sussex/Scunthorpe, Dick/Dickinson pass).
  **Child-safety category required.** Reject → neutral "Please choose a different name"; never name
  the term; never silently store.

## 5. DECKLE (brand edge)
- **Curator card ONLY — nowhere else.** `feTurbulence baseFrequency="0.014 0.016" numOctaves="4"
  seed="7"`, `feDisplacementMap scale="5.5"`. Applied via the deckle boot script.

## 6. COPY LAW
- **"Crafted Images" / "Crafted Portraits"** — capital C, capital I, always paired.
- **BANNED in customer copy:** "sculpture / sculpted / sculpt".
- **"In Environment"** everywhere user-facing — NEVER "In-Situ" / "In Situ". Internal code id
  `in_situ` may remain.
- Plain language — avoid literary terms (e.g. "register").

## 7. SHELL ARCHITECTURE (universal across all series)
- **Four-column full-height workspace:** `masthead` + `<div class="stage">` (flex,
  `height:calc(100vh - 90px)`, `overflow:hidden`) with children in order **`.adv` → `.curator` →
  `.main` → `.colrail`**. `body{min-width:1440px;overflow:hidden}`.
- **NOT** a tabbed/view-swapping stage. Suggested grid + preview render as content INSIDE `.main`,
  not as sibling top-level views.
- **To Be Crafted** = 5th column, present only when carrying, inserted as a direct child of
  `.stage` immediately **before `.colrail`** (absent, not hidden, when empty). Never nested in
  `.main` or `.colrail`.
- Column widths: `.adv clamp(280px,13.3vw,360px)` · `.curator clamp(380px,17vw,440px)` ·
  `.main flex:1` · `.colrail clamp(240px,10.5vw,300px)`; all `flex-shrink:0` except `.main`.
- This shell is the **template every series inherits** (Portraits is the reference; Houses/Pets/
  Groups/Landscapes fork it).
- **Advanced panel default state = CLOSED.** The `.adv` "Design your own" panel starts **collapsed
  to its rail on every fresh load** (not remembered-open, not open-then-collapse). It opens only on
  user action. Shell geometry must stay correct in both states: with Advanced closed the remaining
  columns reflow to fill; opening it never overlaps or breaks layout. Applies to every series.

## 8. BRAND TOKENS (brand hex — align every `:root` AND `--v7-*` set)
- vellum `#f3ede1` · paper `#faf6ec` · panel `#ece2d0` · ink `#2a241e` · oxblood `#7d4242` ·
  oxblood-deep `#6a3737` · brass `#75623a` · taupe `#aba39a` · sage `#8a9a7b` · hairline `#d8cfba`.
- Known drift to catch: `--v7-ink` must be `#2a241e` (not `#1F1B14`); `--brass` `#75623a`
  (not `#8B6F3E`).

## 9. COMPONENT LAWS
- **Action buttons** = italic serif pills 1.1rem+, clear padding, oxblood/sage outlined or filled.
  Never tiny micro-links or thin underlined text. When in doubt, size up.
- **Tabs / chips:** active = **FILLED** oxblood (obvious), never greyed/sage.
- **Two marks, never conflated:** the Liten & Co site logo (company identity) vs. the Curator "C"
  mark (product persona on the Curator card).
- **Effect thumbnails** pull from `previews/<series>/<effect>/1-4.jpg` (real renders) — NEVER
  `Icon_Effect__*` icons. Icons are ONLY the Advanced disc grid. Copy `previews/` →
  `public/previews/` to serve.
- **My Collection — aspect-ratio display:** show pieces at their **native aspect ratio** wherever
  the layout allows. Ratios extreme enough to break the collection grid/rail (tall 9:16/3:4,
  wide 16:9, etc.) are **cropped to the tile** to protect the layout — **EXCEPT in a larger /
  expanded view (Lightbox, large card), which always shows the FULL native ratio, uncropped.**
  Accommodate first; crop only when accommodation breaks layout badly; never crop in the large view.
- **`.main` has TWO distinct states — never conflate them:**
  - **Empty-stage mural** (before upload): a **cycling crossfade** showcase of popular finishes
    (staggered holds, `.slide.show` opacity transitions, `prefers-reduced-motion` guarded). This is
    the **ONLY** place the crossfade/cycle lives.
  - **Suggested-effects grid** (after the Curator returns suggestions): **STATIC** curated result
    cards — each shows ONE render and does **NOT** cycle or crossfade. Cards "deal in" once on
    reveal, then hold.
  The crossfade/cycle belongs to the empty mural only; the suggested grid never cycles.
- **Empty → suggested transition:** on upload the source enters the Curator card but `.main`
  **HOLDS the empty mural unchanged** until the Curator returns suggestions — no abrupt swap on
  upload. When suggestions are ready, the mural **fades out** and the suggested cards **deal in**.

## 10. FIDELITY LAW (proto → live)
- **Copy proto blocks verbatim. Never recreate, simplify, refactor, or "optimize."** Visual
  similarity ≠ compliance — recreated markup FAILS even if the page looks identical.
- **Forbidden transforms:** rename classes · replace/prefix/regenerate IDs · rewrite selectors ·
  substitute "equivalent" CSS values · collapse inline rules into utility classes (or vice-versa) ·
  normalize/reflow whitespace · convert/minify inline SVG · reorder DOM children or CSS declarations.
- **Regeneration rule (closes the last hole):** If an existing proto block already satisfies the
  requirement, **replacing it with newly-generated markup is automatically an INTERPRETATION
  failure — regardless of visual similarity and even if every forbidden transform above was
  individually avoided.** Producing a fresh block with the same class names is still recreation,
  not copying. The required action is to MOVE the existing proto block; if the delivered block was
  authored rather than lifted, it fails.
- Permitted edits only: the documented wired hooks, the locked price/font values, and relocating
  code UNCHANGED into asset files.

## 11. SERIES / ENGINE INVARIANTS
- Portraits = 1–3 subjects (solo scope = 1; 4+ → Groups). Multi-person = built, dormant, GATED
  behind `subject_mode` (default solo) — do not wire/expose/remove.
- Environment-silo series (Landscapes) delete subject-pick entirely (orphan, skip — not stub).
- Groups: number-in-group is **auto/detected — not a user-set control.**
- `scale` valid values: **`close_up | fill` only** (no `auto_85`/`zoom_out`).
- **Aspect ratios by silo type:** environment/group silos (**Houses · Groups · Landscapes**) use the
  full **8-ratio set** — `3:2 (default) · 16:9 · 4:3 · 5:4 · 1:1 · 4:5 · 3:4 · 9:16` (breathe in a
  larger canvas; matches the CENG engine enum; routes validate this enum). Subject silos keep their
  tighter framing sets (Portraits framing ratios; Pets 3:4/1:1/4:3).
- **Route schema ↔ engine schema must stay in sync** — verify both ends on any request-shape change.
- Anatomy first, material second. Short prompts beat long. Verbatim engine blocks
  (`BUST_UNIVERSAL`, etc.) — Rich authors; do not edit.

## 12. DELIVERY + PROCESS DISCIPLINE
- Full files, not diffs. One "place this file here, run this command" block per change.
- Validate before delivery: `node --check` (JS), `tsc`/esbuild (TS).
- Live-site build: break CSS/JS out to asset directories; shared shell → `assets/shared/`.
- CC permission mode = **acceptEdits** (not bypassPermissions — that mode parks on a one-time dialog).
- Every dense session ends with a dated **recap + propagation checklist**. Keep
  `_PRODUCTION-BIBLE.md` current in-repo (edit in place, commit with the work).
- CC deliverables get **independent (second-entity) verification** against the proto before merge.
- Lanes: **CUI** (design/spec, protos) · **CC** (live code) · **CENG** (prompt engine). Prompt
  blocks are CENG's; CC gets locked specs.

---

## DEFINITION OF DONE (production merge gate)
A task is COMPLETE only when ALL are true. Any single ☐ unchecked = NOT done.

```
□ Verification checklist passes (all applicable items).
□ Zero INTERPRETATION failures (nothing recreated/regenerated instead of copied).
□ Zero REGRESSION failures (no existing behavior broken; no functionality deleted as "cleanup").
□ node --check passes (JS) and the TS build / typecheck passes.
□ Visual screenshot attached.
□ Git diff reviewed (deletions accounted for; no silent drops).
□ Independent (second-entity) review returns no FAIL / REGRESSION / INTERPRETATION.
```

"Looks right" is not a state. Only the gate above is.

---

## 13. SERIES INHERITANCE
Portraits is the canonical implementation of the shell. **Every series SHALL inherit, unchanged:**
masthead · `.stage` (four-column shell) · `.curator` · deckle · `.colrail` (collection rail) ·
mural framework.

**A series MAY override ONLY:** Advanced controls (effect tabs / settings) · upload copy · recipe
generation · effect catalog · preview assets (`previews/<series>/…`) · engine wiring.

**Override method (hard):** overrides are done by **DELETING the Portraits block and COPYING the
series block from that series' proto** — never by mutating/editing the Portraits block into the
series block. Mutating a Portraits block into a series block is an INTERPRETATION failure (§10).
Silo-specific copy (upload label/sub, recipe format, mural labels) is **locked copy** — copy it
verbatim from the series proto; do not paraphrase.
No other series may retain another series' preview paths, upload copy, effect ids, or recipe text
(e.g. no `previews/portraits/…` path may remain anywhere in Houses — greppable).

---

## CHANGELOG
- **v1 · 2026-07-10** — Initial consolidation. Locked: typography (Manrope+Cormorant), $4.99 flat,
  Web/Print/Collector tiers, plaque cut + naming, deckle (Curator only), copy law, four-column
  shell + To Be Crafted 5th-column rule, brand tokens, component laws, fidelity law + forbidden
  transforms + regeneration rule, series/engine invariants, delivery/process discipline, the
  Definition of Done merge gate, and **§13 Series Inheritance** (delete-and-copy override method;
  no cross-series preview/copy/id bleed).
