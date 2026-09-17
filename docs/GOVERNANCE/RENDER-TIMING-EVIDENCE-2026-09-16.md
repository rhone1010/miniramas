# Render timing — what a collection actually takes

Corrected 2026-09-16 (Rich). This exists because a number from a broken run
was circulating as though it described normal behaviour.

**Use the 2026-09-16 23:11Z run below as the current evidence.** The earlier
~211-second figure describes a fault that has been fixed, and must not be
quoted as normal render timing.

---

## Current evidence — fast path, Preview, after 5fa6273

Portfolio `6d57664c-8c71-4101-bf2e-c90edea0b9d3`, 4 effects, Preview
deployment running the branch's own code, Stripe test mode, shared
prod-linked database.

The dispatch route's own summary:

```
2026-09-16 23:11:27Z  POST /api/v1/portfolios/{id}/dispatch
[dispatch] {"portfolioId":"6d57664c-8c71-4101-bf2e-c90edea0b9d3",
            "dispatched":4,"rendered":4,"skipped":0,"failed":0,"ms":21152}
```

**All four dispatched, all four rendered, none failed, 21.2 seconds.**

The four NB2 renders, each its own invocation:

| Started | Effect | Generation |
|---|---|---|
| 23:11:29.422 | cubism | 18 219 ms |
| 23:11:29.493 | ice | 17 886 ms |
| 23:11:30.922 | wild_west | 14 641 ms |
| 23:11:31.019 | neon | 15 102 ms |

All four begin within **1.6 seconds** of each other — a genuine parallel
fan-out, not a queue. Wall clock from payment to the last image is about 25
seconds, the extra few seconds being the client's 3-second poll tick.

The recovery cron took no part. Every production tick around the run
reported no work, including the one at 23:12:33Z immediately afterwards:

```
23:08:33  (no work logged)
23:10:33  (no work logged)
23:12:33  (no work logged)
23:14:33  (no work logged)
```

That is the point: on the fast path the cron never sees the items at all.

---

## The superseded run — a fault, not a baseline

Portfolio `67dbd54e-c18e-445c-a868-f98b1fbb46cd`, 4 effects, 2026-09-16
22:33Z, **before** 5fa6273. Three images arrived quickly and the fourth about
three and a half minutes after payment.

Cause: every self-call used `getAppUrl()`, which on Preview resolved to a
different, SSO-protected deployment. All four dispatches were refused at
Vercel's edge before any of our code ran:

```
22:33:21Z  [dispatch] item 689624bf... failed: HTTP 401
             {"protection":{"vercel_auth_enabled":true, ...}}
           [dispatch] {"dispatched":4,"rendered":0,"skipped":0,"failed":4,"ms":60}
```

Nothing was claimed, so the whole portfolio fell to the recovery cron, which
renders at most `MAX_ITEMS_PER_TICK = 3` per 2-minute tick, serially:

```
22:34:33  [render-poll] {"reclaimed":0,"scanned":3,"claimed":3,"rendered":3,"failed":0,"ms":57758}
22:36:33  [render-poll] {"reclaimed":0,"scanned":1,"claimed":1,"rendered":1,"failed":0,"ms":16936}
```

Three in one tick, the fourth in the next — the observed 3 + 1. Derived
completion times from payment: 95 s, 114 s, 133 s, **211 s**.

**The 211 seconds measured the recovery path, not generation.** NB2 itself was
never slow in that run: the four renders took 17.7 s, 17.5 s, 16.6 s and
14.4 s, and the straggler was the *fastest* of the four. The delay was
entirely the cron's cadence and its 3-per-tick cap.

Fixed by 5fa6273 (`lib/store/internal-fetch.ts`): a Preview self-call now
targets `https://$VERCEL_URL`, the deployment actually running the code, and
carries Vercel's automation bypass. Production was never affected — its
`APP_URL` is the custom domain, which the project's
`all_except_custom_domains` SSO setting does not cover.

---

## What did not change

Nothing about how renders are scheduled was touched, before or after: render
concurrency, the `Promise.allSettled` fan-out, cron frequency,
`MAX_ITEMS_PER_TICK`, retry timing, client polling intervals, stale
thresholds, NB2 generation and the portfolio lifecycle are all as they were.
The fix corrected **where a self-call was sent**, nothing else.

## Still open

- The in-process retry in `lib/store/portfolio-render.ts` sends no
  `Authorization` header to a secret-gated route, so it is refused 401 every
  time — and because a 401 is a response rather than a throw, its `.catch`
  never fires and nothing is logged. Verified by reading the code; it did not
  fire in either run above. Left alone at Rich's instruction: report, do not
  fix.
- Both temporary Preview bypasses (foyer intake cap, free-reveal allowance)
  must be removed before any Production deploy.

## Sources

Vercel runtime logs, project `miniramas`, 2026-09-16, read via
`vercel logs --json`. Production and Preview environments as labelled.
