# CARRYOVER — CUI V23 → V24

**2026-07-31.** Read `docs/GOVERNANCE/` first, then
`docs/GOVERNANCE/LAUNCH-BOARD-2026-07-31.md`, then this.

**Six days to Aug 7.**

---

## 1 · THE LINE

`public/litenco-stage-2026-07-30-s72.html` — accepted, committed.
`public/portraits-b2.html` — the engine. 8,876 lines, 202 functions, 10 route
calls, and **still the only file that completes a craft.**

They have never met. Build 1 is the merge and it has not started.

s70 and s71 exist in `outputs` but never landed in `public/`; s72 supersedes
both. b1 and b4 are archived, b2 is not — it is the donor.

---

## 2 · WHAT LANDED TODAY

| | |
|---|---|
| s70 | effect registry migration — three hand-kept globals gone, everything keyed on ids not labels, silo floor rendered from `R.silos` |
| s71 | clicking the Curator returns to the workshop; Back moved left; masthead link toggles |
| s72 | three onward cards at the foot of My Collection — Recommends, Print Shop, Wallpapers |
| — | five credit blocks ruled: 10/30/60/120/300, 60 recommended, ladder fenced to purchase |
| — | five Stripe test products created, prices verified |
| `011_credit_skus.sql` | widens `skus.kind`, adds `grant_credits` (idempotent by ref_id), seeds the blocks |
| `credits/purchase/route.ts` | written |
| `confirmPurchase` | patched to land credits |

**All committed. None of the money path has been run.**

---

## 3 · WHERE BUILD 1 STOPPED

`scripts/build_1a_strip.py` — strips b2 of certainly-dead functions. **Gate
failing, nothing written.** Three faults, all real:

**Over-excision.** 202 → 171 having removed 23; expected 179. Eight functions
lost. The first cutter counted braces and was defeated by a `//` comment
containing one — it removed 78. The second anchors on indentation and is
closer but still wrong, because a nested block whose closing brace sits at the
function's indent ends the cut early.

**Five functions not found** — `tourPromptNo`, `tourPromptYes`,
`tourRevealRegions`, `_tourReposition`, `addCuratorQueueIcon`. Not at
top-level indent, so nested or declared as expressions.

**Eight orphan calls survive**, all in markup — `onclick="startTour()"`,
`onchange="handleRawRefUpload(this)"` and so on. A removed function with a
live call is a runtime error waiting for a click. The markup has to be cut in
the same pass.

**What I would do differently:** stop cutting text. Parse the script block,
walk the function declarations, and rebuild it from the ones that survive.
Regex and brace-counting have now failed twice on the same file.

---

## 4 · WHAT MUST NOT BE CUT

**`qaAccept`, `qaRefund`, `qaRerender`.** Named as QA and are not. They set
`user_decision` on a queue item, and `qaRerender` carries:

```js
if ((original.rerender_count || 0) >= 1) return
```

which is the one-gate-re-render-per-piece rule Rich ruled 7/29. Cutting "the
QA panel" wholesale deletes a policy.

**Anything that fills the payload.** `/generate` reads from queue-item fields:
`source_image_b64, additional_images_b64, style_id, preset, location, scale,
aspect_ratio, resolution, plaque_text?`. Several functions on the cut list
write state that reaches those items. Check each against the payload before
removing it — that is why 1a took only the certainly-dead set.

---

## 5 · ROUTES

Ten in b2. **Seven survive.**

| | | |
|---|---|---|
| `/portraits/gate` | 5294 | carries |
| `/qa/settings` | 5343 | **cut** with the strictness sliders |
| `/qa/settings` | 5379 | **cut** |
| `/portraits/analyze` | 6602 | carries |
| `/checkout` | 7067 | moves to the purchase screen |
| `/portraits/curate-effects` | 7243 | carries |
| `/credits/gate` | 8368 | carries |
| `/portraits/raw-pipeline` | 8533 | **cut** with raw mode |
| `/portraits/generate` | 8567 | carries |
| `/portraits/generate` | 8652 | carries |

The gate asserts 7 from build 1 onward.

---

## 6 · FACTS ESTABLISHED TODAY, WORTH NOT REDISCOVERING

**Portraits already renders 1:1.** `DEFAULT_FRAMING = 'signature'`,
`ASPECT_FOR_FRAMING.signature = '1:1'`, and b2 sends no `framing`. The route
**ignores `body.aspect_ratio` entirely** — framing derives it. Hardcoding
aspect on the client does nothing.

**Framing is already dead on the wire.** No `framing` field in the surviving
payload. It only labels a queue row.

**`isExperimentalEffect` IS wired**, route line 156. The twelve Curiosities
400 because the client never sends `experimental_effect`, not because the
door is missing.

**Nothing stores the likeness score.** Computed at craft, discarded. Concierge
§4.1 depends on it.

**`RHONE3166` may be broken after all.** 009 grants
`coalesce(credits_granted, null)` = zero, and `spend_credits` has no admin
path. The 7/28 carryover concluded the bug might not exist; on 009 as written
it does. **010 not read — verify.**

**Intake states 1–4 are post-craft**, not pre-craft as `BUILD-INVENTORY` §2.7
says. State 4 still quotes `$9.99` and card refunds — wrong under credits,
CENG's to rewrite.

---

## 7 · THE GATE, AND WHY IT KEEPS GROWING

Every build boots the output in jsdom and proves it is **alive**, not merely
quiet — a file that throws on line 1 is silent too. It asserts the button
was labelled, eight silo cards rendered, three faces exist, `window.POSES`
is reachable.

Added because they were needed:

- **jsdom boot** — s63 passed every syntax check and shipped inert
- **TDZ position** — a constant declared below the caller that runs at init.
  Three separate builds. `var` hoists the name, never the value.
- **comment stripping** — two gates flagged the comment explaining their own
  fix
- **radius bands** — card curve, pill, or circle; never the middle
- **banned vocabulary** — caught `sculpt` in a Curator line I wrote, four
  accepted revisions old

**Today it caught its own build script over-excising by 78 functions.** That
is the one worth remembering.

---

## 8 · FIRST FIVE MINUTES

```powershell
cd D:\minramas
git status --short
node scripts\boot.js
```

Then read `LAUNCH-BOARD-2026-07-31.md` §6 — the three items that would hurt
most. Two of them are unrun code sitting in the repo right now:

- **the fulfilment flag does not exist** — a tester places a real, billable
  Prodigi order
- **`confirmPurchase` is patched but never run** — until it is, a customer
  pays for credits and receives nothing

Then build 1, and rewrite the stripper before touching it.
