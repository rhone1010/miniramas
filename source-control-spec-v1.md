# Source Control + Curator State Machine — Spec v1 (2026-06-24)

**Target:** `D:\minramas\portraits.html` (Curator spine) + `lib/v1/portraits/` + `/api/v1/portraits/`
**Depends on:** existing analyze pipeline (face detection already runs), Gate 0/Gate 1 intake QA, per-render QA scoring (`qa_log`)
**Replaces:** the hard square crop + blind `object-position: center 28%` on the Curator source image

This spec covers one feature with two faces: a **face-aware source image control** (no pre-crop, draggable focal point, multi-person subject pick) and the **Curator state machine** it drives.

---

## 1. Source image container — kill the pre-crop

### Current (v7)
Incoming source is cropped to fit the side rail, then displayed at `object-position: center 28%`. Two problems: it discards image the customer might need for subject selection, and the fixed 28% anchor guesses wrong on anything that isn't a centered single face.

### New
- **Do not crop the incoming source.** Store the full uploaded image. The crop is a *view*, not a destructive edit.
- Display container: **fixed 3:4 portrait** (`aspect-ratio: 3/4`), `object-fit: cover`. Rationale: 3:4 matches Statuesque and native phone-portrait, so the typical upload barely crops; the container height stays fixed so the five-spine column doesn't reflow.
- **No layout branch for landscape uploads.** A wide photo into the same 3:4 cover container, anchored on the face, still frames the subject. A variable-height container would destabilize the column — don't do it. The focal point does the work, not the container.

### Focal point model
The displayed crop is governed by a single persisted object:

```
focal = {
  x: 0..1,        // normalized horizontal center of the crop
  y: 0..1,        // normalized vertical center
  zoom: 1.0..3.0, // 1.0 = cover-fit baseline
  subjectId: string | null   // which detected face this frame is locked to
}
```

Rendered as CSS: translate the image so `(x, y)` sits at container center, scaled by `zoom`, clamped so edges never reveal background.

---

## 2. Face-aware default

On analyze return, the pipeline already provides face locations. Use them to seed `focal`:

- **One face:** center `focal` on that face's bounding box, `zoom` set so the face fills ~45–55% of the 3:4 frame height (tuneable — `--source-face-fill`). Replaces the blind 28%.
- **Multiple faces:** seed `focal` on the **largest** face (best likeness candidate by face-size-as-drift-driver), set `subjectId` to it, and **raise the Curator elicitation state** (§5) so the customer can confirm or switch.
- **No face cleared by Gate 0/1:** do not seed; **raise the Curator intake/alert state** (§5).

Analyze must return, per detected face:

```
faces: [
  {
    id: string,
    bbox: { x, y, w, h },   // normalized 0..1
    faceFillPct: number,    // face area / image area — drives gate + zoom seed
    gate: "pass" | "small" | "occluded" | "turned"  // Gate 0/1 verdict, per face
  },
  ...
]
```

`faceFillPct` is the dominant drift signal — it gates intake (§4) and seeds zoom.

---

## 3. Draggable / zoom control (manual override)

Sits on top of the container. One gesture fixes a wrong auto-anchor.

- **Drag** (pointer/touch) pans → updates `focal.x/y`.
- **Scroll wheel / pinch** zooms → updates `focal.zoom`, clamp 1.0–3.0.
- Clamp pan so the image always covers the container (no background bleed).
- Persist `focal` on the piece. **Every render reads this `focal`** — what the customer frames is what gets crafted, not a separate guess.
- Subtle affordance only when interactive: a thin focal reticle on first hover/touch, fades after first interaction. **Do not** add a tiny "edit" micro-link — the whole image is the control. (Recurring rule: no thin/undersized controls.)

### Multi-person: the control IS subject selection
When `faces.length > 1`, dragging the frame onto a face **sets `focal.subjectId`** to the nearest face. This is not cosmetic:

- `focal.subjectId` feeds the **generator subject-pick** (the subject-redirect contract), not just the preview.
- Switching subject re-runs the Curator confidence read (§5) for the newly chosen face.
- In **couple mode** (1–2 subjects in Portraits, if that scope is adopted), the control supports a **two-subject frame**: both faces inside the crop, `subjectId` becomes `subjectIds: [a, b]`, and the generator receives both for paired composition. UI: a "both" toggle in the Curator elicitation state flips between single-subject and pair framing.

---

## 4. Intake gating (per-person)

Before any render spend, both/all chosen subjects must clear the face-size floor.

- Gate runs **per face** on `faceFillPct` against the floor (`--gate-face-floor`, current single-subject value reused).
- Single subject below floor → intake/alert state, render blocked until resolved.
- Multi subject, one below floor → intake/alert state names the weak person specifically; offer added-photo drop target for *that* person.
- This is the lever that holds the multi-person retry tax down (see cost note). Stricter, per-person, *before* spend.

---

## 5. Curator state machine

One card, one state machine. The source control lives inside states A and B. Sequence:

```
source lands
  → A. INTAKE/ALERT      (if any chosen subject fails Gate 0/1)
  → B. ELICITATION       (if ambiguous: multi-face, dim, focus unclear)
  → C. PRICING           (if subjects > 1, i.e. couple/multi tier)
  → on Craft → D. CONFIDENCE  (per-person QA read)
  → settles into PRESENTATION (the v7 voiced-treatment body — unchanged)
```

States are not separate UIs — they're content modes on the existing deckled card, in Curator voice. Each maps to existing infra:

### A. Intake / Alert — fed by Gate 0/1
- Voices the rejection instead of a cold error band.
- Names the specific problem face: occluded, turned, too small.
- Renders a **drop target** for an additional/replacement photo of the named person.
- Example voice: *"The second face is turned away from the camera — a clearer photo of [person] would let me hold the likeness. Add one here?"*

### B. Elicitation — multiple-choice, prompted answers
- Same pattern as direction questions: 2–4 mutually exclusive options, in Curator voice.
- Triggers: multi-face ("focus on one, or both?"), low light ("render warm, or true to source?"), framing ambiguity.
- The chosen answer writes back to `focal` (subject pick) and/or the prompt params (warmth, etc.).
- Example: *"I see two people. Shall I focus the portrait on one of you, or craft you both together?"* → [ Just [name] · Just [other] · Both together ]

### C. Pricing — per-person tier
- Surfaces the added-subject cost in-voice, not as a cold upsell band.
- Tied to the multi-subject price tier (per-person delta).
- Example: *"A second subject adds $X — I'll prepare you both. Shall I?"*

### D. Confidence — per-person honesty from QA score
- Reads the **per-person** QA score (not blended).
- Surfaces honest, differentiated confidence — this is the answer to "one person may be close."
- Example (both strong): *"I'm confident in both — each above 90%."*
- Example (split): *"[A] will be excellent. [B] I can get close — a sharper photo would lift it. Proceed, or add a photo first?"*
- The split case offers a branch back to State A (add photo) or forward (proceed as-is).

### Payload additions
Curator output contract gains a `state` field and per-state payloads alongside the existing `voiced_text`:

```
curator: {
  state: "intake" | "elicitation" | "pricing" | "confidence" | "presentation",
  voiced_text: "...",            // existing, with tint span markers
  alert?: { face_id, reason, drop_target: true },
  elicitation?: { prompt, options: [{ id, label, writes: {...} }] },
  pricing?: { added_subjects: n, delta_cents: n },
  confidence?: [ { subject_id, score, verdict: "excellent"|"close" } ]
}
```

---

## 6. Data flow summary

```
upload → analyze (faces[] + faceFillPct + per-face gate)
       → seed focal (largest face) + subjectId
       → per-person intake gate
            fail → Curator state A
            ambiguous → Curator state B
       → customer drags/zooms → focal updated → subjectId/subjectIds set
       → if multi → Curator state C (pricing)
       → Craft: focal (+ subjectIds) → generator subject-pick
       → render → per-person QA → Curator state D (confidence)
       → settle → presentation (v7 body)
```

`focal` is the single source of truth for both the displayed crop and the generated subject. The customer never sees two different crops.

---

## 7. Open items for Rich

- **Couple scope decision** (1–2 in Portraits vs clean 1=Portraits / 2+=Groups) gates whether `subjectIds` pair-mode and the couple verbatim blocks are in scope. Spec supports both; the pair path is dormant until you decide.
- **`--source-face-fill`** default (face % of 3:4 frame) — start ~50%, tune on real uploads.
- **Per-person price delta** — value for State C.
- **Confidence thresholds** — where "excellent" vs "close" splits, from `qa_log` baselines.
- **Tint-span emission** for voiced_text across the new states — inline HTML vs `tint_spans` array (still unpinned from v7 carryover; worth locking before VS picks this up).
