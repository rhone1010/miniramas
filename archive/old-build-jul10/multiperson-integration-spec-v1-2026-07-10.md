# MULTI-PERSON PORTRAITS — INTEGRATION SPEC v1 · 2026-07-10

Full design for turning the dormant multi-person add-on into a shipped feature.
Handoff-ready for Claude Code. Do NOT begin until the solo spine has shipped —
this is a deliberate, sequenced turn-on AFTER solo (see §8 Fence-removal order).

Viability is already PROVEN (see `multiface-exploration-carryover-2026-07-10.md`):
2–3 distinct likenesses hold through effects at the material register. This spec
makes it production-real.

Two slots require Rich (verbatim-block rule): **§3 Bust-Multi and Statuesque-Multi
composition blocks.** Everything else is fully specified.

---

## 1. WHAT ALREADY EXISTS (built during the exploration)

In the codebase, dormant, behind `subject_mode: 'solo' | 'multi'` (default solo):

- `portraits-prompt.ts` — `SIGNATURE_MULTI` composition, `MULTI_SUBJECT_FIGURE_FIDELITY`
  (borrowed verbatim from Groups), `subject_mode` branch in `framingBlock` + both builders,
  pluralized lead sentence, clean-base forced in multi.
- `portraits-generator.ts` — derives `subject_mode` / `subject_count` (loose read), passes to builder.
- generate route — passes `subject_mode` / `subject_count` through; `skip_redirect` bypasses Gate 0.

Solo path is byte-for-byte unchanged by all of the above.

---

## 2. FLAG THREADING — what still needs wiring

`subject_mode` currently only flows when a caller sends it (the test harness did).
For the real feature it must originate from the **subject picker** (§4) and flow:

    S1 subject picker → generate request → generator → prompt + scorer

Wire:
- Subject picker emits `subject_mode: 'multi'` + `subject_count: N` + the targeted
  `subjectId`s (the `focal` contract already exists from V7 — `x`,`y`,`zoom`,`subjectId`).
- `skip_redirect: true` is sent whenever the user has explicitly chosen to craft
  2–3 people in Portraits (they've passed the "that's a Group / craft here anyway" fork).
- Promote `subject_mode` + `subject_count` to first-class fields on
  `PortraitsGenerateRequest` in `portraits-shared.ts` NOW (during integration they're
  read loosely via cast; make them real once solo has shipped and shared.ts is stable).

---

## 3. COMPOSITION BLOCKS

`MULTI_FRAMING_BLOCK` in `portraits-prompt.ts` maps each framing to its multi composition.
Today all three point to `SIGNATURE_MULTI` (fallback). Author the two missing blocks.

**Signature-Multi — DONE** (shipped, validated). Close intimate cluster, shared base,
faces large in frame, per-person age/scale preserved, clean base.

**[RICH TO AUTHOR] Bust-Multi** — the multi variant of `BUST_UNIVERSAL`.
Structural requirements the block must hit (Rich writes the verbatim words):
- 2–3 busts, shoulder-to-shoulder or slightly overlapping, ONE shared base.
- Each: full head, hair, neck, both shoulders, upper chest, garment structure.
  Terminate at mid-bicep as in solo BUST_UNIVERSAL — **NO hands** (bust register;
  avoids NB2's weakest area, the pilot's flagged risk).
- Every face read clearly and frontally, no subject blocked by another's shoulder.
- Per-person age/scale preserved (adults vs children vs toddler).
- Clean unmarked base — no plaque (inscription cut product-wide).
- Faces large in frame — intimate, NOT a distant group tableau.

**[RICH TO AUTHOR] Statuesque-Multi** — the multi variant of `STATUESQUE_UNIVERSAL`.
Structural requirements:
- 2–3 full figures, head-to-mid-thigh (Statuesque register), sharing one plinth.
- Natural standing/seated arrangement, believable per-figure posture.
- Hands resolved naturally where they fall (statuesque already resolves hands) —
  or clasped/at-sides; never fading into undefined form.
- Per-person height/scale preserved — this framing MOST needs it (full bodies show
  the size difference between adult and child directly).
- Clean base.

Until authored, both fall back to `SIGNATURE_MULTI` (already wired) — so the feature
ships functional on signature and gains the other two framings when Rich delivers them.

---

## 4. SUBJECT-PICKER UI (S1 Input)

The front-end targeting is ALREADY BUILT (V7): markers feed a `focal` object
(`x`,`y`,`zoom`,`subjectId`). This section wires it to the multi flow + pricing.

**MECHANISM (confirmed in the generate route):** `focal {x,y,zoom}` server-crops the
source to a 3:4 region around the picked point BEFORE render + QA. So "pick one person"
= crop to that person, then render normally. QA scores likeness against the cropped face.
subjectId is logged only; crop geometry comes from x/y/zoom.

**SINGLE-TARGET: PROVEN (2026-07-10).** `test-targeting.mjs` on a 3-person source with
left/center/right crops returned three different, correct people — target-left → left
person, center → center, right → right. The engine honors the subject pick; the picker→
engine link works. Solo-from-group is gated by the existing single-face scorer.

**MULTI-SUBSET: NOT BUILT (gap).** The focal crop is ONE 3:4 rectangle. Selecting *all*
detected 2–3 works (crop wide / no crop → render everyone). Selecting a *subset* of a
larger group ("these 2 of 4") is NOT expressible through the current focal unless the
chosen faces happen to sit adjacent. Needs one of:
- a wider bounding crop computed from the selected faces' combined bbox (geometric), or
- subjectId-list plumbing that tells the engine which detected faces to keep (identity).
Decide the mechanism before wiring subset selection. For launch, "craft all 2–3 detected"
is sufficient and works today; subset-of-a-group can be a fast-follow.

Flow (from the analyze route's detected faces):
1. Analyze returns per-face markers (already does — `faces[]` with bbox + gate).
2. Picker shows a tappable marker per face. User selects 1, 2, or 3.
3. **Live per-person price under the picker** updates as they select (see §5).
4. Curator voice reflects headcount: "I see N people — craft one, some, or all?"

Routing on selection:
- **1 selected** → solo path (existing). `subject_mode` unset.
- **2–3 selected** → multi. Emit `subject_mode: 'multi'`, `subject_count: N`,
  targeted `subjectId`s, `skip_redirect: true`.
- **4+ detected** → "That's a Group" fork: primary CTA links to Groups; secondary
  "craft any 3 here" lets them narrow to ≤3 in Portraits. (The redirect's `stayLabel`
  path — now real, not just a test flag.)

Fence note: the picker's multi outcome is the ONLY place `subject_mode: 'multi'`
originates in the product. Nothing else sends it.

---

## 5. PRICING

Model: **base × flat per-person adder**, priced on **crafted** (selected) count.

- 1 person: **$4.99** (base)
- 2 people: **$6.49** (+$1.50)
- 3 people: **$7.99** (+$1.50 each)

Formula: `price = 4.99 + (max(0, craftedCount − 1) × 1.50)`

Display:
- **Live price under the subject picker** — the decision moment. Updates on selection.
- Flows UNCHANGED into To Be Crafted and Pay (same number, no recalculation downstream).
- Plain display — NO "founding price / rising soon" messaging (holding $4.99 as a
  stable test-bench number; revisit ~2 weeks post-launch on real conversion data).
- Priced on selected count, not photo count: upload 3, craft 2 → charged for 2.

No pricing logic in the engine — this is commerce/UI. Engine just renders N subjects.

---

## 6. SCORER BRANCH (the ship-gate quality guard)

Today multi renders but only single-face scores (informational). Before customer-facing,
wire real per-figure scoring so weak-likeness renders fail BEFORE the customer sees them.

Copy from Groups into `portraits-refine.ts` (COPY, don't cross-import — keeps silos
decoupled per the subject-IS-the-piece architecture):
- `scorePerFigureFidelity({ sourceImageB64, renderedImageB64, openaiApiKey, expectedSubjectCount }) → PerFigureScore[]`
- `evaluateGroupScores(scores) → { passed, reason }`
- `PER_FIGURE_SCORE_PROMPT`

Then in `portraits-generator.ts`, add the third scoring branch:

```ts
} else if (pipeline.scoringMode === 'per_figure_likeness') {
  perFigureScores = await scorePerFigureFidelity({
    sourceImageB64:   req.source_image_b64,
    renderedImageB64: imageB64,
    openaiApiKey:     input.openaiApiKey,
    expectedSubjectCount: req.subject_count,
  })
  const result = evaluateGroupScores(perFigureScores)
  evalPassed = result.passed
  evalReason = result.reason
  lastFacesRender = perFigureScores.length   // N, not hardcoded 1
}
```

- Select `scoringMode: 'per_figure_likeness'` whenever `subject_mode === 'multi'`.
- `per_figure_scores` result field already declared as an array — fill it with N.
- FREE BONUS: Groups' eval enforces headcount — `expectedSubjectCount=2` fails a render
  with 3 figures. Catches NB2 hallucinating an extra person (a real multi failure mode).
- Threshold: start at the Groups default; tune after the QA gate (§9).

---

## 7. WATCH-ITEMS FROM THE PILOT (bake into QA, not blockers)

- **Facial identity is soft** ("plausibly them," not forensic). The §6 scorer is the
  automated catch. Set threshold conservative for launch, loosen on data.
- **Age drift up** — teens render slightly older, esp. bronze. Note for effect tuning.
- **Hands** — Bust-Multi avoids them by design (§3); Signature/Statuesque resolve them.
- **Walnut grain** fights fine facial likeness — same as solo, not multi-specific.

---

## 8. FENCE-REMOVAL ORDER (non-destructive turn-on, AFTER solo ships)

Do in this order so multi never destabilizes the shipped solo path:

1. **Solo spine shipped & stable** — prerequisite. Do not start before this.
2. Promote `subject_mode` / `subject_count` to first-class in `portraits-shared.ts` (§2).
3. Copy + wire the per-figure scorer (§6). Keep it behind `subject_mode === 'multi'`.
4. Drop in Bust-Multi + Statuesque-Multi blocks when Rich delivers (§3). Signature-Multi
   works meanwhile.
5. Wire the subject picker → multi flow + live pricing (§4, §5).
6. Run the QA gate (§9). Do NOT expose multi in the UI until it passes.
7. Flip multi visible in S1 (the picker's 2–3 selection becomes live).

At every step: solo path untouched. If any step regresses solo, stop — that's the signal
something crossed the fence that shouldn't have.

---

## 9. QA GATE (before customer-facing)

Re-run the pilot harness (`run-multiface-pilot.mjs`) with the scorer LIVE:
- 10 sources × effect matrix, all three framings once Bust/Statuesque land.
- Roll up pass-rate by headcount × effect × framing (people_count is in the manifest).
- Gate: multi goes customer-visible only when pass-rate at the launch threshold is
  acceptable to Rich. Weak effect×headcount combos can be withheld per-effect rather
  than blocking the whole feature.

---

## 10. OUT OF SCOPE / LATER

- Per-figure refine (Pass 2 per face) — not needed for launch.
- Groups adapter / face-swap bench — separate track.
- Pricing above 3 people — Portraits caps at 3; 4+ is Groups.

---

## SUMMARY — what's needed to ship multi

| Piece | State |
|---|---|
| Flag threading (route→gen→prompt) | Built; promote to shared.ts |
| Signature-Multi composition | DONE, validated |
| Bust-Multi + Statuesque-Multi | **Rich authors** (§3) |
| Per-figure scorer | Copy from Groups (§6) |
| Single-target (pick one from group) | PROVEN — engine honors focal crop (§4) |
| Subject picker → multi wiring | Front-end built; wire to flow (§4) |
| Multi-subset targeting (2 of 4) | NOT built — mechanism TBD (§4) |
| Pricing $4.99/$6.49/$7.99 | Locked; wire live display (§5) |
| Redirect "craft here anyway" | Make real in UI (§4) |
| QA gate | Re-run pilot w/ scorer (§9) |

Everything is specified except the two composition blocks. Fill those, run the order
in §8 after solo ships, and multi fires out of the cannon.
