CATALOG SAMPLE BATCH — 2026-10-19
Step 4 is locked in commit16c4f81. This batch changes only its static sample image sources, not layout or commerce behavior.

RESULT
24 assignments; 15 calibrated mockups (5 per category), 9 explicit placeholders.
4 reused artwork files plus 11 successful fresh NB2.1 2K predictions.
Model charges:11 x $0.0504 = $0.5544; authorized cap$2. No retries, auxiliary paid calls, or generation while browsing.
Pricing:https://replicate.com/google/nano-banana-2.1 (checked2026-10-19). This is the model charge calculation from completed output counts, not an invoice reconciliation.
Generation IDs, output metrics and charges: generation-results.next.json.
Source/artwork/prompt hashes and provenance: manifest.next.json.
Production prompt builders imported unchanged from pinned registryRoot a438b46.

TEMPLATE GAPS
Matted Frame: mat-opening visual approval.
Framed Canvas: float-canvas side-plane calibration.
Mug: shared-wash transition approval.
Each affects all3 categories. Holds remain; no substitute template is used.
Greeting Card samples are rendered with the existing validated front mapping; purchasing availability is unchanged.
Card artwork uses the existing production bounded mirror-extension geometry to5:7, with0 cropped pixels. Bounded2:3 rounding uses0.633% resampling and retains all edges.

REPEATABLE WORKFLOW
Do not rerun prepare.next.mts over the completed manifest; it is the original preparation source.
node --test tools/catalog-samples/batch.next.test.cjs
node node_modules/tsx/dist/cli.mjs --test tools/gift-wizard/live-ui.next.test.ts
node tools/catalog-samples/batch.next.cjs tools/catalog-samples/manifest.next.json E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/NEW-RUN
node tools/catalog-samples/publish.next.cjs E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/NEW-RUN
node tools/catalog-samples/serve-integrated.next.cjs
Review:http://127.0.0.1:4198/gift-wizard.next.html?layoutReview=products&fixtureSeries=pets
Replace pets with groups or portraits. APIs are blocked by this offline review server.
Renderer rejects overwrite, changed source/prompt/artwork hashes and unsupported ratios; never crops.
Generation is separate: generate.next.mts defaults to dry-run; --execute requires explicit paid authorization. Its durable ledger prevents repeat attempts and reserves each call against$2 before POST. Existing generated artwork is reused. No further calls required now.

CC COMBINED DEPLOYMENT HANDOFF
Include wizard.next.ts, compiled wizard.next.js, and the entire public/gift-wizard/catalog-samples directory (index plus48 WebPs).
Public URL prefix:/gift-wizard/catalog-samples/. Next public assets need no serverless tracing changes.
Catalog follows session.source.series only; favorite and production artwork references remain separate. No backend contract, price, availability, compositor or CSS changes.
Retain16c4f81 before applying this catalog commit. Do not independently deploy.

VALIDATION AND EVIDENCE
6 batch tests +35 Gift UI tests passed.15 browser checks:3 categories at1280/1660/1920/390/430. No horizontal overflow or broken images;550px desktop featured image,342/382px mobile. Picker, unavailable gating, navigation and configuration checked in browser.
Rendered masters, contact sheets, results: E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/rendered-2026-10-19
Screenshots: E:/Dev/_recovery-staging/frontend-deploy-review/catalog-samples/final-2026-10-19
No push or deployment. No production promises for unfinished templates.
