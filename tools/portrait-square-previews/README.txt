Portrait square preview staging (2026-10-22)

Run from the isolated worktree root. Requires its existing Node/tsx/sharp/OpenAI dependencies.

Preflight (no paid calls):
  node --import tsx tools/portrait-square-previews/run.ts --dry-run --env-file <local-config-path>

Approved batch (paid; fixed USD20 cap):
  node --import tsx tools/portrait-square-previews/run.ts --env-file <local-config-path>

Read-only verification:
  node tools/portrait-square-previews/verify.cjs

After all paid work has exited, require full coverage and finalize the review manifest:
  node tools/portrait-square-previews/verify.cjs --complete
  node tools/portrait-square-previews/finalize.cjs

Local review gallery:
  node tools/portrait-square-previews/gallery.cjs
  http://127.0.0.1:4318

Never run two batch processes at once. The manifest and cost ledger belong to one serial writer.
The runner reads only REPLICATE_API_TOKEN and OPENAI_API_KEY from the supplied configuration.
It calls the existing production engine with the existing effect body and native 1:1 request.
No resolution argument is sent to the engine, because that would invoke its optional post-resize.
No production code, deployed manifest, customer data or source photographs are changed.
Staged aliases preserve the current female variant lookup without generating duplicate images.

Status complete means the production quality gate passed. review_required preserves a generated
square image that did not pass; it is not an approval for integration. Failed/missing jobs remain
visible in the gallery. Two generation attempts per effect/variant are the hard maximum.

Interrupted jobs are not silently resubmitted. --recover fetches existing completed predictions
and uses the existing single-face quality evaluator; it makes no new NB2.1 generation call.
This recovery applies to the initial realistic-style jobs, not other scoring pipelines.

cost-ledger.json records provider prediction IDs, returned metrics and OpenAI token usage.
Dollar estimates are derived from published rates, not a billing invoice. Unknown actual costs
remain null. Initial unmetered QA requests have a conservative explicit reserve. Requests blocked
by the local network sandbox before provider access are retained separately for traceability.

All outputs remain in staging/portrait-square-2026-10-22. Nothing in this tool activates or deploys
the previews. Review and user approval are required before an integration task promotes them.
