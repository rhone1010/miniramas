# Gift Wizard session restore: backend contract for the frontend (2026-10-19)

From CC to Codex. Backend is done and tested locally (not pushed). The Wizard restarting at photo upload is a FRONTEND reference loss: it keeps the session id only in memory (`live.id`), and until now no route could find a customer's session without that id. The data (session row, photo, batch, previews, files) is persistent on the server.

## New: `GET /api/v1/gift/sessions` (auth required, same cookie as the rest)

Returns `RestoreResponse` (`lib/v1/gift/types.ts`):

```
{ contractVersion: 1,
  current: SessionView | null,          // most recently used ACTIVE, unexpired session of this customer, in full (identical to GET /sessions/{id})
  resume: { sessionId, suggestedStep, resumeBatches: number[], runningBatches: number[] } | null,
  recent: [{ sessionId, createdAt, lastActivityAt, expiresAt, series, orderId }]   // newest first; current is recent[0]
}
```

401 `sign_in_required` when signed out. Never returns another customer's session, a deleted one or an expired one. It starts, retries and reserves NOTHING; its only write is extending the session's idle expiry (at most once an hour), like every other action.

### Additive fields on the existing views
* `SessionView.source.photoUrl`: signed URL (1 h) of the customer's own uploaded photo, so a restored Wizard can show it. Re-read the session for a fresh URL.
* `BatchView.generation`: `'complete' | 'running' | 'stalled' | 'failed'`, computed from the database (leases and attempts), so it is right after a refresh or a dead request.

## What the Wizard must do on load (and on Back/Forward, `pageshow` with `persisted`)

1. Call `GET /api/v1/gift/sessions` once per page load / `pageshow`. `current: null` means start at the photo; otherwise do NOT show the upload step.
2. Show the step for `resume.suggestedStep` (server-derived from stored records only): `effects` (photo accepted, no batch yet), `previews` (batch exists, no favorite), `products`, `cart`, `checkout`, `compositions` (paid), `order` (read `order.state`). The server cannot know effects ticked but not yet requested, or purely visual state (focus/compare): keep those in `sessionStorage` keyed by `current.sessionId` if wanted; the server is authoritative for everything below.
3. Show the stored photo (`source.photoUrl`), the requested batch and every ready preview (`previews[].url`), exactly as from a normal session read.
4. Generation, per batch:
   * `running`: poll `GET /sessions/{id}` (or `/batches/{n}`) about every 5 s. Start NOTHING.
   * `stalled` (also listed in `resume.resumeBatches`): the request that was generating it ended. Call `POST /sessions/{id}/batches/{n}/retry` ONCE per such batch, then poll. It resumes only the unfinished previews, is safe to repeat and safe from two tabs at once (each preview is claimed atomically), reserves no batch and charges nothing.
   * `failed`: show the existing failed state; nothing more can be generated for it.
   * `complete`: nothing to do.
5. NEVER call `POST /sessions/{id}/batches` with a new idempotency key to "reconnect". A second key while the batch is unfinished is refused (`previous_batch_incomplete`) and consumes nothing; after completion it would start the next (free or paid) batch, which only the customer's explicit action may do. Reconnecting is `GET` plus, when `stalled`, `retry`.
6. Store `current.sessionId` in `sessionStorage` after create if you want an instant path, but still confirm with the server; the server's answer wins.
7. `recent` allows a "continue / start again" choice. Starting again creates a new session through the existing `POST /sessions` (which has its own per-account limits); do not delete the old one automatically.

## Guarantees the backend tests prove (`lib/v1/gift/restore.test.ts`, 15 tests)
* Returning generates nothing and changes no stored file; finished previews are never regenerated or lost.
* A live lease is respected (no duplicate generation); a lapsed lease becomes `stalled` and is resumed exactly once; attempts are capped at 3.
* Repeating a batch request with the same key returns the same batch and generates nothing; a different key while unfinished reserves nothing.
* Two simultaneous resumes generate each preview once.
* The free-batch allowance is unchanged by returning.

## Not covered
* Selections not yet sent to the server (effects ticked before "request previews", filters) cannot be restored by the backend. Persisting them would need a new column; not added.
* Whether the browser's abort of an in-flight `POST /batches` lets the Vercel function finish is platform behaviour and NOT verified here. If it does not, the batch is `stalled` and the steps above finish it on return. A server-side sweeper would remove the dependency; it was not added (it would generate for customers who have left, and cron is Production-only).

## Spinning-gear results screen: what the server reports (added with the pipeline verification)

While `POST /sessions/{id}/batches` is in flight (it returns only when the batch is done or partly failed, up to 300 s), the Wizard can poll `GET /api/v1/gift/sessions/{id}` (or `GET .../batches/{n}`) every ~3 to 5 s. Every poll is read-only and reflects the database:

* `BatchView.progress`: `{ ready, generating, pending, failed }`, always summing to the six previews. Drive the counter ("3 of 6 ready") from `ready`; show the gear while `generating + pending > 0`.
* Per preview, `status` is `pending` (waiting), `generating` (being made right now), `ready` (finished and stored, `url` is the signed watermarked preview), or `failed` (`retryable` says whether another attempt is allowed). Show each finished preview as soon as its `url` appears, without waiting for the batch.
* `BatchView.generation`: `running` keep the gear; `stalled` call the retry route once; `failed` stop the gear and offer nothing automatic; `complete` done.
* A preview's failure reason is recorded server-side only (`gift_previews.error`, e.g. `generate_failed:http_500:nb2_failed`); it is never in a view. Show the generic failed state.
