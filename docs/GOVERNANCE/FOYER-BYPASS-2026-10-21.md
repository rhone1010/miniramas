# Approved Foyer bypass — 2026-10-21

Branch: `codex/print-collection-launch-ready`. No deployment.

Homepage `/` and `/home` now serve the existing approved `public/homepage.next.html`. Its existing Groups, Pets and Portraits choices enter their current Discovery pages. No separate selection surface was invented. Homepage markup, copy, styling and photography are unchanged.

Legacy `/foyer.html`, `/pets-foyer.html`, `/groups-foyer.html` and `/groups/foyer` redirect to the corresponding Discovery route. `/pets?foyerFrom=…` no longer opens Foyer. Queries survive entry and legacy redirects. Photo subject redirects now go straight to Discovery, retaining `foyerFrom` as the existing handoff source-series contract; storage and photo adoption are unchanged. Foyer pages, assets and backend APIs remain intact.

## Approved navigation edits and staging record

All counts below are physical lines on 2026-10-21, excluding the trailing empty split after the final newline. Source is pre-change HEAD `a0e9d08`. Changes were made in next copies, verified, then promoted in this isolated branch under Rich's explicit instruction to implement the approved navigation correction. No UI blocks were ported or recreated.

| Source | Staged destination | Lines in → out | Authorized deviation |
|---|---|---|---|
| `middleware.ts:1–205` | `middleware.foyer-bypass.next.ts:1–211`, then `middleware.ts:1–211` | 205 → 211 | Lines 51–52 select approved homepage; route block 194–211 redirects legacy Foyer URLs, removes conditional Foyer entry, and preserves queries on home/Discovery routes. Six lines added for legacy redirect handling. |
| `public/upload-routing.js:1–69` | `public/upload-routing.next.js:1–69`, then original | 69 → 69 | Line 29 changes destination only, retaining source-series query for handoff. |
| `public/upload-routing.deep-review.next.js:1–69` | `public/upload-routing.deep-review.next.next.js:1–69`, then original | 69 → 69 | Line 29 changes destination only, retaining source-series query for handoff. |

Every other source line is unchanged. Existing `middleware.next.ts` is unchanged. Matcher, invite handling and logout code are unchanged, verified against HEAD. No Product Studio, backend API, migration, catalog or Foyer page edits.

## Browser verification

Real in-app browser against a localhost navigation-only server, using the actual transpiled staged middleware with NextResponse and unchanged static pages. API requests intentionally return 503; no credentials, customer data, generation, checkout or manufacturing requests were used. This tests browser navigation and actual routing logic; deployed Next/Vercel integration is for Codex 1 after integration.

- Desktop and 390 × 844: homepage choice → Groups, Pets and Portraits Discovery; refresh remains in Discovery; browser Back returns to homepage. All pass.
- Desktop 1280 × 844 and mobile 390 × 844: all four legacy Foyer URLs redirect to the intended Discovery; refresh stays there. All pass.
- Both widths: `/pets?foyerFrom=portraits` opens Discovery directly, including refresh; `/home` opens homepage, including refresh. All pass.
- Initial localhost attempt was blocked by sandbox network isolation; the authorized local server was restarted outside the sandbox, and a fresh browser tab completed all checks.

Evidence: `artifacts/foyer-bypass/browser-results.json`, `desktop-discovery.png`, `mobile-direct-discovery.png`.

`node --test test/foyer-bypass.test.cjs`: 3 tests pass, covering eight entry routes, legacy redirects, query preservation, absence of cookie writes, and cross-series handoff destinations. Both staged upload scripts pass `node --check`. Diff whitespace check passes with CRLF recognized.

Codex 1: integrate this focused commit; it does not depend on unintegrated Collection/mobile work from earlier commits. Keep the existing shared Product Studio work. No independent push/deploy was performed. No known navigation blocker remains in these tested routes.
