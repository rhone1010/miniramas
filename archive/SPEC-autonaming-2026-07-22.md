# SPEC — Portraits Auto-naming
**CUI → CLAW → CC** · 2026-07-22 · Target: `public/portraits.html`

## Decision
Names are suggested automatically, editable, never blocking. Optional subject-name
field at Frame. No route changes.

---

## 1 · Subject name field (Frame step)

Add one optional text input at the Frame step:

    Who is this?  [____________]   (optional)

- Stored on the source photo, reused for every piece from that photo.
- Blank is valid. Never blocks Continue.
- First word only if the user types a full name (`Daniel Ruiz` → `Daniel`).
- Max 24 chars, trimmed.

State: `state.subjectName` (string, default `''`).

---

## 2 · Default name format

    [Effect] — [FirstName] #[n]        e.g.  Reclaimed Bronze — Daniel #1
    [Effect] #[n]                      when subject name is blank

- `[Effect]` — label for the queue item's `preset` key, via PRES lookup.
  (Artists Gallery items use ARTISTS_PRES; that series is flag-gated off for Aug 1.)
- `[n]` — sequence per source photo, starting at 1, in queue order.
- **No duplicate blocking.** Two pieces may carry identical names. No dedupe,
  no warning, no auto-suffix beyond `#n`.

---

## 3 · Naming step

Intercept `runAll()`. Show naming, then craft.

    To Be Crafted → [Add styles to craft] → NAME → craft

r77's Craft→Name→Pay ordering does **not** apply — the engine has no Pay stage.
Naming ships independent of payment.

Port from `litenco-portraits-2026-07-21-r77.html`:
- markup: `#nameStage` (search `<!-- NAME YOUR PIECES -->`)
- CSS: `/* ===== Name your pieces ===== */`
- JS: `nameRowHtml`, `rerenderNames`, `wireNameRows`, `openNaming`,
  plus `aiName()`, `moderate()`, `esc()`, and the `NAME_A` / `NAME_N` lists

Behavior:
1. Each row pre-fills with its default name (§2).
2. Free-text editable. `input` → write to the queue item; `blur` → `moderate()`.
3. **Suggest** button (`↻ suggest`) rerolls that row via `aiName()`.
4. Continue re-validates, then proceeds to craft.
5. Back returns to To Be Crafted with names retained.

---

## 4 · Moderation

Port `moderate()` unchanged:
- empty → `Untitled portrait`
- banned word → reject, red border, `Please choose a different name`
- clamp 60 chars

Block Continue **only** on a banned word.

---

## 5 · Copy

The r77 subtitle string is corrupted — do not port verbatim. It reads:

    Each has a suggested name I've suggested a name for each — keep it, or make it yours.mdash; edit it, or tap Suggest for another.

Use:

    I've suggested a name for each — keep it, edit it, or tap Suggest for another.

Banned verbs stand: off, save, discount, queue, render. Action verb is **Craft**.

---

## 6 · Persistence

Name flows through the existing `/api/v1/portraits/pieces` POST.
`collection_pieces.label` is **metadata only — never rendered into the image,
never passed into a prompt payload.**

---

## 7 · Do not

- Do not touch any of the 13 `fetch()` calls or their payload shapes
- Do not add price/tier/quality language to this step
- Do not block on duplicate names
- Do not require the subject name field

---

## 8 · Verify

- Frame shows an optional "Who is this?" field; blank passes through
- Naming appears on craft; Back retains names
- Defaults read `[Effect] — [FirstName] #[n]`, or `[Effect] #[n]` when blank
- `#n` restarts at 1 for a new source photo
- Suggest replaces one row only
- Banned word blocks; empty becomes `Untitled portrait`
- Edited names survive refresh (via `/pieces`)
- All 13 route calls fire unchanged
