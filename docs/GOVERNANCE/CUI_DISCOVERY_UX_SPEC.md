# CUI 45 — Discovery UX / UI Implementation Specification
**Owner:** CUI 45  
**Depends on:** `LITEN_DISCOVERY_PRODUCT_SPEC.md`  
**Goal:** Implement the locked browsing and Portfolio experience without redesigning it.

## 1. Screen anatomy
Desktop screen has three visual zones:

### A. Left rail — action and ownership
- Light parchment/stone family.
- Curator at upper-left.
- Large Portfolio anchored lower-left.
- Minimal tier/status copy adjacent to or immediately above/below Portfolio.
- Portfolio is the dominant object once selections begin.

### B. Main stage — discovery
- Rich coffee/leather-toned stage, softer than the header.
- Named silo navigation across the top.
- 4×2 effect gallery.
- No redundant headings if the silo nav already provides context.

### C. Right edge — orientation
- Narrow 56-cell vertical minimap.
- No extra explanatory panel.

## 2. Visual hierarchy
1. Art cards
2. Portfolio
3. Curator
4. Silo navigation
5. Minimap
6. Pricing/status text

Pricing must remain visible but quiet.

## 3. Effect cards
Each visible silo renders 8 large cards max.
Card includes:
- large effect preview
- effect name
- restrained add/select affordance
- selected state

Do not shrink the artwork merely to expose more inventory.

## 4. Silo navigation
- Sticky within the gallery stage if the page scrolls.
- Uses the approved silo names from product data.
- One active state.
- Selecting a silo swaps the 4×2 gallery in-place.
- No transitions longer than ~250 ms for the gallery swap.

## 5. Minimap
- 56 cells total, grouped 8 × 7.
- Narrow, vertical, always visible on desktop.
- Clickable.
- Current silo/group is visually distinguishable.
- Selected canonical effects may receive a restrained brass/gold state.
- Keep all other states visually minimal.

No legend, no miniature thumbnails, no hover image previews.

## 6. Portfolio visual
### Must read as
A large artist/canvas presentation folio shown small.

### Must not read as
Wallet, purse, handbag, book, shopping bag, shopping basket, change purse.

### Construction
- Landscape-oriented case proportions.
- Broad uninterrupted material fields.
- Substantial spine/hinge.
- Brass center badge.
- Large-scale stitching/edge work.
- Deep soft shadow.
- May extend partially off the left/bottom viewport edge.

### Material states
Use one geometry with material variables:
- Tier 1: soft tan
- Tier 2: forest green
- Tier 3: oxblood
- Tier 4: dark suede

Avoid simply swapping flat colors. Use texture, specular response, edge treatment and shadow changes to suggest material.

## 7. Portfolio selection animation
Sequence:
1. User selects effect.
2. Source card receives selected state immediately.
3. Create a lightweight visual proxy from the effect image.
4. Proxy lifts 2–4 px.
5. Proxy follows a shallow arc toward the Portfolio.
6. Proxy scales down progressively.
7. Proxy slips behind/into the open Portfolio.
8. Portfolio gives one restrained tactile response.
9. Selected miniature occupies the next mount.

Timing:
- Total: 450–650 ms.
- Page turn: 500–700 ms.
- Reduced motion: fade/scale only, <= 200 ms.

No sound by default.

## 8. Portfolio pages
- 4 works per visible page/spread state.
- When a page is full, the next addition initiates page turn before placement.
- Miniatures must remain recognizable.
- Portfolio should visually “fill up” as selections accumulate.

## 9. Portfolio quick interaction
Click/tap Portfolio while browsing:
- expands enough to flip through current selected works;
- remains anchored to left side / overlays into stage;
- gallery remains perceptually present;
- user can close and continue browsing immediately.

Do not navigate to a separate route for quick browse.

## 10. Full-stage Portfolio
Triggered by `View Portfolio`.

Main stage becomes a large open artist folio showing selected works in selection order.

Allowed actions:
- flip pages
- inspect
- remove selection
- return to gallery
- Create My Collection

Do not add sorting/rearranging unless separately approved.

## 11. Left-rail copy
Keep succinct.

Example:
**YOUR PORTFOLIO**  
12 selected  
Studio Collection · $7.99  
8 more included

**NEXT: STUDIO / NEXT TIER** copy should only appear if it remains extremely compact and helpful. Do not create a pricing table in the rail.

Important: “included” refers to capacity within the current price ledge, not free unlocks.

## 12. Curator states
### Empty Portfolio / early browse
Curator may be expanded and ask one concise question.

### Once selections accumulate
Curator collapses to a compact presence so Portfolio gains visual priority.

Suggested compact state:
**Curator**  
Want help finding your next few?

No duplicate floating chat panel.

## 13. Curator recommendations
Recommended effects are highlighted in their actual gallery positions.
Recommended highlight should be visually quieter than `selected`.
A Curator action may navigate directly to the first recommended silo/effect.

## 14. Tier transitions
At selection counts 5, 10, 20:
- no modal;
- no blocking toast;
- material treatment transitions in-place;
- tier/price text updates;
- selection continues uninterrupted.

At removal thresholds 19→9 etc., reverse appropriately.

Complete Collection activates at 40+.

## 15. Responsive intent
Desktop behavior is canonical.

On narrower screens:
- preserve the product model;
- do not invent alternate flows;
- Portfolio remains persistent if feasible;
- minimap may compress or become an explicit compact navigator;
- maintain 4×2 semantics only where space allows; responsive adaptation must preserve large-card priority.

Mobile redesign is out of scope for this implementation unless separately requested.

## 16. CSS design tokens
Use these as starting tokens; adjust only to match existing LITEN assets.

```css
:root {
  --liten-parchment: #e8ddc8;
  --liten-parchment-deep: #d8c7aa;
  --liten-coffee: #3a2b24;
  --liten-coffee-soft: #4a372d;
  --liten-ink: #231f1b;
  --liten-brass: #b68a46;
  --liten-brass-soft: #c8a56c;

  --folio-tan: #b89b73;
  --folio-forest: #344f3a;
  --folio-oxblood: #5b2528;
  --folio-suede: #2f2926;

  --rail-width: 300px;
  --minimap-width: 46px;
  --card-gap: 16px;

  --motion-select: 560ms;
  --motion-page: 620ms;
  --motion-fast: 180ms;
}
```

### Suggested structural CSS
```css
.discovery-shell {
  display: grid;
  grid-template-columns: var(--rail-width) minmax(0, 1fr) var(--minimap-width);
  min-height: 100vh;
  background: var(--liten-coffee);
}

.discovery-rail {
  position: sticky;
  top: 0;
  height: 100vh;
  background:
    linear-gradient(rgba(255,255,255,.06), rgba(255,255,255,0)),
    var(--liten-parchment);
}

.gallery-stage {
  min-width: 0;
  padding: 24px 28px 40px;
  background:
    radial-gradient(circle at 50% 0%, rgba(255,255,255,.05), transparent 38%),
    var(--liten-coffee-soft);
}

.effect-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--card-gap);
}

.effect-card { position: relative; min-width: 0; }
.effect-card__image { width: 100%; aspect-ratio: 4 / 5; object-fit: cover; }

.minimap {
  position: sticky;
  top: 0;
  height: 100vh;
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 12px 8px;
  background: rgba(22,17,14,.42);
}

.minimap__group {
  display: grid;
  gap: 4px;
}

.minimap__cell {
  width: 100%;
  aspect-ratio: 1.4 / 1;
  border: 1px solid rgba(232,221,200,.36);
  background: transparent;
}

.minimap__cell[aria-current="true"] {
  border-color: var(--liten-brass);
}

.minimap__cell[data-selected="true"] {
  background: var(--liten-brass);
  border-color: var(--liten-brass);
}
```

## 17. Accessibility
- All selectable effects are keyboard accessible.
- Minimap cells must have meaningful accessible names (`Earth & Ore — Stone & Clay`).
- Portfolio open/close states must manage focus correctly.
- `prefers-reduced-motion` must disable arc/page-turn choreography while preserving state comprehension.
- Do not communicate selected/current states by color alone.

## 18. CUI prohibition
If a component is not listed in the shared spec or this document, do not add it “for clarity.”
