# VERIFY — PORTRAITS SHELL CHECKLIST · 2026-07-10
**For an independent reviewer (second entity / ChatGPT).**

Purpose: check that the shell-rebuild instructions — and CC's resulting `public/portraits.html` —
match the proto **`portraits-proto.html`**. Every item is an
objective YES/NO you can confirm by reading the proto file (and the rebuilt live file). No
interpretation. Values below are extracted verbatim from the proto; verify them against the proto
first, then hold the rebuilt live file to the same list.

**How to use:** open the proto file. For each assertion, mark ✅ (true in proto) or ❌. Then open
the rebuilt `public/portraits.html` and mark whether it matches. Any ❌ in the "live matches"
column is a failed rebuild.

**SPEC RESOLUTIONS (independent review, 2026-07-10 — four contradictions closed):**
1. **Price.** The proto is now corrected to `base:4.99`. "Copy verbatim" and "$4.99" no longer
   conflict — the proto's own value is 4.99.
2. **Child count.** The four-children rule applies to the **EMPTY/base shell**. In the carrying
   state a **fifth** column (To Be Crafted) is inserted as a direct sibling immediately **before**
   `.colrail`. See items 4 + 6 for the exact DOM in each state.
3. **Fonts.** The proto's `--sans` is now `'Manrope',sans-serif` (system stack removed). "Only"
   means: Manrope + Cormorant Garamond are the only intentionally-LOADED typefaces; a generic
   keyword fallback (`sans-serif`/`serif`) is allowed; NO named fonts (Inter, JetBrains) or named
   system stack (`-apple-system`, `Segoe UI`).
4. **Shared assets.** Acceptance for THIS task = reusable shell CSS/JS is placed under
   `assets/shared/`. Migrating Houses/Pets/Groups/Landscapes to LOAD those shared files is a
   SEPARATE follow-up task and is NOT graded here (item 26).

---

## A. TOP-LEVEL SHELL STRUCTURE

1. `<body>` CSS includes `min-width:1440px` and `overflow:hidden`.
2. Directly inside `<body>` there is ONE `<header class="masthead">` followed by ONE
   `<div class="stage">`. (No view-tab bar, no stage-swapping wrapper.)
3. `.stage` CSS is a flex container: `display:flex; align-items:stretch; height:calc(100vh - 90px); overflow:hidden`.
4. **Empty/base state:** `.stage` has **exactly four direct children, in this order**:
   `<aside class="adv">` → `<section class="curator">` → `<main class="main">` → `<aside class="colrail">`.
   **Carrying state:** a **fifth** direct child `<aside class="tbc">` (To Be Crafted) is inserted
   as a direct sibling of `.stage`, positioned **immediately before `.colrail`** (order becomes
   adv → curator → main → tbc → colrail). It is NOT nested inside `.main` and NOT inside `.colrail`,
   and it is ABSENT (not merely hidden) in the empty state.
5. There is **no** element that swaps between `stage-empty` / `suggester` / `preview-container`
   as sibling top-level views. (The tabbed-stage pattern must be ABSENT.) The suggested-grid and
   preview render as content INSIDE `.main`, not as sibling top-level stages.
6. Rendered / My Collection are **not nested inside `<main class="main">`**. My Collection is the
   `.colrail` column. (To Be Crafted DOM is defined in item 4.)

## B. COLUMN GEOMETRY (from proto CSS)

7. `.adv` width = `clamp(280px,13.3vw,360px)`; `flex-shrink:0`; is a full-height flex column.
8. `.curator` width = `clamp(380px,17vw,440px)`; `flex-shrink:0`; `align-self:flex-start`.
9. `.main` = `flex:1`; contains `.mural` (a `grid-template-columns:repeat(4,1fr)` 4×4 grid).
10. `.colrail` width = `clamp(240px,10.5vw,300px)`; `flex-shrink:0`.

## C. MASTHEAD

11. `.masthead` height 90px; logo image on the left; `.navcluster` centered; `.signin` on the right.
12. Nav items: Workshop · Gallery · Sets · Print Shop · My Collection · Help (Workshop active).

## D. ADVANCED PANEL CONTENTS (inside `.adv`)

13. Effect tabs read **Earth & Ore / Artists / Curiosities** (NOT "Realistic / Artists Gallery").
14. A disc-grid (`#advSwatches`, class `.swatches`, `grid-template-columns:repeat(3,1fr)`) is present.
15. Section **The setting** with glyphs **Mantel / Pedestal / Gradient**.
16. Section **The framing** with **Bust (1:1) / Signature (1:1) / Statuesque (3:4)**.
17. An italic recipe line `#advRecipe` sits below framing.
18. Quality is a custom dot-ledger (`.lrow` + `.dot`): Web Quality (included) / Print Quality
    (+$2.00) / Collector Print (+$4.99). NOT native OS radio buttons.
19. Active selections render FILLED oxblood (`.on` → oxblood background), not greyed.

## E. DECKLE (brand edge)

20. An SVG `<filter id="curatorDeckle">` exists with exactly:
    `feTurbulence baseFrequency="0.014 0.016" numOctaves="4" seed="7"` and
    `feDisplacementMap … scale="5.5"`.
21. The deckle is applied to the **Curator card only** — no other element carries it.

## F. INVARIANTS

22. The only intentionally-LOADED typefaces are **Manrope** (sans) + **Cormorant Garamond**
    (serif). A generic keyword fallback (`sans-serif` / `serif`) is allowed. FAIL if any named
    font (Inter, JetBrains Mono) or named system stack (`-apple-system`, `BlinkMacSystemFont`,
    `Segoe UI`) appears in a `--sans`/`--serif`/`font-family`. Proto value of record:
    `--sans:'Manrope',sans-serif;` / `--serif:'Cormorant Garamond',Georgia,serif;`.
23. Prices show **$4.99** (base) — no $3.99 / $3.89 / $3.39 / $2.99 anywhere.
24. Tokens: `--ink:#2a241e`, `--brass:#75623a`.

## G. LIVE-SITE BUILD (rebuilt file only — not applicable to the proto)

25. `portraits.html` links an external CSS asset (e.g. `assets/portraits/portraits.css`) and an
    external JS asset — CSS/JS are NOT one giant inline block.
26. Reusable shell CSS/JS (masthead, `.stage` columns, deckle) is PLACED under `assets/shared/`
    (a file that exists on disk). **Not graded here:** whether Houses/Pets/Groups/Landscapes load
    it — migrating the other series is a separate follow-up task. Grade only that the shared file
    exists and that `portraits.html` loads it.

---

## H. FIDELITY — LITERAL COPY (not recreation)

27. The rebuilt markup is a **copy** of the proto's blocks, not a recreation. FAIL if any of these
    occurred, even if the page looks identical:
    - a class was renamed (`.adv` → `.panel`/`.section`/etc.),
    - an ID was replaced/prefixed/regenerated (`#advSwatches` changed),
    - a CSS value was substituted for an "equivalent" (`clamp(280px,13.3vw,360px)` → `320px`;
      `calc(100vh - 90px)` simplified; hex → named color),
    - inline rules were collapsed into utility classes (or vice-versa),
    - whitespace inside copied blocks was normalized/reflowed,
    - inline SVG (deckle filter, glyph paths) was converted/minified/re-expressed,
    - DOM child order or CSS declaration order changed.
28. The ONLY permitted differences between proto blocks and live blocks are: the four wired hooks,
    the documented values (`base:4.99`, `--sans:'Manrope',sans-serif`), and relocation of CSS/JS
    into external asset files **with the code unchanged**.

## SCORING
- **A + B all YES on the rebuilt live file** = the shell architecture is correct (the thing that
  kept failing). This is the pass/fail gate.
- D–F are the panel + brand fidelity.
- G is the live-site asset structure.
- **H is literal-copy fidelity** — any ❌ here is an **Interpretation** failure (recreated instead
  of copied) and counts as FAIL regardless of visual result.
- Any ❌ in section A on the live file = the rebuild did NOT happen; it's still the old skeleton.

Verdict per item, senior-review style: **PASS** (matches exactly) · **FAIL** (doesn't match) ·
**REGRESSION** (broke existing behavior) · **INTERPRETATION** (invented/recreated instead of
copied). Do not credit visual similarity as compliance; do not infer missing functionality "must
be elsewhere."

**Independent reviewer:** please also confirm the instructions in
`cc-task-portraits-shell-rebuild-2026-07-10.md` would, if followed literally, produce a file that
passes A–B. If any instruction contradicts the proto values above, flag it.
