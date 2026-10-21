# Initial six-preview pipeline: verification, corrections and Cancel contract, 2026-10-21

Real provider calls were made through the app's own series routes (in-process), logging every outbound call (host, path, status, ms; never bodies or keys). Probe scripts and outputs: `E:\Dev\_recovery-staging\initial-preview-verify\`.

## Calls made before the six previews exist (one preview, real)
| series | BEFORE | AFTER |
|---|---|---|
| Groups (5 people, 3:2) | 10 calls, 104.6 s: 1 OpenAI preflight (face/age/count), then **4** x (NB2.1 + OpenAI per-figure score), then **1 Stability margin outpaint** (8% each side). Output 1466x1050 (NB2's 1264x848 plus the margin) | 5 calls, 40.4 s: 1 OpenAI preflight, **2** x (NB2.1 + score), **no Stability**. Output 1264x848, exactly what the model returned |
| Pets (dog, 1:1) | 4 calls, 30.0 s (58 s on a run that retried): OpenAI pre-flight, NB2.1, OpenAI score, **Stability outpaint (10% each side)**. Output 1228x1228 | 3 calls, 18.2 s: no Stability. Output 1024x1024 |
| Portraits (1:1) | 4 calls, 21.7 s: 2 OpenAI (age/visibility, classify/intake), NB2.1, OpenAI likeness score. Output 1024x1024. No Stability, no upscale | unchanged (it had nothing to remove) |

No upscaling and no aspect adaptation happen in any initial-preview path (confirmed in code and in the call logs); the stored master is the model's bytes (the Gift service stores them without re-encoding, resizing or extending).

## Actual six-preview batch (Portraits, real providers, concurrent)
All six previews started within 190 ms of each other (parallelism is 6; the provider limit was not hit); batch complete in **45.6 s**; per preview 17.8, 19.2, 20.6, 22.8, 42.4 and 45.5 s (the two slowest each retried once after a missed likeness score, 2 NB2 calls); 8 NB2.1 calls, 20 OpenAI calls, 0 Stability, every master 1024x1024 with `postProcessing.outpaint = false`. For comparison the stored history of the failed Groups batch took 3.4 minutes for six (every preview used all 4 attempts and a Stability outpaint).

## Corrections (initial-preview path only; compositions and every other caller are unchanged)
1. Groups route/generator: new internal fields `skip_outpaint` (no margin outpaint) and `max_attempts` (a caller may only LOWER the cap from 4); Pets route/generator: internal `skip_outpaint` (honoured only with internal auth). Gift sends them for initial previews (`generateBody`): Groups `skip_outpaint: true, max_attempts: 2` (`INITIAL_PREVIEW_MAX_ATTEMPTS`); Pets `skip_outpaint: true`; Portraits nothing. The effect prompts, the source photograph, the series' aspect ratio and every other field are exactly as before.
2. Quality is no longer thrown away. Each ready preview carries a generation record (`GenerationRecord`: attempts, passed, quality `passed | below_bar | unscored`, reason, per-figure scores, post-processing flags, duration), stored in `gift_previews.generation` (migration 058, NOT applied; the service works without it and simply drops the record) and exposed to the client as `PreviewView.quality = { status, attempts } | null`. A preview that missed the likeness bar is delivered `ready` with `quality.status = 'below_bar'`: information, never a failure and never a block. Reasons and scores stay server-side.
3. A failed generation (the route answers `ok:false`) is a recoverable failure: `status 'failed'`, `retryable true` until 3 claims; verified that a retry runs only the failed one and that the cap of 3 holds however often the customer retries.
4. Cancel/delete race: a render that finishes after the project was deleted (or expired) is now discarded before anything is stored, `markReady` reports whether the row still existed (else the files are removed), and `deleteSessionNow` sweeps files a late render wrote between the object removal and the row deletion. Before this a late result could leave a master and a preview in storage with no row pointing at them (inferred from the code; no live reproduction).

## Durable state, retries, refresh, duplicates (tested)
Rows are claimed with a 300 s lease (`gift_claim_preview`, max 3 claims per preview); a restore mid-render returns `runningBatches [1]` and `progress.generating 6`; two simultaneous requests for one batch (double click, second tab) pay for six renders once (idempotency key plus claim); a refresh never starts a render. Per-preview worst case is now route attempts (at most 2) x claims (at most 3).

## Cancel: exact behavior and frontend contract (for Codex 1)
- The Wizard's current **Cancel button makes no API call** (it saves the view and navigates to /gifts). Therefore nothing is cancelled server-side: the six in-flight renders continue (the paid provider calls cannot be recalled), their results are stored in the saved project, and `GET /api/v1/gift/sessions` restores them. Cancel today means "leave, keep my project".
- **Discard** is `DELETE /api/v1/gift/sessions/{id}` -> `204`: removes the project, its source photo and every master, preview, composition and mockup file. `409 session_retained` when a paid order pins the session. If renders are in flight, they finish at the provider (already paid) but their results are discarded and no row or file survives; no new render starts; a following retry answers `404 session_not_found`.
- There is no "stop the six" call, because all six start at once and cannot be recalled; the UI must not promise one. If the product wants "Cancel = discard", the button must call the DELETE above after confirming with the customer.
- New field to read: `session.batches[].previews[].quality` (`{ status: 'passed' | 'below_bar' | 'unscored', attempts }` or null). Do not block or label on it unless the product decides to; `below_bar` is a complete, usable preview.

## Cost
The $50 was a cumulative ceiling. Estimated spend under it so far, from call counts (provider billing was not queried): repair about $1 to $2, Stability validation $0.48, this verification about 20 NB2.1 calls, about 45 OpenAI calls and 3 Stability calls, roughly $2. That is well under $5 by any plausible price, so more than $45 remains by estimate; the exact figure could not be established.

## Not done / remaining
- Migration 058 is not applied (optional; previews are created without the record until it is). Apply with `docs/GOVERNANCE/gift-058-preflight-and-verify.sql` before and after.
- Groups scoring is gpt-4o-mini against the source photograph and rejects many good renders (all four attempts failed on the 5-person photo); that is the generator's scoring, not changed here. With the cap at 2 and no block, a failed score now costs one retry and is recorded.
- The 17 `lib/v1/groups` tests that already failed before this work still fail (their own fixtures).
