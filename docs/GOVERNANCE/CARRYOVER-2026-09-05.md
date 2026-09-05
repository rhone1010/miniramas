# CARRYOVER — 5 September 2026 — Discovery build + feedback panel

Session covered: Discovery UI wiring (tasks 1-5 of the original 7-step
plan), pose/aspect-ratio/clear-all additions, several real bugs found
and fixed, and the start of a new feedback-panel feature. This doc is
the honest state of everything open — several items were sent and
never confirmed closed. Read before assuming anything is done.

---

## Discovery build — confirmed working, verified by Rich directly

- Preview images populated on all 56 cards (task 1)
- Gender toggle, plates-based gate, all 8 rooms (task 2, after a
  mount-point bug fix — was mounted into a dead `#iconNav` container)
- Photo upload, base64 client-side (task 3)
- Photo-driven gender auto-detection (task 4, after an analyze-never-
  fires bug fix — was chained behind an unrelated promise)
- Real selections → real payload, tier-relock fix, review-image fix,
  session-id-undefined fix (Next.js `params` is a Promise, not a plain
  object — five routes were reading it wrong) (task 5)
- Pose selection, ported from `portraits.html`, request-time only
  (no schema change needed)
- Aspect ratio (Square/Portrait/Landscape), cosmetic for now —
  `generate/route.ts:319` derives aspect from framing and discards
  client value by design; this is known and accepted, not a bug
- Clear-all/start-over, atomic server-side clear, confirmed via real
  store test and Network tab
- Dual-view bug fixed (view-switch functions now defensively hide all
  other views on every transition)
- Face-centering/cropping ported from `portraits.html`, confirmed
  working on upload

## Discovery build — IN PROGRESS, no confirmation yet

**Correction task currently running** (sent, not yet reported back):
CC's last report claimed the Pose/Aspect rail shows the full "Ready to
create" summary (shared `buildSummaryHtml()`) — Rich's screenshots
show it does not, only the photo renders. Also: aspect panel is
transparent (should be solid oxblood), "Shape" heading is
outside/below the panel (should be inside, near bottom), chosen-state
gold fill missing. CC was told to use Playwright screenshots to verify
before reporting again — this pattern of claimed-fixed-but-not-actually
matches two earlier bugs this session (toggle mount point, analyze
never firing), both of which were real jsdom-blind-spot bugs, not
fabrication. Do not trust this batch's next report without checking
the screenshots it's required to include.

**UX pass, sent, not yet reported:** intent-pill apply action,
freeform "tell me what you like" wiring, review button copy, help "?"
context-awareness, curator-card CSS. (A prior version of this batch
WAS reported and mostly confirmed real — see below — but the
pose-rail/aspect items from that same report are the ones now known
false, per above.)

## NOT STARTED — original 7-step plan

- Task 6 — Craft button → Stripe checkout
- Task 7 — Payment confirmation → NB2 render → My Collection

## Feedback panel — new feature, just started

Spec: `docs/GOVERNANCE/FEEDBACK-PANEL-HANDOVER-2026-09-05.md`, CUI's
component at `public/litenco-feedback-modal.html` (now r02 — footer-
only changes, POST contract/schema/GitHub-issue shape unchanged from
r01).

- **Task A (backend: schema, endpoint, GitHub issue, reporting) —
  being sent now.** Not started as of this doc.
- **Task B (glass integration) — written, held.** Do not send until
  Task A is confirmed working. Also explicitly adapted for the
  consolidated single-file Discovery build, NOT the three separate
  mock files the original handover doc assumes — CUI's handover doc
  itself needs a correction (§6 should say one file, not three; CUI's
  component is correctly built as one responsive file already, only
  the integration target was wrong in the doc).
- Rich's pending decision (handover §8): scarab test-release-only vs.
  customer-facing — defaulted to `release='test'` in the schema until
  told otherwise.

## Unconfirmed from earlier in the night — do not assume resolved

- **Watermark persistence fix** — sent as its own task early in the
  session (bake + store the watermarked image, not just the clean
  original; mint a real signed URL for `previewId`). Never got a
  completion report. Task 7 (render → My Collection) is meaningless
  without this — check status before building task 7.
- **Stripe webhook** — `STRIPE_PRINT_WEBHOOK_SECRET` and
  `STRIPE_WEBHOOK_SECRET` were both stale (leftover from a live/test
  mode switch), corrected in both Vercel Preview and Production and in
  `.env.local`. Redeployed. **"Send test events" confirmation from
  Stripe's dashboard was never actually completed** — status unknown.

## Housekeeping — tagged, not actioned, will grow

- Branch sprawl: roughly a dozen preview branches created this session
  alone (`discovery-task1-previews` through the current pose/UX
  branches), none merged toward `minramas`'s actual deploy state.
- Two stray `.gitignore` lines (`.vercel`, `.env*`) — origin unknown,
  never ruled on. `.env*` would newly ignore `.env.local` if ever
  actually applied.
- 41 archive deletions + 13 route-stub edits sitting uncommitted in
  `minramas` since the original convergence pass — predates this
  session's Discovery work, unrelated to it, still sitting there.
- `docs/GOVERNANCE/FEEDBACK-PANEL-HANDOVER-2026-09-05.md` needs a
  one-line correction: §6 assumes three glass files, should say one
  (`discovery-consolidated-draft.html`).

## Key lesson from this session, worth repeating to any successor

Several real bugs this session were invisible to jsdom by their exact
nature — a CSS `display:none` ancestor, a chained-promise ordering
bug, a Next.js `params`-as-Promise contract violation. jsdom cannot
execute server routes, apply CSS, or run real async timing. **A green
jsdom suite is not proof of a working feature.** Real Chrome
(increasingly via Playwright screenshots, not just manual description)
and direct verification by Rich on a deployed preview are what
actually confirm something works. Every task brief going forward
should keep requiring this explicitly — it has already caught multiple
false "done" claims that were confident, detailed, and wrong.

*Session handoff — 5 September 2026*
