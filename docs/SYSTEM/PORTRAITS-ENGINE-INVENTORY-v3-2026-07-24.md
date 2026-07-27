# PORTRAITS ENGINE — INVENTORY v3 (COMPLETE)

Read from current `lib/v1/portraits/` **and** `app/api/v1/portraits/` files
supplied by Rich, 2026-07-24. 18 files.
Supersedes v1 (stale sources, wrong headline) and v2 (lib only, one question open).

---

## THE HEADLINE

**Curiosities cannot render. Every one of the 14 effects returns HTTP 400 from
the generate endpoint.**

`portraits-generate-route.ts` guards its input:

```ts
if (!(presetId in PRESET_LABELS)) {
  return NextResponse.json(
    { error: `unknown preset_id "${presetId}" — refresh the page for the current treatment list` },
    { status: 400 },
  )
}
```

`PRESET_LABELS` holds 17 preset ids. The 14 experimental effect ids share
**zero** overlap with it:

`amber · armor · blown_glass · circuit · deep_sea · dragon_skin · elizabethan ·
fantasy_crystal · magic_energy · mercury · nebula_resin · neon ·
reclaimed_bronze · victorian`

No route imports `buildExperimentalPrompt`, `EXPERIMENTAL_EFFECTS`,
`isExperimentalEffect` or `experimentalButtons`. Verified across all six route
files.

**The workshop UI offers twelve Curiosities tiles that the API rejects.**
`MATS.curios` in `portraits.html` lists deep_sea, circuit, armor, mercury,
blown_glass, amber, neon, nebula_resin, dragon_skin, magic_energy,
fantasy_crystal, reclaimed_bronze. Every one of those clicks 400s.

### This is a small fix, not a rebuild

The effects are complete. They import the main prompt's primitives
(`framingBlock`, `CRAFT_PERSONALITY`, `HUE_LOCK`, `STUDIO_DIRECTIVES`,
`COSTUME_DIRECTIVES`) rather than duplicating them, and `buildExperimentalPrompt`
is written and exported. What is missing is the seam between the route and the
addon — roughly:

```ts
const isExp = isExperimentalEffect(presetId)
if (!isExp && !(presetId in PRESET_LABELS)) { …400… }
```

plus routing the prompt build to `buildExperimentalPrompt` when `isExp`.

**This one seam is why Advanced being held for Aug 1 has not been noticed as a
problem.** Advanced is the only surface that exposes Curiosities, it is switched
off, so nothing has hit the guard.

---

## 1 · Route inventory — six files

| Route | Lines | Calls | Status |
|---|---|---|---|
| `/generate` | 321 | `generatePortraitsRender` · `STYLE_PIPELINE` · `PRESET_LABELS` | the render path |
| `/analyze` | 70 | `analyzeSourceSet` | live |
| `/curate-effects` | 81 | `curateEffects` | live |
| `/curate-upper-body` | 102 | `curateUpperBody` | live |
| `/raw-gpt-image` | 114 | `callGptImage1` | bench |
| `/raw-pipeline` | 174 | inlined NB2, no lib imports | bench |

**`portraits-route.ts` from the stale set does not exist.** That duplicate-route
concern in v1 was an artifact of the old project-knowledge copy. Six routes, no
duplicates.

### `/raw-pipeline` is the prompt bench

Takes a raw prompt straight to NB2 — no block assembly, no scoring, no Pass 2,
no outpaint. This is how experimental prompts can be exercised today despite the
guard: build the prompt, paste it in. It is a real bench and it works.

---

## 2 · The catalogue

**Styles — 3:** `realistic` · `people_resolving` · `artists_gallery`

**Presets — 17** (four new: `pewter`, `chocolate`, `stained_glass`, `driftwood_resin`)

| Style | Presets |
|---|---|
| realistic | plushy · ebony · walnut · stone · bronze · iron · alabaster · **pewter** · **chocolate** |
| people_resolving | ebony · walnut · bronze · alabaster |
| artists_gallery | impressionist · torn_paper · folded_book · charcoal_chalk · pencil_sketch · sheet_music · **stained_glass** · **driftwood_resin** |

**Curiosities — 14**, authored, unreachable. `mercury` and `amber` are
`monolithic: true`; `armor`, `elizabethan`, `victorian` are `mode: 'costume'`.

**Renderable today: 17. Advertised in the workshop: 29.**

---

## 3 · Pipeline

`STYLE_PIPELINE` is now identical for all three styles:

```
faceSwapEnabled: false · scoringMode: 'single_face_likeness' · scoringThreshold: 8
passTwoEnabled: false · generator: 'nb2' · expandEnabled: false · expandPercent: 0
```

**Artists Gallery is NB2 now.** `portraits-gpt-image.ts`: *"No Portraits style
currently routes here… Kept on disk for the Artist Series migration; do not
delete."* The premium-pricing argument for Artist Series was inherited from a
pipeline that has changed — on the Portraits path it costs what everything else
costs.

**Outpaint is off everywhere, and the code disagrees with itself.** The generate
route's header still says *"outpaint runs for Realistic/Resolving (10%, now
local canvas pad) and is off for Artists Gallery."* The config says
`expandEnabled: false` for all three. Meanwhile `portraits-expand.ts` was
rewritten from a paid Stability call to a local `sharp` canvas pad at ~$0 and
~50ms. **A cheap replacement was built, and then the feature was switched off
without the comment being updated.** That reads like an accident.

**Pass 2 off for all styles**, with a documented rationale: gpt-image-1 with a
face-related multi-image input has a strong prior to "fix" the face —
photo-paste first, then idealisation.

---

## 4 · The QA layer is substantial and undocumented downstream

`/generate` runs three gates, entirely fail-open — any QA failure is swallowed
and the render proceeds.

| Gate | Does | Can block? |
|---|---|---|
| 0 | `classifySubject` → `decideRedirect` | yes — returns `status: 'redirected'` with a Series offer |
| 1 | `scoreIntake` against `qaSettings.intakeThreshold` | yes — returns `status: 'intake_rejected'` |
| 2 | `scoreAesthetic` on the final render | **no** — logged only in v1 |

Every request writes one `qa_log` row. Strictness comes from `qa_settings` via
two 1–10 sliders read per request. `QA_COST` tracks cents per stage for
observability, not billing.

**The UI contract does not cover `status: 'redirected'` or
`status: 'intake_rejected'`.** `PORTRAITS-HOOK-CONTRACT-v1` §1 describes an
intake modal with hard-block and soft-warn classes; the engine actually returns
two distinct statuses from the *generate* call, not the analyze call. The
contract needs correcting before CC wires it.

---

## 5 · The Curator observation has more data than I claimed

`CURATOR-FLOW-v1` §3.3 said framing and pose are unavailable and recommended
adding analyze fields. Partly wrong.

`analyzeSourceSet` already returns:

| Field | Values |
|---|---|
| `body_coverage` | includes `'face_only'` — this is framing |
| `sharpness` | good · fair · poor |
| `lighting` | good · fair · poor |
| `subject_count_estimate` | number |
| `quality_verdict` | green · yellow · red |
| `recommendation` | free text |

And `classifySubject` returns `subjectType`, `confidence`, `description`
(natural language) and `activityDetected`.

So an honest observation is buildable today from `body_coverage` + `sharpness` +
`lighting` + `description`. **"A clear, face-forward photograph" still is not** —
nothing returns head orientation. But the gap is narrower than one field:
`CURATOR-FLOW-v1` §3.3 should be revised down from "add descriptive fields" to
"add orientation only."

---

## 6 · Smaller findings

**Four presets have no `MATERIAL_REGISTER`.** `portraits-curator.ts` maps
wardrobe register across 13; `pewter`, `chocolate`, `stained_glass` and
`driftwood_resin` fall back to generic. Quiet loss of specificity on the newest
materials.

**Four Pass 2 blocks are `[placeholder]` text.** Required by the exhaustive
`Record<PortraitsPresetId, string>`. Harmless while Pass 2 is off.

**`STYLE_REFERENCE_ASSETS` is three empty arrays**, keyed by *style*. The
influence-image plumbing is real, the library is zero, and per-effect references
need a schema change.

**`stabilityApiKey` is still threaded** from route → generator → expand, where
it is retained for signature compatibility and never used.

**The code asks its own question:** `chocolate: 'signature', // seasonal upsell
— confirm intended tier`.

**Solo/multi is live**, not dormant — `SubjectMode = 'solo' | 'multi'`,
`MULTI_SUBJECT_FIGURE_FIDELITY`, `familyLock` all in the prompt builder.

---

## 7 · Rulings needed

1. **Wire Curiosities, or stop showing it.** 12 tiles currently 400. Either add
   the seam at the guard or hide `MATS.curios` until it exists. Shipping a
   category that errors is the worse of the two.
2. **Outpaint** — accident or decision? The header comment and the config
   disagree, and the cheap implementation is sitting unused.
3. **Artists Gallery is NB2.** Does Artist Series premium pricing still hold?
4. **`chocolate` tier** — the code is asking.
5. **Four presets missing wardrobe register** — author, or accept the fallback?

## 8 · Documents this corrects

- `PORTRAITS-HOOK-CONTRACT-v1` §1 — intake states are wrong; the engine returns
  `redirected` and `intake_rejected` from `/generate`.
- `CURATOR-FLOW-v1` §3.3 — analyze already returns framing via `body_coverage`;
  only orientation is genuinely missing.
- `PORTRAITS-TAXONOMY-v1` — built against 14 effects. The real selectable set is
  31, of which 17 render.
- Artist Series premium pricing, asserted repeatedly this session — inherited
  from a pipeline that changed.
