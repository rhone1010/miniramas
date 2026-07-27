# CREDITS & CODES SPEC v4 — for CC
**Supersedes v3, v2, `COMP-CODE-SPEC-v1`.** Drop in `/payload`. **Update the cover note reference from v3 → v4.**
**Date:** 2026-07-24 · Change from v3: **1 credit/image → 10 credits/image**; tester grant re-scaled; scaling model logged.

---

## 0 · CHANGES FROM v3 — read first
- **A Crafted Image now costs 10 credits** (was 1). Locked ruling, 2026-07-24.
- **⚠ TESTER GRANT — decision confirm.** v3 gave 50 credits = 50 images at 1/image. At 10/image, 50 credits = **5 images** — too few to test finishes. **This spec sets tester codes to 500 credits (= 50 images), preserving the original allowance.** Knock it down if 50 images/tester is too generous.
- Scaling model (premium/curiosity/wallpaper as credit multiples) is **schema-ready but not wired** — Aug 15.

---

## 1 · Core model
```
credits IN  → Stripe purchase (Aug 15, flag-hidden) | code redemption (Aug 1) | grant / referral
credits OUT → craft spend (10 credits / standard Crafted Image)
```
One balance per account. One ledger. Every craft passes the same gate; only the funding source differs.

**Codes are a payment method inside commerce, not a bypass around it.** Card and code both terminate in the same ledger. Aug 1 runs the real plumbing with Stripe disabled — Stripe-on is a config flip. **If codes skip the ledger, Aug 1 tests nothing real.**

**Credit cost is config, not hardcoded.** Standard = 10. Structure the code so premium/curiosity/wallpaper can carry different values without a rewrite (see §7 parking).

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

**`craft_events`** — migration `007_craft_events.sql`. **Reconciliation rule: any `craft_events` row with non-zero `credits_delta` MUST have a matching `credit_ledger` row.** Dispute evidence + the only real failure-rate source.

---

## 3 · Aug 1 seed
- `RHONE3166` — kind `admin`, unlimited, never depletes, Rich only.
- 10 tester codes, **500 credits each (= 50 images @ 10)**, one redemption per account:
  `TESTER-AMBER` · `TESTER-BRASS` · `TESTER-CEDAR` · `TESTER-DELTA` · `TESTER-ELDER` · `TESTER-FLINT` · `TESTER-GROVE` · `TESTER-HAVEN` · `TESTER-IVORY` · `TESTER-JASPER`

---

## 4 · THE CALL-PATH SWAP — the one hard task

**Current (broken for Aug 1):** in `runAll`, every pending item is `!paid` → `startCheckout` (Stripe) → `cart_identity_required` 400 → **`craftPending()` is never reached.**

**Replace the divert with the credits gate:**
```
runAll
  → N = pending items ; COST = 10 ; total = N × COST
  → POST /api/v1/credits/gate  { owner_key, count: N, cost_per: COST, series, presets[] }
      ← { ok: true,  balance_after, debited: total }
      ← { ok: false, reason: 'insufficient_credits', balance, needed: total }
  → if ok:    mark items paid/entitled → craftPending()   ← existing wired path, unchanged
  → if !ok:   surface "not enough credits" + Redeem / Buy (Buy flag-hidden Aug 1). No Stripe call.
```

**Gate route (server-side, service-role):**
1. Read balance for `owner_key`.
2. `balance >= N×COST` → decrement by `N×COST`; write **N** `credit_ledger` rows (`reason:'craft'`, `delta −10` each) and **N** `craft_events` rows (`event:'craft_started'`, `credits_delta −10`).
3. `balance < N×COST` → no mutation, return the shortfall.
4. **`RHONE3166` never decrements** — still write audit rows with `delta 0`.

**Do not touch `craftPending()` or any of the 13 existing `fetch()` calls.** The swap is upstream of the render path.
**`/api/v1/checkout` stays wired but unreached Aug 1** — Aug 15 funding path for buying credits, not for crafting.

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
| **Accept as-is** | none — piece kept | none |
| **Credit** | **+10** back to balance | `credit_ledger` reason `'refund'`, `delta +10` |
| **Refund** | Aug 1 → **+10 credits** · Aug 15 → Stripe reversal | `'refund'` (+ payment reversal Aug 15) |

**⚠ Copy source-aware.** "Refunded to your card" is wrong Aug 1 — no card charged. Credit-funded → "credit returned." Card-funded → "refunded to your card." → CENG.
**Persist the decision** to `craft_events` — it currently lives only in client state and evaporates on reload.

---

## 6 · Entry gate — sign-in specifics
Before render, in order:
1. **Code field** → validate against `access_codes` (active, not expired, redemptions left).
2. **Magic-link sign-in** → existing `SigninModal.tsx` → `signInWithOtp` → `app/auth/callback/route.ts`. **Built + deployed — wire to it, don't rebuild.**
3. **Consent checkbox** → already shipped (T5).

**Why sign-in not guest:** resolves `cart_identity_required` permanently, gives cross-device collection, attaches credits to a person. Guest token still works for persistence, but **code redemption requires an account** — else one code re-redeems from every fresh browser.
**Redemption idempotent per account.** Second redeem by same `owner_key` → "already redeemed," no double grant.
**First-login destination: Account page.**

---

## 7 · Presentation rules + parking
- No low-balance nag, no depleted meter, no countdown pressure.
- No bonus-credit tier ladders. Quiet quantity pricing only.
- Buying is a considered act inside Account — never mid-craft interstitial.
- Buy Credits ships built but flag-hidden Aug 1.
- Referral: `kind='referral'` schema-ready. 3 qualified friends → credits, cap 10/account. Qualification: confirmed email → sign-in → first craft. No card in the path. Flow Aug 15+.

**Parking — Aug 15 pricing (schema-ready, not wired):**
- Pack pricing at non-round ratios (e.g. ~20 credits / $9.99) so credits read as their own unit, not a dollar alias.
- Credit costs as multiples of the 10 base: premium/interpretive (gpt-image-1) 15–20 · curiosity ~8 · wallpaper export 5 · recraft-with-tweaks ~3.
- Real dollars-per-image target named explicitly at Aug 15, not backed into via pack size.

---

## 8 · Definition of Done (Aug 1)
- Redeem `TESTER-AMBER` → 500 credits, ledger row written; second redeem by same account blocked.
- Craft debits **10 credits**, writes `credit_ledger` + `craft_events`, **reaches `craftPending()`**, piece renders → My Collection.
- Balance < 10 → craft blocked with clear message + Redeem path. **No Stripe call fires.**
- `RHONE3166` never depletes; audit rows still written.
- Failed craft offers Recraft · Credit · Refund; remedy persists and reconciles between `craft_events` and `credit_ledger`.
- **End-to-end walk visible:** homepage → gate → upload → analyze → curate → craft → rendered image → collection → download.
