# PROJECT KNOWLEDGE — TRIAGE

CUI V21 · 2026-07-24 · for Rich, then CLAW to execute

**135 files. 87 are `.ts`. 5 load-bearing documents are missing.**

---

## The principle

**Project knowledge holds decisions. The repo holds code.**

Code already has a source of truth. Copying it here creates a second one that
drifts silently, and every lane that reads it inherits the drift as fact.

That is not theoretical. Today I read `portraits-*.ts` from this project and
wrote a confident engine audit whose central claim was false. The stale copies
showed `portraits-experimental.ts` imported by nothing; the live files show it
imports five primitives from `portraits-prompt.ts`, which has grown 381 → 643
lines. Four presets had also been added — `pewter`, `chocolate`,
`stained_glass`, `driftwood_resin` — and the whole pipeline had moved to NB2.

**`portraits-route.ts` is in this project and does not exist in the repo.** That
file is the proof: project knowledge is holding a route that was deleted.

---

## PURGE 1 — every `.ts` file · 87 files · 64% of the repository

```
portraits-*.ts (14) · groups-*.ts (11) · houses-*.ts (10) · actionmini-*.ts (9)
landscapes-*.ts (7) · pets-*.ts (5) · *-route.ts (~30) · subject-redirect.ts
```

All stale. All dangerous in the same way, because they read as authoritative.

**Also purge `portraits.html`** — the 9,872-line engine copy. Same problem,
larger blast radius: a lane that treats it as current could hand CC a diff
against a file that no longer exists.

**Replacement practice:** when a lane needs engine truth, Rich pulls the files
that day. That is exactly what happened this session and it worked — three
uploads, and the audit went from wrong to correct in twenty minutes.

If a standing engine reference is wanted, keep **`PORTRAITS-ENGINE-INVENTORY-v3`**
instead. It is a dated snapshot that says what it is, rather than code
pretending to be current.

## PURGE 2 — superseded UI revisions · 11 files

| File | Superseded by |
|---|---|
| `portraits-2026-07-16-r42.html` | r81 |
| `portraits-2026-07-16-r76.html` | r81 |
| `liten-three-rooms-v29.html` | the wizard spine |
| `liten-print-shop-mockup-v1.html` | printshop r28 |
| `litenco-printshop-workspace-2026-07-08-light.html` | printshop r28 |
| `litenco-proto-workshop-deckle-1920-2026-07-07-light.html` | r81 |
| `litenco-mycollection-redesign-2026-07-08-light.html` | account r7 |
| `litenco-collection-states-2026-07-07-light.html` | account r7 |
| `litenco-s1-input-2026-07-08-light.html` | r81 intake |
| `litenco-payflow-2026-07-08-light.html` | credits spec + entry gate |
| `liten-mobile-prototype.html` | no mobile work in flight |

**Rich's call:** `homepage-light.html`, `litenco-hero-fadewall-2026-07-07-light.html`,
`Landscapes-UI-001-Surface-v5.html`. The homepage may still be current; Landscapes
is out for Aug 1 but the surface may be worth banking.

## PURGE 3 — superseded session docs · 12 files

```
minirama-carryover-2026-05-13.md          minirama-silos-and-art-gallery-2026-05-13.md
liten-workshop-carryover-2026-05-20.md    CARRYOVER-2026-05-31.md
carryover-calibration-01-engine.md        carryover-2026-06-24-v7.md
CARRYOVER-portraits-UI-2026-07-16.md      CARRYOVER-2026-07-20-r76.md
ui-claude-carryover.md                    qa-claude-carryover.md
portrait-engine-briefing-2026-06-08.md    PORTRAITS-WIZARD-LOCKED-DECISIONS-…-r01.md
```

Carryovers are handoffs, not history. Once their decisions are folded into the
Bible or a locked-decisions doc, they are noise — and two of them still say
"silos."

`…-r01` is superseded by `…-r03`. Keep r03.

**Net: 110 files removed, 25 remain.**

---

## MISSING — this is the sharper problem

Five documents are referenced by things that survive, and are not here:

| File | Referenced by | Consequence |
|---|---|---|
| **`CLAW-STATUS.md`** | pasted at the start of every session | the master status doc has no home |
| **`liten-co-ux-philosophy-v1.md`** | `PHILOSOPHY-v2-AMENDMENT` | **the amendment targets a file nobody can read** |
| **`CREDITS-AND-CODES-SPEC-v3.md`** | the pay step, the entry gate | Rich had to hand it to me directly today |
| **`CLAUDE.md`** | repo governance, the CC fidelity law | the rule CC is bound by isn't stored |
| `CREDITS-AND-CODES-SPEC-v2.md` | superseded by v3 | fine to stay gone |

The philosophy one is the worst. I wrote a 202-line in-place amendment against a
322-line document that is not in the project. Whoever applies it has to find the
original elsewhere, and cannot check my section numbers.

---

## KEEP — 25 files

**Governing**
`_PRODUCTION-BIBLE.md` · `MASTER-LOCKED-ELEMENTS-v2_1.md` ·
`CLAW-CARRYOVER-2026-07-24.md` · `PHILOSOPHY-v2-AMENDMENT-2026-07-24.md` ·
`PORTRAITS-WIZARD-LOCKED-DECISIONS-2026-07-16-r03.md`

**Curator** — `Curator_Core_-_UI_Behavior_and_Prompt_System.md` ·
`…Trigger_Taxonomy_and_Voice_Library.md` · `…Engine_Output_Spec.md`
*Review against `CURATOR-FLOW-v1`. The two-tier flow may supersede parts.*

**CENG reference** — `liten-action-prompt-system-v1.md` ·
`liten-action-v7-spec.md` · `liten-face-swap-process-v1.md` ·
`RESOLUTION-GATE-NOTES.md`

**Process** — `liten-test-bench-spec-v1.md` · `liten-qa-log-wiring-v1.md` ·
`MIGRATION-NOTES.md` · `litenco-flow-contract-v1-2026-07-07.md` ·
`claude-code-handoff-portraits-solo-v1.md` · `engine-sync-checkout-preview.md` ·
`GoToMarket-Launch-001-Strategy-v1.md`

**Asset** — `Icon_Effect__0010_PencilSketch.png`

**`seam-tracker.md` needs a ruling.** It is the UI↔engine seam register and
predates the hook contracts, which now do that job per surface. Either fold it
into the contracts or retire it — running both invites disagreement.

---

## ADD — from this session

**Current approved surfaces**
`litenco-portraits-2026-07-24-r81.html` ·
`litenco-printshop-2026-07-24-r28.html` ·
`litenco-account-2026-07-24-r7.html` ·
`litenco-masthead-2026-07-24-r2.html` ·
`litenco-entrygate-2026-07-24-r1.html`

Not `r82-BENCH` — bench builds are disposable and it is marked not-for-deploy.

**Contracts and directives**
`PRINTSHOP-HOOK-CONTRACT-v3.md` · `MASTHEAD-DIRECTIVE-v1.md` ·
`PORTRAITS-ENGINE-INVENTORY-v3-2026-07-24.md`

**Tickets**
`CC-TICKET-FOCAL-POINT-2026-07-24.md` ·
`CLAW-TICKET-PRINTSHOP-PRODUCTS-2026-07-24.md`

**Add after correction — do not add as-is**

| Document | Fix first |
|---|---|
| `PORTRAITS-HOOK-CONTRACT-v1` | §1 intake states are wrong. The engine returns `redirected` and `intake_rejected` from `/generate`, not the modal classes I described. |
| `CURATOR-FLOW-v1` | §3.3 overstates the gap. `analyze` already returns `body_coverage`, `sharpness`, `lighting`; `classifySubject` returns a description. Only orientation is missing. |
| `PORTRAITS-TAXONOMY-v1` | Derived from 14 effects. The real set is 31, of which 17 render. Re-derive or drop for the three groups that already exist. |
| `CREDITS-MODEL-v1` | **Hold.** Ratio contradicts spec v3 (1 credit, not 5), and Rich has since changed the schema. Await CLAW's back-update. |

---

## Recommended order

1. **Add the five missing documents.** Cheapest, and it unblocks the philosophy
   amendment immediately.
2. **Purge all 87 `.ts` and `portraits.html`.** Biggest single risk reduction in
   the whole repository.
3. Purge the superseded UI and session docs — 23 files.
4. Add the five current surfaces and the three contracts.
5. Correct the four documents, then add them.
6. Rule on `seam-tracker.md` and the three homepage/Landscapes files.
7. **Update `_PRODUCTION-BIBLE.md`.** Dated 2026-07-10 and predates: r80d/r81
   approval, the whole Print Shop line, locked print prices, the credits schema
   change, the philosophy amendment, and the Curiosities finding. It is the
   governing document and it is fourteen days behind.

## One standing rule worth adopting

**No `.ts` in project knowledge, ever.** If a lane needs engine truth, it asks
for a same-day pull. The cost is one upload. The cost of the alternative was
demonstrated twice today.
