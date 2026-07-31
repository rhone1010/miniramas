# LAUNCH BOARD — Aug 7

**Opened 2026-07-31 by CUI V23. Maintained by CHK.**
**Seven days.**

One place where "what is left" has one answer. Every item carries a lane and a
state. Rich rules; CHK marks.

States: **BLOCKED** (waiting on a ruling or another item) · **OPEN** (ready,
nobody on it) · **WIP** · **DONE**

Lanes: **RICH** · **CUI** (glass and wiring) · **CENG** (prompts, voice) ·
**CHK** (documents, archive, hygiene)

> **Rule for this document:** an item is only DONE when the thing works, not
> when it is written. "Built but never clicked" is WIP.

---

## 1 · BLOCKS LAUNCH

Nothing ships without these.

| # | Item | Lane | State | Note |
|---|---|---|---|---|
| 1.1 | **The wiring** — s72 + b2 → `portraits.html` | CUI | OPEN | five builds, agreed. Nothing is wired today: s72 has 0 route calls, b2 has 7 that survive. |
| 1.2 | **Entry gate** | CUI | BLOCKED | sign-in at craft, magic link, no password. Blocked on 1.1 build 5. |
| 1.3 | **Purchase reveal + page** | CUI | OPEN | reveal expands in place when the gate finds a shortfall; page is the deliberate route. Migration and route are written and unrun. |
| 1.4 | **Per-account fulfilment flag** | CUI | OPEN | testers false, customers true. **Without it a tester places a real billable Prodigi order.** Password-gating the Print Shop is not the same protection. |
| 1.5 | **Prodigi wholesale cost** | RICH | BLOCKED | four SKUs. The only physical cost in the business and it appears in no document. Margin on print is currently unknown. |
| 1.6 | **Tax** | RICH | OPEN | California, selling nationally. Stripe Tax exists but nobody has switched it on. Changes checkout. |
| 1.7 | **Silo art** — `living_world`, `handmade` | RICH | WIP | `another_age` done. Cards show broken images until these land. |
| 1.8 | **Pose images** — six at `/previews/pose/` | RICH | WIP | five present. Keep My Pose is an icon card and needs no file. |
| 1.9 | **Effect prompts** | CENG | WIP | 29 of 36 live. Seven have no body: `cast_glass`, `frost_ice`, `volumetric_light`, `fire_ember`, `living_reef`, `atomic_robot`, `cosmic_bloom`. `living_world` is 0 live and its room will not open. |
| 1.10 | **Print Shop UI + wiring** | CUI | OPEN | r28 harvested. Prices already correct. Blocked in practice on 1.5. |
| 1.11 | **Account page** | CUI | OPEN | design exists at `docs/SURFACES/account/`, unread. Credits balance shows large here. |
| 1.12 | **Concierge** | — | BLOCKED | spec written. Blocked on 3.1 and 3.2. |
| 1.13 | **Migration 011 + purchase route + confirmPurchase patch** | RICH | OPEN | written 7/31, unrun. **Until the patch is applied a credit purchase is charged and nothing reaches the ledger.** |

---

## 2 · WORKS BUT UNPROVEN

Built, gated, never exercised against a running system.

| # | Item | Lane | State | Note |
|---|---|---|---|---|
| 2.1 | Credits routes — gate, refund, balance | RICH | WIP | committed 7/29, never verified live. Craft one image; ledger should read −10. |
| 2.2 | `RHONE3166` | RICH | BLOCKED | 009 grants `coalesce(credits_granted, 0)` = **zero**, and `spend_credits` has no admin path. Admin may redeem and then be unable to craft. **010 may have fixed it — verify before acting.** |
| 2.3 | Ledger write outside `spend_credits` | RICH | BLOCKED | balance moves in the function, the route writes the ledger separately. Has already diverged once on the test account. Ruling needed: does the write move inside? |
| 2.4 | `credits/redeem` guest path | CUI | OPEN | last route still carrying guest. Never read. |
| 2.5 | Quality gate thresholds | RICH | OPEN | see `QUALITY-GATE-DATA-2026-07-30.md`. One recorded render. No distribution. Intake thresholds written nowhere. |

---

## 3 · DECISIONS OUTSTANDING

Each blocks something. Ordered by what it unblocks.

| # | Question | Blocks |
|---|---|---|
| 3.1 | **Likeness scale — 0–10 or 0–100?** Code is 0–10 (`PASS_SINGLE = 8`). Rich has used 80–100. | Concierge, the gate retune |
| 3.2 | **Post-delivery dispute vs the two-per-account cap.** The r02 note says re-craft free; the 7/29 ruling says two then gone. They disagree. | Concierge disputes |
| 3.3 | **Does Concierge refund money or credits?** $50 authority is money; everything else in the system is credits. | Concierge, and whether it touches Stripe |
| 3.4 | **Does the ledger write move inside `spend_credits`?** | 2.3 |
| 3.5 | **`likeness_score` on the piece record** — join the focal-point migration? | Concierge §4.1 |
| 3.6 | **Homepage.** Never discussed. Does Aug 7 have one? | unknown scope |
| 3.7 | **Curator copy authorship.** CUI has written pose lines and rail copy. PROCEDURES §2 says CENG owns the voice. | CENG's queue |

---

## 4 · QUEUED, NOT BLOCKING

| # | Item | Lane | State |
|---|---|---|---|
| 4.1 | Archive superseded stage files, b1, b4 | CHK | WIP |
| 4.2 | Four stale document corrections | CHK | WIP |
| 4.3 | Purge `.ts` from project knowledge, after harvesting | CHK | OPEN |
| 4.4 | Archive `portraits-catalogue.js` once the stage carries its economics | CHK | BLOCKED on 1.3 |
| 4.5 | Dead commerce tree — `/store`, `lib/bundles`, `BundleForm.tsx` | CHK | OPEN — map the import graph, do not move |
| 4.6 | Carryovers are not in git | CHK | OPEN |
| 4.7 | `CLAUDE.md` and `README.md` dated 18 March | RICH | OPEN |
| 4.8 | `tsc` baseline 53 | CHK | tracking |
| 4.9 | Stripe test keys — two CLI keys exposed 7/31 | RICH | revoke |
| 4.10 | `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` still `your_str` | RICH | OPEN |

---

## 5 · AFTER AUG 7

Named so nobody mistakes them for launch scope.

Sets and reward tracking · Artist Series and For Fun silos · Houses and
Landscapes · the twelve experimental effects behind `isExperimentalEffect` ·
per-effect art (cards reuse silo images) · the Curator's name question ·
retention job · `subject_regions` consumers · Gallery Canvas if `GLOBAL-CAN`
is found · the eighth silo's name

---

## 6 · THE THREE THAT WOULD HURT MOST

Not the longest, the most dangerous.

**1.4 — the fulfilment flag.** A tester with granted credits places a real,
billable Prodigi order. It costs money and it is invisible until the invoice.

**1.13 — the confirmPurchase patch.** Until it is applied, a customer pays for
credits and receives nothing. Charged, no goods, no error.

**1.5 — Prodigi cost.** You are selling prints at a price nobody has checked
against what they cost. It might be fine. Nobody knows.

---

## 7 · HOW THIS STAYS TRUE

CHK updates it when a state changes, and only when the thing works — not when
it is written. Anyone who finds something missing says so and CHK adds it.

If this document and reality disagree, reality wins and this is corrected the
same day. Same rule as everything else here.
