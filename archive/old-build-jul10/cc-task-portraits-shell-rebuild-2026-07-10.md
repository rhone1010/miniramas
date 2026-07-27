# CC TASK — PORTRAITS SHELL REBUILD (LIVE SITE) · 2026-07-10
**Architecture-level task. The live file has the WRONG skeleton. This rebuilds the shell, then
the regions drop into it. This is not a restyle — it's a container replacement.**

We are now building **live-site materials**, so this task ALSO breaks the monolithic inline
CSS/JS out into asset directories. Read with the verification checklist
`VERIFY-portraits-shell-checklist-2026-07-10.md` — every claim here is checkable against the proto.

---

## THE ROOT PROBLEM (why panel-level fixes kept failing)

The proto is a **four-column full-height workspace shell**:

```
<header class="masthead"> logo · centered nav · Sign in
<div class="stage">  (display:flex, height:calc(100vh - 90px))
   ├ <aside class="adv">      Advanced panel   (full-height column)
   ├ <section class="curator"> Curator card    (column)
   ├ <main class="main">       mural / stage   (flex:1 column)
   └ <aside class="colrail">   My Collection    (column)
```

The live `public/portraits.html` is a **tabbed-stage shell**: a topbar + a collapsed "Advanced"
rail + ONE `.stage` that swaps views (`stage-empty` / `suggester` / `preview-container`), with
To Be Crafted / Rendered / My Collection nested *inside* the stage. Different bones. No panel
paste will ever make it read like the proto while the container is a view-swapper. **Rebuild the
container first.**

---

## SOURCE + DESTINATION

- **SOURCE (structure of record):** `Prototype Files/portraits-proto.html`
- **DESTINATION:** `public/portraits.html` + new asset files (below).
- **COPY, do not reproduce.** The proto's markup/CSS carry HTML entities and the deckle filter's
  float/unicode values — retyping corrupts them. Copy blocks out of the source file.

---

## STEP 1 — REPLACE THE SHELL

Rebuild the destination's top-level layout to be exactly the proto's shell:

- One `<header class="masthead">` (logo left · `.navcluster` centered · `.signin` right).
- One `<div class="stage">` as a **flexbox**, `height:calc(100vh - 90px)`, `overflow:hidden`,
  with **four direct children, in this order**: `<aside class="adv">`, `<section class="curator">`,
  `<main class="main">`, `<aside class="colrail">`.
- `body{min-width:1440px; overflow:hidden}`.
- **DELETE** the tabbed-stage architecture: the view-tab bar, the `stage-empty/suggester/
  preview-container` swap wrapper, and any nesting of To Be Crafted / Rendered / My Collection
  *inside* the stage. Those become their own columns/regions, not swapped views.

Column widths (copy from proto CSS): `.adv` `clamp(280px,13.3vw,360px)` · `.curator`
`clamp(380px,17vw,440px)` · `.main` `flex:1` · `.colrail` `clamp(240px,10.5vw,300px)`; all
`flex-shrink:0` except `.main`.

## STEP 2 — REGIONS INTO COLUMNS

Each region is a column, not a tab:
- `.adv` = the Advanced panel (paste per the panel paste-task; disc grid / setting / framing /
  recipe / dot-ledger).
- `.curator` = the Curator card WITH the deckle (feTurbulence filter + boot script).
- `.main` = the workspace: mural in the empty state; the **suggested grid** and **preview**
  render *here as content swaps inside `.main`*, NOT as separate top-level stages. Wire to the
  live engine states.
- `.colrail` = My Collection rail.
- **To Be Crafted** = a fifth column. EXACT DOM: in the empty state it is **absent** and `.stage`
  has four children. In the carrying state (spawns on first effect selection) insert
  `<aside class="tbc">` as a **direct child of `.stage`, immediately before `.colrail`** — never
  nested in `.main`, never inside `.colrail`, never a permanently-hidden fifth column. Order when
  carrying: adv → curator → main → tbc → colrail.

## STEP 3 — BREAK OUT CSS + JS TO ASSET DIRECTORIES (live-site build)

Stop shipping one monolithic inline file. Extract:

- **CSS →** `public/assets/portraits/portraits.css` (or the repo's existing asset convention if
  one exists — check `public/assets/` / `app/` first and match it). Include: `:root` tokens, the
  shell/column rules, all `.adv*` panel rules, `.curator` + deckle rules, `.mural`, `.colrail`.
  Link it from `portraits.html` `<head>`.
- **JS →** `public/assets/portraits/portraits.js` — the panel presentational logic (`MATS`,
  `renderSwatches`, tab/glyph/frame/ledger wiring, `advRecipe`) and the deckle boot IIFE. Load it
  from `portraits.html` (defer). Keep the engine/API wiring where it currently lives; this
  extraction is the presentational layer.
- Shared shell CSS/JS that every series will reuse (masthead, `.stage` columns, deckle) →
  `public/assets/shared/`. **Scope of THIS task:** place the reusable shell code under
  `assets/shared/` and have `portraits.html` load it. **Migrating Houses/Pets/Groups/Landscapes
  to load those shared files is a SEPARATE follow-up task — do not touch those series here.**
- If an asset directory/convention already exists in the repo, MATCH it; do not invent a second one.
- **Font tokens (production values):** `--sans:'Manrope',sans-serif;` and
  `--serif:'Cormorant Garamond',Georgia,serif;`. No `-apple-system`/`Segoe UI` system stack, no
  Inter/JetBrains. (The `portraits-proto.html` is already set to these.)
- **Price:** the proto is already `base:4.99`. Keep 4.99; there is no $3.99 to carry over.

## STEP 4 — VERIFY + COMMIT

Run the checklist in `VERIFY-portraits-shell-checklist-2026-07-10.md`. Screenshot the result.
Commit with the asset files.

---

## INVARIANTS (do not regress)

- Fonts **Manrope + Cormorant Garamond only** (source 07-10 is correct; no Inter/JetBrains/system).
- **$4.99** base; tiers Web Quality / Print Quality / Collector Print.
- Brand tokens (`--ink #2a241e`, `--brass #75623a`, `--v7-*`) — destination's corrected values win.
- Deckle on the **Curator card ONLY**.
- Engine wiring (upload/analyze/generate/queue/Stripe) preserved; state-gating intact.

## FIDELITY — LITERAL COPY, NOT RECREATION

**Acceptance rule (hard fail):** If the rebuilt DOM differs from `portraits-proto.html` because the
markup was **recreated, simplified, refactored, or "optimized"** instead of copied, the task
**FAILS — even if the page looks visually identical.** Visual similarity is not compliance. The
graded artifact is the DOM/CSS itself matching the proto byte-for-byte (modulo the four wired
hooks and the documented price/font values).

**Forbidden transforms — do NONE of these when moving blocks from proto → live:**
- Do NOT rename classes (`.adv` stays `.adv`, never `.panel` / `.advanced-panel` / `.section`).
- Do NOT replace, prefix, or regenerate IDs (`#advSwatches` stays `#advSwatches`).
- Do NOT rewrite or "modernize" CSS selectors.
- Do NOT substitute equivalent CSS values (`clamp(280px,13.3vw,360px)` does not become `320px`;
  `calc(100vh - 90px)` is not "simplified"; hex values are not swapped for named colors).
- Do NOT collapse inline rules into utility classes, or convert utility patterns into new classes.
- Do NOT normalize, reflow, or reformat whitespace inside copied blocks.
- Do NOT convert, minify, re-express, or "clean up" the inline SVG (deckle filter, glyph paths).
- Do NOT reorder DOM children or CSS declarations. Preserve order exactly.

If a block seems improvable, that is not license to change it — copy it as-is. The only edits
permitted are: the four wired hooks (§ "wire 4 hooks"), the documented `base:4.99` /
`--sans:'Manrope',sans-serif` values, and the CSS/JS extraction to asset files (moving code
unchanged into external files — not rewriting it).

## RULE OF THE JOB

If you're building the shell "from understanding," stop — copy the proto's `<div class="stage">`
and its four children verbatim, then wire. The failure mode is reproducing the layout instead of
copying it. Container first, regions second, assets extracted, checklist last.
