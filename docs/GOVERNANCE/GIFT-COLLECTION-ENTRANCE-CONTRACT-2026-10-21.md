# My Collection -> shared Product Studio: backend contract for Codex 1 (Giftshop) and Codex 2 (Printshop), 2026-10-21

Backend only, committed locally. **Migration 057 is applied and verified on the live database (2026-10-21)**; the endpoint below was verified live (see "Verified live"). Before 057 the endpoint answered `503 collection_unavailable`.

## Endpoint
`POST /api/v1/gift/sessions/from-collection`   body `{ "previewId": "<uuid>" }`   (signed in; `Cache-Control: no-store`)
`previewId` is the owned artwork's id exactly as My Collection and `GET /api/v1/print/source?previewId=` already know it (the `preview_ledger` id of a finished item of the customer's own portfolio).

- `201` a new session: a full `SessionView`.
- `200` the same piece again: the SAME live session (idempotent, also under a double click or a second tab).
- Both responses are the normal `SessionView` plus two fields, also present on every `GET /sessions/{id}` and `GET /sessions` (restore):
  - `entrance: 'photo' | 'collection'`
  - `collection: { previewId, portfolioId } | null`  (the owned piece the session references; `order.unlockPortfolioId` is the same portfolio, so "view in My Collection" links to the original piece)

### What the new session looks like (a collection session)
- `artworkPreviewId` is already set: the owned artwork is the favorite. `batches` has ONE entry `{ kind: 'collection', complete: true, previews: [one ready preview, watermarked `previewUrl`] }` (not six). `masterAspect` is the owned piece's own shape ('1:1', '3:2', '2:3', ...).
- Nothing to generate: `nextBatch = { kind: 'blocked', reason: 'collection_session' }`, `entitlement.freeAvailable = false` (`freeBlockedReason: 'session_limit'`, an existing value so the current validator accepts it). `POST /batches`, `.../batches/{n}/retry` answer `409 collection_session_no_generation`. Do not show the effect-picking step for `entrance === 'collection'`: go straight to products.
- `source.photoUrl` is the customer's own photograph the piece was made from (copied into the session), used only so a composition or the one free correction can regenerate.

### Errors (`{ error }`, no-store)
| status | code | meaning |
|---|---|---|
| 400 | `invalid_json` | body not JSON |
| 404 | `artwork_not_found` | not the customer's, not unlocked, not finished, no such piece, or malformed id. Never says which |
| 409 | `artwork_not_compatible` | the piece's shape or series cannot be used (same rule as the Print Shop's owned source) |
| 403 | `age_restricted`, 4xx `unsupported_subject` | the photograph fails the same policy checks as a new upload |
| 429 | `rate_limited` | the same per-account limits as photo sessions |
| 503 | `artwork_unavailable` | the original or the customer's photograph could not be read; retry later |
| 503 | `collection_unavailable` | migration 057 not applied |

## After the session exists: nothing different
Everything below is the existing photo-entrance contract, same endpoints and rules: `GET .../product-preview?productId=` (scene-backed; `?provisional=1` for a differently shaped piece), `PUT .../lines` (sale gate ON: only configurations with an approved scene), `POST .../checkout`, composition adaptation (NB2.1 at the nearest ratio where the shape needs it, from the customer's photograph), `POST .../compositions`, one free correction per line, per-line approve, `POST .../finalize` (approval only), operator-only release. What differs: `finalize` creates NO second My Collection piece and copies nothing into My Collection (the session already owns it); the owned piece, its ledger row, its portfolio and its stored original are never written, moved or deleted by any step; deleting or expiring the session removes only the session's own copies.

## What is NOT part of this (no parallel Print Shop backend)
`/api/v1/print/*` stays as it is for existing Print Shop orders; the Studio's My Collection entrance uses only the Gift endpoints above.

## Verified
`collection-entrance.test.ts` (9, real service + handlers), `migration-057.test.ts` (real Postgres: ownership in the database, owned rows byte-identical, idempotent, refusals create nothing, no generation batches, finalize creates no second piece, closed to browser roles, re-runnable), `tools/gift-walk/w25.cjs` (HTTP walk: create, again, not mine, framed refused, product-preview scene, composition, finalize, restore). Walk server: `GET /__walk/owned` gives the seeded owned `previewId` for the signed-in walk user.
Wall found and fixed in the walk: the Wizard's `assertSession` rejects unknown `entitlement.freeBlockedReason` values (so 'session_limit' is used). Still open on the frontend (Codex): the Wizard has no collection or approved screen yet; on a finalized collection session it opens "Your purchase is confirmed. Review your personalized gifts".

## Verified live (isolated fixture, 057 applied)
Two throwaway accounts and one owned artwork built the way My Collection stores it, real handlers on the live store and storage, stand-in analyzer, throwing generator and release hook (no paid call, no manufacturing); 36 checks, all passed, fixture and accounts removed, the existing order/session and all print orders byte-identical: another customer's piece, an unknown id, a malformed and a missing id all 404 `artwork_not_found` and create nothing; create 201 with `entrance: 'collection'`, one `collection` batch with one ready preview (signed https `url`), favorite preselected, `unlockPortfolioId` = the owned portfolio; the session's master is the owned original byte for byte at its own `gift/<session>/` path; the owned portfolio, item, ledger row and stored original unchanged after creation and after deleting the session; again and five concurrent requests all return the SAME session (one session and one batch row); the stranger gets `session_not_found` for the session and an empty restore, the owner's restore returns it; generation refused `collection_session_no_generation`; framed and premium 12x18 refused by the sale gate; fine art 12x18 and canvas 12x12 accepted; `product-preview` for canvas 12x12 is `ready` / scene `gallery-canvas-square` and fine art 12x18 `provisional` / scene; an unfinished item is refused 404; after deletion the piece starts a fresh session. Not exercised live: the paid composition and the finalize (covered in the same-code photo-entrance live fixture and in the walk).

## Applying 057 (done)
1. `docs/GOVERNANCE/gift-057-preflight-and-verify.sql` (read-only): dependencies "present", new objects "not applied yet", no FAIL.
2. Run `supabase/migrations/057_gift_collection_entrance.sql` once (idempotent; widens two CHECKs on gift_batches, adds a column, a partial unique index, a trigger and one function).
3. Re-run the verify file: nothing FAIL, nothing "not applied yet". Then tell CC to repeat the isolated live fixture against a real owned piece.
