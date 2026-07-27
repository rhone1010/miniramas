# SPEC → CC · PORTRAITS OCCUPIED + SUGGESTED GRID · 2026-07-11
Combined pass on the loaded workshop: Curator cleanup, the empty→suggested transition, the
suggested grid (10 effects + bundles + redeal), crafting feedback, and the checkout blocker.
Owner tagged per item. Master List §9 now locks the mural-vs-suggested distinction + the
empty→suggested transition — build to it. References `cc-spec-portraits-occupied-states-2026-07-11.md`.

---

## A. Curator column — REMOVE the email / free-preview card — [CC · design change]
The "Your first piece is on us / enter your email / Craft my free preview / No thanks" card is
**deprecated — remove it entirely.** We no longer gate on email-for-preview.
- `.curator` contains ONLY the one deckled Curator card: **`C` Curator header → voice → framing
  preview**. No email capture, no free-preview CTA, no "No thanks" link.
- Supersedes the email-capture step in the earlier funnel spec; do not reintroduce in any series.

## B. Mural vs Suggested — un-conflate — [CC · Master List §9]
The empty-mural crossfade/cycle was applied to the **suggested-effects previews**. Wrong target:
- **Empty-stage mural** (before upload): KEEPS the cycling crossfade. Only place it lives.
- **Suggested-effects grid** (after suggestions): **STATIC** — remove the cycle/crossfade. Each
  card shows ONE render and holds. It "deals in" once (§C), then does not animate.

## C. Empty → Suggested transition — hold, then fade + deal — [CC · Master List §9]
Current upload transition is abrupt. Fix the sequence:
1. **Upload:** source photo enters the **Curator card**. `.main` **HOLDS the empty mural
   unchanged** — no swap yet (mural keeps cycling while the Curator works).
2. **Curator analyzes** (analyze → curate-effects). Still no change in `.main`.
3. **Suggestions ready:** `.main` **fades the mural out**, then the suggested cards **deal in**
   (staggered reveal — a gentle card-deal, not a hard pop). Reduced-motion → simple fade, no stagger.

## D. Ten effects + two bundle cells — 12-slot grid — [CC · UI + CENG dep]
Today: 5 effects + one "All 5" cell. Design is **10 suggested effects in two batches of five**,
each batch capped by its bundle cell:

| slot | content |
|---|---|
| 1–5 | suggested effects (batch 1) |
| **6** | **Add all 5** bundle ("five for the price of four") |
| 7–11 | suggested effects (batch 2 — effects 6–10) |
| **12** | **Add all 10** bundle (all ten) |

- Bundle cells at slots 6 and 12 (same footprint as an effect card, distinct treatment).
- Grid fills `.main` (`auto-fill, minmax(230px,1fr)`); 12 cells flow across the width.
- **Engine dep (CENG):** `curate-effects` returns 5 today (`final=5`); it must return **10** (two
  batches of five) — one call or two calls of five. Flag to CENG; UI builds the 12-slot layout regardless.

## E. Redeal — new batch of suggestions — [CC · UI]
Add the **redeal** control (missing). 
- Re-fetches `curate-effects` with a new **rotation** (route already supports it — logs show
  `rotation=17`). Returns a fresh 5 + 5.
- On redeal: current cards fade out, new batch **deals in** (same reveal as §C).
- Placement: quiet control near the "Chosen for you" header — italic serif pill, NOT a micro-link
  (Master List §9). **Copy TBD by CUI/Rich** ("Redeal" / "Show me another set").
- Disable during fetch to guard rapid re-clicks; no hard cap unless Rich wants one.

## F. Crafting feedback device — [CC · UI]
The paid craft (Craft this piece → render) has **no progress feedback** — same gap the wallpapers
had. Reuse that exact pattern (already built in `portrait-wallpaper.html`):
- During the render (~15–40s): a **light-sweep shimmer** over the crafting tile, and the **Curator
  narrates** a rotating sequence ("Reading your photograph… Casting your portrait in {material}…
  Shaping the piece… Almost there…") ~every 4.5s — not one static line.
- Clear shimmer + narration on success/error, show the result.
- Copy `startRender()`/`stopRender()` + the `.rendering` sweep CSS from the wallpaper HTML verbatim;
  scope the sweep to the crafting tile in `.tbc`/`.main`.

## G. BLOCKER — "Craft this piece" does not complete a render — [Engine/CENG]
Root cause = the checkout failure in the logs: `[checkout] cart failed cart_identity_required → 400`
("Stripe cart contract pending with Engine"). The paid craft routes through checkout, checkout
rejects for missing cart identity, so the render never fires.
- The **cart-identity handshake** between the checkout route and Engine — not a UI bug.
- Needed: what `cart_identity_required` expects (a session/cart id the route isn't passing yet).
  Pin the contract, wire the id, then the craft completes.
- Everything before purchase returns 200 (analyze, curate-effects, gate).
- Minor: curate log shows `forced=walnut,folded_book` (final=5) but only 4 tiles + Bundle render —
  confirm the 5th tile (`folded_book`) isn't dropped.

---

## OWNER SUMMARY
- **CC (UI):** A remove email card · B cycle back to empty mural · C hold-then-fade-deal ·
  D 12-slot grid (10 effects + Add-all-5 @6 + Add-all-10 @12) · E redeal · F crafting feedback.
- **Engine/CENG:** G cart-identity contract (unblocks the paid render) · D `curate-effects` returns 10.
- **Deckle recheck:** confirm `.tbc` / `.colrail` carry NO deckle — Curator card only (Master List §5).
