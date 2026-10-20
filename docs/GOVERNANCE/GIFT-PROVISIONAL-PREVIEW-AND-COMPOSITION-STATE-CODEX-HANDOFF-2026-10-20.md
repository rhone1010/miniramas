# Provisional product preview and durable composition state: backend contracts for the frontend (2026-10-20)

From CC to Codex. Backend only; local commits, nothing pushed or deployed. Migration 055 is written for the owner to apply; nothing below fails before it is applied (see "Before 055").

## 1. `GET /api/v1/gift/sessions/{id}/product-preview?productId=fine_art:12x18&provisional=1`

Opt-in. Without `provisional=1` the answers are exactly as before (`ready`, `adaptation_required`, `not_available`), so the current client does not change until you ask. With it, a product the favorite does not fit (what was `adaptation_required`) answers a new status:

```
{ status: 'provisional', renderer: 'scene'|'calibrated', sceneId, fit: 'contain', url, urlExpiresAt, width, height, cached, watermarked: true,
  provisional: { exactArtworkShown: true, cropped: false, distorted: false, surround: 'neutral',
                 bars: { sides: 'top_bottom'|'left_right', fractionPerSide },        // where the neutral surround is, and how much of the picture each side takes (0.1667 = a sixth)
                 favoriteAspect, pictureAspect, extension,
                 finalComposition: 'generated'|'deterministic'|null } }
```

What it is: the WHOLE favorite, undistorted, centered inside the product's picture area on a plain neutral surround (`#efece6`, never artwork pixels), through the same scene or calibrated renderer, watermarked, no generation, no composition, no approval or entitlement touched. What it is NOT: the final picture. `finalComposition` says what the real step after purchase does: `generated` = a new generation of the same effect from the customer's photograph at the product's shape, which the customer approves; `deterministic` = a bounded extension. Say so in the screen; do not present the provisional image as what will be printed.
To adopt: add `'provisional'` to the status list `GiftBackend.productPreview` accepts (`backend.next.ts`) and append `&provisional=1`; `ready` is unchanged and still means the exact final shape. Products that are not launched still answer `not_available`.

## 2. Durable composition state (`CompositionView`, `restore`)

Each gift in `SessionView.compositions[]` now carries, read from the database (migration 055), so it is right after a refresh, navigation or a dead request:

| `state` | meaning | the screen |
|---|---|---|
| `not_started` | nothing prepared or claimed | start it: `POST /sessions/{id}/compositions` (once, not on every poll) |
| `preparing` | a request holds the job now (`preparingSince`) | "Preparing your masterpiece"; poll `GET /sessions/{id}` every 3 to 5 s; start NOTHING |
| `stalled` | the request that was preparing it ended | `POST /compositions` again (idempotent) |
| `failed` | last attempt failed (`failureCode`), `retryable` says if another of the 3 attempts remains | a retry button, or Concierge when `retryable` is false |
| `ready` / `approved` | the product-shaped artwork exists (`previewUrl`, `status`) | Final Approval |

`attempts`, `preparingSince`, `failureCode`, `retryable` are real values: use them for honest messaging (elapsed time since `preparingSince`, per-gift state); there is no progress percentage and none should be invented.
`GET /api/v1/gift/sessions` (restore) adds `resume.compositions = { state, resumeNeeded, preparing[], stalled[], failed[] }` (null when there are no gifts): on load, `resumeNeeded` means call `POST /compositions` once; `state: 'preparing'` means poll; `ready` means go to Final Approval.

Guarantees (tests: `composition-jobs.test.ts`, `migration-055.test.ts`): a second request, tab or retry while one is preparing generates nothing and answers at once with the current view (the paid generation runs once); a dead request becomes `stalled` when its 6-minute lease lapses and the next call takes it over; a failure is recorded with a code, retried up to 3 times in all, then no further paid attempt is made; two gifts of one picture shape share one job; the favorite, the correction entitlement and approval are never touched.

## Before 055 is applied
The durable job table does not exist: the server logs one warning, composes exactly as it did before (no durable guard), and reports `not_started` or `ready`/`approved` only. Nothing errors. Apply 055 (the owner's step) to get `preparing`, `stalled`, `failed` and the duplicate-generation guard.
