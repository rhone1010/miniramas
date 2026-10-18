# Gift: operator repair of one composition (runbook)

Status: built and tested, NOT applied, NOT deployed. Migration 052 is not applied to any database.

## What it is
`repairLine` (lib/v1/gift/compose.ts) replaces ONE line's composition when the stored file fails the frozen-product shape check (the landscape-file-for-a-portrait-product defect fixed in 2922970). Operator-only: no route, page or customer action calls it (a test scans for that). Run by `scripts/gift-repair-line.ts`.

## Contract
- Inputs: session, customer user id, ONE line id, operator name. No "all lines".
- Preconditions: order paid and awaiting artwork approval; not refunded, no refund request; saved favorite set; the line's current composition fails the shape check. Anything else is `not_needed` or an error and changes nothing.
- Effect: a new composition row (same attempt, `repair_seq` = n+1, status `ready`, never `approved`), generated from the saved favorite at the frozen product's own orientation; the defective row is superseded in the same database transaction that releases the claim (files, plan and dimensions kept, reason and replacement recorded); its cached mockup file is removed.
- Untouched: frozen geometry, order, prices, `corrections_used`, saved favorite, other lines' compositions and approvals. The customer approves the replacement; `approveOrder` refuses until they do.
- Claim: `gift_claim_repair` (one live claim per session+line, atomic, 15-minute expiry). After winning it the state is re-read, so a repair that just finished is not repeated.
- Interruption: the replacement's files have a fixed path, so a retry after a crash reuses them (no second paid generation); a stored replacement whose old row was not yet retired is finished by the next call with no generation. A process that dies holding the claim blocks a retry for at most 15 minutes.
- Cost: at most one NB2.1 generation per run (dry run reports it).

## Operator command
Dry run (default; no database writes, no paid call):

    npx tsx --env-file=.env.local scripts/gift-repair-line.ts --session <session-uuid> --user <customer-user-uuid> --line <lineId> --operator <you@liten.co>

Execute (only after approval; refuses if 052 is not applied to that database):

    npx tsx --env-file=.env.local scripts/gift-repair-line.ts --session <session-uuid> --user <customer-user-uuid> --line <lineId> --operator <you@liten.co> --execute

UNVERIFIED precondition: generation is a self-call to the app (lib/store/internal-fetch.ts). From a local shell it goes to `APP_URL`; on Preview that must point at a reachable deployment and `VERCEL_AUTOMATION_BYPASS_SECRET` must be set, or the generation is refused at the edge before any cost. Dry run does not need this.

## Existing test record (not touched)
Session 7c63738b-ccfa-4d55-ba79-a4e1f3a27295, line b63b4e57-c3b7-4710-bcee-5e198a4c42b5 (Fine Art Print), composition 7834b6ad-6c7e-41b2-8573-803233755b64. Canvas control line 0b417291-791d-450f-a8b2-75ce09c18cbb must stay untouched.
Note: the line id the script takes is the wizard's `line_id` for that order line, not the row uuid shown above if those differ. Read it from the order view first.

## Deployment sequence (one combined protected Preview push)
1. Owner approves; commit the repair branch (migration 052, verify SQL, code, script, tests).
2. Owner runs `docs/GOVERNANCE/gift-052-preflight-and-verify.sql` (expect FAIL-free, "not applied yet"), applies `052_gift_composition_repair.sql` in the Supabase SQL Editor, runs the verify file again (every row PASS). 052 is additive; the currently deployed code is unaffected by it.
3. Assemble ONE fast-forward: current Preview tip + held backend disclosure commit (`7e64b82`, version 2026-10-18-2) + Codex's `2435f57` and `002153d` + the repair commit; run the Gift, print and wizard-UI suites on the combined tree. Backend and frontend disclosure version and exact text must be identical in that single push.
4. Push to `codex/canonical-2026-09-24` only; confirm the `miniramas` Vercel deployment completes.
5. Smoke (read-only): Canvas line mockup 200; Fine Art Print mockup 409 `composition_geometry_mismatch`; checkout accepts `2026-10-18-2` only.
6. Dry-run the script on the Fine Art line; review the plan.
7. With approval: `--execute` once; confirm the new row is `ready`, the old `superseded`, `corrections_used` still 0, other line unchanged, Fine Art mockup 200; customer approves the replacement through the normal flow.
