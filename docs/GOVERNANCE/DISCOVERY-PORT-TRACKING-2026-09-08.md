# DISCOVERY PORT TRACKING — 2026-09-08

`docs/GOVERNANCE/DISCOVERY-PORT-TRACKING-2026-09-08.md`

Everything below reflects verified state as of this date only. Code
changes daily — before acting on or repeating any line here, confirm it
against the actual current code/branch, not this document. This is a
record of what was true when last checked, not a source of truth on its
own.

**Update rule:** an entry only moves to "confirmed" after real evidence
— a harness run, a browser check, a direct SQL query, something
checkable — never on a self-report alone.

---

## 1 · TASK LIST — current state, in order

1. **Three fixes on `phase1/require-signin-wholesale`, uncommitted:**
   `restoreResume` (ported from portraits.html), `syncDiscoveryChecks`
   baseId fix, `paintMinimapSelection` baseId fix. Harness-verified
   against the real extracted functions. NOT yet verified against a real
   magic-link browser round-trip — Rich's explicit choice to wait for
   production rather than trust Preview. Do not commit until that
   verification happens.

2. **Cut a new branch, `discovery`, off `main`.** Not off
   `ceng-halloween-revise` — that branch mixes in unrelated
   `halloween.html` work and should not be promoted wholesale.

3. **Move only the Discovery-relevant commits** from
   `phase1/require-signin-wholesale` onto `discovery` — cherry-pick, not
   a full branch merge, so the unrelated halloween work stays out.

4. **Confirm a clean build on `main`'s current state** before trusting
   anything above it. `main` had the cron-poller/webhook chain removed
   under Phase 2, so it has diverged from `ceng-halloween-revise` since
   this work started. Use `npx tsc --noEmit` — never `npm run dev`.

5. **Point a Vercel Production deployment (not Preview) at `discovery`,**
   its own URL, separate from Portraits' production domain — these are
   permanent A/B siblings, not variants of one deploy.

6. **Source-identifier column — not started.** Add a `source` field to
   `purchases`, `entitlements`, `collection_pieces` (or fold into
   `collection_pieces.meta`, already jsonb, no migration needed). Each
   front-end sends its own tag at checkout; `checkout.ts` — the one file
   both products already call — writes whatever tag it receives.

7. **Unconfirmed:** whether Discovery has ever completed a full
   production-shaped build, end to end. Flagged, not yet checked.

---

## 2 · COMPREHENSIVE PORT LIST — Discovery vs Portraits

### Function inventory, counted directly against both files, 2026-09-08
- `portraits.html`: 227 functions
- `discovery-consolidated-draft.html`: 166 functions
- Shared by name: 28
- Discovery-only, no portraits.html equivalent: **138 (83%)**

This 138 is not padding — it's the bundle/unlock feature set the product
actually asked for. Treat it as real product surface, not drift to
reconcile.

### Shared — one file/table serves both products, must stay in sync
- `checkout.ts` — one file, both products' checkout flows call it.
  Confirmed: `guestEmail` wired in both single/bundle and cart/unlock
  modes; zero age-check logic anywhere in this file.
- Supabase tables `purchases`, `entitlements`, `collection_pieces` —
  shared schema, confirmed via direct query 2026-09-08.

### Discovery-owned — standing decision, NOT to be ported or merged
Decided 2026-09-08: Portraits and Discovery are permanent, separate
A/B-test products. Divergence in the items below is correct, not debt.
- My Collection (`renderMyCollectionGrid`, `openMyCollection`,
  `loadPortfolio`) — its own implementation, talks to
  `/api/v1/portfolios/:id/status` and `/unlocks`, tracks unlock state
  portraits.html has no concept of at all.
- Session backend (`discovery_sessions` table, `ensureSession`,
  `syncSelect`) — server-side mirror of selection state + live price,
  no portraits.html equivalent, and does not need one.
- Minimap (`buildMinimap`, `paintMinimapSelection`), guided tour
  (`startTour`, `placeSpotlight`, `renderTourStep`, `endTour`),
  fan-layout review grid (`buildFans`, `layoutFans`, `fanBaseTransform`,
  `renderReviewGrid`), curator intent boxes (`renderIntentBox`,
  `applyIntent`, `askCurator`, `highlightRecommended`) — Discovery-only
  features. Confirmed working except where noted below.

### Confirmed wired correctly, 2026-09-08 — harness-verified
- `restoreResume` ported into `discovery-consolidated-draft.html`.
  Mapping used: `SRC.dataUrl`/`SRC.b64` → `uploadedPhotoDataUrl`;
  `addToQueue(siloId, effectId)` → direct `SELECTED.push({key, baseId,
  name, siloName})` (shape already matches `saveResume`'s output);
  repaint via `syncDiscoveryChecks()` + `afterSelectionChange()`.
  Deliberately skipped, no substitute written: `curatorState`,
  `labelGo`, `SUB_NOTE`, `precheckSourceGate`, `runAnalyze` — none have
  a Discovery equivalent.
- `syncDiscoveryChecks` — root cause found and fixed: `card.dataset.key`
  is set once at boot to the effect's base id and never updated;
  `SELECTED[].key` gets rewritten to the resolved (subject-variant) id
  on subject flip. Fix: match `s.baseId === card.dataset.key` in
  addition to the existing `s.key` match.
- `paintMinimapSelection` — identical bug, identical fix, same root
  cause, separate function.

### Confirmed broken and NOT yet fixed, found but out of scope tonight
- None currently open beyond the two above — both are covered by the
  same fix already briefed.

### Explicitly NOT a problem — checked and cleared
- `is-selected` class removal in Discovery's `startOver` — dead code
  (nothing in `#stageScroll` ever adds `is-selected` to a card), but
  harmless and out of scope. Left alone.
- Fan-layout review grid (`buildFans`/`layoutFans`) — operates on
  `SELECTED` by array position, not by `dataset.key` matching. Does not
  share the variant-id bug class. No action needed.
- Guided tour — no `SELECTED` dependency at all. Unrelated to any bug
  found tonight. No action needed.

### Not yet checked, not yet claimed either way
- Anything in either file not explicitly named above.
- Whether age-gate enforcement exists anywhere beyond the client-side
  check in `runAnalyze` (portraits.html) — last discussed, not reopened
  since; note only, not flagged as broken.

---

*Liten & Co · 2026-09-08*
