# Account and Concierge restoration — 2026-09-26

Source: public/portraits.html — 12469 lines, read 2026-09-26. Source left unchanged.

Approved adaptations: preserve designs; replace obsolete credit model with Collection Unlocks; retain account/profile functionality; hide Print Shop; restore Concierge and reconcile guidance.

- Account CSS copied from the donor. Its header selectors are scoped to .acct so Collection is untouched. Panel left edge uses canonical --rail-w, z-index uses canonical Collection level; mobile left edge is zero. Missing donor color/texture tokens are scoped to Account with donor values.
- Account markup copied unchanged. Logic retains the card renderer, formatting, profile and purchase layouts. Removed Print Shop/address UI and obsolete generation-credit purchasing; balance uses collectionUnlockBalance, activity reads consumed paid wallet entitlements, purchase labels reflect current product types. Purchase Unlocks opens existing My Collection; Sign Out calls existing onAuthButton. Account opens over the current Portraits/Pets surface; direct /account uses canonical Portraits with the same opener.
- Donor CSS counts: base 21 lines + Account 255 lines + header 27 lines = 303 lines in; 308 lines out including spacing and 2 scoped geometry/token adapters. No new visual design values; canonical geometry and donor tokens reused.
- Concierge uses existing concierge.js and /api/v1/concierge. Trigger and script include copied, desktop/tablet hiding removed. Pointing map uses current equivalent selectors and omits absent cart/Gallery; question seed uses current Unlock terminology. Existing action log emits concierge:acted. Chat greeting and server guidance updated to approved pricing, current navigation, Google/email, no Print Shop. No service or interaction redesign.
- No new schema, migrations, payment fulfillment, auth architecture, or Production deployment.

## Port trace

### public/discovery-consolidated-draft.html — 10943 lines — 2026-09-26


- Account styles: donor 3217–3237, 3633–3887 and 3889–3915; destination 3022–3329 (308 lines). Geometry/scoping adapters below; visual declarations retained.

- Account markup: source 5229–5243; destination 10710–10724; 15 in / 15 out, byte-identical.

- Account logic: source 11376–11727 (352 lines); destination 10732–10927 (196 lines). Authorized adaptations below.

- Concierge trigger: source 4966–4969, 4 in / 4 out; destination 3392–3395, byte-identical.

### public/pets.html — 10474 lines — 2026-09-26


- Account styles: donor 3217–3237, 3633–3887 and 3889–3915; destination 3022–3329 (308 lines). Geometry/scoping adapters below; visual declarations retained.

- Account markup: source 5229–5243; destination 10241–10255; 15 in / 15 out, byte-identical.

- Account logic: source 11376–11727 (352 lines); destination 10263–10458 (196 lines). Authorized adaptations below.

- Concierge trigger: source 4966–4969, 4 in / 4 out; destination 3398–3401, byte-identical.

## Focused checks
Inline scripts parse in both surfaces; unique Account/Concierge IDs; donor markup/trigger identity verified. Account renderer fixtures verify balance, purchase labels, sign-in copy and no obsolete controls. Three API tests verify owner scope, unauthenticated rejection, paid wallet activity filtering and unknown-versus-zero handling.

## Deferred
Existing account deletion endpoint and historical credit-era pages remain untouched and are not exposed by this restoration. No unrelated investigation performed.
