# Account and Concierge restoration â€” 2026-09-26

Source: public/portraits.html â€” 12469 lines, read 2026-09-26. Source left unchanged.

Approved adaptations: preserve designs; replace obsolete credit model with Collection Unlocks; retain account/profile functionality; hide Print Shop; restore Concierge and reconcile guidance.

- Account CSS copied from the donor. Its header selectors are scoped to .acct so Collection is untouched. Panel left edge uses canonical --rail-w, z-index uses canonical Collection level; mobile left edge is zero. Missing donor color/texture tokens are scoped to Account with donor values.
- Account markup copied unchanged. Logic retains the card renderer, formatting, profile and purchase layouts. Removed Print Shop/address UI and obsolete generation-credit purchasing; balance uses collectionUnlockBalance, activity reads consumed paid wallet entitlements, purchase labels reflect current product types. Purchase Unlocks opens existing My Collection; Sign Out calls existing onAuthButton. Account opens over the current Portraits/Pets surface; direct /account uses canonical Portraits with the same opener.
- Donor CSS counts: base 22 lines + Account 255 lines + header 28 lines = 305 lines in; 308 lines out including spacing and 2 scoped geometry/token adapters. No new visual design values; canonical geometry and donor tokens reused.
- Concierge uses existing concierge.js and /api/v1/concierge. Trigger and script include copied, desktop/tablet hiding removed. Pointing map uses current equivalent selectors and omits absent cart/Gallery; question seed uses current Unlock terminology. Existing action log emits concierge:acted. Chat greeting and server guidance updated to approved pricing, current navigation, Google/email, no Print Shop. No service or interaction redesign.
- No new schema, migrations, payment fulfillment, auth architecture, or Production deployment.

## Port trace

### public/discovery-consolidated-draft.html â€” 10943 lines â€” 2026-09-26


- Account styles: donor 3217â€“3237, 3633â€“3887 and 3889â€“3915; destination 3022â€“3329 (308 lines). Geometry/scoping adapters below; visual declarations retained.

- Account markup: source 5229â€“5243; destination 10710â€“10724; 15 in / 15 out, byte-identical.

- Account logic: source 11376â€“11727 (352 lines); destination 10732â€“10927 (196 lines). Authorized adaptations below.

- Concierge trigger: source 4966â€“4969, 4 in / 4 out; destination 3392â€“3395, byte-identical.

### public/pets.html â€” 10474 lines â€” 2026-09-26


- Account styles: donor 3217â€“3237, 3633â€“3887 and 3889â€“3915; destination 3022â€“3329 (308 lines). Geometry/scoping adapters below; visual declarations retained.

- Account markup: source 5229â€“5243; destination 10241â€“10255; 15 in / 15 out, byte-identical.

- Account logic: source 11376â€“11727 (352 lines); destination 10263â€“10458 (196 lines). Authorized adaptations below.

- Concierge trigger: source 4966â€“4969, 4 in / 4 out; destination 3398â€“3401, byte-identical.

## Focused checks
Inline scripts parse in both surfaces; unique Account/Concierge IDs; donor markup/trigger identity verified. Account renderer fixtures verify balance, purchase labels, sign-in copy and no obsolete controls. Three API tests verify owner scope, unauthenticated rejection, paid wallet activity filtering and unknown-versus-zero handling.

## Deferred
Existing account deletion endpoint and historical credit-era pages remain untouched and are not exposed by this restoration. No unrelated investigation performed.

Preview verification: authenticated Account renders live balance and purchases; Purchase Unlocks opens existing Collection; Pets opens Account without leaving /pets/discovery. Concierge answered approved pricing, Google/email and no Print Shop. Mobile chat sheet opens and closes correctly. Account mobile check identified missing donor header/account rules; copied those rules into both surfaces. Scoped header selectors use :where(.acct) to preserve donor specificity. No sign-out or purchases executed.

Final discovery-consolidated-draft.html: 10963 lines. Account CSS destination 3022–3350, 329 lines including mobile adapters.

Final pets.html: 10494 lines. Account CSS destination 3022–3350, 329 lines including mobile adapters.

Canonical-width adapter: .acct .ac-card and .acct .ac-pair use min-width:0 so the copied grids fit the narrower canonical panel/mobile viewport rather than growing to purchase-label intrinsic width. Existing typography, gaps, card styling and grid proportions are unchanged.
