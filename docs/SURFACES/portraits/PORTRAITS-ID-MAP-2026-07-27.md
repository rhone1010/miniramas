# PORTRAITS ID MAP — b2 → r81

**CUI V22 · 2026-07-27.** Read live from the two uploaded files this day.

| File | Role | Lines | Unique ids | Route calls | Functions |
|---|---|---|---|---|---|
| `portraits-b2.html` | working base — plumbing | 8,876 | 152 | 10 | 226 |
| `litenco-portraits-2026-07-24-r81.html` | approved skin — specification | 1,895 | 74 | 0 | 70 |

No duplicate ids in either file.

---

## 1 · THE HEADLINE

**The two files share two ids: `curatorDeckle` and `lightbox`.**

That is the whole overlap. 150 of b2's ids and 72 of r81's are unique to their
file. There is no meaningful name-level correspondence to port along.

**Consequence: the mapping is by function, not by id.** Every r81 element must
be matched to the b2 *function* that will drive it, and the binding rewritten.
Renaming b2's ids to r81's would be the largest possible diff for the smallest
possible gain, and would break 226 functions at once.

**Therefore the rule for every build below: r81's ids are adopted as the new
DOM contract; b2's functions are retained and re-pointed.** b2's id names die
with b2's markup. Its *behaviour* is what §3 of PROCEDURES protects, and
behaviour lives in the functions, not the id strings.

This is a deviation from the literal reading of the base-file law — b2 will not
finish with 152 ids. It finishes with r81's DOM and b2's 226 functions intact.
**Rich rules on this before build 1.**

---

## 2 · b2's ROUTE CALLS — all ten must survive

Read from source today:

| Line | Constant | Endpoint |
|---|---|---|
| 5294 | `GATE_URL` | `/api/v1/portraits/gate` |
| 5343 | `QA_SETTINGS_URL` | `/api/v1/qa/settings?silo=portraits` |
| 5379 | `QA_SETTINGS_URL` | `/api/v1/qa/settings` |
| 6602 | `ANALYZE` | `/api/v1/portraits/analyze` |
| 7067 | `CHECKOUT_URL` | `/api/v1/checkout` |
| 7243 | `CURATE_EFFECTS_URL` | `/api/v1/portraits/curate-effects` |
| 8368 | `CREDITS_GATE_URL` | `/api/v1/credits/gate` |
| 8533 | — | `/api/v1/portraits/raw-pipeline` |
| 8567 | `API` | `/api/v1/portraits/generate` |
| 8652 | `API` | `/api/v1/portraits/generate` |

`CHECKOUT_URL` is the superseded preview-then-unlock path. It stays wired for
credit *purchase* and is removed from the craft path. Nine survive as-is.

---

## 3 · r81's 72 IDS — WHAT DRIVES EACH

### 3.1 Curator — the new spine
| r81 id | b2 function | Status |
|---|---|---|
| `curatorDeckle` | `sizeCuratorPaper` | **shared id** — direct |
| `curNote` | `updateCuratorLine`, `curatorShowStep` | maps |
| `curSource`, `curCrop`, `srcThumb`, `changePhoto` | `handlePrimaryUpload`, `precheckSourceGate` | maps |
| `cycleBtn` | `curatorEffectsOverride` | maps — **behaviour changes**, see §5 |
| `pickHint`, `picksBack` | `curatorEnterEffects` | maps |
| `wzSteps` | `curatorShowStep`, `currentStep` | maps |

### 3.2 Stage and effect selection
| r81 id | b2 function | Status |
|---|---|---|
| `stageGrid`, `allGrid` | `renderEffectCards`, `syncEffectCards` | maps |
| `featBox`, `miniBox` | `updateStagePreview` | maps |
| `svGrid`, `svPrev`, `svNext`, `svBack`, `setsView` | — | **no b2 equivalent** |
| `craftBar`, `craftTitle`, `craftSub`, `crafting` | `runAll`, `updateRunGate` | maps |

### 3.3 To Be Crafted rail
| r81 id | b2 function | Status |
|---|---|---|
| `railTbc`, `tbcPills`, `tbcMsg` | `renderQueueList`, `buildQueueRow` | maps |
| `tbcPrice` | `priceForCount` | maps — **rewrite to credits** |
| `tbcCraft` | `runAll` | maps |
| `rightRail`, `railCollection` | `setSpinesVisible` | maps |

### 3.4 Advanced rail
| r81 id | b2 function | Status |
|---|---|---|
| `adv`, `advOpen`, `advClose` | `openAdvanced`, `closeAdvanced`, `updateAdvancedTrigger` | maps — **default flips to closed** |
| `advSwatches`, `advModes`, `advFrames`, `advGlyphs` | `renderMaterials`, `renderLocations`, `selectFramingV2` | maps |
| `advRecipe`, `advLedger` | `updateInfoBox`, `renderCountRibbon` | maps |
| `advAdd` | `addToQueue` | maps |

### 3.5 Pay stage
| r81 id | b2 function | Status |
|---|---|---|
| `payStage`, `payBack`, `payItems`, `payBtn` | `startCheckout`, `finishPurchase` | maps — **re-point to credits gate** |
| `payTotal`, `payTierLabel` | `priceForCount`, `renderPackTiers` | maps — **rewrite to credits** |
| `creditsCount` | `spendCredits`, `creditsNotice` | maps |

### 3.6 My Collection
| r81 id | b2 function | Status |
|---|---|---|
| `collView`, `collLatest`, `collLine` | `openMyCollection`, `renderCollectionBands`, `renderRendered` | maps |
| `collTabs` | `switchTab` | maps — **filter set corrected, see §6** |
| `actDownload` | `downloadPiece` | maps |
| `actPrint` | — | **no b2 equivalent** |
| `lightbox`, `lbImg`, `lbName`, `lbFx`, `lbClose`, `lbPrev`, `lbNext` | `openLightbox`, `closeLightbox`, `toggleLightboxView` | **`lightbox` shared** — direct |

### 3.7 Intake failure modal
| r81 id | b2 function | Status |
|---|---|---|
| `intakeModal`, `mclose` | `friendlyReject`, `curatorEnterQualityFail` | maps |
| `redirectMsg`, `redirectCta`, `redirectGo` | `gotoSeries` | maps — **stale map, see §7** |
| `retryBtn` | `sourceReviewUploadMore` | maps |

r81 exposes `window.__openIntake(1..8)` over eight states: Interrupted ·
Photograph · At capacity·orphan · Refunded · Face small · Blur·BLOCK · Dim ·
Can't use. **All eight are pre-craft intake.** There is no post-render
rejection state in either file — see §8.

### 3.8 Entry, nav, QA
| r81 id | b2 function | Status |
|---|---|---|
| `s1file`, `s1img`, `s1consent`, `s1continue`, `s1another` | `handlePrimaryUpload`, `afterSourceReview` | maps |
| `navWorkshop`, `navCollection` | `openMyCollection`, `restoreWorkshop` | maps |
| `qaPanel` | `openQaPanel`, `saveQaSettings`, `qaAccept`, `qaRefund`, `qaRerender` | maps |

---

## 4 · WHAT b2 HAS THAT r81 DROPPED

r81 has no element for these b2 capabilities. Each needs a ruling: **carry into
the new DOM, or accept the loss in writing.**

**Must carry — load-bearing**
- `runAllBtn`, `renderCount`, `renderTotal`, `stageProgress` — run orchestration
- `queueRows`, `qpill-*`, `qimg-*`, `qscores-*`, `qpass-*` — per-item queue state
- `curStep*` (7 ids) — the Curator step machine `curatorShowStep` drives
- `curEffectCards`, `curEffectsLoading` — the `/curate-effects` render target
- `sourceReviewList`, `sourceEmpty`, `sourceCount` — multi-source intake
- `subjectPickBtns`, `subjectPickTitle` — `chooseSubject`, the multi-face path
- `resBanner`, `resBadge` — `assessResolution`

**Rich rules — probably cut**
- `resolutionControl`, `resolutionPills`, `olTier` — Web/Print/Collector.
  `LOCKED-DECISIONS` removed quality tiers. r81 still shows them; they go.
- `previewBand`, `previewCraftBtn`, `previewEmailInput` — preview-then-unlock,
  superseded
- `inscription*` (5 ids), `stagePreviewPlaque` — plaque text. Not in r81.
- `experimentalFx`, `experimentalButtons` — replaced by the Curiosities silo
- `rawControls`, `rawPromptText`, `rawRefSlot` — raw mode. Bench tooling.
- `tourHelpBtn` + 10 tour functions — onboarding tour. Not in r81.

**Dead on arrival**
- `_retired_renderQueueGrid_bigCards`, `_retired_updateQueueCard_bigCards`,
  `_retired_updateQueueMeta` — already retired in b2, drop.

---

## 5 · WHAT THE SPEC NEEDS THAT NEITHER FILE HAS

From the 2026-07-27 session. **All new build, no source to port from.**

1. **Silo tier.** 6 silos × 36 effects. Neither file has a silo layer — r81 has
   a 3-group pill strip, b2 has a flat list. New data table drives pills,
   grid, Advanced, and the Collection filter from one source.
2. **Curator photo reaction.** A per-photo compliment or rejection on upload.
   No route exists. CENG owns the voice.
3. **Cycle effects at silo level.** `cycleBtn` exists; it must become inert
   until the user is inside a silo.
4. **Curator suggestion card** replacing `Add All 5` in grid slot 6.
5. **Post-render likeness gate** and its remedy surface — §8.
6. **Piece ID** auto-assigned, immutable, system-wide.
7. **Sign-in.** Neither file has one. `entrygate-2026-07-24-r1.html` is the
   unbuilt design.

---

## 6 · DRIFT FOUND IN r81 — fix during the port

- **Two disagreeing Series lists.** Line 1410 carries the locked five
  (View All · Portraits · Pets · Groups · Action · Mobile Wallpapers).
  Lines 953–959 carry the old seven including Houses and Landscapes, which are
  out for Aug 9. One data source resolves it.
- **Quality tiers present.** Web / Print +$2.00 / Collector +$4.99 appear in
  the Advanced rail. Removed by `LOCKED-DECISIONS`.
- **Dollar pricing on the primary button** — `Add this piece · $4.99`. Credits
  govern; dollars appear only at credit purchase.
- **24 effects in 3 groups.** Superseded by the 36/6 taxonomy.
- **Dev switcher bar** injected into `document.body` at line 1882. Bench
  tooling — must not port forward (PROCEDURES §6).

---

## 7 · CARRIED-OVER BUGS THAT LAND IN THIS PORT

- `body{min-width:1440px; overflow:hidden}` — fixed in r81, must reach live.
- `gotoSeries` map is stale — `redirectGo` depends on it.
- Credits gate spends raw count, ignoring `cost_per`. Route-side, not glass.
- `redeem_code` writes no redemption row on the admin path — `RHONE3166`
  cannot authorise a craft.

---

## 8 · THE ONE GAP WITH NO DESIGN AT ALL

Post-render rejection. Eight intake modals exist; nothing exists for *"this
came back and I don't like it."*

Proposed and awaiting ruling: the gate scores every piece at render and stores
the score. Below threshold, the piece arrives pre-flagged with a free recraft —
no complaint path needed. Above threshold, there is no reject control; the
action is *Talk to the concierge*, opening chat with piece ID and score in
context. Self-serve refund on a passing piece becomes impossible by design.

No likeness threshold exists in either file. **85% proposed.**

---

## 9 · BUILD SEQUENCE

Each is one gated Python script. Nothing starts until §1 is ruled.

| # | Build | Gate additions |
|---|---|---|
| 0 | Silo data table, inert | table shape; 36 effects; 6 silos |
| 1 | r81 shell onto b2 — masthead, rails, stage | 10 fetch intact; function count ≥226 |
| 2 | Curator step machine onto r81 markup | 7 curStep equivalents reachable |
| 3 | Silo tier + effect grid | cycle inert outside silo |
| 4 | To Be Crafted rail, credits pricing | no dollar string on craft path |
| 5 | Pay stage → credits gate | `/api/v1/checkout` off the craft path |
| 6 | My Collection as slide-over | rails default closed; filter = locked five |
| 7 | Intake modal, 8 states | `__openIntake` preserved; dev bar absent |
| 8 | Post-render gate + remedy | threshold constant present |

---

## 10 · RULINGS BLOCKING BUILD 1

1. **§1** — adopt r81's ids as the DOM contract, retaining b2's functions?
2. **§4** — the cut list. Each line, keep or lose.
3. Credits per image — **10 or 5**.
4. Route and SQL owner.
5. Likeness threshold — **85%?**
6. Piece ID format — **`Portraits-Walnut-0247`?**

Answers to 1 and 2 are enough to start.
