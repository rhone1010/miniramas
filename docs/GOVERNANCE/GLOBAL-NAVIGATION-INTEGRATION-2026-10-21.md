# Global navigation integration verification — 2026-10-21

Isolated branch: `codex/global-navigation-finish`, base `79745f4`.
Integrated Codex 2's navigation commit `b5b2a1d` as `b2c7c2a` without conflicts. No Studio components or backend files changed. The source/deviation record is in CUSTOMER-JOURNEY-LAUNCH-2026-10-21.md.

## Customer-visible corrections included

- Print Shop enters Collection with the originating series preserved.
- Help and Account preserve the series for return navigation.
- Desktop dropdowns remain above the Account panel.
- Existing Collection filter/sort/scroll persistence applies on desktop as well as mobile.
- Help Printing uses the existing approved gift disclosure.

## Verification and limits

- Nine targeted tests passed: three middleware/direct-route/Foyer regressions and six jsdom masthead tests covering all three series, both authentication labels, mobile drawer, keyboard navigation, Escape and outside closing. Authentication responses in jsdom are fixtures.
- Real protected Preview: Groups/Pets direct Create routes, Gallery, Community and Account destinations were inspected. Yahoo account identity was visible in Account. No customer state was changed.
- Real Preview at 1660x950 and 390x844: Gifts dropdown/hamburger, Gift Collection navigation and browser Back worked; document width did not exceed the viewport. Existing Gift Collection footer points home and both landing CTAs point to the Wizard.
- These screenshots show the current deployed navigation, not a deployment of this isolated branch. Browser static-asset interception for an independent retest failed and was cleared; do not count that attempt as verification of the patch. Codex 2's successful browser verification of the same integrated changes is separately recorded in its handoff document.
- Signed-out labels were tested with fixtures here; actual sign-out/sign-in was exercised by Codex 2 as recorded in that handoff. This pass did not repeat sign-out or certify every signed-out destination.
- Screenshot files: `navigation-desktop.png` and `navigation-mobile.png` under the task visualization directory.

## Remaining launch gap

No approved shared global footer was found. Homepage has no footer. Gift Collection has a minimal existing home-link footer. The hidden legacy Groups footer includes placeholder text. No placeholder footer was exposed, and no new legal destinations or customer copy were invented. Rich must identify the approved global footer block and destination set before a byte-preserving port can be completed under AGENTS.md sections 1–2. This remains unresolved, not certified launch-ready.

No push, deployment, paid generation, purchase, backend mutation or manufacturing action occurred.
