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
