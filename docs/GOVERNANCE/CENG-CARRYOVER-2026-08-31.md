# CENG CARRYOVER — 31 August 2026 — HANDOFF TO CENG-50

Supersedes CENG-CARRYOVER-2026-08-30.md. Read that one for the pricing
model history (Portfolio era -> docx pivot -> fixed sizes) if you need
the deep background; this doc is current state plus everything that
happened in the session between then and now.

Also read, in this order, before touching anything:
1. `CENG-CLAUDE-CODE-CONTRACT-2026-08-28.md` — how you have direct
   repo access, what that changes, what it doesn't.
2. `CENG-KNOWN-FAILURE-PATTERNS-2026-08-31.md` — companion doc to this
   one. Specific, recurring mistakes from tonight's session, written so
   you don't repeat them. Not optional reading — several of these cost
   real time and one touched real money risk.
3. This doc.

---

## 1. LANE ASSIGNMENT

**Work in `D:\lanes\ceng`, branch `lane/ceng`. Do not create a new
worktree.** Earlier carryovers (26 Aug) split work into `ceng` vs
`ceng45` specifically to avoid colliding with another lane's live
investigation that night (a QA/scoring bug in Portraits). That
investigation is long over. There is no active reason for a separate
worktree right now. `D:\lanes\ceng45` was never even created as a real
git repo (confirmed in this session — `git branch` failed with "not a
git repository" when checked) — don't assume it's usable without
verifying first if anyone ever tells you to use it.

If a future instruction tells you to use a different lane, verify it's
a real, initialized worktree before trusting the name — see the
failure-patterns doc for why this matters.

## 2. FILE HANDLING — SHORT VERSION

You write directly to the repo. No Downloads folder, no Install-File
relay — that workflow is for CUI, not you (per the Claude Code
contract, section 1). One specific trap from tonight: when Rich says
"here's the file" via a chat interface (not this session), the file
often lands in HIS Downloads folder, not in front of you. That is not
usable to you as a file — you need the actual text content pasted or
attached directly into THIS session. If Rich references a file you
don't have visible content for, say so plainly and ask for the content
to be pasted, rather than assuming it exists on disk somewhere you can
reach.

## 3. DISCOVERY REVISION — CURRENT STATE

**Pricing: fixed sizes, confirmed multiple times.** 1 / 4 / 8 / 16
effects, $2.99 / $4.99 / $7.99 / $12.99. Hard cap at 16 even though the
catalog is 56 effects (8 silos x 7). No continuous/range pricing
exists anywhere in the live code — if you see anything suggesting
otherwise, it's stale, not current.

**Included unlocks:** size 1 = no watermark, straight render, doesn't
touch the Portfolio pipeline at all (routes through the ORIGINAL
single-craft checkout, `skuId:'single'`). Size 4 = 1 unlock. Size 8 = 1
unlock. Size 16 = 2 unlocks.

**Architecture: separate route, NOT a replacement of `portraits.html`.**
Confirmed directly by Rich, deliberately, after briefly considering and
rejecting full replacement — a working live product doesn't need to go
down for testing with no forcing function. New experience stays
isolated (CUI's `/discovery-preview` or wherever they've moved it)
until proven out. Cutover is a separate, later decision.

**Curator: real recommendation logic is built**, `lib/store/curator.ts`
no longer stubs. `analyzeSourcePhoto` (OpenAI vision) +
`selectRecommendedEffects` (silo-affinity scoring, per-silo caps,
excludes the known dead `made_by_hand` gap). Covers Pick-for-me,
Help-me-choose, Describe-what-you're-looking-for. **Every user-facing
string is a DRAFT placeholder** — logic is real, copy is not
launch-ready, needs Rich's voice before ship. Pick-for-me ASKS which
size, confirmed, does not auto-default.

**Endpoints, all live:** catalog (with silo boundaries for
continuous-scroll), session select/remove/toggle, portfolio checkout
(sizes 4/8/16), single checkout (size 1), unlock-status
(`GET /api/v1/portfolios/{id}/unlocks`). Full reference:
`docs/GOVERNANCE/CENG_API_REFERENCE.md`.

**Not done:** full end-to-end test of the CURRENT model. The pipeline
test that found real bugs (SKU grants, size-1 routing) predates the
Curator build and predates tonight's Stripe mode fix. Nobody has run a
complete Discovery-to-purchase test against the fully-current state.
This is the single highest-value next action if picking this back up.

## 4. CREDITS — BEING DISCONTINUED, CURRENTLY IN A STOPGAP STATE

**Rich's own words: "these will not be real prices. we are going to
discontinue credits."** Do not treat the credits system as a product
to improve or extend. It is being phased out.

**Current DB state is intentionally NOT production-accurate.** The
`skus` table's `price_cents` values for `credits_10/30/60/120/300`
were changed tonight to match STOPGAP TEST-MODE Stripe prices that
have nothing to do with real credit pricing ($82.34, $38.92, $22.46,
$12.72 — old leftover test amounts, not real numbers). This was
deliberate, to unblock testing the rest of the site safely, NOT a
pricing decision. If credits work resumes for any reason, these values
need to be revisited — don't assume they're meaningful.

## 5. STRIPE MODE — RESOLVED, WORTH KNOWING WHAT HAPPENED

The live deployment (`litenco.com`) was found to be running with LIVE
Stripe keys, left over from full-pipeline testing roughly a week prior.
Discovered when a test card was correctly rejected by Stripe's own
safety net (declines known test cards in live mode) — no real charge
occurred. Switched back to test mode. Two real bugs surfaced and were
fixed in the process — full detail in the failure-patterns doc, but
briefly: a Vercel env var Type mismatch (Secret vs Config broke
`NEXT_PUBLIC_` browser exposure) and a stale `price_cents` desync
between the DB and Stripe's actual test-mode prices. Both fixed. Test
mode is confirmed working end to end as of tonight.

**Before this ever goes back to live mode**, the credits SKU
`price_cents` values need to be restored to real numbers (see section
4) and the Vercel env vars need to be swapped back to live keys —
neither of those is done automatically by anything, they're manual
reversals someone needs to remember to do.

## 6. WHAT DIDN'T CHANGE

Everything from the 30 Aug carryover's stable list still applies —
`DiscoverySession`, the 56-position catalog, the real generation
pipeline (render -> real generate call -> watermark/storage ->
retry-same-effect), CENG/CUI ownership split, the render pipeline's
fail-closed error handling.

## 7. STILL OPEN

- Curator's real copy/voice — logic built, text is all placeholder.
- Full end-to-end test under fully-current state (section 3).
- Pets fur/coat likeness revision — separate CENG instance, not this
  thread's scope, unrelated to Discovery work.
- Credits system's actual wind-down plan — not scoped, not asked for
  yet, just confirmed as directional intent.

*CENG-45 (handing off to CENG-50) — 31 August 2026*
