# Gift Wizard end-to-end walk: walls found (2026-10-19)

Real Chrome, real Wizard files, real backend handlers (harness: `tools/gift-walk/`). Screenshots: `frontend-deploy-review/walk-20261019/`. Not covered: payment, approval, Preview.

| # | Wall | Evidence | Owner | Status |
|---|---|---|---|---|
| 1 | Generation screen does not reflect generation | At t+4.4 s the server had 3 ready and 3 generating; the screen showed six "Waiting to start…" and nothing until t+8.5 s. Only ONE session read happened during the whole POST (no poll). Disabled CTA reads "Choose Effects →" on the previews screen. | Codex | open (backend ready: `BatchView.progress`, `generation`, per-preview `status`) |
| 2 | Configuration and cart show a stranger's sample photo, no price | `product-fine_art.jpg` (a wedding group in a studio) beside a cropped thumbnail of the customer's art; mobile shows no customer art at all; no price before Add to Cart. Nothing calls `/product-preview`. | Codex | open (backend ready: `GET /sessions/{id}/product-preview`) |
| 3 | Half the sizes have no personalized preview | Square favorite: `ready` for the square sizes only; every rectangular size answers `adaptation_required` (extension 0.5). | Owner decision | open |
| 4 | Mobile primary action below the fold | 390x844: recipient CTA y=1326, configuration "Add to Cart" y=1300, cart "Next: Checkout" y=1112 (viewport 844). Laptop 1300x720: all in view. | Codex | open |
| 5 | Re-upload of the same photo shows `rate_limited` | After 5 uploads the screen showed the raw code. | CC: response now carries `resumeSessionId` + `samePhoto`; Codex: message and resume | CC half done |
| 6 | Nested scrolling panels | Left/center/right panels scroll internally at 1300x720. | Codex | open |

Verified working in the same walk: upload; six effects; all six renders concurrent; leaving mid-generation and returning by Back and by URL restores the finished previews; Add to Cart survives 9 s and a refresh; all eight families visible with the four unlaunched ones disabled.

## Re-walk after Codex fe8ab88 (same day)

Fixed and seen working in the browser: "Choose One Artwork" with a disabled "Choose Your Gift →" until an artwork is chosen; the configuration screen shows ONE personalized preview from `/product-preview`; the cart and checkout copy; reaching Final Approval with the mockup after a verified payment (simulated: Stripe is not available in the harness).

| # | Wall | Evidence | Owner |
|---|---|---|---|
| A | Finished previews are not shown as they finish | t+4.4 s: server 4 ready + 2 generating; screen "Crafting…" x6, no images. Images appear only at the end. | Codex |
| B | "Craft My Six Previews" leaves the first viewport | 1660x900, six effects picked: the selected-effects grid pushes the button below the fold (not visible); Back / Start a New Gift are not visible either | Codex |
| C | Adaptation-required product shows an empty page | Classic Framed 16x24: one sentence ("Product-specific artwork will be prepared after payment") and ~600 px of blank; no product, no artwork | Codex (the response carries favoriteAspect, pictureAspect, method) |
| D | Returning to a paid session shows an error, not progress | Restore lands on Review with "This product preview could not load. Try again" and a disabled Approve button; composition starts only after the customer clicks Try again (3.6 to 5.7 s), then the preview appears | Codex (backend: per-line `compositions[].status` none -> ready is pollable; POST /compositions is idempotent) |
| E | Final Approval for the black Classic Framed 16x24 is the calibrated lay-flat mockup | server log: `scene fallback ... GLOBAL-CFP-16X24 configuration_not_photographed`; an orientation probe shows portrait art drawn rotated 90 degrees on a gray surface (`walk-20261019/40-orientation-probe-framed-16x24.png`) | Photography (see GIFT-SCENE-COVERAGE-AND-PHOTOGRAPHY-BRIEF-2026-10-19.md) |
| F | Mobile CTA / nested scrolling | not re-run after fe8ab88 | Codex to re-run `w15.cjs mobile` |

Not walked: Back / Change Product / Cancel inside configuration (punch 2), the analysis animation (punch 5), real Stripe checkout, approval click-through, Preview.

## Re-walk 2026-10-20 (Codex 9123c06 merged; CC 1b2bc35)

Backend walls closed over real HTTP on the real handlers (`tools/gift-walk/w21.cjs`):
* Provisional preview (`product-preview?provisional=1`): for a square favorite, fine art 12x18, framed 16x24, canvas 12x18 and premium 8x12 answer `provisional` (whole favorite, neutral surround, `finalComposition: generated`, 0.5 to 1.2 s); fine art 8x8 stays `ready`; without the flag the answer is still `adaptation_required`. Images: `walk-20261019/60-provisional-*.jpg`.
* Durable composition state: before start `not_started` + `resumeNeeded`; a refresh at +0.9 s says `preparing` (with `preparingSince`) and `resumeNeeded: false`; a second POST answered in 190 ms with no new generation; both gifts `ready` afterwards.

The next actual wall (still standing in the browser, `w20.cjs`): returning to a paid session whose artwork has not been prepared lands on Final Approval with "This product preview could not load. Try again", Approve disabled and a disabled primary button; nothing starts it, and the customer is told it failed. Owner: Codex. The data it needs is now in `resume.compositions` and `CompositionView.state`; start with `POST /compositions` once when `resumeNeeded`, poll while `preparing`.
