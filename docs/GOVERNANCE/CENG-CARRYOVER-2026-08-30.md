# CENG CARRYOVER — 30 August 2026

Supersedes CENG-CARRYOVER-2026-08-28.md. That doc described the
"Portfolio" era (folio component, continuous pricing) as current — it
was superseded same-session by LITEN_Discovery_Adjustment_Handoff.docx,
and this doc captures what's actually true now, three sessions later.

Read `docs/GOVERNANCE/READ-THIS-FIRST-DISCOVERY-SPEC-HISTORY-2026-08-28.md`
first if you haven't - it explains WHY the model changed. This doc is
just the current state.

---

## 1. THE ACTUAL PRICING MODEL, CONFIRMED

**Fixed sizes, not continuous.** Four purchasable sizes: 1 / 4 / 8 / 16.
Hard cap at 16 even though the catalog is 56 effects. A selection of,
say, 2 or 6 isn't purchasable at all — CUI's UI nudges the user toward
the nearest real size ("add two more, or remove one").

This was RE-CONFIRMED this session after a real crossed-wire: CUI
independently reported hearing "continuous range with tier boundaries"
from Rich in the same conversation where CENG was told "fixed sizes."
Resolved via a concrete test case (what happens at exactly 2 selected —
answer: nothing purchasable, UI nudges to 1 or 4). Worth remembering
this happened once already — confirm numeric/model claims with a
concrete test case, not just a restated table, when two lanes report
different things from the same conversation.

## 2. INCLUDED UNLOCKS PER SIZE — CONFIRMED, WITH A REAL EXCEPTION

- **Size 1: no watermark, straight render, no unlock step at all.**
  Does NOT go through the Portfolio/watermark pipeline. Routes through
  the ORIGINAL single-craft checkout (`POST /api/v1/checkout`,
  `skuId: 'single'`) instead. `PORTFOLIO_SIZES` in
  `portfolio-checkout.ts` no longer includes count:1 — `VALID_COUNTS`
  is `{4, 8, 16}` only, size-1 requests to the portfolios route are
  rejected with `portfolio_invalid_size`.
- Size 4 → 1 included unlock
- Size 8 → 1 included unlock
- Size 16 → 2 included unlocks

## 3. NEW ENDPOINT — UNLOCK STATUS

`GET /api/v1/portfolios/{portfolioId}/unlocks` — new this session.
Returns `includedTotal`, `includedRemaining`, `additionalAvailable`
(entitlements from the user's OTHER purchases, not just this
portfolio), and `items[]` with per-slot `renderStatus`/`previewId`/
`unlocked`. Auth required, owner-checked. Full shape documented in
`docs/GOVERNANCE/CENG_API_REFERENCE.md`.

## 4. ARCHITECTURE — DECIDED

**Separate route, NOT a replacement of portraits.html.** Confirmed by
Rich directly, reversed from an earlier "replaces it entirely" answer
in the same conversation once the actual risk was named out loud (a
live, working product doesn't need to go down for days of testing with
no forcing function). The new Discovery experience stays isolated
(CUI's `/discovery-preview` or wherever it lands) until proven out.
Cutover is a LATER decision, not concurrent with finishing the build.

Practical consequence: CUI does NOT need to port My Collection/Print
Shop/Account/login into the new experience right now — that's cutover
work, explicitly deferred.

## 5. CUI's DATA WIRING STATE, AS OF THEIR LAST SYNC

Everything in `/discovery-preview` is real layout, fake data. All four
real endpoints they need now exist and are documented:
- `GET /api/v1/discovery/catalog` (map + silo boundaries)
- `POST /api/v1/discovery/sessions` + `.../select`
- `POST /api/v1/portfolios` (sizes 4/8/16 only) + `POST
  /api/v1/checkout` with `skuId:'single'` (size 1)
- `GET /api/v1/portfolios/{id}/unlocks` (new, section 3 above)

Full reference: `docs/GOVERNANCE/CENG_API_REFERENCE.md`.

Still stubbed, not CENG's blocker: Curator's actual recommendation
logic (`curator.ts` still throws `curator_not_implemented` on purpose —
copy/voice needs Rich's approval, hasn't been written), "Pick for me"'s
exact question/default behavior (simpler now that sizes are discrete —
needs Rich's answer on whether it asks "which size" or defaults to
one, not yet asked).

## 6. WHAT DIDN'T CHANGE

Everything from the 28 August carryover's "stays intact" list still
applies: `DiscoverySession`/select-remove-toggle, the 56-position
catalog (now with silo boundaries added), the real generation pipeline
(render route → real generate call → watermark/storage → retry-same-
effect on failure), CENG/CUI ownership split.

## 7. STILL OPEN

- Curator's real recommendation logic and copy — not started, needs
  Rich's voice.
- "Pick for me" exact behavior under discrete sizes — needs Rich's
  answer (ask which size vs. default).
- Full end-to-end test under the CURRENT (corrected) pricing model —
  the last real pipeline test predates this session's size-1/unlock
  fixes. Nothing has verified the current state end-to-end yet.
- Pets fur/coat likeness revision — explicitly handed to a separate
  CENG instance, not this thread's scope.

*CENG-45 — 30 August 2026*
