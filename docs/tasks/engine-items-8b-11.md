# Engine task: items 8b + 11 (qa_override + is_preview_bake)

Implement two small engine items from the UI sync doc (2026-06-09/12). Both are
route-level changes sharing one internal-gating pattern. Do NOT touch prompts,
presets, or BUST_UNIVERSAL.

## Shared prerequisite — internal-traffic guard

Add a helper: env flag `LITEN_INTERNAL_KEY` + request header `x-liten-internal`.
A request is `internal` when the header matches the env value. Both features
below require it.

## Item 8b — `qa_override` body field (do first, ~2 lines per route)

In `/api/v1/portraits/generate`, accept an optional body field:

```json
"qa_override": { "source_strictness": 3, "render_strictness": 3 }
```

Honor it ONLY when the internal header passes; otherwise ignore silently
(no error — customers must never learn the field exists):

```ts
const srcStrict = internal
  ? body.qa_override?.source_strictness ?? qaSettings.sourceStrictness
  : qaSettings.sourceStrictness;
const rndStrict = internal
  ? body.qa_override?.render_strictness ?? qaSettings.renderStrictness
  : qaSettings.renderStrictness;
```

Wire these into `scoreIntake` and the render QA thresholds wherever
`qaSettings` values are read today.

## Item 11 — `is_preview_bake` flag on `/api/v1/portraits/generate`

Optional body field `is_preview_bake: boolean` (default false). When true:

- REQUIRE the internal header — respond 401/403 if absent, never silent.
- Gate 0 (`classifySubject`) and Gate 1 (`scoreIntake`) STILL RUN — the whole
  point is the production pipeline. `qa_override` applies here too.
- SKIP: qa_log user attribution, entitlements decrement, `collection_pieces`
  write, collector number assignment, preview-ledger logic.
- Accept `preview_bake_path: "previews/portraits/{preset}/{bin}.jpg"` and write
  the result as JPEG to Supabase Storage at exactly that path.
- Return `{ status: 'baked', storage_path, qa_log_id }` instead of the normal
  generate response shape.

## Acceptance

1. Show me the full diff BEFORE applying anything.
2. After applying, list every code path the item-11 skip-list touches so I can
   verify nothing customer-facing leaks into bake runs.
3. Confirm: a request with `is_preview_bake: true` and no internal header is
   rejected; a request with `qa_override` and no internal header runs with
   table settings as if the field were absent.
