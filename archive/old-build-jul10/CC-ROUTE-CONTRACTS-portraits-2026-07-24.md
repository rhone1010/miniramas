# PORTRAITS ROUTE CONTRACTS — real shapes, from source
**By:** CC · 2026-07-24 · extracted from the route `.ts` files (not from memory).
All are `POST` unless noted. Bodies are JSON. `(req)` = required (400 if missing).
Auth/owner: routes that persist resolve owner as **auth user id → else `guest_key`**.

---

## 1 · `analyze`  → `POST /api/v1/portraits/analyze`
**In:** `{ source_image_b64 (req), additional_images_b64?: string[] }`
**Out 200:** `{ result: SourceSetAnalysis, elapsed_ms }`
&nbsp;&nbsp;`SourceSetAnalysis` = `{ subject_count_estimate: int, quality_verdict, recommendation, reason, … }` (the analyzer object; `faces`/`people` are read internally, not all surfaced).
**Err:** `400 {error:'source_image_b64 required'}` · `500 {error:'OPENAI_API_KEY not configured'}` · `500 {error}`
**Caller:** curator intake.

## 2 · `gate`  → `POST /api/v1/portraits/gate`  (source pre-check, cheap)
**In:** `{ source_image_b64 (req) }`
**Out 200 — three shapes:**
- `{ status:'passed', intake: {score,reasons} | null, note?: 'qa_unconfigured'|'qa_disabled'|'precheck_error' }`
- `{ status:'intake_rejected', intake: { score, reasons: string[] } }`
- `{ status:'redirected', redirect: { series, message, ctaLabel, stayLabel } }`
**Err:** `400 {error:'source_image_b64 required'}`
**Caller:** pre-craft source gate. Non-fatal — any error path returns `passed`.

## 3 · `generate`  → `POST /api/v1/portraits/generate`  (the render)
**In (req):** `source_image_b64`, `style_id`, `preset_id` (alias `preset`).
**In (optional):** `location_id` (alias `location`), `framing`, `focal {x,y,zoom,subjectId}`, `scale`, `aspect_ratio`, `resolution` ('1k'|'2k'|'4k'), `experimental_effect`, `additional_images_b64[]`, `upper_body_concept`, `subject_selector`, `skip_redirect`, `session_id`, `user_ref`, `refinement_tweak`, `refinements`, `refine`, `notes`.
&nbsp;&nbsp;*Dead/internal:* `plaque`/`plaque_text`, `is_preview`/`preview_email` (removed 2.1), `is_preview_bake`/`preview_bake_path`/`render_ref` (internal preview-bake path).
**Out 200 — three shapes:**
- `{ status:'done', image_b64, elapsed_ms, … }`  ← success (also the experimental branch: `{ image_b64, elapsed_ms, … }`)
- `{ status:'redirected', redirect:{ series, message, ctaLabel, stayLabel } }`
- `{ status:'intake_rejected', intake:{ score, reasons } }`
**Err:** `400` (source/style/preset required; unknown `style_id`/`preset_id`) · `403 {error:'preview_bake_forbidden'}` · `500 {error:'REPLICATE_API_TOKEN not configured'}` / `{error}`
**⚠ contract note:** success is `{status:'done', image_b64}`; the UI accepts both `data.image_b64` (flat) and `data.result.image_b64` (wrapped) — keep that shape stable.

## 4 · `curate-effects`  → `POST /api/v1/portraits/curate-effects`
**In:** `{ source_image_b64 (req), rotation_index?: number, upper_body_concept?: string }`
**Out 200:** `{ ok:true, recommendations: EffectRecommendation[], duration_ms }`
**Err:** `400 {ok:false, error:'source_image_b64 is required'|'Invalid JSON body'}` · `500 {ok:false, error}`
**Caller:** "finishes we'd choose" grid; `rotation_index` drives the redeal/cycle rotation.

## 5 · `curate-upper-body`  → `POST /api/v1/portraits/curate-upper-body`
**In:** `{ source_image_b64 (req), style_id (req), preset_id (req), rejected_labels?: string[] (≤10) }`
**Out 200:** `{ ok:true, concepts: […], round, duration_ms }`
**Err:** `400 {ok:false, error:'source_image_b64 is required'|'style_id and preset_id are required'|'Invalid JSON body'}` · `500 {ok:false, error}`
**Caller:** face-only source → torso-concept curation.

## 6 · `raw-pipeline`  → `POST /api/v1/portraits/raw-pipeline`  (dev Raw Mode)
**In:** `{ source_image_b64 (req), prompt (req, non-empty), additional_images_b64?: string[], aspect_ratio? }`
**Out 200:** `{ image_b64, duration_ms, prompt_chars, aspect_ratio, stages_run:{ pass1_nb2:true, pass2_gpt:false, outpaint:false, faceswap:false } }`
**Err:** `400 {error:'source_image_b64 required'|'prompt required (non-empty string)'}` · `500 {error:'REPLICATE_API_TOKEN not configured'}` / `{error}`

## 7 · `pieces`  → `POST` + `GET /api/v1/portraits/pieces`  (My Collection persistence)
**POST In:** `{ guest_key?, image_b64 (req), series?, preset?, mode? ('material'|'experimental'), meta?, label? }`
&nbsp;&nbsp;**⚠ `label` is now IGNORED** — the route **auto-generates** it at persist: `[Series] - [Effect] - [User Name] - [###]` (auto-naming, 2026-07-23). No moderation.
**POST Out 200:** `{ ok:true, piece:{ id, series, preset, label, mode, image_url (signed), created_at } }`
**POST Err (all `{ok:false, reason}`):** `no_owner` (400) · `image_b64 required` (400) · `upload_failed: …` (500) · `insert_failed: …` (500) · `not_configured`.
**GET In:** `?guest_key=<token>`   **GET Out:** `{ pieces: [{ id, series, preset, label, mode, image_url, created_at, … }] }` (empty `{pieces:[]}` if not configured / no owner).

## 8 · `checkout`  → `POST /api/v1/checkout`  (shared store route)
**In:** `{ skuId? }` **or** `{ cart:{…} }`; plus `guestEmail?`, `returnUrl?`, `style?`, `variant?`, `sourceImageRef?`.
**Out 200:** cart → `{ url: <hosted Stripe URL> }` · sku → `{ …quote/result }`
**Err:** `400 {error:'invalid_json'|'sku_required'|'cart_identity_required'|…}` · `404 {error}` · `500 {error:'checkout_failed', message}`
**⚠ Aug-1:** **NOT on the craft path** — `runAll` now calls the credits gate, not this. `checkout` stays wired for the **Aug-15 buy-credits** path. (`cart_identity_required` is why the old craft flow 400'd.)

## 9 · `qa/settings`  → `GET` + `PUT /api/v1/qa/settings`  (dev-gated)
**GET In:** `?silo=<series>` (a.k.a. series).   **GET Out:** `{ silo, source_strictness (0–10, default 5), render_strictness (default 5), qa_enabled (default true) }`
**PUT In:** `{ silo|series, source_strictness?, render_strictness?, qa_enabled? }`
**Err:** `403 {error:'forbidden'}` (not dev) · `400 {error:'silo (series) required'}` · `500 {error:'supabase not configured'|error.message}`
**Caller:** dev QA drawer only (`?dev=1`).

## 10 · `samples`  → `GET /api/v1/samples?series=portraits`
**⚠ ROUTE DOES NOT EXIST.** The client fetches it (`portraits.next.html` ~6334) and **degrades gracefully** — `SampleLib` stays dark until it returns rows, so no error is thrown, but the example-render slot never populates.
**Expected shape (from the caller):** `{ samples: SampleRow[] }`, each row passing `qualityOk`. Query: `?series=<series>`.
**→ FLAG: needs building** (or confirm it's intentionally deferred) — otherwise the empty-workshop sample slot is permanently blank.

---

## Cross-cutting notes
- **13 fetch calls / 10 routes** — the payload's count. `pieces` (POST+GET) and `generate` (preset/experimental/raw branches) account for the >10.
- **Owner resolution** is uniform: auth user id (cross-device) → else client `guest_key`. Redemption (credits) additionally **requires an account**.
- **New (not in the 10, added this cycle):** `POST /api/v1/credits/gate`, `POST /api/v1/credits/redeem`, `GET /api/v1/credits/balance`. The craft path now hits `credits/gate` upstream of `generate`.
