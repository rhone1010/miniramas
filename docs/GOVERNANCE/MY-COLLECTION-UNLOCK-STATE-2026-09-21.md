# My Collection unlock state — read-only, 2026-09-21

The public Production Discovery HTML returned HTTP 200 and matched RC
`ae104808c674396af671a0ba38b981e207f8330e` after CRLF normalization. Production
`GET /api/v1/collection/unlock-review` returned 404. No account, entitlement,
payment or database mutation was performed for this report.

| Interaction | Current behavior |
| --- | --- |
| Unlock one locked piece using its included allowance | Implemented. Gallery quick action, featured action and detail action call `unlockPiece` → `requestUnlock` → `/api/v1/portraits/unlock`. Requires a finished piece with preview ID, clean original and an eligible paid entitlement. |
| Included balance | Portfolio-scoped, supplied by the portfolio status response and read by `includedRemainingFor`. It is not a transferable account-wide wallet. Discovery bundles of 4/8 include 1; 16 includes 2; the outright single is already owned and includes 0. |
| Choose between included and $2.99 in detail | Both enter the same handler. An eligible included entitlement is tried first even if the paid-labelled button was clicked; no new charge is forced while that allowance can satisfy the piece. |
| One additional $2.99 piece unlock | Implemented, not intentionally disabled. When the ordinary claim reports no entitlement, the client opens the piece-specific embedded checkout, confirms payment and retries the claim. The paid entitlement is bound to that exact preview. No paid transaction was tested here. |
| Reopen/download an already owned piece | Implemented. Clean output is redelivered for the owner without spending another included entitlement. Outright purchased singles remain owned. |
| Included unlock from another portfolio | Intentionally unavailable. The server restricts included redemption to the original portfolio/purchase. |
| Reusable 1/3/5/10 unlock packages | Unavailable in Production. The display-only endpoint is Preview-gated; Preview's package checkout is explicitly disabled. A 1-credit package is distinct from the functioning $2.99 piece-specific unlock. |
| Unlock All | Unavailable; no active customer snapshot checkout/fulfillment path. Preview can display an illustrative offer only. |
| Package rail / Get More Unlocks / package sheet | Preview-only presentation, conditional on the display-only endpoint. Production's 404 leaves `MC_UNLOCK_REVIEW` null, so this commerce presentation is not activated. |
| Select several lock badges, then “Unlock selected” | Incomplete legacy presentation. Badge selection and a quoted batch total can appear, but `mycollUnlockBuy` only clears selection and repaints. It makes no payment or unlock request and consumes no included entitlement. It is not a working bulk unlock. |
| Missing clean original | No fallback re-crafting is implemented by the unlock route. It returns `clean_unavailable` before consuming an entitlement. |

The multi-select quote uses the old `unlockPrice` bands; these are not active
purchasable offers. No pricing, copy, visibility, commerce or entitlement change
was made as part of this investigation.

Source anchors: `public/discovery-consolidated-draft.html` functions
`includedRemainingFor`, `renderMycollRail`, `requestUnlock`, `startUnlockCheckout`,
`unlockPiece`, `paintPieceDetail`, `downloadPiece`; the delegated
`#mycollUnlockBuy` handler; `app/api/v1/collection/unlock-review/route.ts`;
`app/api/v1/portraits/unlock/route.ts`; `lib/store/portfolio-checkout.ts`.
