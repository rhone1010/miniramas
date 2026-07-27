# Integration Spec — Five-Spine Architecture into `portraits.html`

**Owner:** VS Claude Code · **Authored by:** UI Claude (web) · **Date:** 2026-06-14
**Read before starting:** `edit-log.md` (locked rules + checklist)
**Visual contract:** `portraits-five-spine-proto.html` (prototype demonstrates the choreography)

---

## 1. Why this is a restructure, not a patch

`portraits.html` currently has multiple overlapping visibility systems: `.curator-collapsed` toggling, `setSpinesVisible` shim, the queue card's own visibility logic, inline `display:none` patterns from various rounds, and `.curator-panel-compact` zoom-based scaling. Adding a fifth-phase architecture on top of these will cause regressions — that's the exact pattern the edit-log documents.

The clean path: replace the existing spine/collapse systems with **one state machine** that governs every panel size. The state machine reads a single `state.uiPhase` value; every CSS rule for panel size keys off `.app[data-phase="…"]`; no per-panel JavaScript visibility toggles.

Backend, analyze pipeline, render handler, gate logic, Stripe checkout — **none of that changes.** This is HTML structure + CSS rules + a handful of JS lines that call `setUiPhase()`.

---

## 2. The state model (single source of truth)

```js
state.uiPhase = 'idle' | 'upload' | 'composing' | 'queued' | 'crafting' | 'post-craft'

// Overlay states (can be true during any phase):
state.curatorOpen    = boolean   // Curator spine clicked open during crafting
state.suggestedOpen  = boolean   // Suggested spine clicked open during crafting
state.collectionOpen = boolean   // Collection spine clicked open outside crafting
state.advancedOpen   = boolean   // Advanced spine clicked open (any phase)
```

`setUiPhase(p)` is the **only** function that changes `uiPhase`. It sets `state.uiPhase = p`, writes `data-phase` on the app shell, and triggers any phase-specific side effects (such as kicking off `runAll()` once `crafting` is set). CSS does everything else for size and visibility.

---

## 3. The complete state table

| Phase | Advanced | Source+Curator | Suggested | Queue | Collection |
|---|---|---|---|---|---|
| **idle** | 48px spine | hidden | hidden | hidden | 120px spine right |
| **upload** | 48px spine | 400px panel | hidden | hidden | 120px spine right |
| **composing** (queue empty) | 48px spine | 400px panel | flex-fill (3×350 cap) | hidden | 120px spine right |
| **queued** | 48px spine | 200px compact | flex-fill (3×350 cap) | 350px panel | 120px spine right |
| **crafting** | 48px spine | 48px spine | 48px spine | 350px on left | expanded right of Queue |
| **post-craft** | 48px spine | 48px spine | 48px spine | hidden | expanded right side, new pieces highlighted |

### Overlay states (additive on top of the phase):

| Overlay | Active phase | Behavior |
|---|---|---|
| `curatorOpen` | crafting | Curator restores to 400px panel · Suggested stays spine · Queue stays 350px squeezed against Collection · Collection collapses to 120px spine |
| `suggestedOpen` | crafting | Suggested restores to full panel · Curator stays spine · Queue stays 350px squeezed · Collection collapses to 120px spine |
| `collectionOpen` | composing or queued | Suggested shrinks to ~30% (1 card wide minimum) · Queue keeps 350px if present · Collection opens to ~50% of stage |
| `advancedOpen` | any | Advanced spine expands to 200px panel, pushing stage right, shrinking image sizes if needed |
| Click outside opened spine | (any overlay) | Reverts to underlying phase defaults |

---

## 4. Choreography — the animations the customer experiences

Every transition uses `transition: <prop> .45s cubic-bezier(.4, 0, .2, 1)` on the affected panels. **No JavaScript animation code beyond setting state** — CSS handles motion.

### Transition events:

**A. First choice made (queue gains its first item — `state.queue.length` goes 0 → 1):**
- `setUiPhase('queued')`
- CSS handles: Curator shrinks 400 → 200 simultaneously with Queue appearing at 350px on the right
- One continuous motion, both panels in same animation frame

**B. Craft pressed:**
- `setUiPhase('crafting')`
- CSS handles: Curator and Suggested both collapse to 48px spines simultaneously · Queue slides leftward to sit against the spine stack · Collection slides leftward from its 120px spine, expanding to take the right portion of the stage
- One continuous motion across all panels

**C. Each render completes:**
- Existing render handler adds class `.is-flying-to-collection` to the relevant queue tile
- On `animationend`, the tile data moves from `state.queue` to the appropriate Series in the Collection data structure, the tile is removed from the queue DOM, the new piece appears in the Collection with `.is-arriving` highlight class
- CSS keyframe is a translate from the tile's current position to a JS-calculated target rect on the Collection side

**D. Click Curator spine during crafting:** `state.curatorOpen = true` (overlay), CSS rule `.app[data-curator-open="true"]` overrides sizes. Click outside → false → revert.

**E. Click Suggested spine during crafting:** same pattern with `suggestedOpen`.

**F. Click Collection spine during composing/queued:** `state.collectionOpen = true`, CSS shrinks Suggested. Click outside → revert.

**G. Click Advanced spine, any phase:** `state.advancedOpen = true`, Advanced expands to 200px panel. Click outside or close button → revert.

---

## 5. What to RIP OUT of current `portraits.html`

These systems are replaced by the phase model and must be removed cleanly:

1. **`.curator-collapsed` class system** — all CSS rules keyed to `.curator-collapsed` on `.cur-effects-layout`, and the `suggCollapse()` / `suggExpand()` JS functions.
2. **Existing spine markup and CSS** — `.coll-spine` elements (`#curatorSpine`, `#queueSpine`) and the CSS that shows them. Replaced by phase-driven spines in the app shell.
3. **All inline `style="display:none"` on spine elements** — these were the orphan-spine fix and fight the phase model.
4. **`setSpinesVisible()` shim** — phase model handles spine visibility via CSS attribute selectors.
5. **Current `.cur-effects-queue[hidden]` logic for the queue card** — visibility now driven by phase.
6. **Current My Collection implementation as a separate destination view** — Collection now lives as a persistent right-side panel that expands inline; the separate destination view becomes the expanded Collection.
7. **Order Ledger floating pill (bottom-right dark pill)** — content moves into the Queue panel itself, which is now always at 350px during queued/crafting and adjacent to Collection.
8. **`.curator-panel-compact` zoom-based scaling** — compaction is now a phase-driven width change, not a CSS transform.

---

## 6. What to ADD to `portraits.html`

### App shell structure:
```html
<div class="app" id="app"
     data-phase="idle"
     data-curator-open="false"
     data-suggested-open="false"
     data-collection-open="false"
     data-advanced-open="false">

  <!-- 1. Advanced — 48px spine, opens to 200px panel -->
  <div class="spine spine-advanced" id="advancedSpine" onclick="toggleAdvanced()">
    <span class="spine-label">Advanced ›</span>
    <div class="spine-content">
      <button class="spine-close" onclick="event.stopPropagation();toggleAdvanced()">×</button>
      <!-- existing rail controls: The Piece, Material, Framing, Location, Quality -->
    </div>
  </div>

  <!-- Workshop stage -->
  <div class="workshop-stage" id="workshopStage">

    <!-- 2. Source + Curator (existing analyze content lives here) -->
    <div class="source-curator-panel" id="sourceCuratorPanel">
      <div class="sc-source"><!-- 150×150 in compact, 400×400 in full --></div>
      <div class="sc-curator-text"><!-- existing analyze observations + Source Review --></div>
      <div class="sc-leadin"><!-- "Here are the five styles I would reach for first →" (hidden in compact) --></div>
    </div>

    <!-- 3. Suggested (existing curator card / recommendation grid lives here) -->
    <div class="suggested-panel" id="suggestedPanel">
      <!-- existing 5-card recommendation grid + Add All 5 sixth slot -->
    </div>

    <!-- 4. Queue (existing queue card content lives here, no Order Ledger pill) -->
    <aside class="queue-panel" id="queuePanel">
      <!-- existing Ready to Craft + tiles + inscription + Craft button -->
    </aside>

  </div>

  <!-- 5. Collection — always present, 120px spine by default -->
  <aside class="collection-panel" id="collectionPanel">
    <button class="collection-spine-label" onclick="toggleCollection()">My Collection</button>
    <div class="collection-spine-count" id="collectionCount">0 pieces</div>

    <div class="collection-expanded">
      <section class="collection-current-series">
        <h2 class="cs-title" id="csTitle">Portraits</h2>
        <div class="cs-grid" id="csGrid"><!-- 350px cap cards --></div>
      </section>
      <section class="collection-other-series" id="otherSeriesList">
        <!-- one row per non-current Series with dot/square indicators -->
      </section>
    </div>
  </aside>

</div>
```

### CSS contracts — phase rules:
Each phase is one block, one selector per panel. Example for `composing`:
```css
.app[data-phase="composing"] .spine-advanced       { flex: 0 0 48px; }
.app[data-phase="composing"] .source-curator-panel { flex: 0 0 400px; }
.app[data-phase="composing"] .suggested-panel      { flex: 1 1 auto; }
.app[data-phase="composing"] .queue-panel          { display: none; }
.app[data-phase="composing"] .collection-panel     { flex: 0 0 120px; }
```

Transitions live on the panels themselves:
```css
.spine-advanced, .source-curator-panel, .suggested-panel,
.queue-panel, .collection-panel {
  transition: flex-basis .45s cubic-bezier(.4, 0, .2, 1),
              max-width  .45s cubic-bezier(.4, 0, .2, 1),
              opacity    .35s ease,
              padding    .45s cubic-bezier(.4, 0, .2, 1);
}
```

Overlay rules override the phase. Example:
```css
.app[data-phase="crafting"][data-curator-open="true"] .source-curator-panel {
  flex: 0 0 400px;
}
.app[data-phase="crafting"][data-curator-open="true"] .collection-panel {
  flex: 0 0 120px;
}
```

### Other-Series row markup (inside expanded Collection):
```html
<div class="other-series-row" onclick="setCurrentSeries('Houses')">
  <span class="os-name">Houses</span>
  <div class="os-dots">
    <span class="os-dot has-piece"></span>
    <span class="os-dot has-piece"></span>
    <span class="os-dot"></span>
    <!-- count varies; dots fill in order of acquisition -->
  </div>
  <span class="os-count">2</span>
</div>
```

### Lightbox (currently absent):
Modal triggered by clicking any piece in the Collection. Image + four buttons: Download 1K (as-is), Download 2K (+$2), Download 4K (+$5), Send to Print Shop.

### Fly-to-Collection animation contract:
```css
.queue-tile.is-flying-to-collection {
  animation: flyToCollection .55s cubic-bezier(.4, 0, .2, 1) both;
  --target-x: 0px; --target-y: 0px;
  z-index: 10;
}
@keyframes flyToCollection {
  from { transform: translate(0, 0) scale(1); opacity: 1; }
  to   { transform: translate(var(--target-x), var(--target-y)) scale(.6); opacity: 0; }
}
.col-piece.is-arriving {
  animation: arrivingHighlight 1.2s ease-out both;
}
@keyframes arrivingHighlight {
  0%   { box-shadow: 0 0 0 4px var(--sage); transform: scale(.94); }
  60%  { transform: scale(1.02); }
  100% { box-shadow: 0 0 0 0 transparent; transform: scale(1); }
}
```
JS computes `--target-x` and `--target-y` per tile from the source tile's `getBoundingClientRect()` versus the next open slot in the Collection's current Series row.

---

## 7. What to PRESERVE — the JS that stays

None of the following gets rewritten:
- `runAnalyze()` and the analyze pipeline
- The Source Review step inside the Curator panel
- Gate precheck route handling (`precheckSourceGate`)
- Subject pick screen for multi-person photos
- Statuesque framing offer
- Stripe sandbox checkout snapshot
- QA settings drawer
- `syncEffectCards()` add-all logic
- `priceForCount()` tier discount math
- Render handler that processes engine responses (accepts both `{result:{image_b64}}` and flat `{image_b64}` shapes — locked rule from edit-log)
- Inscription step (still renders during queued / crafting)
- Free preview gift card and dismissal flow

---

## 8. The five seams where existing JS calls `setUiPhase()`

These are the only JS additions outside the state machine itself:

1. **`handlePrimaryUpload()` after photo lands** → `setUiPhase('upload')`
2. **Analyze-complete handler, after recommendations render** → `setUiPhase('composing')`
3. **`refreshQueueViews()`** → `setUiPhase(state.queue.length > 0 ? 'queued' : 'composing')`
4. **Top of `runAll()` (Craft handler)** → `setUiPhase('crafting')`
5. **Render-complete handler, when last render lands** → `setUiPhase('post-craft')`

Plus four overlay-toggle functions (`toggleAdvanced`, `toggleCurator`, `toggleSuggested`, `toggleCollection`) that each set a single boolean and update the corresponding `data-*-open` attribute.

---

## 9. Acceptance criteria

- All six phases reachable by walking upload → compose → queue → craft → completion. No layout flash or surface error in any transition.
- Each transition runs the .45s cubic-bezier ease. No abrupt cuts.
- Each render completion fires the fly-to-Collection animation with arriving-highlight on landing.
- Click each spine during each phase where it's a spine — verify the overlay state works without breaking the underlying phase.
- All locked rules in `edit-log.md` survive: type floors (18px serif / 16px UI), Add button 50px bottom padding, brand vocabulary (Crafted Portraits, Ready to Craft, Your Pieces, never sculpted/discount/render-as-verb), response-shape handling (both wrapped and flat).
- Integration runs in a **single VS Claude session** with `edit-log.md` open. Each edit appends to "Recent Edits" with locked-rules-verified line.

---

## 10. What this delivers

A `portraits.html` that's *simpler* than the current file — one state machine collapses several disparate visibility systems into one — and that feels coherent across every customer phase. The five-spine architecture is the visual contract; the existing functional core (analyze, gate, render, Stripe) is untouched.

Reference files for VS Claude:
- `portraits-five-spine-proto.html` — visual / motion contract
- `portraits.html` — functional / behavioral source of truth
- `edit-log.md` — locked rules and discipline checklist
- `seam-tracker.md` — cross-lane state with Engine
- This file — the contract between visual and functional

— UI Claude, 2026-06-14
