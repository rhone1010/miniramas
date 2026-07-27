# PUNCH LIST → CC · PORTRAITS OCCUPIED · 2026-07-11
Four fixes on the loaded workshop. Owner tagged per item. References the occupied-states spec
(`cc-spec-portraits-occupied-states-2026-07-11.md`) and the Master List.

---

## 1. REMOVE the email / free-preview card from the Curator column — [CC · design change]
The "Your first piece is on us / enter your email / Craft my free preview / No thanks" card is
**deprecated — remove it entirely.** We no longer gate on email-for-preview.
- The `.curator` column contains ONLY the one deckled Curator card: **`C` Curator header → voice →
  framing preview**. No email capture, no free-preview CTA, no "No thanks" link.
- This supersedes the email-capture step in the earlier funnel spec. Update the occupied-states
  spec's `.curator` contents accordingly (no lead-capture element).
- Master List: the email-preview funnel element is retired; do not reintroduce in any series.

## 2. "Craft this piece" did not complete a render — [Engine/CENG · blocker]
Root cause is almost certainly the same as the checkout failure in the logs:
`[api/v1/checkout] cart failed cart_identity_required → 400`, and the on-screen note
"Stripe cart contract pending with Engine." The paid craft routes through checkout, checkout
rejects for a missing cart identity, so the render never fires.
- This is the **cart-identity handshake** between the checkout route and the Engine — not a UI bug.
- Needed: what `cart_identity_required` expects (a session/cart id the checkout route isn't
  passing yet). Pin the contract with Engine, wire the id, then the craft completes.
- Until wired, the workshop is fully functional up to the *purchase* step; everything before
  (analyze, curate-effects, gate) returns 200.
- Separate minor: curate log shows `forced=walnut,folded_book` (final=5) but only 4 preview tiles
  render + the Bundle cell — confirm the 5th tile (`folded_book`) isn't being dropped from the grid.

## 3. ADD a crafting feedback device — [CC · UI]
The paid craft (Craft this piece → render) has **no progress feedback** — same gap the wallpaper
products had. Reuse that exact pattern (already built in `portrait-wallpaper.html`):
- While the render runs (~15–40s): a **light-sweep shimmer** over the crafting tile/preview, and
  the **Curator narrates** a rotating sequence ("Reading your photograph… Casting your portrait in
  {material}… Shaping the piece… Almost there…") every ~4.5s — not one static line.
- Clear the shimmer + narration on success/error and show the result.
- Copy the `startRender()`/`stopRender()` + `.rendering` sweep CSS from the wallpaper HTML verbatim;
  it's proven and on-brand. Scope the sweep to the crafting tile in `.tbc`/`.main`.

## 4. RESTORE preview crossfade / cycling — [CC · UI]
The suggested preview tiles are **static**; they should crossfade/cycle like the empty-state mural
does in `portraits-proto.html`.
- The empty-state mural already has the crossfade logic (staggered `HOLDS`/`OFFSETS`, `.slide.show`
  opacity transition) — reuse that same mechanism for the suggested-grid tiles so each tile gently
  cycles through its available renders rather than sitting frozen.
- Respect `prefers-reduced-motion` (the proto's crossfade already guards on it — keep that).

---

## OWNER SUMMARY
- **CC (UI):** #1 remove email card · #3 crafting feedback (copy wallpaper pattern) · #4 restore crossfade.
- **Engine/CENG (blocker):** #2 cart-identity contract for checkout → unblocks the paid render.
- Deckle recheck (from prior note): confirm `.tbc` / `.colrail` carry NO deckle — Curator card only.
