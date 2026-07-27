# Portraits — Locked Rules & Edit Log

**This is the discipline doc. Claude reads this BEFORE every edit, updates it AFTER every edit. The locked rules below have been violated multiple times by Claude across sessions — that pattern stops here.**

---

## 🔒 LOCKED RULES (do not violate without Rich's explicit permission)

These are decisions Rich has made and Claude has subsequently broken. Each one cost a round of frustration. If a current edit would touch any of these, STOP and confirm with Rich first.

### Type
- **18px floor on Garamond/serif content** (Source Review list, inscription option names, queue summary)
- **16px floor on small UI text** (ar-txt, aux-caption, rail-helper, control-label, res-lbl, res-up, sp-hint, pb-body, pb-note, pb-email, insc-lead, insc-input, materials-hint-tight)
- Cluster titles `.rail-cluster-title` at 21px italic serif
- Recommended options use **sage tint, not dot** — `.pill-lg[data-recommended="yes"]:not(.active){ background:var(--sage-tint); border-color:var(--sage-border); }` — the dot pushed text around

### Layout
- **Queue card:** 480px wide, 50px side padding, 18px grid gap, hugs content (`align-self:flex-start`), not stretchy
- **Curator column:** min-width 430px, max-width 840px, never crushed by siblings, never stretched to fill row
- **`.cur-effects-layout`:** flex-wrap on; align-items:flex-start (no stretch); rendered column drops below when third column won't fit
- **Spines:** `.coll-spine` is `align-self:flex-start` with `height:auto` — never stretches to row height. Visibility driven by `.curator-collapsed` class on parent, NOT inline `display:none`
- **Add button (`.rail-addqueue-sticky`):** 50px bottom padding, solid `var(--bg)` background with soft top shadow, sits above More options with 8px+ floor between them
- **Curator card:** Add All 5 + Design Your Own action stack is **top-right** of the header, in a flex row, 25px margin-top, 10px between the row and Design Your Own button

### Component behavior
- **Framing trio:** vertical full-width stack — three rows, name (italic serif 16px) on left, aspect (mono 11px) on right. **NEVER horizontal pills** (Signature Pose label too long, always wraps and crashes)
- **Free preview gift card:** floats *beside* the queue (its own 300px sage easel), 1px solid sage border, dismissable with "No thanks" underlined hotlink; `liten_preview_dismissed` localStorage flag; returns whenever pieces pending unless used or dismissed
- **Order Ledger:** dark pill fixed bottom-right, italic Garamond count + bold total + brass tier discount; scale-bump on total change; hides while crafting; click runs craft
- **Effect shelf:** cards HIDE not destroy on add; `syncEffectCards()` returns them to shelf when gate bounces pieces (rejected/redirected)
- **N (queue count):** pending-only — `state.queue.filter(q=>q.status==='pending').length`. Done and rejected items never inflate count, tier, button price, or ledger
- **Curator transitions:** 0.45s cubic-bezier(0.4,0,0.2,1) on column collapse; spine fades in from left at 0.15s delay; no abrupt cuts

### Brand vocabulary
- **NEVER** in customer-facing copy: "sculpted", "sculpture", "Sculpted Images", "off", "save", "discount", "queue" (as customer word), "render" (as verb), "In-Situ" / "In Situ"
- **Always:** "Crafted Images", "Crafted Portraits", "In Environment" (for Landscapes/Houses), "Ready to Craft", "Your Pieces", "+ Add this piece", "Craft all N", "Craft it again", "Keep it as is" (lifts watermark), "Refund" (paid only)
- **Framing names:** Bust / Signature Pose / Statuesque (customer-facing). Internal field `framing: 'bust' | 'signature' | 'statuesque'` (engine maps statuesque→full_body if needed)

### Response handling
- Engine responses may be wrapped `{result: {image_b64, ...}}` OR flat `{image_b64, ...}`. Code accepts both. Don't tighten back to one shape.

---

## 📋 EDIT CHECKLIST (Claude follows EVERY round)

**Before editing portraits.html:**
1. ⬜ Read this whole doc top to bottom
2. ⬜ Identify which sections of the file the edit will touch
3. ⬜ For each touched section: read the *current* state with view or grep, don't assume
4. ⬜ Check if any locked rule above applies — if yes, the edit must preserve it
5. ⬜ For any CSS rule being replaced wholesale, verify the new rule contains every property the old one had unless deletion is the explicit intent

**During edit:**
1. ⬜ Use minimal anchors (just the rule selector + opening `{`), not multi-line exact-match blocks (they drift with prior edits)
2. ⬜ Apply via regex span replacement keyed to selectors, not literal `.replace()` of multi-line strings
3. ⬜ One concept per edit; if fixing multiple things, sequence them and verify between

**After edit:**
1. ⬜ JS parse check (already automated)
2. ⬜ Grep for known locked-rule signatures to confirm they survive (e.g. `grep "padding:24px 50px 28px"` to confirm queue padding)
3. ⬜ Append a line to "RECENT EDITS" below with date, change summary, and which locked rules were checked

---

## ⚠️ REGRESSION PATTERN — WHAT KEEPS HAPPENING

Cataloging so it stops:

| Round | What was edited | What broke as a side effect |
|---|---|---|
| Spine fix (orphan spines) | Added inline `display:none` to spine markup | Class-based reveal stopped working — Curator vanished entirely on craft instead of going to spine |
| Framing pill wrap fix | Replaced `.control.framing .pill-lg` rule wholesale | Lost the per-position border-radius rules; the horizontal layout itself was the wrong call (long labels always lose) |
| 76% → 84% zoom | Targeted scale change | Add button padding got clobbered in same round |
| "Add All 5 only at 5 cards" sync rule | Tightened visibility logic | Customer couldn't Add 4 or Add 3 — the discount stayed honest at any tier, fix was widening not tightening |
| Multiple rounds | CSS rule rewrites via wholesale replacement | `.coll-spine` rule deleted at some point; never noticed until spine never appeared |
| Multiple rounds | Re-runs of layout fixes | Queue padding (50px sides) lost more than once |

**Root cause:** Claude edits portraits.html without reading surrounding context, using literal multi-line `.replace()` anchors that drift across edits. Fix: read first, regex-by-selector, this doc as guard rail.

---

## 📜 RECENT EDITS (Claude appends after every change; oldest first; keep last ~15)

- 2026-06-14 — **Persistent edit log doc created.** Locked rules cataloged from session memory; regression patterns documented. Going forward, every edit appends here.
- 2026-06-23 — **Five-spine integration attempt — fully reverted at Rich's request.** A VS-Claude session built the `vs-integration-spec.md` state machine (`data-phase`/overlay attrs + setUiPhase/derivePhase, My Collection + Curator collapse migrated to attribute overlays), then a visible shell pass (Advanced spine + My Collection right spine). Rich's call: the incremental morph of the working UI lost cohesion. **Rich is mocking up each phase first**, then implementing against the mocks. All session edits to `portraits.html` were surgically reverted (verified: zero residual markers, JS parse pass, divs balanced 270/270 — back to session-start state). Takeaway for next attempt: don't morph the live UI incrementally — design each `data-phase` state as a finished mock, then build to it.
- 2026-06-26 — **Source Control v5 + LIVE subject-pick — functional half shipped & verified.** Per the VS Handoff. Discovery surfaced that the handoff's "subject-pick is LIVE" premise was contradicted by the code (generate route ignored the chosen subject; `subject-redirect.ts` is a Series classifier, not a face picker; analyze had no per-face bbox). Rich's call: build both halves live. Reframe: **subject-pick = server-side crop to the focal region** (robust; no fragile "pick face N" prompt). Built: (1) **analyze** (`portraits-refine.ts`) — vision prompt now returns per-face normalized `bbox{x,y,w,h}` + per-face `gate`; new `AnalyzedFace[]` (id/bbox/faceFillPct/gate) on the primary photo, surfaced through the analyze route. (2) **UI** (`portraits.html`) — face-aware 3:4 source control (`#faSource`/`#faVp`, drag/zoom/tap-to-pick) lifted from the locked v5 proto into the sidebar, emitting `state.focal{x,y,zoom,subjectId}`; seeds from analyze faces; focal snapshotted onto each queue item and into the generate body. (3) **generate route** — reads `body.focal`, server-crops the source to the chosen 3:4 region BEFORE the QA gates + generator (so QA scores the picked face), fail-open; `cropSourceToFocal` mirrors the client cover/zoom math; subjectId logged. (4) **per-person gate** — minimal UI block before craft when the chosen face's gate is `small` (§7; voiced state deferred per §8). Verify: portraits-refine/analyze/generate typecheck clean (pre-existing errors in groups/landscapes/store are unrelated); portraits.html JS parse clean. **Routes:** edited the live `app/api/v1/portraits/{analyze,generate}` (served routes; `_route_upload/` is a flattened mirror). **Curator card restyle (§2) — DONE:** `#curatorPanel` now a flat champagne (#ECDFC1) deckled card — programmatic SVG turbulence rag edge (`#curatorPaper`, scale 16) sized to the card by `sizeCuratorPaper()` via a ResizeObserver, faint brass border #c4b48f 1.5; C-mark masthead + rule replaces the per-step "The Curator" eyebrow (hidden); Garamond body lead bumped to 1.42rem. Parse clean; CSS braces 791/791; divs 278/278. **Two visual caveats for Rich's eye:** (a) `.curator-panel-compact` zoom:0.84 still applies, so rendered body type is ~0.84× the CSS size — the §2 22px floor renders ~19px until the zoom is removed/retuned (left the locked zoom intact rather than guess); (b) the champagne deckle paper sits behind ALL curator steps including the big effects workshop (curStepEffects) — if §2's "global" meant only the voiced steps, scope the paper to those. **DEFERRED per §8:** Curator intake/elicitation/pricing/confidence states. **Live test (§9.8):** multi-person source → pick a non-default face → confirm the crafted output targets that face.

---

## OPEN ITEMS — to-do across the surface (not locked, just tracked)

- Queue card scrollbar appearing/disappearing inconsistently (Rich flag, 2026-06-14)
- Curator spine minimum height — currently sized to text only; should have a sensible min so it reads as a deliberate column anchor
- Render quality concerns from Rich/ChatGPT (Engine lane): missing shirt in some materials, shrunken hands, invented hands on plaque, overall flatness
- Engine sync items still tracked in `seam-tracker.md` — this doc does not replace that; this doc is the UI-side discipline log
- 2026-06-27 — **Bugfix: Craft bounced to "5 suggested" before rendering (focal-crop resolution regression).** Root cause: the face-aware control auto-seeded a tight zoom even for SINGLE-subject photos, so `focal` was "meaningful" and the generate route cropped to a small region whose long edge fell below `MIN_LONG_EDGE_PX` (1024) → the intake resolution gate (generate route ~L265) rejected the piece → `syncEffectCards()` returned the cards to the shelf (the locked "gate bounces pieces → cards return" behavior) → looked like a crash/reset before processing. Fix 1 (UI `seedAuto`): only auto-frame when ≥2 faces (real disambiguation); a single/zero-face source leaves `focal` neutral → no crop, full-res source used. Fix 2 (route `cropSourceToFocal`): upscale any crop whose long edge is under `MIN_LONG_EDGE_PX + 256` so even a deliberate tight multi-person crop clears the gate (generator re-synthesizes anyway). Both verified: generate route typecheck clean, portraits.html parse clean.
- 2026-06-27 — **Bugfix follow-up: reverted the single-subject no-crop (Fix 1) — it broke §4.** Live test showed intake_rejected (intake=8, "face small") and cards resetting to 5 suggested. Cause: the previous Fix 1 stopped sending the focal crop for single subjects, so the intake gate scored the UNCROPPED original (small face) instead of the face-prominent 3:4 framing the customer sees — violating §4 ("the customer never sees a crop different from what gets made"). Reverted `seedAuto` to always frame the largest face; the route's upscale (Fix 2) keeps the tight crop above the resolution floor, so cropping is safe. Net: what the customer frames is what gets gated + crafted, and framing onto the face is what intake wants. Parse clean. NOTE (follow-up, not blocking): the /gate PRECHECK still scores the original (no focal), so its "face small" note can be pessimistic vs the cropped craft; passing focal to the precheck would align them. SEPARATE (Engine lane, not mine): `checkout 400 cart_identity_required` is the Stripe sandbox cart (seam S2.3) — non-fatal, sandbox simulated payment and still ran the generates.
- 2026-06-27 — **Experimental Effects UI wired (portraits-experimental.ts contract).** After the two backend edits (pass2 keys + route experimental branch), added the Curator UI the module's contract describes. portraits.html: new "Experimental Effects" section in the curator effects step (#experimentalFx) rendering one button per effect from a 10-entry EXPERIMENTAL_FX array (order mirrors EXPERIMENTAL_EFFECTS); renderExperimentalButtons() hooked into renderEffectCards so it appears beside the 5 suggestions; queueExperimental(id) pushes a mode:'experimental' queue item (carries experimental_effect, framing, focal, plaque, source) so it renders through the existing Craft/runQueueItem pipeline; runQueueItem gained an experimental branch that POSTs { experimental_effect, framing, plaque, focal, source } to /generate and reads the flat {image_b64} response (like raw mode). Item carries preset=label so existing matLabel title/alt spots display the effect name without touching them. Verified: JS parse clean; CSS braces 798/798; divs 282/282. Experimental pieces flow through the same payment/display path as presets (consistent). NOTE: tapping queues the piece (like picking a preset) — user still hits Craft; if Rich wants tap-to-render-immediately or free experimental renders, that's a follow-up.
