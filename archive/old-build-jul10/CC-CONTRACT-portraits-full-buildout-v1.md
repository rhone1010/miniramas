# CC CONTRACT — PORTRAITS FULL BUILD-OUT v1 · 2026-07-10
**The single authoritative contract for the complete Portraits workshop + design system.**
Repo `D:\minramas\`. Supersedes piecemeal handoffs. Read with `_PRODUCTION-BIBLE.md`.

Purpose: the design system + UI/UX was developed across prior threads and lives mainly in the
**protos** (`design/protos/`) — not in one contract. This consolidates it into one build order.
**The protos are the pixel-level visual truth.** This contract says what to build, in what order,
honoring which decisions, tokens, and behaviors. Where this contract and a proto disagree on a
LOCKED DECISION (§3), the decision wins; where they disagree on layout/visuals, the proto wins.

Scope: **SOLO Portraits, end to end.** Multi is fenced (§7). This is the launch build.

---

## 1. DESIGN SYSTEM (apply across every surface)

**Color tokens:**
oxblood `#7d4242` · oxblood-deep `#6a3737` · vellum `#f3ede1` · paper `#faf6ec` ·
panel `#ece2d0` · champagne `#ECDFC1` · ink `#2a241e` · brass `#75623a` · brass-lt `#c4a96e` ·
sage `#8a9a7b` · taupe `#aba39a` · hairline `#d8cfba` · active-tab brass/sand `#c4a96e` ·
active-chip `#d0c29d`.

**Typography — two families, strict roles:**
- **Cormorant Garamond italic** = the VOICE (all Curator "says", brand lines, piece titles).
  Renders ~⅓ smaller than sans at same px — **size up**. Body floor 22px (never below 20);
  serif UI pills/controls 18px+.
- **Manrope** = sans/ledger for SYSTEM-REPORTED data (prices, labels, metadata, controls).
  Locked (Karla retired). Mono/sans labels ≥12px; no body text <16px.
- Undersized type is a recurring critical rejection — when in doubt, size UP.

**Motion (from canonical proto — use these):**
`--ease-out: cubic-bezier(.22,.7,.3,1)` · `--dur-micro: 150ms` · `--dur-state: 250ms` ·
`--dur-panel: 400ms`.

**Layout (from canonical proto `litenco-proto-workshop-deckle-1920`):**
- Body: desktop-locked, `min-width:1440px`, `overflow:hidden`.
- Advanced ("Design your own") panel `.adv`: `clamp(280px,13.3vw,360px)`, oxblood rail 52px,
  `adv-add` button oxblood italic 20px radius 10px.
- Curator spine: italic 19px, taupe → oxblood on hover, padding-left shift on hover.
- Swatches grid: `repeat(3,1fr)`, gap `14px 10px`.
- Five-spine: Advanced / Curator / Suggested (mural 4×4 explore grid) / Queue / Collection.

**Signature brand edge — the deckle:** `curatorDeckle` feTurbulence baseFrequency `0.014 0.016`,
scale **5.5**, seed **7**. **Curator card ONLY** — nowhere else.

**FONT RECONCILIATION (decision locked):** sans = **Manrope** (confirmed by Rich). The canonical
proto uses a system stack and the live `portraits.html` uses **Inter** — both are drift. CC must
set `--sans: 'Manrope'`, load Manrope, keep Cormorant Garamond as `--serif`. If JetBrains Mono is
used for system labels, that's the sans/ledger role → Manrope replaces it unless a deliberate mono
role is confirmed with Rich.

**Component laws:**
- **Action buttons:** italic serif pills at 1.1rem+, clear padding (~0.5rem 0.8rem+),
  oxblood/sage outlined or filled. NEVER tiny micro-links or thin underlined text. Size up.
- **Series tabs / chips:** oxblood-outlined pills; active = FILLED (obvious, not greyed).
- **Two distinct marks, never conflate:** the Liten & Co site logo (company identity) vs. the
  Curator "C" mark (product persona on the Curator card).

**Asset rules (violations bit us before):**
- Collection/piece thumbnails + finish previews pull from `previews/portraits/<effect>/1-4.jpg`
  (REAL renders), **NEVER** `Icon_Effect__*` icons. Icons are ONLY the Advanced disc grid.
- `previews/` MUST be copied to `public/previews/` to serve (repo-root 404s in Next.js):
  `Copy-Item D:\minramas\previews\* -Destination D:\minramas\public\previews\ -Recurse -Force`
- Taxonomy-ID filenames, always unique (shared names silently overwrite).

**Copy law:** "Crafted Images"/"Crafted Portraits" (cap C, cap I, always paired). "Sculpture/
sculpted/sculpt" BANNED in customer copy. Plain language — avoid literary terms like "register".

---

## 2. THE WORKSHOP SHELL + BUILD ORDER

Shell = the five-spine workshop (Advanced / Curator / Suggested / Queue-ToBeCrafted / Collection).
Build the customer spine in this order; each surface has a proto in `design/protos/`.

**ARCHITECTURE NOTE (do now, lightly):** build so series-specific content (effects, S1 stage,
grid tiles, pricing) is cleanly SEPARABLE from the shell chrome — even though only Portraits
exists today. Other series will slot into this shell later (see `series-ui-deltas-v1`). Don't
hard-bake "portraits" so deep that extraction is painful. Don't over-abstract either — just keep
the seams clean.

**Spine (build in order):**

1. **Homepage** — DONE, live (`app/page.tsx` + `app/homepage.css`). Fade-wall hero, gallery
   scale, footer, bundles. CTAs → workshop. Reconcile any mock/port drift only.

2. **S1 Input** — proto `litenco-s1-input-…-light.html` (APPROVED). Three stages, verbatim strings:
   - Crop/frame — overlay verbatim: "Drag to frame · Scroll to zoom · Tap a face".
   - One-time quality warning — verbatim, no pixel counts, shown once.
   - Subject pick — markers from analyze route faces. SOLO scope: single/most-prominent only.
     "Craft together" + 4+→Groups are multi/Groups routing — stub/hide, do not wire.

3. **Suggested / Options + Advanced** — the effect surfaces. 3×2 primary grid + exploration row,
   image-overlay labels, oxblood buttons. Advanced = icon disc grid (only place icons are used).
   Effect tabs: Earth & Ore / Artists / Curiosities. Framing row: Bust / Signature / Statuesque.

4. **To Be Crafted** — presence-when-carrying (spawns on first effect selection, rides through
   Pay + Crafting, clears when last piece completes, respawns on next). Lives LEFT of My
   Collection (gear icon). NEVER appears in My Collection.

5. **Piece naming** — one name per craft batch → `collection_pieces.label` (metadata only, never
   rendered). Moderation-gated (§3). Empty → "Untitled portrait". (Server + client done per CC;
   verify wired into the pre-craft panel.)

6. **Pay (S4)** — proto `litenco-payflow-…-light.html`. To Be Crafted → embedded Stripe
   (email = identity anchor) → Paid/Crafting. Paid shows the LOGO, not renders. Pay-before-craft,
   no free preview. [IN PROGRESS]

7. **Crafting → completion** — DONE (S5). Progress voice + piece-lands-in-Collection choreography,
   reduced-motion guarded.

8. **My Collection** — proto `litenco-mycollection-redesign-…-light.html`. Read-only owned library
   (pieces arrive only from Workshop). Actions: Download · Send to Print Shop · Use a Set. Select-
   to-act (checkmarks, never ×). Series tabs (oxblood pills, active filled). Prominence = recency:
   Latest (horizontal-scroll large cards) + Your Sets (compact strips: owned thumbs · dashed ghost
   slots · "Unlock [finish] — free" · "3 of 5" progress). IGNORE the superseded ×-delete proto.

9. **Print Shop** — proto `litenco-printshop-workspace-…-light.html` (LOCKED). Own cross-series
   page: all-pieces wall (series FILTER not tabs) → tap → flyout config (Print/Canvas · Size ·
   Wrap) · live price · Add. Cart = per-variant lines with quantity. Incomplete items recede
   (dimmed/dashed, not errors); summary "X ready · Y need options"; total sums READY only. Pay
   drop-alert names incomplete → Continue drops them (nothing leaves library). Curator has a voice.
   Confirmation uses the LOGO, not a fake framed-print mockup.

10. **Lightbox** — piece-focus modal: Download · Print Shop · Prev/Next · source-photo · Esc.
    Replaces inline piece-focus. [net-new]

---

## 3. LOCKED DECISIONS (win over protos on conflict)

- **Inscription/plaque CUT product-wide.** Clean unmarked base always. Choice → Pay directly.
- **Piece naming** = batch-level → `label`, metadata only, never in the prompt. Moderation:
  substring for unambiguous terms; **word-boundary `\bword\b` for short/embeddable** (Essex/
  Sussex/Scunthorpe, Dick/Dickinson pass). **Child-safety category required.** Reject → neutral
  message, no term named, no silent store. Empty → "Untitled portrait". Server = hard gate.
- **Pricing: base $4.99** (reconcile if repo shows $3.99). Multi (gated): +$1.50/person on
  crafted count → 4.99/6.49/7.99. Plain display, no founding/rising copy.
- **Resolution tiers: "Web Quality / Print Quality / Collector Print"** (LOCKED by Rich; matches
  the live build). Confirm the adders under $4.99 base (currently +$2.00 / +$4.99 in the build —
  verify these still hold).
- **My Collection read-only**; pieces only from Workshop; select-to-act, never ×.
- **To Be Crafted** never in My Collection.
- **Pay:** embedded Stripe, email = identity, Paid shows logo, pay-before-craft, no free preview.
- **Portraits = 1–3 subjects; solo scope = 1.** 4+ → Groups (multi path fenced).
- **Typography:** Manrope + Garamond per §1.
- **500 fix:** preserve the `owner_key` anonymous save path (`user_id` may be null).

---

## 4. VERBATIM STRINGS (do not reword)

- S1 crop overlay: "Drag to frame · Scroll to zoom · Tap a face"
- S1 quality warning: the locked one-time string (single verbatim warning; retire any per-reason
  duplicate path e.g. `resBanner`/`resBadge` → collapse to the one Curator-panel warning).
- Naming reject: "Please choose a different name"
- Empty name fallback label: "Untitled portrait"
- `BUST_UNIVERSAL` / `SIGNATURE_UNIVERSAL` / `STATUESQUE_UNIVERSAL` = Rich's verbatim engine
  blocks — do not edit without Rich.

---

## 5. RESOLUTION / QA GATES (existing systems to respect)

- `qa_settings` with `source_strictness` / `render_strictness` sliders (1–10); every render writes
  a `qa_log` row. Don't bypass.
- Scale valid values: `close_up | fill` only.
- Route schema MUST match engine schema (silent overwrites caused rounds of invisible failures) —
  verify both ends when touching request shape.

---

## 6. RECONCILIATION — CONCRETE DRIFT FIXES (live `portraits.html` diverges — fix these)

Found by diffing the canonical proto + locked decisions against the live build:

1. **Price → $4.99.** Live shows `$3.99` throughout (+ stray `$2.99` / `$3.39`). Replace all with
   $4.99 base; purge the strays.
2. **Font → Manrope.** Live `--sans: 'Inter'` + loads Inter + JetBrains Mono. Set `--sans:
   'Manrope'`, load Manrope, drop Inter. Keep Cormorant Garamond `--serif`. (Manrope wasn't in the
   proto OR the live build — it never landed. Land it now.)
3. **Brand tokens → correct hex.** Live tokens drifted from brand:
   - `--ink: #2a241e` (live has `#1F1B14`)
   - `--brass: #75623a` (live has `#8B6F3E`)
   Align all tokens to §1.
4. **Tier names** = "Web Quality / Print Quality / Collector Print" (locked — matches build, keep).
   Verify adders (+$2.00 / +$4.99) still intended under $4.99 base.
5. Verify plaque fully stripped, naming→label live, moderation word-boundary applied.
6. Verify `_PRODUCTION-BIBLE.md` §5 reflects $4.99 + these decisions (commit with the fix).

---

## 7. MULTI-PERSON FENCE

Multi (2–3 subject) code is present, dormant, behind `subject_mode` (default solo). It is OUT OF
SCOPE for this build. Preserve `subject_mode`, `SIGNATURE_MULTI`, `MULTI_SUBJECT_FIGURE_FIDELITY`
VERBATIM. Do not wire, expose, or remove. Nothing in this flow sends `subject_mode`. Solo is
byte-for-byte unchanged by the multi code. Fires only post-solo per `multiperson-integration-spec-v1`.

---

## 8. DELIVERY DISCIPLINE

- Full files, not patch diffs. Validate before delivery: `node --check` (JS), esbuild (TS),
  assertion/must-exist gates (integration scripts).
- One "place this file here, run this command" block per change.
- Never hand giant base64 files (prompt-too-long). Light source only.
- **Keep `_PRODUCTION-BIBLE.md` current in-repo** — move items to DONE, add locked decisions to
  §5 as made, edit in place (never full-regenerate — risks clobbering), commit with the work.
- Turbopack HMR race (os error 32, Windows): kill Node, delete `.next`, restart clean.

---

## 9. BUILD SEQUENCE SUMMARY

Homepage (done) → S1 Input → Suggested/Advanced → To Be Crafted → Naming → **Pay (current)** →
Crafting (done) → My Collection → Print Shop → Lightbox. Then reconcile §6. Multi stays fenced.
Design system §1 applies to every surface. Protos = visual truth; §3 decisions win on conflict.
