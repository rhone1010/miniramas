# BUILD INVENTORY — what exists, what is only ruled

**2026-07-28 · CUI V22.** Read against `public/litenco-stage-2026-07-28-s58.html`
this day, not recalled.

This document exists because the governance set describes **decisions**, and a
reader can reasonably mistake a ruling for an implementation. Several of the
most-discussed features — the pose step, the entry gate, the name question —
are ruled in detail and exist nowhere in the file.

Three states only:

| | |
|---|---|
| **BUILT** | in s58, working, judged on the glass |
| **RULED** | decided, specified, **not written** |
| **OPEN** | undecided |

---

## 1 · BUILT — in s58 today

**Geometry and chrome**
- Stage contract: `body` a block, 16px type floor, 90% stage with 100px gutter
  cap, ground fixed edge to edge. Gated by `scripts/gate-stage.js`.
- Four responsive bands: ≥1921 · ≤1920 · ≤1599 · ≤1366.
- Masthead, 76–90px by band, with the series dropdown and the inlined logo mark.
- Four textured surfaces — Curator vellum, footer limestone, queue coffee
  leather, ground limestone. Values in `SURFACE-TOKENS-2026-07-28.md`.

**The floor**
- Eight silo cards, 4+4, on a twelve-then-eight column system.
- Two-sided deck. Choosing a room turns the floor over with a 38ms per-card
  stagger; the breadcrumb returns.
- Effects capped at seven per room, with the upsell in slot eight.
- The upsell reads the queue and always points at ten, escalating through three
  registers.
- Seven effects with no prompt render greyed and unselectable.

**The Curator**
- One panel, four states: empty · photograph in · choosing a room · inside a room.
- Per-silo lines, faded in and out.
- No step dots, no cycle button. Own type scale.

**The queue**
- To Be Crafted rail, global across Series.
- Density tiers: full to 4, medium to 7, compact to 10.
- Craft sits under the last entry. Reads credits only — no percentage, no dollars.
- Caps at ten; the eleventh pick opens a modal with the Curator explaining.

**Modals**
- Eight intake states behind `__openIntake(1..8)`, namespaced so nothing
  collides with the Curator panel.
- They illustrate with the customer's own photograph, not stock examples.

**Diagnostics**
- Collapsible metrics readout: viewport, stage width, gutters, band, card size,
  masthead alignment.

**Routes — committed, not verified against a running system**
- `credits/gate` spends `count × cost_per` and refuses unrenderable presets.
- `credits/refund` atomic and idempotent by `ref_id`.
- `credits/balance` guest removed, returns `owner`.
- `010_credits_v4.sql` applied: tester grants 500, `refund_credits`, ledger
  reason constraint.

---

## 2 · RULED — decided, specified, NOT WRITTEN

**None of the following exists in any file.** Each is fully specified; none has
markup.

### 2.1 Entry gate and identity
`COMMERCE-AND-IDENTITY §4`. Magic link, email as identity, no password.
**Sign-in at craft, not at upload** — the photograph is held client-side until
there is an owner to attach it to.
`litenco-entrygate-2026-07-24-r1.html` is a design, unbuilt.
**Nothing in s58 signs anyone in.**

### 2.2 Marketing consent
Unticked checkbox, separate from the terms, timestamp and wording stored.
**No checkbox exists.**

### 2.3 The Curator asks the name
Deliberately *not* a field on the gate — every field there costs conversion.
The Curator asks once the customer is in: *what should I call you?*
**Not written.** The Curator has four states; this would be a fifth.

### 2.4 The pose step
`CARRYOVER §6`. The Curator asks once, after the photo reaction and before the
rooms:

> Would you like me to reinterpret the pose?
> ○ Keep it as photographed  ○ Give it more presence

The second answer flips the floor to four mood cards — Thoughtful, Dramatic,
Heroic, Playful — then flips again to the rooms.
**Nothing of this exists.** No mood cards, no third floor state, no images at
`/previews/moods/`, no prompt blocks from CENG.

This is the most-discussed unbuilt feature and the easiest to assume is done.

### 2.5 Credit purchase screen
Blocks to 300 credits at 45%. `COMMERCE-AND-IDENTITY §2`.
**The ladder now lives only here — and here does not exist.** Credits cannot be
bought. The only funding path is a studio code.

### 2.6 Retention
12 months for anything crafted, 90 days for an account that never crafted,
emails at 30 and 60 days. **No job, no columns, no timestamps.**

### 2.7 Post-render remedy
The eight modals are **pre-craft only**. There is nothing for *"it came back
and I don't like it."* The mechanism is proposed in `PORTRAITS-SPEC §7.4` and
the threshold is known — 8/10 — but no surface exists.

### 2.8 Per-account fulfilment flag
Testers false, customers true. **Does not exist.** Without it a tester places a
real, billable Prodigi order. Password-gating the Print Shop payment is a
different protection and not a substitute.

---

## 3 · THE BIGGEST THING NOT BUILT

**s58 has zero route calls.** It is glass. b2 has ten and completes a craft in
26 seconds. **They have never met.**

s58 uses classes, not ids — 46 ids against b2's 152, and no reason to think
they correspond. So the mapping is not id-to-id. It is **b2's 203 functions
against s58's elements and states**: which have a home, which need one built,
which are cut.

That document does not exist and nothing can be wired without it.

---

## 4 · OPEN — undecided

1. Does the ledger write move inside `spend_credits`? The balance and the
   ledger can currently disagree, and already have once on the test account.
2. Is `RHONE3166` broken at all? The data is correct; the diagnosis in the V21
   carryover was wrong. Verify by hitting `/api/v1/credits/balance` signed in.
3. `credits/redeem/route.ts` — the last file with a guest path. Not yet read.
4. The eighth silo has no name. `eigth.jpg` is misspelled.
5. Artists Gallery holds eight effects against a cap of seven.
6. `victorian` renders and belongs to no silo. `deep_sea` likewise, and is cut.
7. Per-effect art. Effect cards currently reuse the silo image.

---

## 5 · THE HONEST SUMMARY

The **workshop** is built and looks right at every band.

**Nothing before it and nothing after it exists.** No way in, no way to buy
credits, no way to complain about a result, and no connection between the glass
and the engine that renders.

Twelve days.
