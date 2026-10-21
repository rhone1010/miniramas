# Customer journey fixes — 2026-10-21

Branch: `codex/customer-journey-launch`, based on `1f1d00d`.
Scope: independent Collection, Account, Help and navigation adapters. No shared Product Studio, Gift Wizard, catalog, backend, migration, or Foyer assets changed. Codex 1 has reserved further global navigation/footer work.

## Reproduced walls and fixes

- Groups → Gifts → Print Shop went through Portraits Discovery and arrived at Collection with `from=portraits`. The existing menu now goes directly to Collection with the current validated series.
- On desktop Account, the open More menu was underneath the Account panel (masthead stacking level 120, Account 220). Extended the existing mobile open-menu stacking selector to desktop menus, preserving its existing value and all visual declarations.
- Collection's Groups filter disappeared on desktop refresh. Enabled the existing mobile sessionStorage restoration on both widths and repaint cached artwork after restoring the view. Existing storage key, artwork identities and server contracts remain unchanged.
- Help's Printing guide said Print Shop was unavailable. Replaced that text with four verbatim paragraphs from the approved physical-gift disclosure (payment preparation, approval before manufacture, pre-submission refund, exclusion of preview packs).
- Help/Account return paths lost Groups context. Their menu links now carry validated `from`; explicit Back actions return to that series. Internal Help navigation does not trigger an extra return navigation.

## Actual browser verification

Protected Preview alias: https://miniramas-git-codex-canonical-2026-09-24-litenco.vercel.app/
Changed static assets were served through temporary browser-only request overrides against the real Preview backend; this branch was not deployed. Overrides were cleared afterward. The alias may advance as Codex 1 integrates independent work.

- Desktop 1280px and mobile 390px: homepage Groups, Pets and Portraits entry links reached their Discovery routes without Foyer.
- Direct legacy links: `/foyer.html` → `/portraits`; `/groups-foyer.html` → `/groups`; `/pets-foyer.html` → `/pets/discovery`. Existing integrated bypass required no new change.
- Desktop Groups Print Shop → `/collection?from=groups`; authorized account loaded 8 existing owned artworks and 4 unlocks. Applying Groups showed 4 cards. Refresh restored Filter · 1 and the same 4 cards.
- Mobile 390px: selected existing Groups Marionettes; entered shared Product Studio session `5b8f0c22-53b5-43a3-aedd-56b66a4f1564`, retaining artwork `9f3ad666-75c0-4961-ae9c-c942035235ec`. Studio Back → `/collection?from=groups`; refresh preserved the Groups filter. Existing cart remained two lines; no cart mutation in this pass.
- Desktop Account → More → Help became clickable after the stacking fix. Mobile Help navigation also passed. Printing policy displayed on both widths. Direct Help refresh and Back returned to Groups.
- Help → Support → Talk to us opened the existing Concierge message composer. No message or remedy request submitted.
- Account loaded existing purchase/activity and support records. Sign-out completed. Google recovery completed but selected another existing browser account; the user was given the normal Preview email sign-in form to restore the original authorized account. Yahoo magic-link completion is a user handoff, not certified by this report.
- Account direct link with `from=groups`, then Back → Groups passed at 390px.
- JavaScript syntax checks passed for all four changed JavaScript files; `git -c core.whitespace=cr-at-eol diff --check` passed (existing CRLF preserved).

Local screenshot evidence (not uploaded to Git): `artifacts/customer-journey-launch/desktop-collection.png`, `mobile-collection.png`, `desktop-printing-help.png`, `mobile-printing-help.png`.

## Fidelity and staging record

All paths below are relative to this isolated worktree. Date: 2026-10-21. Sources were copied to `.next` staging siblings, modified and browser-tested, then promoted under the explicit instruction to implement and commit. Staging siblings were removed after exact-byte promotion.

| Source → staged destination | Lines in → out | Authorized deviations |
|---|---:|---|
| `public/shared-masthead.next.js:1–32` → `public/shared-masthead.next.next.js:1–35` | 32 → 35 | Three destination assignments, final lines 11–13; preserve series navigation. Existing markup/copy unchanged. |
| `public/site-masthead.next.css:1–2` → `public/site-masthead.next.next.css:1–2` | 2 → 2 | Line 2 selector also matches open desktop menus; existing declaration copied unchanged. Fix inaccessible menus. |
| `public/site-masthead.next.js:1–10` → `public/site-masthead.next.next.js:1–11` | 10 → 11 | Line 4 intercepts explicit Account Back with valid series; restore return path. |
| `public/help-phase1.js:1–123` → `public/help-phase1.next.js:1–123` | 123 → 123 | Lines 16, 96, 99 preserve explicit return context; line 34 ports approved policy. |
| `public/collection-design.next.js:1–75` → `public/collection-design.next.next.js:1–76` | 75 → 76 | Lines 8–9 remove viewport gates from existing persistence; line 31 repaints restored view. |

Policy source: `public/gift-wizard/wizard.next.ts:24` (714 total lines on 2026-10-21; read only), disclosure version `2026-10-18-3`, paragraphs 3–6. Destination: `public/help-phase1.js:34`. One source line → one destination line; four decoded paragraphs → four byte-identical decoded paragraphs. Only the existing Printing value was replaced; no new policy, markup, design values or customer copy authored. CRLF preserved for edited files.

## Integration and remaining limits

Cherry-pick this focused commit onto the latest authoritative branch; do not copy old frontend files over current work. Codex 1 owns subsequent masthead/footer and all Studio polish. No Product Studio integration contract changed.

This pass does not certify email-link expiry/error recovery, payment submission, manufacturing, or the full post-purchase correction lifecycle. Those flows require backend/test-state support or the user's completed sign-in. Existing shared Studio scene restrictions and backend approval eligibility remain outside this branch. No purchase, generation, Production deployment or manufacturing submission occurred.
