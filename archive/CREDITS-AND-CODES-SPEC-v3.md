# CREDITS & CODES SPEC v3 — for CC
**Supersedes v2 and `COMP-CODE-SPEC-v1`.** Drop this in `/payload`.
**Date:** 2026-07-23 · Incorporates: three-choice refund model · `craft_events` (migration 007) · the `runAll` call-path swap · entry-gate sign-in specifics.

---

## 1 · Core model
```
credits IN  → Stripe purchase (Aug 15, flag-hidden) | code redemption (Aug 1) | grant / referral
credits OUT → craft spend (1 credit)
```
One balance per account. One ledger. Every craft passes the same gate; only the funding source differs.

**Codes are a payment method inside commerce, not a bypass around it.** Card and code both terminate in the same ledger. Aug 1 runs the real plumbing with Stripe disabled — Stripe-on is a config flip, not a rebuild. **If codes skip the ledger, Aug 1 tests nothing real.**

---

## 2 · Tables

**`credit_balances`**
- `owner_key` (PK — auth user id, else guest token) · `balance` (int) · `updated_at`

**`credit_ledger`** — append-only, every movement
- `id`, `owner_key`, `delta` (int, +/-)
- `reason` ('purchase' | 'code' | 'grant' | 'referral' | 'craft' | 'refund')
- `ref_id` (code / stripe payment id / piece id / craft_event id)
- `balance_after`, `created_at`

**`access_codes`**
- `code` (PK) · `kind` ('admin' | 'tester' | 'promo' | 'referral' | 'unlock')
- `credits_granted` (int; null = unlimited, admin only)
- `max_redemptions`, `redemptions_used`
- `expires_at` (nullable), `active` (bool)

**`code_redemptions`** — prevents double-redeem
- `code`, `owner_key`, `credits_granted`, `redeemed_at` · unique(`code`, `owner_key`)

**`craft_events`** — already landed as migration `007_craft_events.sql`. **Reconciliation rule: any `craft_events` row with a non-zero `credits_delta` MUST have a matching `credit_ledger` row.** The two must always reconcile — this is dispute evidence and the only source of a real failure rate.

---

## 3 · Aug 1 seed
- `RHONE3166` — kind `admin`, unlimited, never depletes, Rich only.
- 10 tester codes, **50 credits each**, one redemption per account:
  `TESTER-AMBER` · `TESTER-BRASS` · `TESTER-CEDAR` · `TESTER-DELTA` · `TESTER-ELDER` · `TESTER-FLINT` · `TESTER-GROVE` · `TESTER-HAVEN` · `TESTER-IVORY` · `TESTER-JASPER`

---

## 4 · THE CALL-PATH SWAP — the one hard task

**Current (broken for Aug 1):** in `runAll`, every pending item is `!paid` → `startCheckout` (Stripe) → `cart_identity_required` 400 → **`craftPending()` is never reached.** The whole wired render path sits behind a payment divert that cannot succeed.

**Replace the divert with the credits gate:**
```
runAll
  → count pending items = N
  → POST /api/v1/credits/gate  { owner_key, count: N, series, presets[] }
      ← { ok: true,  balance_after, granted: N }
      ← { ok: false, reason: 'insufficient_credits', balance, needed }
  → if ok:    mark items paid/entitled → craftPending()   ← the existing wired path, unchanged
  → if !ok:   surface "not enough credits" + Redeem / Buy (Buy flag-hidden Aug 1). No Stripe call.
```

**Gate route responsibilities (server-side, service-role):**
1. Read balance for `owner_key`.
2. `balance >= N` → decrement by N, write **N** `credit_ledger` rows (`reason:'craft'`) and **N** `craft_events` rows (`event:'craft_started'`).
3. `balance < N` → no mutation, return the shortfall.
4. **`RHONE3166` accounts never decrement** — still write ledger + event rows with `delta 0` so the audit trail is complete.

**Do not touch `craftPending()` or any of the 13 existing `fetch()` calls.** This swap is upstream of the render path.
**`/api/v1/checkout` stays wired but unreached on Aug 1** — it is the Aug 15 funding path for buying credits, not for crafting.

---

## 5 · Failure remedies — three parallel choices
Not sequential. Any studio failure offers all three at once:

| Failure | Choices |
|---|---|
| **Soft** (image rendered, failed likeness) | Recraft · Accept as-is · Credit · Refund |
| **Hard** (500 / no image) | Recraft · Credit · Refund |

| Choice | Credit effect | Ledger row |
|---|---|---|
| **Recraft** | free — no new debit | `craft_events` only, `credits_delta 0` |
| **Accept as-is** | none — piece is kept | none |
| **Credit** | +1 back to balance | `credit_ledger` reason `'refund'` |
| **Refund** | Aug 1 → +1 credit back · Aug 15 → Stripe reversal | `'refund'` (+ payment reversal Aug 15) |

**⚠ Copy must be source-aware.** *"Refunded to your card"* is wrong on Aug 1 — no card was charged. Credit-funded → "credit returned." Card-funded → "refunded to your card." → CENG for strings.

**Persist the decision.** `user_decision` currently lives only in client state and evaporates on reload — write it to `craft_events`.

---

## 6 · Entry gate — sign-in specifics
Order at the door, all **before render**:
1. **Code field** → validate against `access_codes` (active, not expired, redemptions left).
2. **Magic-link sign-in** → existing `SigninModal.tsx` → `signInWithOtp` → `app/auth/callback/route.ts`. **Already built and deployed — wire to it, do not rebuild.**
3. **Consent checkbox** → already shipped (T5).

**Why sign-in and not guest:** identity resolves `cart_identity_required` permanently, gives cross-device collection, and attaches credits to a person rather than a browser. A guest token still works as fallback for persistence, but **code redemption requires an account** — otherwise one code can be re-redeemed from every fresh browser.

**Redemption is idempotent per account.** Second redeem of the same code by the same `owner_key` → friendly "already redeemed," no double grant.

**First-login destination is the Account page.**

---

## 7 · Presentation rules (gallery register, not arcade)
- No low-balance nag, no depleted meter, no countdown pressure.
- No bonus-credit tier ladders. Quiet quantity pricing only.
- Buying is a considered act inside Account — **never an interstitial mid-craft.**
- Buy Credits ships **built but flag-hidden** Aug 1.
- Referral: `kind='referral'` schema-ready. Loop is 3 qualified friends → 2 credits, cap **10 per account**. Qualification: confirmed email → magic-link sign-in → **first craft completed.** No credit card in the referral path. Flow is Aug 15+; it issues codes like any other kind, so no new architecture.

---

## 8 · Definition of Done (Aug 1)
- Redeem `TESTER-AMBER` → 50 credits, ledger row written; second redeem by same account blocked.
- Craft debits 1 credit, writes `credit_ledger` + `craft_events`, **reaches `craftPending()`**, piece renders and lands in My Collection.
- Balance 0 → craft blocked with a clear message and a Redeem path. **No Stripe call fires.**
- `RHONE3166` never depletes; audit rows still written.
- Failed craft offers Recraft · Credit · Refund; chosen remedy persists and reconciles between `craft_events` and `credit_ledger`.
- **End-to-end walk visible:** homepage → gate → upload → analyze → curate → craft → rendered image → collection → download.
