# Help / Make It Right polish — 2026-09-27

## Case #3 read-only finding (reported before edits)

Vinyl Figure, Portraits, original portfolio size 4, zero-based slot 2. Authorized and successfully executed total: 424 cents.

| Component | Original transaction | Paid | Refunded | Remaining before / after |
|---|---|---:|---:|---:|
| Craft | `e6da5132-b3c8-4c12-b561-9b16aa2d223d`, `basket_discover_5`, Stripe charge `ch_3UK5kLCWHIffAtyW1ZZRVVYM` | $4.99 | $1.25 | $4.99 / $3.74 |
| Individual unlock | `36f6ab51-0c2c-46b3-98b9-022f8b02bd39`, `unlock_addon_1`, Stripe charge `ch_3UK5lDCWHIffAtyW0MLqy8p8` | $2.99 | $2.99 | $2.99 / $0.00 |

499 cents split across four stable slots = 125, 125, 125, 124. This artwork's slot receives 125 cents. The consumed entitlement has `discovery_unlock` style and is separately paid, not a wallet, included allowance, or Unlock All share. Both reservation snapshots had the full original transaction amount remaining. Audit rows record succeeded refunds `re_3UK5kLCWHIffAtyW1cg7AbHd` and `re_3UK5lDCWHIffAtyW0VYjKUtr`. Stripe Dashboard independently confirms the $4.99 partial refund of $1.25 and the fully refunded $2.99 transaction, both in test mode. No allocation defect found; no policy change made.

## Scoped changes

- Resolved refund projection exposes only human component labels and amounts from the stored authorized allocation, after checking its sum matches the completed total. No payment, entitlement or allocation calculation changes. Free included unlocks have no cash component; persisted-set allocations use the customer label Unlock All.
- Refund Issued shows applicable components and Total refunded, with no internal identifiers.
- Desktop typography and controls increased approximately 12.5%, preserving existing colors, cards and hierarchy.
- Shared Help header displays Back to the workshop / HELP on landing, and Back to Help / HELP · SECTION on subpages; existing page titles remain.
- Artwork selector displays all owner-verified artwork inside a bounded internally scrolling region: five columns and three visible rows on desktop, existing three-column smaller breakpoint. Heading, steps and controls remain outside. Selection retains internal scroll position.

## File and promotion trace

All paths relative to `D:/lanes/canonical-2026-09-24`, dated 2026-09-27. This is an expressly requested polish adaptation, not a new verbatim design port. Only the deviations above were authorized and made.

- `public/help-phase1.js`: 121 baseline lines → 122 lines. `public/help-phase1.polish.next.js` lines 1–122 copied to live lines 1–122, 122 in / 122 out, no promotion deviation.
- `public/help-phase1.css`: 122 baseline lines → 161 lines. `.polish.next.css` lines 1–161 copied to live lines 1–161, 161 in / 161 out, no promotion deviation.
- `lib/store/remedy-case-execution.ts`: 100 baseline lines → 111 lines. `.polish.next.ts` lines 1–111 copied to live lines 1–111, 111 in / 111 out; only customer-facing projection changed.
- `lib/store/tests/remedy-case-execution.test.ts`: 43 baseline lines → 65 lines. `.polish.next.test.ts` lines 1–65 copied to live lines 1–65, 65 in / 65 out.

53 focused tests pass. Script parsing and in-memory Help/navigation/request flow checks pass. Browser visual acceptance uses canonical Preview only. No database/configuration changes, migrations, new refunds, unlock consumption, or generation were performed. Existing unrelated dirty drafts remain untouched.
