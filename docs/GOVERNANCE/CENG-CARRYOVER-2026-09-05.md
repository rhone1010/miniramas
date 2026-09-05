# CENG-CARRYOVER-2026-09-05 — HANDOFF TO CENG-52

Long session. Discovery/feedback-panel work from tonight is mostly
closed out below; the new scope for CENG-52 is opening integration
work up to the rest of the product — other Series and Print Shop.
Read this whole document before touching anything, especially §1
(process) and §2 (the lessons — they cost real time to learn tonight
and will cost it again if skipped).

---

## 0 · WHAT'S NEW SINCE THE LAST CARRYOVER — read this first if you've seen an earlier version

Everything that was "unconfirmed" or "in progress" in the prior
carryover is now resolved, confirmed by Rich directly, tonight:

- **Both Stripe webhooks fixed and confirmed live** (§4)
- **Pose/Aspect rail — fully fixed and confirmed** (§5)
- **Feedback panel — fully built, tested end-to-end, confirmed** (§6)
- **Task 6 (Craft → Stripe checkout) — just sent, not yet reported**
- **Task 7 (payment → render → My Collection) — not started, blocked
  on the still-unconfirmed watermark persistence fix (§7)**

The new direction Rich wants next: **broaden past Discovery/Portraits
into the other Series (Groups, Pets, Halloween, Wallpapers, etc.) and
Print Shop.** See §8. This is a real scope change — most of what's
below §8 is Portraits/Discovery-specific and won't directly transfer;
§8 is where CENG-52 should actually start once the Discovery loose
ends are tied off.

---

## 1 · HOW THIS SESSION ACTUALLY WORKS — read this first

Rich does not have direct repo access in the chat interface. The
pattern: CENG (chat) writes a task brief in markdown; Rich pastes it
into Claude Code (a separate agent with real repo/git/Vercel/Supabase/
Stripe/GitHub access); CC does the work and reports back by pasting
its output into the chat; CENG reads the report, verifies what it can
independently, writes the next task or a correction. **CENG has no
computer/repo access itself** — everything "known" about the codebase
comes from files Rich uploads or CC's reports. Neither party can
casually "go check" something — every claim has to be verified
deliberately, which is why the discipline in §2 exists.

---

## 2 · THE CENTRAL LESSON — jsdom is structurally blind to whole classes of bugs

This bit tonight **four separate times**, each costing real
back-and-forth:

1. **CSS ancestor visibility.** A correctly-built, fully-tested
   (41/41 jsdom) gender toggle was mounted into a container set to
   `display:none` elsewhere in the file. jsdom doesn't apply CSS at
   all — a real element a browser would never show looks identical to
   one it would.
2. **Async/promise ordering.** A photo-analysis call was chained
   inside another promise and silently never fired in production,
   because every test stub resolved that promise instantly — the real
   race condition never had a chance to manifest in jsdom.
3. **Server-side route contracts.** Five Next.js route handlers
   destructured `params` as a plain object when in this Next.js
   version `params` is a `Promise`. jsdom never executes a server
   route — `fetch` is stubbed — so this kind of bug is **structurally
   invisible** to any client-side test, regardless of how well it's
   written.
4. **Partial ports verified by a close-up screenshot instead of the
   whole surface.** A rail component was ported missing its header and
   all action buttons — the verification screenshot only showed the
   colored panel it was asked to fix, not the full rail.

**Standing rule for every future task brief:** require real-browser
verification (Playwright screenshots, not just jsdom) for anything
involving layout, cross-boundary async timing, or server routes — and
require it to cover the *whole* changed surface, not just the part
being fixed. A green jsdom suite is not proof of a working feature in
this codebase. Every bug above shipped a passing, detailed, confident
report before Rich caught it by looking at the actual page.

---

## 3 · INFRASTRUCTURE GOTCHAS DISCOVERED THIS SESSION

**Claude Code permissions — two files, wrong one can win.**
`.claude/settings.json` (shared) and `.claude/settings.local.json`
(personal, untracked) both exist. **Local takes precedence.** If
permission prompts persist after editing `settings.json`, check
`settings.local.json` before assuming the edit didn't take. Both were
rewritten tonight to a broad `"Bash"` allow with a hardened deny list
(`rm -rf`, `sudo`, force-push, `.env` reads) rather than enumerating
every safe command individually — enumeration already failed once.

**Vercel preview deployments have two separate, easily-conflated
gates:** (1) Vercel Deployment Protection/SSO — blocks every request
including API routes unless the browser has a Vercel team session; CC
cannot pass this, so CC's own verification against a *live* preview
URL is structurally limited (tonight's workaround: test an identical
local copy via `http-server`, assert byte-identical push). (2) The
site's own soft-launch passcode gate (`middleware.ts`,
`?access=<LITEN_ACCESS_CODE>`) — separate, currently OFF in Preview.

**Vercel "Redeploy" reuses the build cache by default** — env var
changes do NOT take effect unless "Use existing Build Cache" is
explicitly unchecked. Cost real time tonight on the Stripe webhook fix
appearing not to work when it was actually just a stale cached build.

**Preview branch URLs must match the Supabase Redirect URL allowlist
exactly**, or magic-link sign-in silently fails there. Fixed tonight
with a wildcard: `https://miniramas-git-*-litenco.vercel.app/**`. Use
the `miniramas-git-<branch>` URL form, not the content-hash form —
only the branch-alias form matches the wildcard.

**`git push` from Claude Code is reliably blocked by an auto-mode
safety classifier.** Nobody found a workaround. **Rich pushes every
branch himself, every time** — established, accepted workflow now,
not a bug to keep re-solving.

**Migrations can silently no-op.** The feedback-panel migration used
`CREATE TABLE IF NOT EXISTS` and silently did nothing because an
unrelated older `feedback` table (different schema entirely,
`owner_key`/`category`/`body`/`page`/`read_at`) already existed and
was empty. CC found it, confirmed it was empty before dropping it, and
re-ran correctly. **Always check for a pre-existing table by name
before trusting `IF NOT EXISTS` to mean "created correctly."**

**Two separate Stripe webhook endpoints, two separate signing
secrets** (`STRIPE_WEBHOOK_SECRET` for `/api/v1/webhooks/stripe`,
`STRIPE_PRINT_WEBHOOK_SECRET` for `/api/v1/print/webhook`). Both went
stale from an earlier live/test-mode switch that wasn't fully
reverted. Vercel showed one of them existing ONLY under Production
with no Preview entry at all — a genuinely different variable per
environment, easy to miss since the UI lists them as separate rows.
Both now fixed: rolled fresh secrets in Stripe, set correctly in both
Vercel environments, `.env.local` updated, fresh (non-cached) deploy,
confirmed via real Stripe test events returning 200.

---

## 4 · STRIPE WEBHOOKS — CLOSED

Both endpoints confirmed working via real Stripe test events tonight:

- **Print** (`/api/v1/print/webhook`) — 200 OK, confirmed
- **Credits/Checkout** (`/api/v1/webhooks/stripe`, named "Credits" in
  Stripe's dashboard) — 200 OK, `{"received": true}`, confirmed

Nothing further needed here unless new symptoms appear.

---

## 5 · DISCOVERY BUILD — CLOSED except Task 6 (in flight) and Task 7 (blocked)

### Confirmed working, verified by Rich directly
- All 56 real preview images, correctly mapped
- Gender toggle: plates-based gate (all 8 rooms), photo-driven
  auto-detection, manual override always wins
- Photo upload (client-side base64, matching `portraits.html`'s
  existing pattern)
- Face-centering/cropping on upload thumbnail
- Real selections → real session sync → real payload assembly
- Tier-relock, both directions
- Clear-all/start-over, atomic server-side
- Pose selection (request-time only, no schema change, by design)
- Aspect ratio (cosmetic for now — `generate/route.ts:319` derives
  aspect from framing, discards client value by design; known,
  accepted, not a bug)
- Dual-stale-view bug fixed (every view-switch function now
  defensively hides all other views on every transition)
- **Pose/Aspect rail — fully fixed and confirmed.** Was missing the
  Curator header and all action buttons after an incomplete first
  port; second correction ported the full `renderReviewRail()`
  structure (header, divider, buttons, Start Over confirm) into both
  `renderPoseRail()` and a new `renderAspectRail()`. Verified with
  full-rail Playwright screenshots this time, not just a close-up.

### IN FLIGHT
**Task 6 — Craft button → real Stripe checkout.** Just sent, no report
yet. Brief covers: confirm `startCheckout()`'s current (stub) state
before building, confirm `POST /api/v1/portfolios`'s live contract
still matches earlier inventory, confirm the size-1-routes-to-
single-checkout branch is handled correctly, wire real redirect and
error handling. This is the first task this session touching real
(test-mode) money movement — verification requires an actual completed
test-mode Stripe checkout, not just a payload inspection.

### NOT STARTED
**Task 7 — payment confirmation → NB2 render firing → item in My
Collection.** Do not start this until the item below is checked.

---

## 6 · FEEDBACK PANEL — CLOSED, fully verified end-to-end

Spec: `docs/GOVERNANCE/FEEDBACK-PANEL-HANDOVER-2026-09-05.md` (note:
still needs a one-line correction — §6 assumes three glass files, the
Discovery UI is one consolidated file now, see §9). Component:
`public/litenco-feedback-modal.html` r02.

- Backend (schema, endpoint, GitHub issue automation, digest view) —
  built, migration corrected after the silent-no-op discovery above,
  fully tested.
- Glass integration into `discovery-consolidated-draft.html` — built,
  Playwright-verified (scarab visible, panel opens, context chips
  populate, form works).
- **End-to-end test — all 5 cases pass, verified by Rich directly**:
  real submission with screenshot (GitHub issue #143), without
  screenshot (#144), oversized-screenshot 413-then-retry (#145),
  labels auto-created correctly, rate-limit logic confirmed sound.
- Open, non-blocking decision: scarab test-release-only vs.
  customer-facing forever (handover §8) — defaulted to
  `release='test'` in schema, Rich hasn't ruled yet, not urgent.
- Daily/weekly notification digest (Slack or Resend email for
  severity-2 items) — flagged, not built, needs its own decision on
  mechanism. Not blocking anything.

---

## 7 · WATERMARK PERSISTENCE — STILL UNCONFIRMED, CHECK BEFORE TASK 7

Found early this session: `app/api/v1/portfolios/items/render/route.ts`
bakes a watermark (`bakeWatermark()`) and then discards it — only the
clean, unwatermarked original gets stored (`storeCleanOriginal()`).
This is a real pre-purchase-image-exposure risk, not cosmetic. A fix
task was sent hours ago (persist the watermarked bytes separately,
mint a real signed URL for `previewId`, reusing one of five existing
`createSignedUrl` call sites elsewhere in the codebase for the
pattern). **No completion report was ever received for this task** —
not because it failed, but because the conversation moved on to other
things. **Before starting Task 7, re-check whether this was ever
actually done.** Task 7 (render → My Collection) is meaningless if
customers can't be shown a safe pre-purchase preview.

---

## 8 · NEW SCOPE FOR CENG-52 — other Series and Print Shop

This is genuinely new territory for this session-chain. Almost
everything above is Portraits/Discovery-specific. Rich wants
integration work extended to:

- **Other Series** — Groups, Pets, Halloween, Wallpapers (mobile), and
  whatever else is currently live. (Houses and Landscapes are
  explicitly held per an earlier Rich ruling — do not touch or build
  toward reactivating either without his explicit go-ahead; the
  Curator's Note copy still references them by name even though
  they're unreachable, per much older governance docs.)
- **Print Shop** — per older governance material, Print Shop was
  disabled sitewide via a `printable()` function returning false. **CC
  should verify this is still true before assuming it** — a lot has
  changed this session, and older memory is exactly the kind of thing
  the "read the live file, don't assume" discipline exists to guard
  against. If it's still disabled, find out why and what's needed to
  re-enable it (a flag flip, or something more structural).

### How to start this, concretely

**Do not write a build brief yet.** Given how much drift and stale
assumption cost this session on the Discovery side (§2, §3's migration
gotcha), the very first task for this new scope should be a plain
**inventory pass**, same shape as the one that worked well early in
Discovery's work:

1. For each Series (Groups, Pets, Halloween, Wallpapers): what actually
   exists and works today — catalog/effect registry, upload/analyze
   flow, checkout flow, any Discovery-equivalent UI or is it still the
   older credits-based flow only. Cite file:line for every claim,
   report "not built" plainly where nothing exists rather than
   guessing.
2. For Print Shop specifically: confirm the current state of
   `printable()` (or whatever the current live gate mechanism is —
   don't assume the name/mechanism from old memory without checking
   the actual file), what's needed to re-enable it, and whether
   Prodigi integration (`lib/v1/print/prodigi-client.ts`,
   `PRODIGI_ENV`/`PRODIGI_KEY_LIVE`/`PRODIGI_KEY_SANDBOX` — confirmed
   present in `.env.local` earlier this session) is currently
   functional or stale.
3. Report back plainly, flat, no recommendations yet — same discipline
   that worked well for the original Discovery inventory. Decisions
   about what to build get made after the real state is known, not
   before.

---

## 9 · HOUSEKEEPING PILE — tagged, some new, none urgent tonight

- **Branch sprawl.** 15+ preview branches created this session alone,
  none merged toward `minramas`'s actual long-term state beyond what's
  landed on `ceng-halloween-revise`. Needs a consolidation pass before
  any real launch.
- Two stray `.gitignore` lines (`.vercel`, `.env*`), origin unknown,
  never ruled on.
- 41 archive deletions + 13 route-stub edits sitting uncommitted in
  `minramas`, predating this session's Discovery work, unrelated to it.
- `FEEDBACK-PANEL-HANDOVER-2026-09-05.md` needs a one-line correction
  (§6 → one glass file, not three).
- Three test GitHub issues (#143, #144, #145) from the feedback-panel
  E2E test are still open — real test data, not real customer reports;
  close them out or leave as reference, Rich's call, no urgency.

---

## 10 · WORKING WITH RICH — patterns that worked this session

- Terse, bottom-line first. Long explanations aren't wanted unless
  asked for.
- **Screenshots are directives, not discussion prompts.** Read the
  visual change requested and act — don't ask him to re-describe what
  he already showed.
- Rich gets reasonably frustrated when a task is reported "done" and
  turns out partial (happened multiple times tonight — see §2). Right
  response each time: own it plainly, verify the actual gap
  independently where possible, send a precise correction — no
  over-apologizing, no defensiveness.
- Rich explicitly does not want to be the one re-enumerating what's
  still broken every time — *"I am not going to waste my time again
  saying whats not done."* When a report looks incomplete, examine the
  evidence (screenshots, prior specs) and write the correction
  proactively.
- When Rich says "yes"/"go" ambiguously after options were presented,
  state the assumption plainly and proceed — don't stall re-confirming.
- Rich is capable and technical but not full-time engineering staff —
  explain infrastructure gotchas (build cache, allowlists, settings
  precedence) in plain terms, since he executes the dashboard steps
  himself.

---

## 11 · STANDING PROCESS RULES ESTABLISHED THIS SESSION

- Every CC task brief requires real verification proof scaled to what
  jsdom cannot see: Playwright screenshots for layout, real network
  traces for server interactions, computed-style checks for CSS.
- Check-first, don't rebuild blind — several "gaps" tonight were small
  breaks in already-working functionality, not missing features.
- Flag schema/migration decisions, never apply them silently — and
  check for pre-existing tables/objects by name, since `IF NOT EXISTS`
  can silently no-op against something unrelated.
- Rich pushes to git himself; stop trying to route around the
  `git push` classifier block.
- One file, not three, for Discovery glass work.
- Name carryover docs `CENG-CARRYOVER-<date>.md`, footer identifies
  the session (e.g. `*CENG-51 — 5 September 2026*`) — easy to forget,
  Rich's explicit standing instruction.

---

*CENG-51 — 5 September 2026*
