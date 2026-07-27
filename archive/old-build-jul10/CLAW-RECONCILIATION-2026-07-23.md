# CLAW RECONCILIATION → CUI PAYLOAD
**Date:** 2026-07-23 · **Read with:** `CC-PAYLOAD-MASTER-2026-07-22.md` + `CC-PAYLOAD-portraits-2026-07-22.md` + `SPEC-autonaming-2026-07-22.md`
**Status:** CUI's payload is line-verified and stands. This file corrects three stale items and adds five locked items it predates. **Where this file conflicts with CUI's, this file wins.**

---

# 1 · CORRECTIONS — CUI payload is stale on these

## 1.1 · Print Shop is IN for Aug 1 — not paused
**CUI master says:** "Paused: Print Shop … `litenco-printshop-2026-07-21-r9.html` — do not build for Aug 1."
**Correct:** print was reversed back **IN** on Jul 23. Print Shop UI ships; **Prodigi fulfillment is OFF** — testers walk the print path, no order is placed, no cost is incurred. Rich sends his own test prints separately.
*Note CUI's payload is already internally inconsistent here — §2 Account correctly includes Print History and Cart.*
**Corrected path:** Homepage → entry gate → Portraits workshop → My Collection (in Account) → download **+ Print Shop**.

## 1.2 · §5 Identity / entry gate is NOT blocked — it is specced and the foundation exists
**CUI says:** "Supabase Auth is the unbuilt foundation… cannot be specced until someone decides."
**Correct:** CC confirmed on Jul 22 that **Supabase Auth is built and deployed** — magic-link OTP (`SigninModal.tsx` → `signInWithOtp`), completion route `app/auth/callback/route.ts`, server `getUser()` in `lib/store/auth.ts`, `GET /api/v1/auth/me`. Persistence is live via `collection_pieces` with `owner_key` (auth user id, else guest token) and service-role RLS.
CUI's finding that `portraits.html` has no auth hits is accurate — **the client doesn't call auth; the auth lives in the Next.js components.** This is a wiring job, not an unbuilt foundation.
**Decision, locked:** Aug 1 is **code-gated + magic-link sign-in + consent**, all before render. Spec: `CREDITS-AND-CODES-SPEC-v2`.
**§5 is unblocked. Build it.**

## 1.3 · Order of work item A is already done
Backend restore to `8796549` — **CC confirmed 0-diff on Jul 22.** Do not redo. Skip to B.

## 1.4 · §1 Download end state contradicts the Print reversal *(caught by CUI)*
**CUI §1 says:** "No commerce on this screen. No print upsell, no pricing, no Print Shop link. This is the end of the Aug 1 path."
**Correct:** with Print back in, download is **not** the end of the path, and the download screen is exactly where the print handoff belongs.
**Revised download end state — three CTAs:**
- **Craft another** → returns to upload, clears the source
- **Your Collection** → opens My Collection
- **Send to Print Shop** → carries the piece into the print path
Still **no pricing, no tier language, no discount language** on this screen. The print CTA is a handoff, not a sell.
*Same root cause as 1.1, but a separate instruction in a separate section — CC would follow it independently and build a dead end. Treat this delta as authoritative on anything Print-adjacent in CUI's file.*

---

# 2 · ADDITIONS — locked after CUI's payload was written

## 2.1 · Delete plaques and free preview 🔴 *(not flagged — deleted)*
Rich confirmed both are gone from the product. **Delete, do not flag.**
- **Plaques** — 14 refs in `portraits.html`. Retired system-wide.
- **Free preview** — 11 `is_preview` refs, Free Preview band (~4925/4957), `previewEmailInput`, `PREVIEW_FLAG` / `liten_preview_used`, dismiss flags, and the `is_preview && !purchased` download lock.
**Why preview goes:** credits replace it. Two free-first mechanics conflict, and preview produces a piece the tester cannot download — reads as broken on a path whose whole point is reaching a download.

## 2.2 · Retry affordance on hard failure 🔴 S1 — absent from CUI payload
CAQ's highest value / lowest cost item and it is not in the payload.
**Current split:** soft failure (image rendered, failed likeness) → QA panel with real choices ✅. Hard failure (500, exception, no image) → bare error string, **no action** ❌.
**Action:** one "Try again" button on any row with `status:'failed'`. Re-queues the same configuration — reuse the existing `makeVariation()` clone pattern. **Requires no modal infrastructure. Ship even if everything else slips.**

## 2.3 · Failure & remedy tracking → Supabase 🔴 new
`user_decision` currently lives **only in client state** (`item.user_decision`, lines 8964–9011; code comment reads *"No payment plumbing yet"*). It is never sent to `/pieces`. Only successful pieces persist — failures, attempts, failure reasons and the customer's remedy choice all evaporate on reload.
With credits live, that is unrecorded money movement.
**Add `craft_events`** (append-only): `id`, `owner_key`, `piece_id`, `source_photo_id`, `series`, `preset`, `event` ('craft_started' | 'craft_succeeded' | 'craft_failed' | 'redirected' | 'intake_rejected'), `failure_type` ('timeout' | 'fatal_error' | 'likeness_fail' | null), `failure_reason` (engine `final_reason`), `attempts`, `user_decision` ('recraft' | 'credit' | 'refund' | 'accept' | null), `credits_delta`, `created_at`.
Write on craft start, craft resolve, and every user decision. **Any decision moving credits must also write a `credit_ledger` row — the two must reconcile.** Persist the QA panel decision instead of holding it in client state so it survives reload.
**Two reasons beyond bookkeeping:** dispute evidence, and the only way to learn the real failure rate across the test.

## 2.4 · Studio failure = three parallel choices 🔴 corrected
Not sequential. Any studio failure offers all three at once:
**A · Recraft · B · Credit · C · Refund**
- **Soft failure** (image exists, failed likeness): Recraft · Accept as-is · Credit · Refund
- **Hard failure** (no image): Recraft · Credit · Refund
**⚠ Copy correction:** *"Refunded to your card"* is **wrong for Aug 1** — no card is charged; credits came from a code. Copy must be source-aware: credit-funded → "credit returned"; card-funded → "refunded to your card." → CENG for strings.

## 2.5 · Delete confirmation 🟡 S2 — absent from CUI payload
Deleting a piece is irreversible with zero guard (no `Undo`, no `Are you sure`). Add a confirm step or a 5-second undo toast.

## 2.6 · Cut "At Capacity" from the modal set
`generate` emits `intake_rejected`, `redirected`, `fatal_error`, or success. **There is no `deferred` / capacity state.** The modal cannot fire — design orphan. **Cut.** Not adding engine states nine days out.
*Timeouts are separate and already covered — they surface as fatal_error and are handled by the hard-failure path + §2.2 retry.*

## 2.7 · Money system → `CREDITS-AND-CODES-SPEC-v2`
Codes are **a payment method inside commerce, not a bypass around it.** Card and code both terminate in the same entitlements ledger; a craft debits it. Aug 1 runs real plumbing with Stripe disabled — Stripe-on is a config flip.
**Seed:** `RHONE3166` admin unlimited · 10 tester codes @ 50 credits, one redemption per account.
**⚠ Wiring question — answer before building:** the Craft action currently hits `/api/v1/checkout` (Stripe). With credits it must hit the **credits gate**. Confirm and report the new call path.

---

# 3 · NO CONFLICT — confirmed, proceed as written
- Auto-naming: `SPEC-autonaming` supersedes portraits Task 6. The open `[FirstName]` question is **already resolved** by the newer spec — option (a), "Who is this?" at Frame. Ship (a), not the (c) fallback.
- Ground rule "never edit `portraits.html` directly → `portraits.next.html` → verify → merge" — correct and locked.
- Tier strip (T1) incl. the warning to **leave the Tier 1 source-photo resolution gate intact** — correct, that judges the upload not an output tier.
- Discount language (T2) as dormant-not-live — correct read; remove anyway.
- Artist Series flag-gate (T3) — correct, flag not delete, returns at premium.
- Redirect CTA (T4) incl. no dead links to out-of-scope Series — correct.
- Consent (T5) — correct, and CUI's single-line copy is better than CAQ's.
- Groups map drift (T7) — verify and report, do not reconcile.
- CSS/JS split — optional, port direction r77 UI → `portraits.html`, never reverse.

---

# 4 · RICH'S DECISIONS — Jul 23, locked

## 4.1 · Wallpapers — SHIPPING
It is one of the five. **Drop "Coming soon" from the Account Discover slot** — that badge is stale from when Wallpapers was a reserved placeholder. **Build the card live but flag-gated.** If Jul 29–30 slips, flip the flag off: one line, no redesign, no dead tile.
**Do not ship it labeled "Coming soon" while it is in scope — testers read that as cut.**

## 4.2 · Two token systems — ACCEPTED DEBT, one exception
Full palette reconciliation is too large before Aug 1 and touches every surface. **Exception: unify the masthead.** It appears on every screen, and it is what makes the shift read as a bug rather than as different rooms.
**Action:** one shared masthead component on shared tokens. Workshop stays vellum/coffee inside; Account stays limestone inside — that reads as intentional. **Full token merge is post-launch.**
