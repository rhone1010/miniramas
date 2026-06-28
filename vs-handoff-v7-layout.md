# VS Handoff — Full v7 Workshop Layout

**Date:** 2026-06-25
**Canonical design:** `portraits-clean-build-v7.html` (standalone prototype — the design source of truth)
**Target:** `D:\minramas\portraits.html`
**Scope:** Bring the **entire v7 workshop layout** into portraits.html. Local/sandbox only — Stripe and Prodigi are sandbox, so there is **no production checkout to protect**. This is a UI rebuild that keeps the sandbox endpoint calls wired.

---

## TL;DR

Rebuild the Portraits workshop to the v7 five-spine layout. The always-visible form sidebar (materials / framing / quality) **moves into the Advanced spine's expanded state**. Default view = the Curator's suggested grid. Keep every button calling the same sandbox Stripe/Prodigi endpoints — just reparent them.

---

## 1. Do NOT undo what's already integrated

The source-control handoff already landed in portraits.html. Preserve it; the v7 layout wraps around it:

- **Face-aware source control** — 3:4 container, drag/zoom, subject pick, `focal` → generator contract. Keep as-is.
- **Curator masthead** — C mark (drop shadow) + "Curator" title above the voiced body.
- **Deckled champagne Curator panel** — flat `#ECDFC1`, programmatic rag edge + faint brass border.
- **Intake alert** — the "this photo may not craft well" note already fires. Leave it; it's the first of the deferred Curator states taking shape (§8).

These live inside the **Curator spine** of the v7 layout. Don't rebuild them — slot them in.

---

## 2. The v7 layout target (five spines)

Left → right, at 1920px:

| Spine | Width | Contents |
|---|---|---|
| **Advanced** | 48px collapsed | icon + "Advanced" label + chevron + Curator tooltip; **expands to hold the relocated controls** (§3) |
| **Curator** | 360px | deckled champagne card: source control + masthead + voiced text w/ tinted spans (all already integrated) |
| **Suggested** | flex (~920px) | 3×2 primary grid + exploration row (§4) |
| **Queue** | 240px | horizontal "Ready to Craft" pills (§5) |
| **Collection** | 180px | recolored series rail, active oxblood tile (§6) |

Responsive tightening (already in the prototype CSS — lift it): at **1440** Curator 320 / Queue 220 / Collection 160; at **1280** Suggested goes 2-col and the exploration row goes 4 cards + 2fr bundle. Lift these breakpoints from `portraits-clean-build-v7.html` rather than re-deriving.

---

## 3. The structural change — controls move into the Advanced spine

This is the main IA shift. Today portraits.html shows an always-visible form sidebar: Realistic/Artists toggle, material chips (Ebony, Walnut, Stone, Bronze, Iron, Alabaster), Location, Framing, Finish, Quality tiers, "Add this piece $X". In v7 those are **advanced controls** — they belong behind the spine, not in the default view.

- **Default view:** the Curator's suggested grid (§4). No form sidebar.
- **Advanced spine collapsed (48px):** use the locked design in `advanced-spine-v2.html` — sliders icon, vertical "Advanced" label, chevron, oxblood accent edge, slow icon pulse, Curator-voiced tooltip (more control / more to decide / suggestions are safe if unsure).
- **Advanced spine expanded:** reveals the relocated controls (materials/framing/finish/quality/add-this-piece). Reparent the existing control markup into the expanded panel — **keep every existing event handler and sandbox endpoint call intact**. This is a move, not a rewrite.
- **"Design Your Own"** (the button under the suggested cards) → triggers the spine expansion. That's the entry point to manual control.

So: suggested-first by default; advanced controls one click away in the spine.

---

## 4. Suggested spine — grid + exploration

**Primary 3×2 grid**, cards sized from natural 1:1 image. Per-card overlay (lift from v7):
- full-bleed image, dark gradient on bottom 38%
- bottom-left: floating name (italic Garamond, warm-paper, text-shadow)
- bottom-right: **quality badge, color-coded** — `excellent = gold`, `good = sage`, `limited = brass`. **Fix:** the live build renders this badge navy; it must follow the v7 palette.
- top-right: state chip (+ Add / ✓ In Collection)
- top-left: Curator's pick badge (mini C mark + italic "Curator's pick") on 2 cards
- slot 6: Studio Bundle ("five for the price of four")

**Exploration row:** `repeat(5, 1fr) 2fr` — 5 small 1:1 cards + Curator's Bundle spanning 2 cells ("All Ten — the full set").

**Copy-count fix:** the Curator heading/body must read the **actual rendered count**. The live build said "Five styles… craft all five" while showing 3 cards. Make the count dynamic (and show failed/empty slots distinctly if a render fails) — never hardcode "five".

---

## 5. Queue spine — Ready to Craft pills

Horizontal pills (lift from v7): white capsule, sage dot (active selection) on the left, italic Garamond name, mono number, × delete. Hover snaps border to sage. **Fly-to-Collection animation on Craft** (0.55s, calculated `--fly-x`). The "Craft all" action stays wired to the **sandbox Stripe** checkout — same endpoint, new button.

---

## 6. Collection spine — recolored rail

Lift from v7: inactive tiles 1:1 (warm-paper bg, oxblood icon, oxblood italic name, sage mono count); active tile 3:4 (oxblood bg, warm-paper icon, warm-paper name, light-sage count, 3 real thumbnails, `is-arriving` pulse on new arrivals). 8 series icons as SVG symbols (portraits, houses, action, groups, landscapes, pets, forfun, artist) + c-mark badge.

---

## 7. Sandbox wiring (keep, don't protect)

No production commerce. Keep the existing sandbox calls on the reparented buttons:
- **Stripe sandbox** checkout on Craft / Craft-all.
- **Prodigi sandbox** on print/fulfillment paths.
- The checkout-400 / "Stripe cart contract pending with Engine" seen in the live build is an **Engine-lane** item, not UI — leave it to that lane; just keep the UI calling the same endpoint.

Because it's all sandbox, reparenting controls is low-risk: if an endpoint call moves with its handler, nothing customer-facing breaks.

---

## 8. Still deferred — Curator interactive states

Do **not** build these yet (they need real render/QA data): elicitation Q&A, pricing notice, per-person confidence. Spec: `source-control-spec-v1.md` §5. The intake alert already firing can stay as-is. The locked Curator resting state (masthead + voiced body + tinted spans) is what ships.

---

## 9. Integration steps

1. Rebuild the workshop shell to the five-spine flex layout (§2); lift the responsive breakpoints from `portraits-clean-build-v7.html`.
2. Drop the existing always-visible form sidebar; **reparent** its controls (materials/framing/finish/quality/add-this-piece) into the Advanced spine's expanded state (§3), keeping all handlers + sandbox calls. Wire "Design Your Own" → expand spine.
3. Install the collapsed Advanced spine from `advanced-spine-v2.html` (icon, label, chevron, tooltip).
4. Slot the already-integrated source control + Curator masthead into the Curator spine (do not rebuild — §1).
5. Build the Suggested spine: 3×2 grid + exploration row with overlay labels (§4). Apply the badge color fix (sage/gold/brass) and the dynamic copy-count fix.
6. Build the Queue spine (pills + fly-to-collection) and keep Craft wired to sandbox Stripe (§5).
7. Build the Collection rail recolor (§6).
8. Leave the deferred Curator states unbuilt (§8).
9. Verify: suggested grid renders by default; spine expands to the controls; Craft round-trips to sandbox Stripe; a multi-person source still routes to the picked subject (from the source-control contract).

---

## 10. Source of truth

`portraits-clean-build-v7.html` is the **design** truth — lift markup/CSS/animations from it. `D:\minramas\portraits.html` is the **code** truth — wire the design to the live sandbox endpoints there. Where the prototype and deployed code differ on data/wiring, the deployed code wins; where they differ on look, v7 wins.
