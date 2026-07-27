# CLAUDE CODE HANDOFF — Portraits Solo Path v1 · 2026-07-10

Repo `D:\minramas\`. Integrate against the live codebase. This spec is the locked
order of work for the **main Portraits implementation, SOLO subject only**.

Marching order (unchanged): **homepage → Portraits collection, end to end. LIMITED
REDESIGN — port the locked mocks, streamline, QA as you go.** Do not redesign
surfaces that are already locked; port them.

---

## 0. MULTI-PERSON FENCE — READ FIRST

Multi-person (2–3 subject) Portraits is a **dormant add-on**, gated behind a
`subject_mode` flag that defaults to `'solo'`. It is **out of scope for this work**
and is not yet proven (pilot pending).

Rules:
- **Do not build against it.** Nothing in the homepage → collection flow sends
  `subject_mode`. Every render in this scope is solo. Leave it that way.
- **Do not wire `subject_mode` into any UI, funnel, pricing, or Curator copy.**
  The subject-picker "craft one / some / all" targeting is a LATER feature.
- **Do not remove it.** If `subject_mode`, `SIGNATURE_MULTI`, or
  `MULTI_SUBJECT_FIGURE_FIDELITY` already exist in `portraits-prompt.ts` /
  `portraits-generator.ts` / the generate route, preserve them **verbatim**. They
  are inert while `subject_mode` is unset — dead code that never fires on the solo
  path. Editing around them is fine; deleting or rewiring them is not.
- If those multi blocks are **not** in the live files yet, they stay parked
  (side branch / test folder) until the pilot passes. Work from the current
  production solo files. Either way: solo path is byte-for-byte unchanged.

The solo path already works by construction — `subject_mode` defaults to `'solo'`,
so if you never send it, the multi branch is unreachable. Keep it unreachable.

---

## 1. RESOLVE BEFORE PORTING (blockers)

These gate downstream work — settle first, in order:

1. **Font: Karla vs Manrope.** Code currently has Manrope; standing recommendation
   is keep Manrope. This is baked into every ported surface — pick once, then port.
   Do not mix.
2. **Collection-write bug.** `POST /api/v1/portraits/pieces` returns 500
   (save-to-collection failure — likely Supabase insert/schema mismatch). This
   gates the *end* of the flow (piece landing in My Collection). Fix before the
   Crafting → Collection handoff, not after.

Not a blocker for this scope: per-person pricing numbers (multi only, fenced off).

---

## 2. CLEANUP TICKET (do this early — it touches the whole flow)

**Strip inscription/plaque product-wide** (locked decision, 2026-07-08). Remove
plaque/inscription from engine + frontend: the plaque prompt clause, any
`plaque_text` UI, and the Choice→plaque step. Flow is **Choice → Pay directly**.
- Engine note: in the solo prompt, `plaque_text: null` already yields a clean
  unmarked base — the plaque path is the non-null branch. Remove the UI that sets
  it and default to the clean base.

---

## 3. CRITICAL PATH (the spine — build in this order)

Source of truth for the journey: `litenco-flow-contract-v1-2026-07-07.md`
(inscription now removed). Visual source of truth: the approved protos (§5).

```
Homepage  →  S1 Input  →  Suggested/Options (+Advanced)  →  To Be Crafted
          →  Pay  →  Crafting  →  piece lands in My Collection
```

**Already in code:** Homepage (`app/page.tsx` + `app/homepage.css`). Live. Don't
rebuild — only reconcile drift (badge/scale drifted between mock and port before).

**Port these, in flow order (all mocked + locked, not yet in code):**

1. **S1 Input funnel** — proto `litenco-s1-input-2026-07-08.html` (APPROVED).
   Crop/frame (verbatim overlay "Drag to frame · Scroll to zoom · Tap a face") →
   one-time quality warning (verbatim, no pixel counts, shown once) → subject pick.
   - **SOLO SCOPE:** subject pick renders the picker but the only wired outcome is
     **single subject / most-prominent**. The "craft them together" and 4+ → Groups
     branches are multi/Groups routing — stub or hide, do not wire.
2. **Suggested / Options** + **Advanced** spine — the effect-selection surfaces.
   3×2 primary grid, exploration row, Advanced disc grid (icons OK here — Advanced
   is the only place `Icon_Effect__*` icons are allowed).
3. **To Be Crafted** — presence-when-carrying (locked decision #5). Spawns on first
   effect selection, rides through Pay + Crafting, clears when the last piece
   completes, respawns on next selection. Lives in the Workshop LEFT of My
   Collection (gear icon). **Never appears in My Collection.**
4. **Pay** — proto `litenco-payflow-2026-07-08.html`. To Be Crafted → embedded
   Stripe checkout (**email = identity anchor**) → Paid/Crafting. **Paid state shows
   the logo, NOT piece renders** (pieces don't exist yet). No free preview; pay
   before craft.
5. **Crafting → completion** motion (NET-NEW, unbuilt). Progress voice
   ("Crafting your piece…" / "Preserving likeness…") → piece-lands-in-Collection
   animation. Gated on the collection-write fix (§1.2).
6. **My Collection** — proto `litenco-mycollection-redesign-2026-07-08.html`.
   Read-only owned library (locked decision #2). No add/delete/edit. Pieces arrive
   only from the Workshop. Piece actions: **Download · Send to Print Shop · Use a
   Set**. Only "mode" is non-destructive **select** (checkmarks, never ×).
   Series tabs across top (oxblood-outlined pills, active = filled). Prominence =
   recency: Latest (horizontal-scroll large cards) + Your Sets (compact strips).
   - IGNORE the ×-delete in `litenco-collection-manage-2026-07-08.html` — that proto
     is superseded by the read-only select-to-act model.

**Adjacent (phase 2 — after the spine is green):**
- **Lightbox** (piece-focus modal: Download · Print Shop · Prev/Next · source-photo
  · Esc). Replaces inline piece-focus.
- **Print Shop** — proto `litenco-printshop-workspace-2026-07-08.html` (LOCKED). Own
  cross-series page: all-pieces wall (series filter), tap → flyout config
  (Print/Canvas · Size · Wrap), cart with per-variant lines + quantity, incomplete
  items recede (not errors), Pay drop-alert. Confirmation uses the **logo**, not a
  faked framed-print mockup.

---

## 4. LOCKED DECISIONS TO HONOR (2026-07-08 session)

1. Inscription/plaque CUT product-wide → Choice goes straight to Pay.
2. My Collection = read-only. Pieces only arrive from the Workshop.
3. Series tabs on My Collection: oxblood-outlined pills, active = filled (obvious,
   not greyed).
4. Prominence = recency (Latest scroll + Your Sets strips).
5. To Be Crafted = presence-when-carrying; never in My Collection.
6. Print Shop = its own cross-series workspace.
7. Pay: embedded Stripe, email = identity, Paid shows logo not renders, pay before
   craft, no free preview.
8. S1 Input verbatim strings are locked — do not reword.
9. Portraits = 1–3 subjects. **SOLO SCOPE = 1.** The 1–3 / 4+→Groups routing is the
   multi feature — fenced (§0).

---

## 5. STANDING RULES (violations bit us before — do not repeat)

- **Assets:** collection/piece thumbnails + finish previews pull from
  `previews/portraits/<effect>/1-4.jpg` (real renders), **NEVER** `Icon_Effect__*`
  icons. Icons are ONLY for the Advanced disc grid.
- **`previews/` must be copied to `public/previews/` to serve** — repo-root
  `previews/` 404s in Next.js:
  `Copy-Item D:\minramas\previews\* -Destination D:\minramas\public\previews\ -Recurse -Force`
- **Filename discipline:** taxonomy-ID filenames (`amber.jpg`, not `1.jpg`). Unique
  names always — shared filenames silently overwrite.
- **`/mnt/project` knowledge files can drift** from the deployed code — verify via
  PowerShell before trusting as canonical.
- **Turbopack HMR race (os error 32, Windows):** kill all Node, delete `.next`
  entirely, restart clean.
- Route schema must match engine schema — silent overwrites caused rounds of
  invisible failures. Verify both ends when touching request shape.

---

## 6. DELIVERY DISCIPLINE

- Reissue **full files**, not patch diffs.
- Validate before delivery: `node --check` for JS, esbuild transform for TS,
  brace/asset must-exist gates for integration scripts.
- Each change ends with exactly one "place this file here, run this command" block:
  plain file list + destination path.
- Never hand over giant base64-embedded files (the 3.5MB homepage mock caused
  "prompt too long" — only the lightweight source).

---

## 7. OUT OF SCOPE (this handoff)

- Multi-person / 2–3 subject anything (§0).
- Per-person pricing.
- S0b welcome center fork.
- Subject-pick multi-select targeting tool.
- Referral / free-preview systems.

Ship the solo spine first. Everything else is a later, deliberate add.
