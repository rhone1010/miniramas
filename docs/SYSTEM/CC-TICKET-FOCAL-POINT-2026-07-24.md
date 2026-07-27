# CC TICKET — Persist a focal point on the piece record

Raised by CUI V21 · 2026-07-24 · approved by Rich
Lane: CC (plumbing). No UI work until the field exists.

## Problem

Every surface that crops a piece guesses where the subject is. Default
`object-position: center` puts the crop box in the middle of the frame, but
these are portrait busts — the subject sits high. Wide crops decapitate them,
tall crops cut the plinth.

Print Shop cart thumbnails were the visible symptom and are now solved by not
cropping at all. The surfaces that must crop remain wrong:

- Print Shop hero — `object-fit: contain` today, but any future fill crop
- Print Shop minimap tiles — 1:1 `cover`
- Print Shop studio preview — 88px `cover`
- My Collection thumbnails
- Workshop queue pills

Client-side face detection is the wrong fix. It costs a model download and a
paint delay on every surface, repeated per visit, to answer a question that
never changes for a given piece.

## Fix

Compute the focal point **once, at craft time**, and store it.

### Schema

Two floats on the piece record, normalised 0–1 relative to the rendered image:

```
focal_x  numeric  default 0.5
focal_y  numeric  default 0.5
```

Nullable is acceptable; absent means centre, which is today's behaviour. No
migration risk — existing rows read as centre and nothing changes for them.

### Source

The portraits analyze route already locates the face. Take the centroid of the
detected region and normalise against the output dimensions. Groups: use the
centroid of the bounding box enclosing all detected faces. Pets: same detector,
same treatment. Action: subject bounding box rather than face. Landscapes and
Houses: leave at 0.5 / 0.5 — there is no subject to track.

Write it on the same pass that produces the render. Do not add a second model
call.

### Consumption

Surface it on whatever payload already carries the piece's image URL. The UI
applies one line:

```
object-position: calc(var(--focal-x) * 100%) calc(var(--focal-y) * 100%);
```

CUI owns that line and the custom properties. CC's job ends at delivering the
two numbers on the piece payload.

## Definition of done

- Columns exist and are populated on new crafts across Portraits, Pets, Groups,
  Action.
- Values are normalised 0–1 and clamped — a focal point outside the frame is a
  bug, not a shrug.
- Existing rows read as 0.5 / 0.5 with no error.
- The piece payload used by Print Shop and My Collection carries both fields.
- No new model call, no measurable added latency on the craft path.
- Browser console clean on boot.

## Out of scope

- Any change to markup or CSS. CUI applies the crop once the data lands.
- Re-analysing historical pieces. Backfill is a separate ticket if it's ever
  wanted; centre is an acceptable default for pieces crafted before this.

---

**Separate, and blocking CC on Print Shop:** `PRINTSHOP-HOOK-CONTRACT-v1` was
published against r11 and has since drifted. New hooks in r24 not yet in the
contract: `.ti-x[data-line-id]` (remove a cart line), `#cartNext` (scroll the
strip), `data-sku` on every `.sz` button, and `CANVAS_ENABLED` as the flag
gating the Gallery Canvas finish. I'll issue a v2 addendum before CC starts
wiring.
