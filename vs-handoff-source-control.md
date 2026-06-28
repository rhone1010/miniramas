# VS Handoff — Source Control v5 (LOCKED) + live subject-pick contract

**Date:** 2026-06-24
**Canonical artifact:** `source-control-v5.html` (standalone prototype, real bride source embedded)
**Target:** `D:\minramas\portraits.html` (Curator spine) + analyze/generate routes
**Status:** UI lane LOCKED. Subject-pick contract is **LIVE** — wire it, don't stub it.

This replaces the old square-crop Curator source with a face-aware 3:4 control whose `focal` object feeds the generator's subject-pick. Built so multi-person test sources route to the chosen subject.

---

## 1. Why this is live now

The reason the contract goes live (not dormant) is the test phase. Rich is about to throw multi-person sources at the new materials (stained glass, driftwood-resin, fancy chocolate, plushy) on the live pipeline. If the subject picked in the UI doesn't reach the generator, multi-person testing is meaningless. So `focal.subjectId` must arrive at the generate route. Couple-scope (1–2 in Portraits vs 2+ to Groups) is **not** blocked by this — the control emits a single `subjectId` today; pair-mode (`subjectIds[]`) stays dormant until Rich decides, and the contract is forward-compatible with it (§5).

---

## 2. Deltas vs v7 (what changes in `portraits.html`)

| Area | v7 (old) | v5 (new) |
|---|---|---|
| Source crop | square `aspect-ratio:1` + blind `object-position:center 28%` | fixed **3:4**, `object-fit` via manual pan/zoom, **no pre-crop** |
| Subject framing | none | face-aware default + drag/zoom + **subject pick** (markers) |
| Curator bg | 3-stop champagne **gradient** (`#F0EAE0→#ECDFC1→#E0D2A8`) | **flat champagne** `#ECDFC1` |
| Deckle edge | present but not visibly reading | programmatic, **visible**, scale 16, sized to card via JS + **faint brass border** `#c4b48f` 1.5 |
| C mark | small, left of body, low legibility | enlarged, **drop shadow**, lifted into a **Curator masthead** above the body |
| Type | Garamond body 18px | **22px+ floor** (body 24px); see Project type rule |

The deckle/champagne/masthead/type changes apply to the **Curator card globally** in the workshop, not just the source region.

---

## 3. What to lift from `source-control-v5.html`

Copy these regions verbatim (they're the locked design), then rewire data per §4–6:

- **Markup:** `.curator` block — the paper `<svg id="paper">` (deckle filter + bordered rect), `.curator-inner`, the `.fa-source` control (`#vp`, `#srcImg`, `.fa-hint`, `.fa-controls`), and the `.curator-masthead` + `.curator-rule` + `.curator-body`.
- **CSS:** all `.curator-*` and `.fa-*` rules, plus the tokens `--champagne`, `--vellum-soft`, `--brass`, `--border` if not already in `portraits.html`. Apply the type-ramp floors (Garamond body 22px+, serif controls 18px+, no label below 12px).
- **JS:** the focal/pan/zoom/subject-pick block — `vpSize/displayed/clampFocal/render/pickSubject/seedAuto/setCover/boot` and the pointer/wheel/touch handlers, plus `sizePaper()` (deckle sizing) and the resize/load/fonts hooks.

**Drop from the prototype:** the `.proto-head` header, the entire `.readout` panel (focal readout + notes), and the hardcoded `FACES` array — all prototype scaffolding.

---

## 4. The `focal` contract (single source of truth)

```ts
interface Focal {
  x: number;        // 0..1 normalized crop center, horizontal
  y: number;        // 0..1 normalized crop center, vertical
  zoom: number;     // 1.0..3.0  (1.0 = cover-fit baseline)
  subjectId: string | null;   // which detected face is the portrait's subject
}
```

`focal` governs **both** the displayed crop and the generated subject. The customer never sees a crop different from what gets made. Persist it on the piece (workshop state, and on the generate payload).

---

## 5. Analyze route requirements (`portraits-analyze-route.ts`)

The control seeds from real detection. Analyze must return, per detected face:

```ts
faces: Array<{
  id: string;
  bbox: { x:number; y:number; w:number; h:number };  // normalized 0..1
  faceFillPct: number;   // face area / image area — gate signal + zoom seed
  gate: 'pass' | 'small' | 'occluded' | 'turned';     // Gate 0/1 verdict, PER FACE
}>
```

- Replace the prototype's hardcoded `FACES` with this array.
- Default seed: largest face by `bbox.w*bbox.h`; `pickSubject(largest.id)`; auto-zoom to ~`FACE_FILL` (0.42) of frame height.
- `faceFillPct` is the dominant face-drift signal — it's the per-person intake gate (§7) and the zoom seed.

---

## 6. Generate wiring (`portraits-generate-route.ts` + `subject-redirect.ts`) — LIVE

On Craft, pass `focal` to generate. The subject-pick contract consumes it:

- `focal.subjectId` → the subject-redirect / subject-pick contract selects which detected face the render targets. This is the live wire — verify it reaches `subject-redirect.ts`, not just the preview.
- `focal.x/y/zoom` → govern the rendered crop framing, kept in sync so the validator and generator agree (route schema must match engine schema — a mismatch silently drops the override).
- **Validation:** add `focal` to the generate route's request schema. If the route schema and engine schema drift, the subject override fails silently — keep them in sync.

Forward-compat for couples (dormant): when Rich enables pair-mode, `subjectId` becomes `subjectIds: string[]` and the generator receives both faces for paired composition. Build the schema to accept `subjectId: string | null` now; widening to an array later is non-breaking if you treat a single id as `[id]` internally.

---

## 7. Per-person intake gate (hold the retry tax down)

Before render spend, every chosen subject must clear the face-size floor:

- Gate runs per face on `faceFillPct` vs the floor (reuse the single-subject value).
- One chosen subject below floor → block render, surface via the Curator intake state (deferred — see §8). For now, a minimal block + message is acceptable; the voiced state comes later.
- This is the lever that keeps multi-person retry cost down. Per-person, before spend.

---

## 8. What is DEFERRED (spec'd, not built — build after testing)

The Curator's interactive states are **intentionally not built yet** — they're driven by real render data that the test phase produces:

- **Intake/Alert** (bad source, add-photo drop target) — needs real Gate 0/1 verdicts.
- **Elicitation** (multi-person focus Q&A, warmth, etc.) — needs the real ambiguities analyze surfaces.
- **Pricing** (per-person delta) — needs the locked price tier.
- **Confidence** (per-person QA "excellent vs close") — needs real per-person `qa_log` scores.

Full spec: `source-control-spec-v1.md` §5. Build these against real outputs, not imagined payloads. The locked Curator resting state (masthead + voiced body) is what ships now.

---

## 9. Integration steps

1. Lift the Curator-card + source-control regions from `source-control-v5.html` (§3) into `portraits.html`; drop the prototype scaffolding.
2. Apply the global Curator deltas (champagne flat, deckle+border, masthead, type ramp) — §2.
3. Extend `portraits-analyze-route.ts` to return `faces[]` per §5; wire the control to seed from it instead of hardcoded `FACES`.
4. Add `focal` to workshop piece state; persist through to the generate payload.
5. Wire `focal` into `portraits-generate-route.ts` + `subject-redirect.ts` per §6 — **live**. Add `focal` to the route schema; confirm schema parity with the engine.
6. Add the per-person `faceFillPct` gate (§7) as a render precheck.
7. Leave the Curator interactive states unbuilt (§8).
8. Verify on a multi-person source: pick a non-default subject in the UI → confirm that `subjectId` reaches the render and the output targets the chosen face.

---

## 10. Open knobs (tuned defaults, easy to change)

- `FACE_FILL = 0.42` — auto-zoom (face % of 3:4 height). Looser = pull back.
- Ring padding `1.7 / 2.0` (w/h multipliers) — subject-frame size.
- Deckle `scale 16`, `baseFrequency 0.014 0.016` — rag strength (22 = rougher).
- Border `#c4b48f` 1.5 — faint edge tone/weight.
- 3:4 container ratio — spec call; one line to change.
