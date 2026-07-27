# LITEN & CO — PRODUCTION BIBLE
**The governing document. Read this before acting on anything.**
Last updated: 2026-07-10 · Repo: `D:\minramas\` (codename minramas)

This file governs precedence, status, and fire-order for the whole build. When any
directive, spec, or proto seems to conflict, THIS document and its precedence rules
decide. Directives say *what and when*; protos say *what it looks like*; this bible
says *which is live and what wins*.

---

## 0. HOW TO USE THIS

- **Before starting any work**, check the Status Board (§2). Only ACTIVE items are built now.
- **GATED items are not started** until their fire condition (§4) is met — even if the file exists and looks ready.
- **Precedence (§3)** resolves any conflict. Solo always beats multi. Locked decisions (§5) beat everything.
- **When a milestone completes**, update the Status Board and move the item to DONE.
- This is a living doc. Session-end carryovers feed it; it is the durable memory between sessions.

---

## 1. DIRECTORY MAP — where everything lives

```
D:\minramas\
  directives\                  ← sequenced build orders (what/when)
    _PRODUCTION-BIBLE.md        ← THIS FILE (read first)
    claude-code-handoff-portraits-solo-v1.md
    multiperson-integration-spec-v1-2026-07-10.md
  design\protos\               ← locked visual source-of-truth (what it looks like)
    litenco-flow-contract-v1-2026-07-07.md   (journey source of truth)
    litenco-s1-input-…-light.html
    litenco-payflow-…-light.html
    litenco-mycollection-redesign-…-light.html
    litenco-collection-states-…-light.html
    litenco-printshop-workspace-…-light.html
    homepage-light.html
    litenco-hero-fadewall-…-light.html
  scripts\                     ← test harnesses (multiface pilot, targeting, probe)
  lib\ app\ supabase\ …        ← the live codebase
```

Rule: directives say what/when · protos say how it looks · this bible says what's live.

---

## 2. STATUS BOARD

Legend: **ACTIVE** (build now) · **GATED** (do not start; see fire condition) · **BLOCKED** (needs an input) · **DONE**.

### ACTIVE — Solo Portraits spine
Directive: `claude-code-handoff-portraits-solo-v1.md`. The only thing being built now.
Goal: homepage → Portraits collection, end to end, solo subject.

| Item | Status |
|---|---|
| Plaque/inscription strip (engine + frontend) | DONE |
| Piece naming → `collection_pieces.label` + moderation gate | DONE (batch name; server hard gate + client mirror) |
| S1 crop-overlay locked casing | DONE |
| Homepage CTAs → workshop | DONE |
| Delta map (protos vs current) | DONE |
| S5 Crafting → completion motion | DONE (rotating microcopy + large→hold→slide→settle) |
| S4 Pay — embedded Stripe | NEXT UP |
| S1 Input reconciliation (single verbatim warning, retire resBanner) | TODO (approach locked, §5) |
| S6 My Collection alignment | TODO |
| S8 Print Shop alignment | TODO |
| Lightbox (piece-focus modal) | TODO (phase 2) |

### GATED — Multi-person Portraits
Directive: `multiperson-integration-spec-v1-2026-07-10.md`. **Do NOT start** (fire condition §4).
Dormant in codebase behind `subject_mode` (default solo). Solo path unaffected.

| Item | Status |
|---|---|
| Multi-output viability (2–3 likenesses hold) | PROVEN 2026-07-10 |
| Single-target (pick one from group) | PROVEN 2026-07-10 |
| Signature-Multi composition | DONE (validated) |
| Bust-Multi + Statuesque-Multi composition | **BLOCKED — Rich authors** |
| Per-figure scorer (copy from Groups) | SPECCED |
| Subject-picker → multi wiring | SPECCED |
| Live pricing wiring ($4.99/$6.49/$7.99) | SPECCED |
| Multi-subset targeting (2 of 4) | GAP — mechanism TBD |
| QA gate (pilot re-run w/ scorer) | SPECCED |

### DONE / RESOLVED this cycle
- Collection-write 500 — resolved (endpoint returns 200; verified live 2026-07-10).
- Font decision — **Manrope locked**. Karla retired.
- Pricing — locked (§5).
- `portraits.html` reconciliation (2026-07-10) — price → $4.99 flat (ladder/packs retired); Inter + JetBrains Mono → Manrope (`--sans`/`--mono`/`--v7-mono` + hardcoded); `--ink` #2a241e / `--brass` #75623a on both `:root` and `--v7-*`. `--signature` tier color + `--v7-oxblood` left as-is (not in the drift list — flag if brand-align wanted).
- Visual port (proto → live), surface-by-surface. **S1 DONE** (`50b7f80`): motion vars + proto palette tokens (`--vellum/--paper/--panel/--paper-up/--oxblood/--taupe/--sage`) into `:root`. **S2 DONE**: Curator `inv-letter` card + verbatim promise "Bring me a portrait and I'll choose a few starting pieces for you. — C." (flow-contract §S0b, locked by Rich); `startPulse`; **deckle = Curator card ONLY** (section/upload deckles retired, locked by Rich). **S3 DONE** (Advanced "Design your own"): material pills → proto **disc swatches** (preview discs), location → **glyph** settings (SVG icons), resolution → **ledger rows** (Web incl · Print +$2 · Collector Print +$4.99), net-new live-bound **recipe line** ("A {mat} portrait, {setting}, {framing}."), "Design your own" rail header, mode-toggle + adv-add styling. All live handlers preserved (re-render drives active state); script parses. Remainder: framing kept as pills (frame-figures need images); mode-toggle is 2-way (Realistic/Artists) vs proto's 3 (Curiosities = experimental, separate flow). **S4 DONE** (Suggested mural): `renderGhostSuggestions` rewritten from the 3-tile ghost strip to the proto's **2×2 metro mural** — per-tile crossfade on independent rhythms (HOLDS/OFFSETS), no image on two tiles at once, re-render-safe loop guard, "Portraits / Some of our most popular effects" overlay; wired to `GHOST_POOL`/`previewSrc`. **S5 DONE** (My Collection redesign): `renderCollectionBands` rewritten from vertical series-bands to the redesign proto — Curator head + line, **series tabs** (oxblood pills, active filled), **Latest** horizontal-scroll `lcard`s; pieces open the lightbox (Download / Print Shop live there — select-to-act, read-only, never ×). **Visual port COMPLETE (5/5).** Deferred: "Your Sets" strips (need set-definition/membership data — a feature, not visual); Advanced framing-figures + 3rd "Curiosities" mode-toggle (S3 remainder).

---

## 3. PRECEDENCE — what wins in a conflict

1. **Locked decisions (§5)** beat everything. If code or a spec contradicts a locked decision, the locked decision is right.
2. **Solo beats multi.** If a multi item appears to conflict with an in-progress solo task, solo is correct and multi waits. The `subject_mode` fence is inviolable during solo.
3. **This bible beats an individual directive** on status/timing. A directive file existing ≠ permission to run it — the Status Board + fire conditions decide.
4. **Protos are visual truth, not timing truth.** A proto showing a surface doesn't mean build it now; the directive's build order does.
5. **Child-safety + moderation gates are non-negotiable** and beat velocity. The piece-naming moderation gate ships with the feature, not after.

---

## 4. FIRE CONDITIONS — when GATED items unlock

**Multi-person integration** (`multiperson-integration-spec-v1`) fires ONLY when ALL true:
1. Solo spine (§2 ACTIVE) has shipped and is stable end-to-end.
2. Rich has authored Bust-Multi + Statuesque-Multi composition blocks (or accepts Signature-Multi-only launch).
3. Then execute in the spec's own §8 fence-removal order — never out of order.

Until then: multi stays dormant. Claude Code preserves `subject_mode` / `SIGNATURE_MULTI` /
`MULTI_SUBJECT_FIGURE_FIDELITY` verbatim but never wires or exposes them.

---

## 5. LOCKED DECISIONS — single source of truth

Brand / copy:
- "Crafted Images" / "Crafted Portraits" — correct customer terms. "Sculpture/sculpted" BANNED in customer copy.
- 8 Series: Action, Houses, Landscapes, Portrait, Groups, Pets, For Fun, The Artist Series.
- "In Environment" (never "In-Situ") in user-facing Landscapes/Houses copy.

Product / flow (2026-07-08 session):
- Inscription/plaque CUT product-wide. Choice → Pay directly. Clean unmarked base always.
- Piece naming (locked 2026-07-10): user string → `collection_pieces.label` as METADATA only, never carved into the image (finish stays in the `preset` column). ONE name per craft batch, applied to every finish — not per-piece. Empty → "Untitled portrait" (never the old plaque default). Engraved plaque stays fully cut: `plaque_text` permanently null / clean-base, no user string ever reaches the prompt. Moderation REQUIRED (labels sit beside images of real people/children): normalize (lowercase · fold leetspeak · strip spacing/punctuation), then word-boundary match for short/embeddable terms (`\bsex\b` → Essex/Sussex/Scunthorpe pass) + substring match for unambiguous terms; child-safety is a required category, not just profanity. `lib/v1/_core/name-moderation.ts` via `/api/v1/portraits/pieces` is the HARD gate; the `portraits.html` mirror is UX only (instant re-prompt "Please choose a different name", never names the word).
- S1 quality warning (locked): one verbatim Curator-panel string, shown once, no pixel counts. Retire the resBanner/resBadge second surface; route the red-tier analyzer gating to that single warning home.
- My Collection = read-only owned library. Pieces arrive only from Workshop. Select-to-act, never ×-delete.
- To Be Crafted = presence-when-carrying; never in My Collection.
- Print Shop = own cross-series workspace. Confirmation uses logo, not fake framed mockup.
- Pay: embedded Stripe, email = identity anchor, Paid shows logo (not renders), pay-before-craft, no free preview.
- Portraits = 1–3 subjects. Solo scope = 1. 4+ → Groups.

Pricing (locked 2026-07-10):
- **Base $4.99, FLAT per piece.** 1 person $4.99 · 2 people $6.49 · 3 people $7.99 (multi = +$1.50/person on crafted count, gated). Reconciled in `portraits.html` 2026-07-10: the old $3.99 base + volume-discount ladder ($3.39/$2.99/$2.79) and the Curators/Studio pack upsells are RETIRED.
- Plain display, no "founding/rising" messaging, no discount grammar. Revisit ~2 weeks post-launch on data.

Typography:
- Sans/ledger = **Manrope** (locked). Voice = Cormorant Garamond italic (renders ~⅓ small — size up).
- Garamond body floor 22px (never below 20); serif UI 18px+; mono/sans labels ≥12px; no body <16px.

Tokens: oxblood #7d4242 · oxblood-deep #6a3737 · vellum #f3ede1 · paper #faf6ec · panel #ece2d0 ·
champagne #ECDFC1 · ink #2a241e · brass #75623a · brass-lt #c4a96e · sage #8a9a7b · taupe #aba39a · hairline #d8cfba.

Engine architecture:
- Anatomy first, material second. Short prompts beat long. Route schema must match engine schema.
- `subject_mode: 'solo' | 'multi'` default solo — solo byte-for-byte unchanged by multi code.
- Scale valid values: `close_up | fill` only.

---

## 6. LANE MODEL — who does what

- **UI/UX prototyping lane** — mocks, protos, specs, design decisions. Produces directives + protos.
- **Engine/prompt lane** — prompt architecture, verbatim composition blocks (Rich authors), scoring.
- **Claude Code (integration)** — builds against the live codebase from locked directives + protos. `bypassPermissions` set in `.claude/settings.local.json`.
- **Rich** — final decisions, verbatim blocks, pricing, anything conflicting with a locked element.

Directives flow: prototyping lane writes → Rich approves → Claude Code executes.

---

## 7. WORKING RULES — delivery discipline

- **Full files, not patch diffs.** Reissue whole files for iteration speed.
- **Validate before delivery:** `node --check` (JS), esbuild transform (TS), assertion/must-exist gates (integration scripts).
- **One "place this file here, run this command" block** per change. Plain file list + destination.
- **Assets:** thumbnails/previews from `previews/portraits/<effect>/1-4.jpg` (real renders), NEVER `Icon_Effect__*` icons (icons = Advanced disc grid only). Copy `previews/` → `public/previews/` to serve.
- **Filename discipline:** taxonomy-ID names, always unique (shared names silently overwrite).
- **Never hand Claude Code giant base64 files** (prompt-too-long). Light source only.
- **`/mnt/project` knowledge can drift** from deployed code — verify via PowerShell before trusting.
- **Turbopack HMR race (os error 32, Windows):** kill Node, delete `.next`, restart clean.
- **Rich's style:** terse, bottom-line first, no ping-pong multi-choice questions. Flag once, proceed. Read screenshots as directives.

---

## 8. NEXT ACTIONS (rolling — update each session)

1. Claude Code: build embedded Pay (S4, NEXT) → S1 warning collapse → S6/S8 alignment → Lightbox.
2. Rich: policy pass on the piece-name `BLOCKED` lists — decide `sex` (blocks nothing real now via word-boundary) and drop `dick` (collides with the given name); lists are the source of truth in `name-moderation.ts` + `portraits.html` mirror.
3. Rich: eyeball a signature/statuesque test render to confirm clean-base (plaque removal is render-affecting).
4. Rich: hard-refresh workshop → verify S5 crafting microcopy + completion motion, and the piece-name input (try a blocked name → re-prompt; blank → "Untitled portrait").
5. Rich: author Bust-Multi + Statuesque-Multi blocks (unblocks multi §2, does not fire until §4).
6. On solo ship: run multi fire-order (spec §8), QA gate, then expose.

---

## 9. UPDATING THIS DOC

- Move items between ACTIVE/GATED/DONE as reality changes.
- Add locked decisions to §5 the moment they're made — never let them live only in a chat.
- At each dense session end, write a carryover and fold its durable facts into here.
- If a fire condition is met, say so explicitly in §4 and move the item to ACTIVE.
