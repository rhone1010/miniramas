# UI ↔ Engine seam tracker — Liten & Co, Portraits

**Owner of this document:** UI Claude. Updated each UI session.
**Read order:** Engine reads top-down; status column tells you what's
yours and what's ready. Rich adjudicates seam decisions and verbatim
text items. UI Claude does not commit on Engine's side; Engine does not
commit on UI's side; the JSON between us is the seam.

**Status legend:** ▶ = ready for owner to act · ◐ = in progress ·
✓ = shipped · ⏸ = scheduled, not started

---

## ACTIVE — Stage 1: locked-framing push (the gating sequence)

The whole next phase blocks on this. Signature Pose composition must
land first; that composition is what feeds the preview library bake;
the library is what unlocks the closer-to-self previews in the rail;
after that, the lanes parallelize.

### S1.1 — Three-framings scaffold ▶ Engine
**Owner:** Engine · **Greenlit by Rich 2026-06-13** · scaffold-only,
verbatim prompt text is S1.2

- Accept `framing: 'bust' | 'signature' | 'statuesque'` on `/api/v1/portraits/generate`
- Enforce `framing → aspect` server-side; ignore conflicting client `aspect`:
  ```ts
  const ASPECT_FOR_FRAMING = { bust: '1:1', signature: '1:1', statuesque: '3:4' }
  ```
- Map `statuesque → full_body` internally if any downstream code still keys on the old vocabulary; otherwise migrate that code
- Add prompt-builder slots for the three composition blocks (text from S1.2)
- Resolution → output dimensions per aspect: 2K @ 1:1 = 2048×2048; 2K @ 3:4 = 1536×2048
- Migration if any schema columns key on the old vocabulary

UI side already shipped: rail trio, FRAMING_LABEL map updated, Curator
full-figure offer reworded, queue row suffix, default = signature, all
payloads carry `framing` + `aspect`.

### S1.2 — Verbatim composition text ◐ Rich
**Owner:** Rich · **Status:** Signature Pose locked 2026-06-13; Bust and Statuesque blocks pending

Three blocks needed. Signature Pose is the new default — the house
piece — and gates the preview library bake (S1.4) and the closer-to-self
suggested thumbnails (S1.5). Coordinate with the STATUE_UNIVERSAL
session (S3.1) — if both happen close together, they collapse into one.

**Signature Pose — LOCKED 2026-06-13** (~480 chars):

> A finished portrait sculpture — settled, unhurried, in the implied prior attention of a figure just turning back to meet the viewer.
>
> Shoulders turned slightly from camera; head returns to a three-quarter view, eyes meeting the viewer. Arms descend naturally; both hands resolved at plinth level — on the base, the plaque, or each other. Never terminating in unsupported space.
>
> Soft directional museum light; the rotated shoulder takes quiet shadow.
>
> Square 1:1 frame. Inscription plaque integrated at the base.

**Bust — pending Rich** — head + shoulders, square frame, traditional convention; no arms in frame; gallery lighting; plaque integrated.

**Statuesque — pending Rich** — full figure on plinth, 3:4 frame, head to feet, integrated plaque.

### S1.3 — Live test pass ⏸ Rich + UI Claude
**Owner:** Rich loads, UI Claude patches surface issues that surface
· **Pending:** S1.1 + S1.2 ship

Walk the three flows in the running product. Render mismatches → Engine.
Surface issues → UI lane.

### S1.4 — Preview library bake ⏸ Rich (batch Claude)
**Owner:** Rich runs batch Claude · **Pending:** S1.2 locked +
`is_preview_bake` flag (S2.4) shipped + Signature Pose preset live

Once Signature Pose is locked, it becomes the composition every preview
image uses. Library matrix: 6 bins (Female/Male × Young/Mature/Senior)
× ~3 hero materials (Walnut, Folded Book, Charcoal & Chalk) = 18
previews first pass. Routes through the production pipeline via
`is_preview_bake` so previews never drift from customer renders.

---

## Stage 2 — production-readiness items (mostly Engine, mostly small)

These run in parallel once Stage 1 lands. Most are already specced from
earlier sessions; restated here so they're not buried.

### S2.1 — `qa_override` body field (the two-liner) ▶ Engine
**Owner:** Engine · **Smallest unblock in the file**

Honor `body.qa_override` on `/generate` and `/gate`:
```ts
const srcStrict = body.qa_override?.source_strictness ?? qaSettings.sourceStrictness
const rndStrict = body.qa_override?.render_strictness ?? qaSettings.renderStrictness
```
⚠ Gate to internal traffic (env flag / internal header). UI's QA drawer
already rides every request with this; until honored, Rich's slider is a
stored intention, not a live dial.

### S2.2 — Gate precheck route `/api/v1/portraits/gate` ▶ Engine
**Owner:** Engine · **Highest customer-experience leverage of any item**

Extract Gate 0 (classifySubject/redirect) + Gate 1 (scoreIntake) from
the top of the generate route into a thin POST route. Same qa_settings,
honors qa_override. Response: `{ status, intake?, redirect? }`. UI fires
it once per source photo at first queue add — kills "the gate speaks
after Craft" permanently.

### S2.3 — Stripe Embedded Checkout (cart mode) ▶ Engine
**Owner:** Engine

Build the cart on `/api/v1/checkout` with **Embedded Checkout**
(`ui_mode: 'embedded'`, return `client_secret`). The UI's Order Ledger
is the mount point. Server-side price verification against the ladder
(base $3.99 · −15% @ 2 · −25% @ 5 · −30% @ 10 + quality upcharges).
Page never unloads → sessionStorage snapshot demotes to fallback.

### S2.4 — `is_preview_bake` flag on `/generate` ▶ Engine
**Owner:** Engine · **~15 lines**

Optional body field. When true: require internal header; skip qa_log
user attribution, entitlements, collection_pieces, collector number,
preview ledger; write final JPEG to Supabase Storage at
`preview_bake_path`; return `{ status: 'baked', storage_path, qa_log_id }`.
Intake gates still run (the point is the production pipeline).

### S2.5 — Free preview ledger + BAKED watermark ▶ Engine
**Owner:** Engine · **Highest-risk item in the file until baked**

One per email AND per IP, server-enforced. Watermark composited into
the JPEG server-side — UI overlay is presentation only. Until baked, the
free preview is an unprotected full product.

### S2.6 — Collector numbers + Curator inscription `trait` ▶ Engine
**Owner:** Engine

`collector_stamp: true` → next number from per-Series sequence
(`#P00043`), baked onto plaque, returned as `collector_number`. Analyze
adds a `trait` field for the Curator inscription line.

### S2.7 — Phase 1 `006` migration ▶ Engine
**Owner:** Engine · **Must land BEFORE S2.5/S2.6 touch schema**

`collection_pieces` and entitlements schema. Preview ledger and
collector numbers live here — don't invent parallel tables.

### S2.8 — Print Shop UX pass ⏸ UI Claude
**Owner:** UI Claude · **Pending:** Rich's signal

Mockup exists in project files. Surface-only work; no Engine
dependency.

### S2.9 — Mobile pass ⏸ UI Claude
**Owner:** UI Claude · **Pending:** Rich's signal · likely its own session

Flagged unsolved in carryover.

---

## Stage 3 — scheduled, not started

### S3.1 — STATUE_UNIVERSAL session (collapses into S1.2 if simultaneous) ⏸ Rich + Engine
**Owner:** Rich in the room with Engine · placeholder only here

If S1.2 and this session happen close together, they ARE one session —
the universal block and the Signature Pose framing prompt encode the
same composition discipline; no point writing them twice.

### S3.2 — Subject pick contract ⏸ Engine
**Owner:** Engine

`people[]` in analyze (model labels + face_px + viability) ·
`subject_selector` in generate prompt · QA scores against the SELECTED
face crop · Gate 0 treats multi-person + selector as valid Portraits.
UI's picker is built and dormant — lights up automatically on contract
arrival.

### S3.3 — `body_coverage: 'full_body'` in analyze ⏸ Engine
**Owner:** Engine · **small**

Current values stop at `'upper_body'`. Needed for the Curator's
full-figure offer to fire. Offer step is built and dormant.

### S3.4 — Server-side queue persistence ⏸ Engine
**Owner:** Engine · decide alongside Phase 1

Ties to My Renders persistence. Checkout made it load-bearing;
sessionStorage survives sandbox testing for now.

### S3.5 — QA settings GET/PUT route ⏸ Engine
**Owner:** Engine · clean end-state after S2.1

`GET /api/v1/qa/settings?silo=portraits` · `PUT` with same body.
Internal-only. S2.1's qa_override is the unblock; this is the
table-backed persistence that follows.

### S3.6 — Other Series rollout ⏸ Rich, post-launch
**Owner:** Rich sequences, UI Claude executes

Portraits is the template. Groups, Pets, Houses, Action, Landscapes,
For Fun, Artist Series each get the same rail grammar, Curator-driven
flow, framing trio (or its per-Series equivalent), ledger, gift easel,
QA drawer.

---

## Working agreements (the lane rules, restated)

- **UI lane** owns the workshop frontend — the screen and what's on it.
- **Engine lane** owns the backend — routes, prompts, gates, schema, the pipeline.
- **The JSON between us is the seam.** Both lanes propose contracts; Rich adjudicates.
- **No artifact crosses a lane without Rich's hand on it first.** UI doesn't talk to Engine directly; Engine doesn't talk to UI directly.
- **Verbatim text is Rich's.** Composition prompts, BUST/STATUE_UNIVERSAL, Curator copy, brand voice — neither lane writes these.
- **Live testing in the running product is Rich's.** Render mismatches surface there → Engine. Surface issues surface there → UI.

— UI Claude, 2026-06-13
