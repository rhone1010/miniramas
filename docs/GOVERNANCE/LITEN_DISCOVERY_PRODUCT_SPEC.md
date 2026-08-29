# LITEN & CO Discovery Experience — Product Specification
**Status:** Locked for implementation
**Audience:** CUI 45 (glass/UI), CENG (engine/business logic)
**Precedence:** This document is the shared source of truth. If a visual reference conflicts with this document, this document wins.

## 1. Product intent
LITEN & CO is not selling a single AI render. The core experience is **discovery**: a user uploads one image, explores many art/effect interpretations, assembles a Portfolio, purchases the selected preview set, watches the results arrive in My Collection, then chooses included unlocks and optionally purchases more.

The design must feel like a refined studio/gallery experience, not a cart, game, wizard, or marketplace.

## 2. Core journey
1. Enter a lane (Portraits / Pets / Groups / Halloween, etc.).
2. Upload one source image.
3. Enter the effect gallery.
4. Explore effects by silo using:
   - named silo navigation across the top;
   - a clickable vertical 56-effect minimap.
5. Select effects into the persistent Portfolio in the lower-left rail.
6. Portfolio updates in-place as effects are selected.
7. When ready, open/review the Portfolio.
8. Proceed to purchase the current selection tier.
9. Generate selected previews, watermarked.
10. Results progressively appear in My Collection.
11. User spends included unlocks on chosen results.
12. User may purchase additional unlocks.

## 3. Catalog model
- Up to **4 Series**.
- Each Series contains up to **8 Silos**.
- Each Silo contains up to **7 canonical Effects**.
- The discovery map contains **56 canonical effect positions**.
- Seven canonical effects may have a male/female presentation variant. Those variants do **not** add map positions; the relevant variant is resolved from the source image and/or product rules.
- The UI should not expose internal database language unless the current product already uses the words Series/Silo publicly.

## 4. Gallery layout
### Locked
- Desktop default gallery is **4 columns × 2 rows = 8 large effect cards**.
- No 16-card density mode.
- No pagination inside a silo.
- Silo switch replaces the visible 4×2 set without a page reload.
- Existing selections persist across silo/series changes.

### Navigation
- Named silo navigation runs across the top of the gallery.
- A **vertical minimap** is fixed at the right edge of the gallery region.
- Minimap has 56 clickable cells grouped as 8 groups of 7.
- Clicking a cell or its group navigates to the corresponding effect/silo.
- The minimap exists to make the catalog's scale and remaining territory obvious.
- Do not add legends, helper panels, tutorials, or duplicate navigation unless user testing proves required.

## 5. Left rail
All persistent action UI lives in the **left rail**.

The former Queue is removed.

Left rail contains only:
1. Curator
2. Portfolio
3. Minimal current-tier pricing/status
4. Primary Portfolio/review action when appropriate

Do not duplicate Curator or Portfolio elsewhere on the browsing screen.

## 6. Portfolio
The Portfolio is a **large-format artist presentation folio**, shown at reduced scale. It must never read as a wallet, purse, handbag, book, shopping basket, or change purse.

### Position
- Persistent in the **lower-left rail**.
- Same anchor/location throughout gallery browsing.
- May be partially off-page to reinforce large physical scale.
- No white bounding box around the folio.

### Visual scale cues
- Broad surface area
- Oversized corners and hinge/spine
- Substantial material thickness
- Large brass center badge/plate
- Deep contact shadow
- Heavy page stock when open
- Mounted miniatures sized as artwork, not tiny wallet photos

### Tier materials
Same folio object; material/treatment evolves at tier boundaries:
1. **Tier 1:** soft tan
2. **Tier 2:** forest green
3. **Tier 3:** oxblood
4. **Tier 4:** dark suede

Brass badge remains a consistent identity cue.

## 7. Portfolio interaction
### Adding an effect
- User clicks `+` on an effect card.
- The card acknowledges selection.
- A visual proxy of the artwork lifts from the card, scales down, travels in a shallow arc toward the Portfolio, and enters the open folio.
- Target duration: **450–650 ms**.
- No bounce, confetti, sparkle, coins, reward sound, or game-like effects.
- Respect `prefers-reduced-motion`; reduced mode uses a short fade/scale and state update.

### Pages
- **4 selected works per Portfolio page/spread state**.
- When the visible page fills, the next addition triggers a refined page turn.
- Page-turn target duration: **500–700 ms**.
- Incoming effect lands on the next available mount after the page transition.
- The Portfolio itself therefore becomes the primary selection-progress visualization.

### Portfolio viewing
Two levels:
1. **Tap Portfolio in situ:** quick browse through selected works without leaving the gallery context.
2. **View Portfolio:** full-stage review for deliberate inspection/removal and proceeding to creation.

## 8. Selection tiers and pricing
Pricing is based on the number of currently selected canonical effects.

| Selected effects | Tier | Price |
|---:|---|---:|
| 1–4 | Tier 1 | $2.99 |
| 5–9 | Tier 2 | $4.99 |
| 10–19 | Tier 3 | $7.99 |
| 20–39 | Tier 4 | $12.99 |
| 40–56 | Complete Collection | $24.99 |

### Rules
- Tier changes occur only when the selection count crosses a threshold.
- Removing selections can move the user back down a tier and price.
- No modal is shown at normal tier crossings.
- Rail copy updates quietly and immediately.
- Complete Collection is contextual; it should not dominate early browsing.

## 9. Included unlocks
| Tier | Included full-resolution unlocks |
|---|---:|
| Tier 1 | 0 |
| Tier 2 | 1 |
| Tier 3 | 1 |
| Tier 4 | 2 |
| Complete Collection | 3 |

Generation purchase buys watermarked exploration previews. Included unlocks are redeemed **after** generation in My Collection.

## 10. Curator
Curator is guidance, not sales pressure.

### Initial role
After upload, Curator can ask a concise intent question and offer a few quick choices, e.g.:
- Show me your recommendations
- Keep it natural
- Show me something unusual
- I'm making a gift
- Free-text input

### Recommendation behavior
- Curator considers source image + catalog + user intent.
- Recommendations appear by **highlighting the actual effects in their native gallery locations**.
- `Show me` may jump to the first recommended effect/silo.
- No separate recommendation gallery.
- No duplicate Curator panel.

### Optional strong action
`Curate a collection for me` may populate a proposed selection set, but the user retains control to accept/remove items.

## 11. Checkout and generation
Full-stage Portfolio review is the handoff point.

Primary flow:
`Gallery → Portfolio review → purchase → generation → My Collection → unlocks`

Use language like **Create My Collection**, not generic "Checkout", where appropriate to brand tone.

Generation output:
- watermarked preview first;
- progressive appearance in My Collection;
- generation order should follow Portfolio selection order unless engine constraints require otherwise.

## 12. Non-goals / DO NOT ADD
Do **not** add any of the following unless explicitly re-approved:
- Queue
- Bottom tier-card row
- Bottom progress bar
- Pagination
- 16-card view
- Density selector
- Second Portfolio
- Second Curator
- Recommendation sidebar/panel
- Breadcrumb stack
- Shopping-cart iconography
- Basket metaphor
- Gamified levels/badges/confetti
- Silo explainer legends
- Extra status widgets
- Duplicate pricing displays
- "Helpful" UI not specified here

The product relies on restraint. Empty space and large art are features.
