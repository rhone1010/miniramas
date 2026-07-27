# SESSION RECAP — 2026-07-10 (UI/UX + Multi + Concepts)
**Full recapture. Any Claude (CUI) or collaborator should be able to resume from this alone.**
Repo `D:\minramas\` (minramas). Lane: UI/UX (CUI). Parallel: CC (Claude Code) building live.

This is the DELTA for today — what changed, was decided, was built. Standing state lives
in `_PRODUCTION-BIBLE.md`. This doc is the missing "end-of-day handoff" that reconciles
a full day of decisions into one place. **If a value here conflicts with the running repo,
this doc's locked decisions win and the repo must be reconciled** (see Propagation, end).

---

## 1. DECISIONS LOCKED TODAY

**Pricing (NEW — supersedes any earlier number):**
- **Base $4.99** per single-subject Portrait. (Repo screenshot showed $3.99 — STALE, must propagate.)
- Multi-person: **flat +$1.50 per additional person, priced on CRAFTED (selected) count.**
  1p $4.99 · 2p $6.49 · 3p $7.99. Formula `4.99 + max(0, n−1)×1.50`.
- Plain price display. NO "founding/rising" messaging. $4.99 held as a stable test-bench
  number; revisit ~2 weeks post-launch on real conversion data.
- Rationale locked: $2.99–3.99 sits in the scam/commodity band; $4.99 signals a legitimate
  premium product (no free preview means price IS the trust signal). Margin is ample.

**Typography:** **Manrope locked** as sans/ledger. Karla retired. Voice = Cormorant
Garamond italic (renders ~⅓ small — size up). No cross-browser reason to prefer Karla.

**Plaque → Piece naming (finalized the cut):**
- Engraved plaque = fully removed product-wide. Clean unmarked base always. `plaque_text`
  stays null/clean in the generator; nothing renders text into the image.
- Piece NAME = metadata only → `collection_pieces.label`. Captured at pre-craft, one name
  per craft BATCH (all finishes share it), never fed to the prompt. Empty → "Untitled portrait".
- Moderation = hard server gate + client mirror. Two-layer: substring match for unambiguous
  terms; **word-boundary (`\bword\b`) for short/embeddable terms** so "Essex/Sussex/Scunthorpe"
  and real names ("Dick"/"Dickinson") pass. **Child-safety category required, not just profanity**
  (labels attach to images of families/children). Reject → neutral "Please choose a different
  name", never name which term tripped, never silently store. Duplicates allowed (UUID is real ID).

**Portraits multi-person = PROVEN + GATED (see §3).**

**Collection-write 500 = RESOLVED** — endpoint returns 200 (verified live). Root cause not
tracked; fixed incidentally. Working save path uses `owner_key` (anonymous) with `user_id`
null — do NOT refactor that to require `user_id`.

**My Places = new series direction (see §4). Wallpapers = output format + My Places (see §4).**

---

## 2. BUILT TODAY

**By CC (committed, live in repo):**
- S5 Crafting motion — rotating verbatim microcopy + large→hold→shrink→slide→settle completion
  choreography, image-forward, reduced-motion guarded.
- Piece-name feature end-to-end — `lib/v1/_core/name-moderation.ts` (two-layer gate) + pieces
  route (fail-fast, `400 name_rejected`, empty→Untitled) + client mirror. Typecheck + behavior
  + inline-parse validated. Committed `4255f10`. Bible updated in place (§2/§5/§8).
- §1.1 Manrope + §1.2 500 closed.
- Next up: S4 Pay (embedded Stripe) — in progress.

**By CUI (this session, in `/mnt/user-data/outputs/`):**
- `_PRODUCTION-BIBLE.md` — master governing doc (status board, precedence, fire conditions,
  locked decisions, lane model, delivery discipline).
- `claude-code-handoff-portraits-solo-v1.md` — solo spine build order, multi fenced.
- `multiperson-integration-spec-v1-2026-07-10.md` — full multi turn-on spec (fires post-solo).
- `series-ui-deltas-v1-2026-07-10.md` — per-series UI fork map.
- `wallpapers-series-mini-spec-v1-2026-07-10.md` — wallpaper-as-output-format design.
- `my-places-concept-v1-2026-07-10.md` — cutaway-diorama refuge series concept.
- Multi test harnesses: `run-multiface-pilot.mjs`, `probe-generate.mjs`, `test-targeting.mjs`.

---

## 3. MULTI-PERSON PORTRAITS — FULL STATUS

**PROVEN empirically today:**
- Multi-OUTPUT: 2–3 distinct likenesses hold through effects at the material register
  (22 renders, 10 real sources, signature framing, bronze/alabaster/walnut). No blending.
  Per-person age/scale preserved. Candid→frontal normalization works. Caveat: facial identity
  is "plausibly them," not forensic — the per-figure scorer is the automated catch.
- Single-TARGET (pick one from a group): PROVEN. `test-targeting.mjs` — left/center/right
  crops returned three correct people. Mechanism = focal server-crop to the picked face
  (`focal {x,y,zoom}`), not "tell NB2 which face". QA scores against the cropped face.

**Built (dormant, behind `subject_mode: 'solo'|'multi'`, default solo, solo byte-for-byte unchanged):**
- `portraits-prompt.ts`: `SIGNATURE_MULTI` (forked from locked `SIGNATURE_UNIVERSAL`, plaque
  stripped, pluralized close cluster) + `MULTI_SUBJECT_FIGURE_FIDELITY` (borrowed verbatim from
  Groups) + `subject_mode` branch in `framingBlock` + both builders.
- `portraits-generator.ts`: derives `subject_mode`/`subject_count` (loose read).
- generate route: passes both through; `skip_redirect` bypasses the Gate-0 group redirect.

**Specced, not built** (see `multiperson-integration-spec-v1`): per-figure scorer (copy from
Groups), subject-picker→multi wiring, live pricing, redirect "craft here anyway" UI, QA gate.

**GAPS / Rich to author:**
- Bust-Multi + Statuesque-Multi composition blocks (verbatim rule — Rich writes; Signature-Multi
  is the fallback meanwhile).
- Multi-SUBSET targeting (pick 2 of 4) — NOT built; focal crop is one rectangle. "Craft all 2–3
  detected" works today; subset-of-a-group needs a wider bounding crop or subjectId-list plumbing.

**FENCE:** multi does not fire until (1) solo ships + stable, (2) Rich authors the two blocks
(or accepts Signature-only), then (3) run the spec's §8 order. CC preserves the multi code
verbatim during solo, never wires/exposes it.

---

## 4. WALLPAPERS + MY PLACES (concept — post-launch, pilot-gated)

**Reframe reached:** "wallpaper" is an OUTPUT FORMAT (device-sized download) on existing series,
NOT a new series. The one genuinely-new creation surface is **My Places.**

**My Places** = collectible **3D cutaway-diorama refuges** — cozy, prepared, self-contained
shelters, "the safe space you wish you had, built for you." Founder locks:
1. Cutaway/cross-section IS the signature (you see inside).
2. Grounded-plausible only (train, bunker, hillside dome, cabin, beach shack, mountain-airy,
   underground complex, metro, feminine, sci-fi — NO fantasy/castles).
3. 3D-stylized, NOT photorealism (dissolves the uncanny "that's not my place" risk; makes the
   personal subject a safe optional layer).
4. Scene is peaceful/safe — NO threat, NO people — empty, "waiting for the user."
- Personal subject (your pet/family in the refuge) = optional later layer, reuses subject pipeline.
- Rides the Houses/environment engine (environment-IS-the-piece, outpaint) in a new 3D-stylized
  render mode. Inverted intent: Houses = "your house"; My Places = "a refuge for you."
- Living Art (subtle motion — fireplace flicker, rain on the dome) = v2 north-star, separate
  motion pipeline, NOT launch.

**NEXT (paused mid-setup):** a render pilot to find the HOUSE STYLE before any UI. Rich supplied
5 reference images spanning 4 distinct render aesthetics (clean-diorama / illustrated-storybook /
architectural-section / painterly). **Finding: "3D stylized" is a DIAL, not one look — the pilot's
real job is locking the render signature, not testing refuge types.** Planned structure:
Pilot A = 1 refuge × ~4 style descriptors (bake-off → pick the look); Pilot B = locked look ×
refuge range. Open before building the runner: confirm text-to-image (vs source-based), and CUI
to draft the 4 candidate style descriptors. NOT yet run.

**Series delta map (built today):** the workshop shell is UNIVERSAL from Curator→Collection; the
forks concentrate at S1 (subject vs scene vs device) and fulfillment (print vs download).
Landscapes+Houses share one environment-silo delta. Only ~3 S1 variants needed, not 6.

---

## 5. OPEN / UNRESOLVED (need Rich)

1. **Resolution tier names** — repo shows "Web Quality / Print Quality (+$2) / Collector Print
   (+$4.99)"; older carryover had "Download / High Quality / Print Ready". CANONICAL NAMING NOT
   DECIDED. Also confirm the +$2 / +$4.99 adders still hold under $4.99 base.
2. **My Places render pilot** — text-to-image confirm + draft style descriptors + run Pilot A.
3. **Bust-Multi + Statuesque-Multi** composition blocks (Rich authors).
4. **Groups arrangement** — auto vs user-selectable (rec: auto for launch).
5. **Wallpapers** — style taxonomy, device buckets, bundle, pricing (all open in mini-spec).
6. **Policy pass** on moderation BLOCK lists (CC flagged) — confirm word-boundary treatment applied.
7. **Clean-base eyeball** — confirm plaque-removed signature/statuesque renders look right.

---

## 6. PROCESS FIX (why this doc exists)

Problem identified today: a full day of decisions lived only in the chat thread + scattered
one-off spec files; nothing consolidated them, so the repo drifted ($3.99 vs locked $4.99) and
neither CC nor a next-session CUI had a single current source. **Fix = this session-recap discipline:
every dense session ends with ONE dated recap (the delta) + a propagation checklist.** The Bible
is standing state; the recap is the day's diff. CC keeps the Bible current in-repo; CUI writes the
recap; Rich reconciles the repo from the propagation list.

Also locked: CC owns the in-repo Bible (updates as it works, commits with changes). CUI reads the
LIVE bible when shown it — CUI's project-knowledge copy is a stale snapshot and must not overwrite.

---

## 7. PROPAGATION CHECKLIST (repo must reflect these — verify each)

- [ ] Base price $4.99 (repo showed $3.99) — FIX.
- [ ] Multi price 6.49/7.99 wired where multi exists (gated — not customer-facing yet).
- [ ] Resolution tier names — RESOLVE naming first (§5.1), then verify.
- [ ] Manrope everywhere (should be done).
- [ ] Plaque fully stripped, naming→label live (server done; client done per CC).
- [ ] Moderation word-boundary applied incl. `dick`/`sex` (CC flagged; verify).
- [ ] Multi code present + dormant + unexposed (fence intact).
- [ ] 500 fix holds; `owner_key` anon path preserved.
- [ ] Bible §2/§5/§8 current (CC committed 4255f10 — verify includes today's pricing).
