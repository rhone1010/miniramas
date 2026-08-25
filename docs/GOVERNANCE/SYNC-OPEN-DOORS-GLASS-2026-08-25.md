# SYNC - OPEN DOORS ON THE GLASS - 25 August 2026
CUI 41A -> CUI 42, CUI 41B. Companion to CENG's OPEN-DOORS spec of this
morning. The model: browse free, account at the moment of intent, the
passcode is now an optional coupon worth 50 credits.

**The working template is on main: `public/portraits.html` (merged in the
lane/cui41a PR this morning) and `scripts/patch-signin-invite-r1.py`,
which contains every edit below as anchored patches with DRAFT copy
marked. Read the patch before reinventing anything.**

---

## WHAT EVERY SELLING SURFACE NEEDS (42: wallpapers)

1. **The optional invite field on the sign-in card.** Under the email
   input, before the error div:
   - label: "Have an invite code?" + "50 credits on us - optional" (DRAFT)
   - input id="signinCode", autocapitalize="characters", no autocomplete
2. **The code rides AHEAD of the link.** In sendLink, a filled code
   POSTs `/api/v1/invite` with `{ email, code }` BEFORE the signin
   fetch. `ok` -> proceed to the normal send. `bad_code` -> say it
   plainly, halt, let them fix or clear; an empty field never blocks.
   Network failure checking the code -> "clear it to sign in without
   it." The route validates the code server-side; the browser never
   names an amount.
3. **No pre-checking.** The engine's 401 `not_signed_in` on gated routes
   is the trigger for the card. If your surface already opens the card
   on 401, nothing else moves.

## WHAT EVERY SURFACE NEEDS (42 and 41B both)

4. **The copy sweep.** Anywhere saying 80 credits / eight images ->
   50 / five. Better: count from the server's number, never hardcode -
   portraits now computes pieces = floor(credits/10) and words it.
5. **Ledger label**, if your surface renders the account ledger:
   `launch_grant: 'Welcome credits'` (DRAFT) in the AC_REASON map.
6. **Family message** gains "check spam" - Yahoo defers our mail ~5 min.

## WHAT NOT TO DO

- Do not build a welcome screen - it lives on index only, 41A's.
- Do not gate browsing anywhere. The wall is coming off (CENG's B);
  glass assumes open browsing everywhere.
- Do not trust SOFT_LAUNCH state you find in your file - portraits
  reads `false` today and whether that was deliberate is an open
  question to Rich. Ask before flipping anything.

## SEQUENCING

CENG ships the invite-route `code` check (A) before the wall drops (B),
one PR. The glass field is SAFE to ship before A lands: until then a
filled code gets the "could not be checked" line and an empty field is
untouched. Portraits is already live this way.

*CUI 41A - 25 August 2026*
