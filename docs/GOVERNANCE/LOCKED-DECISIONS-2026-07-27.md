# LOCKED DECISIONS — 2026-07-27

Ruled by Rich in session. **These are settled.** Reopening requires a named
reason, not a preference.

Supersedes conflicting statements in `CLAW-STATUS.md` (Jul 24),
`PHILOSOPHY-v2-AMENDMENT`, `CREDITS-MODEL-v1`, and every hook contract.

---

## COMMERCIAL MODEL

**Credits govern.** Preview-then-unlock (`lib/store/checkout.ts`) is superseded
as the customer path. `/api/v1/checkout` remains for buying credits (Aug 15).

**A Crafted Image costs 10 credits** (spec v4, locked Jul 24). 10 credits = 1
image = $4.99.

**Ladder:** $4.99 base, −10% at 2, −15% at 3, −20% at 4, −25% at 5, then −1% per
image to −30% at 10. Formula `4.99 × images × (1 − pct)`.
Tiers: **THE SERIES** (1–9) · **THE STUDIO** (10). Credits do not expire.

**Quality tiers are removed from checkout.** `qualityLabel()` — "Web Quality",
"Print Quality", "Collector Print Quality" — must not reach Stripe
`product_data.name` or the customer's receipt. Resolution is resolved later in
Print Shop and My Collection by **upscaling the output image**, not by charging
a craft-time upcharge. The `⚠ PLACEHOLDER` 2k/4k upcharges are dead.

**Print prices confirmed:** Fine Art 8×10 $28 · 12×16 $48 · 18×24 $68 ·
Framed 16×20 $118.

**Gallery Canvas:** locate the `GLOBAL-CAN` SKU. If found, ship three finishes.
If not found, skip for launch — the card stays flag-hidden.

**Artist Series premium pricing: dropped.** Artists Gallery runs on NB2 now; the
cost argument no longer holds.

---

## LAUNCH

**Date: August 9, 2026.** Single combined release. Aug 1 and Aug 15 are retired.

**Series (5):** Portraits · Pets · Groups · Action · Mobile Wallpapers.

**Mobile Wallpapers is an output format** (9:16, download-only), **served by its
own route** — `/api/v1/portrait-wallpaper`, which already exists.

**For Fun and Artist Series** will exist as silos within some Series. Structure
TBD, not for Aug 9.

---

## RECOVERY

**Base file: `portraits_recover2.html` (8,824 lines).** Boots clean, reaches
Stripe, 151 ids · 200 functions · 8 route calls.

**Direction: port the approved design onto r2.** Prototypes are specifications,
not files to wire. r2 keeps its own ids; the design maps onto them.

**Archive:** the 9,872-line uncommitted file (carries the `PREVIEW_BASE` TDZ) ·
the 2,118-line replacement (harvest its credits wiring as reference first) ·
`public/portraits.next.html` — **not trusted, not a source.**

---

## USERS & AUTH

**Guest is removed.** No guest identity, no `guest_key` owner path. Sign-in
precedes crafting.

**Classes:** admin (`RHONE3166`) · tester · customer (paying consumer).
"Commercial user" means paying consumer, not a business account.

**Testers cannot order Prodigi printing.** A per-account flag gates fulfilment:
false records the order and stops, true submits to Prodigi. Testers false,
customers true. Without it, a tester with granted credits places a real,
billable print order.

**First login lands on the Account page.** The signin route currently defaults
`next` to `/portraits.html` — that must change.

**One sign-in path.** Consolidate on `/api/v1/auth/signin`; retire the
`/?signin=1` modal path in `requireUser()`.

**Tester grant: 500 credits = 50 images each.** ⚠ Ten testers at 50 images is
500 NB2 renders. Flagged for a deliberate look before Aug 9.

---

## CATALOGUE

**Curiosities: wire the seam.** All 14 experimental effects currently return
HTTP 400 from `/generate` — they are absent from `PRESET_LABELS` and no route
calls `buildExperimentalPrompt`. Add `isExperimentalEffect()` at the guard and
route the prompt build accordingly.

**Taxonomy: keep the three groups that exist** — Earth & Ore · Artists ·
Curiosities. Five- and seven-silo proposals are shelved.

**Two-tier Curator (observation → category → effect → mood): deferred.**

**Preview images exist** — `PREVIEW_BASE = '/previews/portraits/'` with a
`PREVIEW_FILE` map. Placeholders were in the CUI prototype only. Rich owns
coverage for the newer presets and Curiosities.

**Style Refs supersede "influence images" entirely.** One mechanism —
`styleReferenceB64`, appended last in `image_input`. Rich's Style Refs process
is the mature, authoritative one. Open: `STYLE_REFERENCE_ASSETS` is keyed by
*style*; per-effect refs need a schema change.

**Cut:** the horror clown. **Held for For Fun:** balloons, candle wax.

---

## PIPELINE

**Outpaint off — deliberate.** The generate route's header comment claims 10%
for Realistic/Resolving and is stale. Correct the comment.

**Pass 2 stays off** for all styles.

**`chocolate` tier: hold.**

**Four presets need `MATERIAL_REGISTER`** — `pewter`, `chocolate`,
`stained_glass`, `driftwood_resin`. **CENG, with Rich.**

**Retire:** BFL · Runware · Stability. Stability is already replaced by the
local sharp canvas pad.

**Storage: Supabase.** Cloudinary is not the system of record.

**`CRON_SECRET`** — purpose unknown. To be identified.

---

## DESIGN SYSTEM

**Masthead is a shell** — geometry, ground (espresso), type, states — with
optional slots: series label · credits · cart · sign-in, plus a per-surface nav
list. **Open: which slots each surface gets.**

**`seam-tracker.md` retired.** Hook contracts do that job per surface.

---

## LANES

**CC is test-only.** Read and execute; never write. Reports bugs, does not fix
them. Runs the dev server, hits routes, reads logs, queries Supabase read-only.

**CUI owns the glass end to end** — markup, CSS and JavaScript.

**CENG remains fully in the loop on prompts.** Delivers verbatim text; nobody
else invents prompt content.

**CAQ remains.** Audits accepted builds, files findings, does not fix. Owns the
effect-reference sheet.

**Rich decides, accepts on the glass, and commits.**

Full detail: `PROCEDURES-AND-LANES-2026-07-27.md`.

---

## REPOSITORY

**Purge the 87 `.ts` files and the engine `.html` from project knowledge — after
harvesting.** Several carry decision records in their comments (why Pass 2 was
disabled, why Stability was replaced) that exist nowhere else. **Critical paths
for Portraits, Pets, Groups and Action must not be lost.**

**Production Bible: rewrite.** Dated Jul 10, predates everything since.

**Philosophy v1 is missing and will be redeveloped**, not amended.

---

## CORRECTIONS TO EXISTING DOCUMENTS

- **`PHILOSOPHY-v2-AMENDMENT` §3 and §7 are wrong.** They state 5 credits per
  Crafted Image and a 5/10/15 pack table. The locked figure is **10**. The
  amendment is superseded by the redeveloped philosophy doc.
- **`CREDITS-MODEL-v1` is void.** Its 5-credit ratio contradicts spec v4.
- **`CLAW-STATUS.md`** still shows Aug 1. Date is now **Aug 9**.
- **`CURATOR-FLOW-v1` §3.3** overstates the analyze gap. `body_coverage`,
  `sharpness`, `lighting` and a natural-language `description` already exist.
  Only head orientation is missing.
- **`PORTRAITS-HOOK-CONTRACT-v1` §1** describes intake states that do not match
  the engine, which returns `redirected` and `intake_rejected` from `/generate`.
- **`PORTRAITS-TAXONOMY-v1`** is shelved with E2/E3.

---

## BUGS — scheduled, not open for debate

1. `qa-override.ts` reads `LITEN_INTERNAL_TOKEN`; `.env.local` defines
   `LITEN_INTERNAL_KEY`. The header path can never authenticate.
2. `credits/refund` is read-then-write, not atomic. Needs a `refund_credits`
   SECURITY DEFINER RPC before multi-user.
3. `body{min-width:1440px; overflow:hidden}` — a floor with a hidden axis clips
   with no scroll. Fixed in r81; must reach the live file.

---

## STILL OPEN

1. **Masthead slots** — which of series label / credits / cart / sign-in per
   surface.
2. **Tester grant** — 500 credits × 10 testers = 500 renders. Confirm or reduce.
3. **`CRON_SECRET`** — what runs.
4. **Gallery Canvas SKU** — locate `GLOBAL-CAN` size suffixes.
5. **Per-effect Style Refs** — schema change if refs are per-effect rather than
   per-style.
