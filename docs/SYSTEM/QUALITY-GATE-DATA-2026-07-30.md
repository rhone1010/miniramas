# QUALITY GATE — what is measured today

**2026-07-30 · CUI V23.** Every threshold, score and gate in the intake and
output path, read this day from live source. Written because the gating "needs
real testing again and needs to be locked down" before soft launch, and that
cannot start until it is clear what is currently measured, what is thrown away,
and what is measured but never used.

**Where a value here disagrees with the code, the code is right and this
document is corrected the same day.**

---

## 1 · THE SHORT VERSION

The system measures more than it keeps and keeps less than it needs.

- Intake produces four signals; the glass uses three.
- Output produces a likeness score; **nothing stores it.**
- Two strictness sliders exist and post to a route; **the route can never
  authenticate** (§5).
- One assessment function is written, wired to nothing, and protected by a
  spec ruling (§3.3).

---

## 2 · THE SCALES

### 2.1 Output — likeness

`public/effect-registry.js` consumers and `portraits-catalogue.js`:

| Constant | Value | Meaning |
|---|---|---|
| `PASS_SINGLE` | **8** | single face, must reach 8 of 10 |
| `PASS_RELAXED` | **7** | multi-face, or a subject outside the top 70% |
| `TOP_RATIO` | **0.70** | the size band that decides which bar applies |

**The scale is 0–10.** Rich has referred to it as 80–100 (§ Concierge spec).
An 81 there is an 8.1 here. One scale has to win, and if it becomes 0–100 the
three constants above move with it.

**Observed:** the one confirmed end-to-end render scored **9/10**, 26 seconds,
NB2. That is the only real data point recorded anywhere.

### 2.2 Intake — the photograph

The analyze route returns, per `LOCKED-DECISIONS` correction to
`CURATOR-FLOW-v1` §3.3:

| Signal | Used by |
|---|---|
| `body_coverage` | face-size warning, intake state 5 |
| `sharpness` | intake state 6 |
| `lighting` | intake state 7 |
| `description` | the Curator's reaction to the photograph |

**Head orientation is the only thing missing.** The spec's claim that the
analyze gap is wider is overstated and was corrected in LOCKED-DECISIONS.

---

## 3 · WHAT THE GLASS DOES WITH IT

### 3.1 The four intake states — pre-craft

Built in s72, reachable via `__openIntake(5..8)`:

| State | Condition | Escape offered |
|---|---|---|
| 5 | face sits too small | **Use this one anyway** |
| 6 | photograph is soft | none — must choose sharper |
| 7 | photograph is dark | **Use this one anyway** |
| 8 | cannot be used at all | none |

⚠ **The thresholds behind these are not written down anywhere.** Which
`body_coverage` value fires state 5, which `sharpness` fires 6, which
`lighting` fires 7 — none of it is in a document, and 5 and 7 let the customer
override while 6 and 8 do not. Whether that asymmetry was decided or emerged
is unknown. **This is the first thing testing has to establish.**

### 3.2 The four failure states — post-craft

Also built in s72, `__openIntake(1..4)`. Corrects `BUILD-INVENTORY` §2.7,
which says the modals are pre-craft only:

| State | Meaning | Spends a re-render? |
|---|---|---|
| 1 | studio stumbled, crafting again | gate's own — **not the customer's** |
| 2 | did not hold, photograph at fault | offers clearer photo, or refund |
| 3 | studio at capacity | neither — deferred, email offered |
| 4 | could not be made well, refunded | terminal |

### 3.3 What b2 measures and discards

| Function | State |
|---|---|
| `assessResolution` (b2:4810) | **called nowhere.** Dead. |
| `applyFaceSizeWarning` | live |
| `applyDistinctnessAdvisory` | live |
| `localPhotoCheck` / `applyLocalPhotoFlags` | live, client-side pre-check |
| `precheckSourceGate` / `buildSourceFindings` | live |

⚠ `PORTRAITS-SPEC` §9.3 rules that **resolution assessment carries**. It is
protecting a function that does not run. Either wire it or drop the ruling.

---

## 4 · WHAT IS NOT STORED — the blocking gap

**The likeness score is computed at craft time and thrown away.**

Nothing on the piece record holds it. Which means:

- Concierge cannot tell a piece that scored 8.1 from one that scored 9.6, and
  §4.1 of the Concierge spec depends entirely on that distinction.
- No one can ever answer "are our thresholds right" after the fact, because
  there is no distribution to look at.
- A customer dispute cannot be checked against what the studio itself thought
  of the piece.

**Add `likeness_score numeric` to the piece record**, in the same migration as
`focal_x` / `focal_y` / `subject_regions` — see
`FOCAL-POINT-AND-SUBJECT-REGIONS-2026-07-29.md`. Three columns become four and
the migration is written once.

Store the raw score, not the pass/fail. The bar can move; the measurement
should not have to be recomputed when it does.

**Also worth storing and currently discarded:** which bar was applied
(`PASS_SINGLE` or `PASS_RELAXED`), because a 7.4 is a pass under one and a
fail under the other, and a year from now nobody will remember which ran.

---

## 5 · THE STRICTNESS CONTROLS

b2 carries two sliders — `source_strictness` and `render_strictness` — saved
by `saveQaSettings()` to `/api/v1/qa/settings?silo=portraits`.

**They can never have worked.** `LOCKED-DECISIONS` bug 1: `qa-override.ts`
reads `LITEN_INTERNAL_TOKEN`; `.env.local` defines `LITEN_INTERNAL_KEY`. The
header path cannot authenticate.

So any tuning done through that panel did nothing, and any conclusion drawn
from it is unsafe. **Ruled 2026-07-30: cut.** The panel goes; the retuning
happens against real renders after launch.

**Do not cut `qaAccept` / `qaRefund` / `qaRerender` with it.** Those set
`user_decision` on a queue item and are product, not bench. `qaRerender`
already enforces one gate re-render per piece:

```js
if ((original.rerender_count || 0) >= 1) return
```

which is exactly the policy ruled 2026-07-29. Misnamed, load-bearing.

---

## 6 · WHAT TESTING HAS TO ESTABLISH

In order, and none of it needs the wiring finished:

1. **The scale.** 0–10 or 0–100. Everything else waits on this.
2. **The four intake thresholds**, as numbers, with the reason 5 and 7 allow an
   override and 6 and 8 do not.
3. **The distribution.** Twenty to thirty renders across the live silos, score
   recorded by hand if the column is not in yet. Without a distribution, 8 is
   a guess.
4. **Whether `PASS_RELAXED` is still needed.** It exists for multi-face, and
   Groups is the only multi-face Series at launch.
5. **What a re-render actually recovers.** If a piece scoring 7.6 re-renders to
   7.7, the gate re-render is costing money and buying nothing. If it recovers
   to 8.8, it is the best thing in the product. Nobody knows which.

**Point 5 is the one worth doing first.** It is the cheapest to measure, it
decides whether the one-free-re-render policy is generous or pointless, and it
is the only one that changes what the studio spends per piece.

---

## 7 · DATA HELD TODAY

| Question | Answer |
|---|---|
| Renders scored and recorded | **1** (9/10) |
| Threshold distribution | none |
| Intake threshold values | not written down |
| Re-render recovery data | none |
| Scores persisted | **none** |

That is the whole of it. Everything above §7 is machinery; this is the
evidence, and there is almost none.
