# CC PROGRESS + FLAGS — Aug 1 payload run
**By:** CC · 2026-07-23 · working file: `public/portraits.next.html` (build-then-swap; `portraits.html` NOT touched)

`portraits.html` was restored to the wired engine (9,872 lines, HEAD 19c3157) before this run.
All portraits-client work is in `portraits.next.html`. **Merge to `portraits.html` is a final step,
gated on Rich/verification.** Syntactic integrity re-checked after each batch (backticks even;
braces/parens balanced).

---

## ✅ DONE this session (in portraits.next.html — backticks even, braces/parens/square balanced after every batch)

- **T1 — Strip tier pricing (ship-blocker).** Removed `#resolutionControl` markup (Web/Print/Collector
  pills), `renderResolutionPills()`, `onResolutionPick()`, the `item.resolution !== '1k'` subtitle
  append, and `RESOLUTION_LABEL`. `RESOLUTION_UPCHARGE` kept (now always 0 since resolution stays
  `'1k'`). The one remaining `renderResolutionPills` caller is `typeof`-guarded → safe no-op. Verified:
  0 live readers of any removed symbol. Kept the Tier-1 source-photo gate. *(Left one dead CSS rule
  `#resolutionPills.ledger-q` + `.control.resolution` rules — inert, scoped to the removed element;
  low-risk CSS sweep noted.)*
- **T2 — Remove discount language.** Collapsed `priceBlock` and the `addPrice` path to current price
  only; removed the `tr.textContent` percent-off tag, the `Studio rate` volume line, and the
  `.queue-row-price .off` CSS. Verified: 0 `class="was"`/`class="off"` emitted, 0 live `tier.off`
  branches. `PRICING.tiers` single `0%` tier left as-is (rendered nothing anyway).
- **Recon 2.2 — Retry affordance (ship-even-if-slips).** `retryFailed(id)` re-queues a failed row via
  the existing `makeVariation()` clone, drops the failed original, and crafts. "Try again" button
  (reuses `.qa-btn`) added to every failed-error render. No modal.



- **T4 — Redirect CTA (ship-blocker).** Added `openRedirectPanel(item)` (reuses the existing
  `.qa-overlay` pattern), wired from `onQueueRowClick` for `status:'redirected'`, plus a visible
  "See ›" affordance on the redirected pill. Surfaces the previously-stored-but-unused
  `redirect.message / ctaLabel / stayLabel`. **Aug-1 real-route whitelist**
  `REDIRECT_ROUTES = { pets:'/pets.html', groups:'/groups.html', actionmini:'/actionmini.html' }`;
  out-of-scope suggestions (Houses/Landscapes/etc.) render copy with **no button** — no dead links.
  - ⚠️ Note: engine's redirect series id for Action is **`actionmini`**, and shared `gotoSeries()`
    is stale (key `action`, extensionless paths that don't match the served `.html` files). I did
    **not** touch `gotoSeries` (separate caller at ~4841); T4 uses its own correct map.

- **T5 — Consent at upload (ship-blocker).** One checkbox co-located with the Craft button:
  *"I have the right to use this photo and agree to the Terms and Privacy Policy."* (links to
  `/terms.html`, `/privacy.html`). `state.consent` gates Craft in **both** `updateActionBar`
  (button disabled) and `runAll` (hard stop — runAll is also reachable from the order ledger).
  `onConsentToggle()` toggles + re-gates. Not persisted (re-affirmed per session).
  - ⚠️ FLAG: `/terms.html` and `/privacy.html` **don't exist yet** → links 404 until those pages land.

- **T3 — Flag-gate Artist Series (ship-blocker).** `const FLAGS = { artistSeries: false }`; hides the
  `data-series="artists_gallery"` button at boot; `onSeriesClick` rejects `'artists_gallery'` when
  off. Data structures (`ARTISTS_PRES`, `MATERIAL_LOCATIONS` entries) left intact — returns at premium.
  - **Report-back (payload asked): hiding Artist Series does NOT break the Location control.** The
    `artists_gallery` branch that force-set `location='pedestal'` + hid Location is now unreachable;
    default series `realistic` shows Location normally. No regression.

---

## 🐛 BOOT TDZ — FIXED (`PREVIEW_BASE`) + new DoD gate
- **Symptom:** `Uncaught ReferenceError: Cannot access 'PREVIEW_BASE' before initialization` at boot →
  script dies, every wired control dead.
- **Cause:** `const PREVIEW_BASE` was declared ~1800 lines *below* its first boot use
  (`init()` → `renderMaterials` → `previewSrc`). Temporal dead zone.
- **⚠ PRE-EXISTING, not the 2.1 pass:** HEAD engine `19c3157` has the identical ordering and throws the
  **identical** TDZ (verified). The engine has been broken at boot since the restore — it was simply never
  browser-loaded (r76 was the live file during that window). `.next` inherited it in the copy.
  **→ The live `portraits.html` has this bug too; the fix lands when `.next` merges.**
- **Fix:** moved the (dependency-free) `const PREVIEW_BASE = '/previews/portraits/'` to just above the
  `init()` call. No other change. Re-verified: boots clean.
- **New DoD gate (per Rich):** braces + tsc do NOT catch TDZ / ordering / runtime boot faults — this one
  passed both and bricked the page. **A headless boot check is now mandatory before "done":**
  `node scripts/boot-test.js public/portraits.next.html` must print `BOOT OK`. (The harness stubs the DOM
  and runs the engine script; it caught this TDZ and confirms the fix.) Propagate to MASTER/PRODUCTION-BIBLE
  Definition of Done. Real in-browser console check still required before merge.

## ✅ DONE — sweep 3: AUTO-NAMING + CREDITS (the end-to-end unlock), verified balanced + tsc-clean

### Auto-naming (superseded spec, silent — 2026-07-23)
- **Client:** removed the `#pieceNameInput` field + the `runAll` batch-name read/stamp; `persistPiece`
  sends `label:''`. Customer no longer names a piece (a rename belongs in My Collection post-launch).
- **Server (`/pieces` route):** label generated at persist time = **`[Series] - [Effect] - [User Name] - [###]`**
  (e.g. `Portraits - Reclaimed Bronze - rich - 001`). `[Effect]` via `PRESET_LABELS`; `[User Name]` =
  account name → **email local-part** (magic-link captures no name) → omit; `[###]` = atomic account-wide
  seq. No moderation (no free text) — removed `resolveLabel`.
- **Migration `008_collection_label_seq.sql`** — per-owner atomic counter (`next_label_seq` RPC).
  ⚠ Sequence is account-wide + monotonic (your correction); deleting a piece does NOT renumber.

### Credits & codes (CREDITS-AND-CODES-SPEC-v3) — THE END-TO-END UNLOCK
- **Migration `009_credits_and_codes.sql`** — `credit_balances`, `credit_ledger`, `access_codes`,
  `code_redemptions` (all service-role RLS) + **seed** (`RHONE3166` admin-unlimited + 10 `TESTER-*` @ 50) +
  two atomic RPCs: `spend_credits` (race-safe conditional decrement) and `redeem_code` (idempotent via
  `code_redemptions` PK).
- **Routes:** `POST /api/v1/credits/gate` (debit N, write N `credit_ledger` + N `craft_events`;
  **RHONE3166 never decrements, delta-0 audit still written**; shortfall → `insufficient_credits`),
  `POST /api/v1/credits/redeem` (account-required, idempotent), `GET /api/v1/credits/balance`.
- **Client call-path swap (THE unlock):** `runAll` now calls `creditsGate(unpaid)` **instead of
  `startCheckout`** → ok marks items entitled → `craftPending()` (wired render path, untouched) → rendered
  images. Shortfall → `openRedeemPanel` (code field → `/redeem` → retry craft). `startCheckout` stays
  defined for the Aug-15 buy path but is **no longer in the craft divert**. tsc clean; `craftPending()` +
  the 13 fetch calls untouched.

### ⚠ CREDITS — remaining (flagged, not blocking the render loop)
- **§5 failure remedies (Credit / Refund → `credit_ledger`)** NOT wired. Retry/Recraft is done (2.2); the
  QA panel's Credit/Refund choices don't yet write a `refund` ledger row + `craft_events.user_decision`.
  Needs a small `/api/v1/credits/refund` endpoint + QA-panel wiring. Source-aware copy → CENG.
- **Migrations 007/008/009 must be APPLIED** (`supabase db push`) before the routes resolve — until then
  `spend_credits`/`redeem_code`/`next_label_seq` RPCs 404 and labels fall back to `001`.
- **Entry gate is functional, not a single "door" screen:** consent in-workshop (T5) + sign-in via the
  React app (SigninModal → cookie; `getUser` resolves in the routes) + code-redeem on craft-shortfall.
  Testers must sign in via homepage/Account first (redeem is account-required). A dedicated
  code+signin+consent pre-upload screen is a refinement.

## ✅ DONE — sweep 2 (continued, verified balanced)
- **Recon 2.1 — free preview REMOVED** (error-free method): band markup, the sole `is_preview = true`
  setter, the craft-gate `&& !q.is_preview`, the `downloadPiece` preview lock, and the generate-request
  `is_preview`/`preview_email` mapping all removed. `is_preview = true` now appears **0** times → every
  remaining `is_preview` read is inert (always false: unlock button, watermark clause). **Pieces are now
  always downloadable.** Craft gate is now `!q.paid` — and I marked it as THE credits-lane swap point.
  - **Plaques:** already reduced to comment-stubs + inert dead state (`state.plaqueText`/`plaqueOff`,
    `plaqueKey`, never sent to route). Left inert — see sweep list.
- **Recon §1.4 — Download end state** built: `showDownloadEndState(item)` fires after `downloadPiece`,
  3 CTAs (Craft another=`location.reload()` clean reset · Your Collection=`openMyCollection` · Send to
  Print Shop=`sendToPrintShop`). No pricing/tier/discount copy. Reuses `.qa-overlay`/`closeQaPanel`.
- **§3 — Homepage cut** in `app/page.tsx` (canonical): removed "Start with the Curator" (one CTA now);
  sub-line updated to the locked §3 copy; Houses/Landscapes/For Fun/Artist Series tiles removed; **4
  tiles wired** — Portraits→`/portraits.html`, Pets→`/pets.html`, Groups→`/groups.html`,
  Action→`/actionmini.html` (buttons → spans, tiles → anchors, no nested-interactive).

## ⏸️ DEFERRED-FOR-SAFETY / LOGGED this sweep (not errors — need a dedicated pass or Rich)
- **Auto-naming (SPEC-autonaming) — DEFERRED.** The engine already has working batch naming
  (`#pieceNameInput` → `readBatchName()` → `q.pieceName` → persists via `/pieces` `label`). The r77
  per-piece `#nameStage` **restructures the craft flow** (which now carries the consent gate + payment
  gate) and conflicts with the batch model — too error-prone to rush in a no-test sweep. Needs a
  dedicated pass. Anchors: engine `readBatchName`/`pieceNameInput`/`q.pieceName`; r77 `#nameStage`
  (line 648), `nameRowHtml`/`openNaming`/`aiName`/`moderate`/`NAME_A`/`NAME_N` (~909–1190). Option (a)
  "Who is this?" at Frame still to add. **Batch naming works for Aug-1 in the meantime.**
- **Mobile Wallpapers homepage tile — NOT wired** (no unified series route; only `pet-wallpaper.html` /
  `portrait-wallpaper.html` exist). Avoided a dead link (§3). Add + flag per recon 4.1 once the route is
  confirmed. **Needs Rich/CUI: what URL is "Mobile Wallpapers"?**
- **Homepage "Studio Bundles / Sets Worth Keeping" section** (`app/page.tsx` ~190+) still promotes Sets
  + The Artist Series — both cut/gated. Outside §3's explicit scope, so **logged not deleted** — confirm
  removal/rework.
- **Inert sweep (safe cleanup, later):** plaque dead-state (`plaqueText`/`plaqueOff`/`plaqueKey`/
  `inscription`), free-preview inert remnants (`startFreePreview`, `previewUsed`/`markPreviewUsed`,
  `PREVIEW_FLAG`, `UNLOCK_PRICE`, unlock button branch, watermark preview-clause, `#resolutionPills`
  dead CSS, `.control.resolution` CSS). All unreachable — zero runtime effect; remove when convenient.

## 📋 REPORT-BACK findings

- **T7 — Groups map drift: YES, drifted (do not reconcile, per spec).**
  `portraits.next.html` Groups-inherited `MATERIAL_LOCATIONS` vs `lib/v1/groups/groups-shared.ts`:
  - Locations: groups-shared adds **`tea_house`** + **`wall_mount`**; portraits matrix carries
    **`gradient`**. Sets diverge.
  - Materials: groups-shared `GroupsPresetId` has 15 (amber, blown_glass, marble, resin, wood,
    nebula_resin, fantasy_crystal, reclaimed_bronze, …); portraits realistic `PRES` is a 6-material
    subset (ebony/walnut/stone/bronze/iron/alabaster). Expected for separate series, but the
    "keep in sync" comment (~5074) is **stale**. Benign for Portraits (it uses its own registries).

- **Recon 2.6 — "At Capacity" modal: nothing to cut.** Confirmed `generate` emits only
  `intake_rejected | redirected | fatal_error | success`; there is no `deferred`/capacity state in
  `portraits.html`. Design orphan already absent. No-op. ✓

---

## 🟢 RICH'S ANSWERS (2026-07-23) — logged
- **CREDITS-AND-CODES-SPEC-v2** → Rich dropping into `/payload` (his lane). **Not there yet** — money
  lane stays parked until it lands; everything else proceeds. When it lands, first wire = the Craft
  payment gate swap (see "TIMELINE crux" below).
- **/terms.html + /privacy.html** → **Rich's lane, not CC's.** CUI drafts minimal REAL pages (what's
  collected, retention, processors = Replicate/Supabase/Prodigi, deletion request), Rich approves.
  T5's checkbox already links to these paths; they 404 until the pages land.
- **Homepage** → `app/page.tsx` is LIVE + canonical; `homepage-light.html` is a design ref. Added to
  `directives/LIVE-FILE-LEDGER.md`. **CC cuts the homepage against `app/page.tsx`.**
- **Queue reorder** → `craft_events` migration BEFORE auto-naming (naming writes to /pieces; events
  table first = persistence touched once). **DONE: `supabase/migrations/007_craft_events.sql` written.**

## 📌 LOG-ONLY (do NOT act now — owner + deadline noted)
- **Shared `gotoSeries()` is stale** (key `action` not `actionmini`; extensionless paths that don't
  match served `.html`). CC worked around it locally in T4 with a correct map, but the stale source map
  remains and **will bite Pets/Groups/Action when they attach to the path.** Fix at SOURCE before
  **series attach (Jul 31)**, not now. Owner: CC.
- **Groups map drift CONFIRMED real** (groups-shared has `tea_house`/`wall_mount` + materials portraits
  lacks; portraits has `gradient`). Groups ships Aug 1 → **reconcile before series attach (Jul 31).**
  Route to **CENG** for the authoritative map; **CC applies.** Not a portraits blocker.

## ⏱️ TIMELINE crux — front-end → crafted rendered images
The render pipeline is wired and works. The ONLY gate is `runAll`'s payment divert:
`unpaid.length` is always > 0 (every pending item is `!paid`, free preview being deleted) →
`startCheckout` → Stripe → `cart_identity_required` 400 → `craftPending()` (the actual render) is never
reached. **Swap that divert for the credits/entitlement gate (recon §2.7) and craft flows to rendered
images.** End-to-end is visible once: credits spec lands → CC wires Craft→credits-gate → `.next` merges.

## 🔴 BLOCKER — saved for Rich (did NOT stop the rest)
- **`CREDITS-AND-CODES-SPEC-v2` is not in `/payload`** (referenced by recon §1.2, §2.7, §2.3, §5).
  Gates ONLY the money plumbing:
  - credits/codes tables + redemption + entitlements ledger; seed `RHONE3166` + 10 tester codes
  - the **Craft → credits-gate call-path swap** (recon §2.7 "answer before building": Craft currently
    hits `/api/v1/checkout` Stripe; with credits it must hit the credits gate — new path unconfirmed)
  - `credit_ledger` reconciliation for credit-funded refunds (recon §2.3 / §2.4)
  - magic-link sign-in wiring specifics for the entry gate (§5)
  - Everything else in the payload is buildable without it — proceeding.

## ❓ Saved decisions/questions for Rich
- **Terms/Privacy pages** (T5 links) — do `/terms.html` + `/privacy.html` exist elsewhere, or need building?
- **`craft_events` (recon 2.3)** — table schema is fully specced and I can write the migration, but its
  `credits_delta` column + the "must also write a `credit_ledger` row" reconciliation depend on
  CREDITS-AND-CODES-SPEC-v2. I'll write the append-only table + the non-credit event writes; the
  credit_ledger tie is flagged with the blocker.
- **Homepage file** — Master §3 names `homepage-light.html` (not in repo); the live homepage is
  `app/page.tsx` (React). Confirm which is the Aug-1 homepage before the cut.

---

## ⏭️ QUEUED — remaining payload, precisely referenced (continue in portraits.next.html)

**Portraits client (still in .next):**
- **T1 — Strip tier pricing (ship-blocker).** Remove `#resolutionControl` (the `Web/Print/Collector`
  pills) + downstream: `#resolutionPills.ledger-q` CSS, the `#resolutionPills` rebuild loop,
  `onResolutionPick()`, the `item.resolution !== '1k'` subtitle append, `RESOLUTION_LABEL` map, and the
  `.control.resolution` CSS. Default `state.resolution`/`item.resolution` to `'1k'` (already defaulted
  at all writer sites — verified `resolution: state.resolution || '1k'`). **Keep** the Tier-1
  *source-photo* resolution gate (judges the upload, not an output tier). *(Payload has exact anchors;
  line numbers shifted by my edits — use string anchors / re-grep.)*
- **T2 — Remove discount language (dead code).** Collapse `priceBlock` to current price only; drop the
  `was`/`off` branches in the `addPrice` path; remove `.queue-row-price .off` CSS. `PRICING.tiers` is a
  single `0%` tier so nothing renders today, but remove so it can't reactivate.
- **Recon 2.1 — DELETE plaques (14 refs) + free preview** (11 `is_preview` refs, Free Preview band
  ~4925/4957, `previewEmailInput`, `PREVIEW_FLAG`/`liten_preview_used`, dismiss flags, the
  `is_preview && !purchased` download lock). **Delete, not flag.**
- **Recon 2.2 — Retry affordance (ship-even-if-slips).** One "Try again" on any `status:'failed'` row,
  re-queues via existing `makeVariation()` clone. No modal.
- **Recon 2.5 — Delete confirmation.** Confirm step or 5-sec undo toast on piece delete.
- **Recon 2.4 — Studio failure = 3 parallel choices** (Recraft · Credit · Refund; soft adds Accept).
  UI choices are client; **source-aware refund copy is CENG**; the Credit/Refund money moves need the
  credits spec (blocker).
- **Auto-naming** (`SPEC-autonaming`, ship option **(a)** "Who is this?" at Frame): optional
  `state.subjectName`, default `[Effect] — [FirstName] #[n]` / `[Effect] #[n]`, NAME step intercepts
  `runAll()`, port `#nameStage` markup+CSS+JS from `litenco-portraits-2026-07-21-r77.html` (fix the
  corrupted subtitle string). No route changes.
- **Download end state (revised, recon 1.4): 3 CTAs** — Craft another · Your Collection ·
  **Send to Print Shop**. No pricing/tier/discount copy. `downloadPiece()` untouched.

**Other surfaces:**
- **Homepage cut** (§3, pending file decision above): one CTA "Upload Your Photo", remove
  "Start with the Curator", 5 wired tiles (Portraits·Pets·Groups·Action·Wallpapers), remove
  Houses/Landscapes/For Fun. Locked headline/sub-line.
- **`craft_events` migration** (recon 2.3) — append-only table, schema given. Will write; credit_ledger
  tie flagged.
- **Account page** (§2) — build to `litenco-account-2026-07-22-r6.html`. Large; many parts
  (credits remaining, Buy Credits flag-hidden, referral) depend on credits spec. Structural build
  possible; live data wiring partly blocked.
- **Masthead unify** (recon 4.2) — one shared masthead on shared tokens across surfaces.
- **CSS/JS split** (§4) — optional, port direction r77 UI → portraits.html only.

## 🚫 Deferred (explicit): Sets (cut), Print Shop fulfillment (Prodigi OFF — UI only),
Houses/Landscapes/For Fun/Artist tiles, responsive/breakpoints (CUI-owned, last).
