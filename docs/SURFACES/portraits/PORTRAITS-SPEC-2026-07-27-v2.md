# PORTRAITS — SPECIFICATION v2

**2026-07-27 · CUI V22 · supersedes and replaces:**
- `PORTRAITS-SOURCE-OF-TRUTH-2026-07-27.md` (v1, same day — wrong in six places)
- `PORTRAITS-ID-MAP-2026-07-27.md` (folded in as §9)

Both predecessors were written before the afternoon rulings and must be archived,
not kept alongside this. Two documents that have to agree is how the engine ended
up with three effect lists.

**Governed by** `docs/GOVERNANCE/PROCEDURES-AND-LANES-2026-07-27.md` and
`LOCKED-DECISIONS-2026-07-27.md`. Where this document differs from them, §12
names the conflict and the correction required.

Everything here marked **RULED** was decided by Rich. **OPEN** means undecided —
do not build on it. Nothing is asserted about the repo or engine unless it was
read from live source on 2026-07-27.

---

## 1 · THE THREE FILES

### `public/portraits-b2.html` — the working base
8,876 lines · 152 unique ids · 10 route calls · 226 functions · no duplicate ids.

The only file that completes a craft end to end: upload → analyze → curate →
credits gate → NB2 → likeness → My Collection → download. Descends from
`portraits_recover2.html` via b1. **Committed and pushed 2026-07-27** — before
that it existed only in Rich's working tree.

**It is functionality, nothing else.** Its markup is superseded. Its effect list
is stale — never read effect ids out of it. That mistake was made twice today.

### `docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html` — the skin
1,895 lines · 74 ids · 0 route calls · 70 functions.

The approved visual design. A **specification**: this is the layout, these are
the tokens, here are the hooks. Not a file to wire.

**Its masthead is superseded** — 68px on a flat 36px inset, both ruled against by
`MASTHEAD-DIRECTIVE-v1`. Its `--r-pill:999px` is superseded too. Everything else
stands.

### Rich's typed taxonomy — the catalogue
Seven silos, 36 effects. Newer than r81's 24. See §3.

**The rule: taxonomy is Rich's, skin is r81, plumbing is b2, masthead is the
directive.**

### Archived — never resurrect
`public/portraits.html` (2,118-line replacement) · `portraits.next.html` ·
the 9,872-line uncommitted file · `litenco-portraits-2026-07-24-r80d.html`.
All moved to `archive/2026-07-27-cleanup/` this session.

---

## 2 · THE FLOW — RULED

```
sign in → upload → Curator reacts → choose silo → choose effects
   → To Be Crafted → craft → paywall → render → My Collection
        → download  |  send to Print Shop
```

**1 · Sign in.** Guest removed. Magic-link: the email *is* the identity, there is
no password. `litenco-entrygate-2026-07-24-r1.html` is the design, **unbuilt**.
First login lands on Account.

**2 · Empty state.** Curator asks for a photograph. That is its whole job here.

**3 · Curator reacts to that photograph.** A specific compliment — the light on
the hair, the expression — or a specific rejection with a clear ask. Live, per
photo, not a canned string. **Route does not exist. CENG owns the voice.**

**4 · Silo choice.** *"What kind of effect are you thinking about today?"* Seven
silos, presented as cards **on the workshop stage** — not in the Curator rail.
Rich supplies the artwork; CUI supplies the card.

**5 · Effect choice.** Drill into a silo. **Maximum five effects shown.** The
silo strip stays on screen as a persistent tab row — switching is one click.
**No back button exists, because nothing is ever behind them.** The queue is
global and survives every switch.

**6 · Cycle effects** activates only inside a silo. Inert above it.

**7 · Selection.** Image tile with a `+` badge, becomes `✓` on add. One component
everywhere.

**8 · To Be Crafted.** Vertical right rail, full height. Price updates live.

**9 · Craft → paywall.** Paywall only, nothing else on that screen.

**10 · Auto-naming in the background.** The user cannot name or rename. The
assigned ID is the system-wide handle — local, Supabase, and spoken in concierge
chat so every party means the same render.

**11 · My Collection.** Lands here on completion.

---

## 3 · THE CATALOGUE — RULED

**Seven silos, 36 effects.** Supersedes r81's 24/3 and supersedes the
"keep three groups, silos shelved" ruling in `LOCKED-DECISIONS`.

| Silo | Count | Effects |
|---|---|---|
| **Earth & Ore** | 7 | Bronze · Iron · Stone · Alabaster · Pewter · Ebony · Walnut |
| **The Artists Gallery** | 8 | Impressionist · Torn Paper · Folded Book · Charcoal & Chalk · Pencil Sketch · Sheet Music · Stained Glass · Driftwood & Resin |
| **Light & Glass** | 7 | Cast Glass · Blown Glass · Amber · Frost & Ice · Liquid Mercury · Enchanted Crystal · Volumetric Light |
| **Myth & Legend** | 6 | Dragon Skin · Fire & Ember · Magic Energy · Living Armor · Living Reef · Reclaimed Bronze |
| **Far & Future** | 5 | Silicon Circuit · Atomic Age Robot · Cosmic Bloom · Nebula Resin · Neon Drawing |
| **Curiosities** | 3 | Plushy · Chocolate · Elizabethan Portrait |
| **Seventh** | — | **OPEN — unnamed** |

Curiosities is deliberately thin: it is the landing zone for new work, not a
leftovers bin. r81's old 12-effect Curiosities group is dissolved into Light &
Glass, Myth & Legend and Far & Future.

**Rulings**
- **Deep Sea cut.** Exists in the engine, in no silo.
- **Fantasy Crystal:** the **id stays `fantasy_crystal`**, the label is
  *Enchanted Crystal*. Rich renamed the label in the engine and kept the id —
  that is correct practice.
- **IDS COME FROM THE ENGINE. LABELS COME FROM RICH.** Six ids were derived
  wrongly this morning and corrected against live source: `silicon_circuit`→
  `circuit`, `liquid_mercury`→`mercury`, `neon_drawing`→`neon`, `living_armor`→
  `armor`, `elizabethan_portrait`→`elizabethan`, `enchanted_crystal`→
  `fantasy_crystal`.
- **The list will grow.** Rich is authoring effects now. The catalogue is a data
  table so growth is a one-line edit — `docs/SYSTEM/portraits-catalogue.js`,
  gated by `docs/SYSTEM/gate0.js`.

### 3.1 What actually renders — read from live source 2026-07-27

**29 of 36 render today**, by two different paths.

| Path | Count | Defined in |
|---|---|---|
| `preset` | 17 | `lib/v1/portraits/portraits-shared.ts` → `PRESET_LABELS` |
| `experimental` | 12 | `lib/v1/portraits/portraits-experimental.ts` → `EXPERIMENTAL_EFFECTS` |
| `none` | 7 | nowhere — Rich is building these |

No prompt yet: `cast_glass`, `frost_ice`, `volumetric_light`, `fire_ember`,
`living_reef`, `atomic_robot`, `cosmic_bloom`.

### 3.2 THREE DOORS — the structural bug

Three lists guard the same door and nothing enforces agreement:

| List | Entries | Consequence |
|---|---|---|
| `PRESET_LABELS` | 17 | `/generate` line 227 accepts these |
| `EFFECT_CATALOG` | 12 | the Curator can only recommend these |
| `EXPERIMENTAL_EFFECTS` | 14 | needs `isExperimentalEffect()` at the guard — currently 400s |

**Five effects render but the Curator cannot offer them:** `plushy`, `pewter`,
`chocolate`, `stained_glass`, `driftwood_resin` — Rich's entire 2026-06 material
batch. Since the Curator is now the spine of the flow, an effect missing from
`EFFECT_CATALOG` is an effect no customer will ever see.

**Proposed fix — OPEN.** One `EFFECTS` array in `portraits-shared.ts` carrying
id, label, series, body_dependency, description, available. `PRESET_LABELS`
derives from it; the Curator imports it and filters on `available`; the
experimental path folds in. TypeScript then refuses to compile an entry missing
a description — the failure moves from silent to a build error. `available`
lets an effect land before CENG has written its prompt.

**Engine orphans:** `deep_sea` (cut) and `victorian` — "Victorian Portrait",
fully written, in no silo. **OPEN: where does victorian go, or is it cut?**

---

## 4 · ADVANCED — RULED

Remains. **Closed by default**, user-toggleable, state persists. **Flat list**,
not grouped by silo. Carries the full effect set. It is the power-user escape
hatch, not the path.

---

## 5 · CREDITS AND PRICING — RULED

- **10 credits = 1 Crafted Image = $4.99.** Locked. The 5-credit figure in
  `PHILOSOPHY-v2-AMENDMENT` and `CREDITS-MODEL-v1` is void.
- Ladder: −10% at 2 · −15% at 3 · −20% at 4 · −25% at 5 · then −1% per image to
  −30% at 10. `4.99 × images × (1 − pct)`.
- Tiers: **THE SERIES** (1–9) · **THE STUDIO** (10). Credits do not expire.
- Quality tiers dead — Web/Print/Collector must never reach Stripe
  `product_data.name` or a receipt. Resolution is resolved later by upscaling.

**Credit blocks**

| Credits | Images | Price |
|---|---|---|
| 10 | 1 | $4.99 |
| 20 | 2 | $8.98 |
| 30 | 3 | $12.72 |
| 50 | 5 | $18.71 |
| 100 | 10 | $34.93 |

100 is the only block reaching THE STUDIO at −30%.

**Why 10 and not 5:** the currency must divide for partial remedies — re-renders,
credit-back, and anything that is a fraction of a rendered image. Fifths do not
express that cleanly, and 10 leaves headroom to price a Group above a Wallpaper
without fractions.

**Paywall — RULED.** One transaction for the whole queue. On partial failure the
full amount is charged and the failed item's credits are returned to the ledger
automatically. A customer wanting money back rather than credit goes through the
concierge. *(Mechanism for cash refund: OPEN.)*

**Insufficient credits — RULED.** They buy inline and continue. The queue is
never lost. Likely a modal over the paywall.

---

## 6 · MY COLLECTION — RULED

**Its own surface**, contained within r81, slides over the workshop.

- Curator and Advanced rails **closed** when it opens; user can open them; state
  persists.
- Every successfully rendered piece appears.
- **Filters:** View All · Portraits · Pets · Groups · Action · Mobile Wallpapers.
  r81 line 1410 is correct; lines 953–959 carry a stale seven including Houses
  and Landscapes — corrected during the port. Client-side filtering at launch
  volumes.
- **Actions:** Download · Send to Print Shop. **Multi-select** for both.
- **Print Shop launches from here.**

---

## 7 · QUALITY, FAILURE AND REMEDY

### 7.1 The gate — RULED, and it already exists
**≥8/10 for a single face.** b2 line 7645: `'≥8/10 (single face)'`. Multi-figure
runs a relaxed tier — the top 70% of figures need ≥8, the remainder ≥7. The route
returns `final_pass` and `final_reason`; **the engine decides, the client
displays.** QA sliders carry `source_strictness` and `render_strictness`, 1–10,
default 5, at `/api/v1/qa/settings`.

This is a 10-point scale, **not a percentage**. Earlier proposals of 85% are
withdrawn.

### 7.2 What the bench data says — 399 items, 2026-06-07
| Metric | Value |
|---|---|
| Mean fidelity | 8.10 – 8.46 across all cells |
| Pass rate | 95.3% |
| First-pass rate | 87.3% |
| Cost per accepted render | **$0.15** |
| `face_drift` share of failures | **70.6%** |

**Consequences, all ruled:**
- The 8/10 threshold sits just below the mean, so **≈5% of renders fail** — that
  is the recraft rate, measured rather than guessed.
- **Recraft is free, once, on a sub-8 score.** At $0.15 a render, a free recraft
  on 5% costs about half a cent per image sold against $4.99.
- **The aesthetic score is dead weight.** 8.96 / 8.99 / 9.00 / 8.96 across every
  cell, preset and run. A metric that never varies measures nothing. **Build no
  UI on it.** The remedy surface keys on fidelity alone.
- `face_drift` being 70.6% of failures means there is **one failure story to
  write, not five** — and a drifted face usually renders fine on retry.

### 7.3 Pre-craft failure — exists
r81 carries eight intake states behind `window.__openIntake(1..8)`: Interrupted ·
Photograph · At capacity·orphan · Refunded · Face small · Blur·BLOCK · Dim ·
Can't use. b2 drives equivalents through `friendlyReject`,
`curatorEnterQualityFail` and `gotoSeries`. **The `gotoSeries` map is stale.**

### 7.4 Post-render rejection — exists nowhere
**Requirement (RULED):** a customer must not be able to self-serve a refund on a
piece that passed our own gate without going through the concierge.

**Mechanism (proposed, OPEN):** the gate scores every piece at render and stores
the score. The control the customer sees is therefore already decided —

- **Below 8** — we caught it first. The piece arrives pre-flagged with a free
  recraft offered. No complaint, no concierge, no argument.
- **8 or above** — no reject control exists. The action is *Talk to the
  concierge*, opening chat with the piece ID and score in context.

The system adjudicates before the customer sees a choice.

### 7.5 The redirect classifier — never human-reviewed
All four bench reports carry this as an open action item and it has never been
done. Series mismatches ran 40% in the spot runs and 7–8% in the large ones.

**This lands in build 7**, which wires `gotoSeries`. A wrong redirect sends a
paying customer to the wrong Series and loses them. **Rich's test: upload a house
to Portraits and confirm the redirect fires correctly.**

---

## 8 · PIECE ID — RULED

`Portraits-Walnut-0247` — Series, effect label, four-digit sequence. Assigned at
craft, immutable, system-wide. Non-alphanumerics stripped from the effect label.

---

## 9 · THE PORT — b2 becomes the product

### 9.1 The governing fact
**b2 and r81 share two ids:** `curatorDeckle` and `lightbox`. 150 of b2's and 72
of r81's are unique to their file. There is no name-level correspondence.

**RULED:** r81's ids become the DOM contract; b2's 226 functions are retained and
re-pointed. b2 does not finish with 152 ids — it finishes with r81's markup and
b2's behaviour. This deviates from the literal base-file law; the law's purpose
is served by protecting the functions and route calls, which is where behaviour
lives. Id strings are not behaviour.

### 9.2 Route calls — all ten survive
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

`/api/v1/checkout` comes off the craft path, stays wired for buying credits.

### 9.3 What carries — RULED
Run orchestration (`runAllBtn`, `renderCount`, `stageProgress`) · per-item queue
state (`qpill-*`, `qimg-*`, `qscores-*`, `qpass-*`) · the Curator step machine
(`curStep*` ×7) · the `/curate-effects` render target · multi-source intake ·
subject pick (`chooseSubject`) · resolution assessment.

### 9.4 What is cut — RULED
Quality tiers (`resolutionControl`, `resolutionPills`, `olTier`) ·
preview-then-unlock (`previewBand`, `previewCraftBtn`, `previewEmailInput`) ·
plaque inscription (`inscription*` ×5, `stagePreviewPlaque`) · raw mode
(`rawControls`, `rawPromptText`, `rawRefSlot`) · experimental buttons
(`experimentalFx`, `experimentalButtons`) · the onboarding tour (`tourHelpBtn`
+10 functions — the Curator does that job better now) · the three
`_retired_*` functions.

### 9.5 Drift in r81 — fix during the port
- Two disagreeing Series lists (line 1410 correct; 953–959 stale seven).
- Quality tiers present in the Advanced rail.
- `Add this piece · $4.99` — dollars on the craft path.
- 24 effects in 3 groups.
- Dev switcher bar injected at line 1882 — bench tooling, must not port forward.
- `body{min-width:1440px; overflow:hidden}` — a floor with a hidden axis. Fixed
  in r81; must reach the live file.
- Masthead at 68px with flat 36px inset — superseded by §10.
- `--r-pill:999px` — superseded by the 8px ceiling.

### 9.6 Build sequence
Each is one gated Python build script (PROCEDURES §4).

| # | Build | Status |
|---|---|---|
| 0 | Catalogue data table | **DONE, accepted, committed** |
| 1 | r81 shell onto b2, masthead per §10 | next |
| 2 | Curator step machine | |
| 3 | Silo stage + effect grid | |
| 4 | To Be Crafted, credits pricing | |
| 5 | Pay stage → credits gate | |
| 6 | My Collection slide-over | |
| 7 | Intake modal + redirect test | |
| 8 | Post-render gate + remedy | |

---

## 10 · MASTHEAD — governed by MASTHEAD-DIRECTIVE-v1

`docs/SURFACES/masthead/litenco-masthead-2026-07-24-r2.html` is the component.
**Rich: trusted, use it.** Responsive behaviour is already built.

- **72px**, espresso `#26201a`, 1px `--card-line` rule, sticky, z-60.
- Three zones: wordmark · nav · credits+cart. Grid
  `minmax(0,1fr) auto minmax(0,1fr)` so nav stays optically centred.
- **Inset tracks the container edge**, never a flat padding:
  `padding-inline: max(calc((100% - var(--container))/2), calc((100% - var(--container-max))/2))`
- Geometry ladder: `--container:86%` / max 2200 / min 1850, released at 1849 →
  92%, 1199 → 94%, 767 → 100%. **The floor must always be released below its own
  value.**
- Fluid root `clamp(12px, 0.38vw + 6px, 15px)`. Wordmark 2.267rem, nav 1.6rem,
  controls Manrope 1rem/600, badge 0.867rem.
- **Radius ceiling 8px. Never 999px.** The count badge is the only circle.
- Cormorant never below 1.333rem, never bold. Hierarchy is size, never weight.
- Cart never hides — at zero it mutes via `data-empty="true"`.
- Credits ships `hidden`, unhidden when a signed-in balance exists.
- Navigation is what gives way below 1200px. **The wordmark and cart never
  clip and never hide at any width.**

**OPEN:** which slots each surface gets — series label · credits · cart ·
sign-in, plus a per-surface nav list.

**OUTSTANDING:** Account rebased onto canonical tokens and the container ladder
(directive §11 step 3). It is the last surface off the system and carries the
unreleased 1850 floor.

---

## 11 · ENTRY GATE

`litenco-entrygate-2026-07-24-r1.html` — three states: signed out · link sent ·
signed in. **Unbuilt.**

- **Magic link. The email is the identity** — there is no password field. Email
  is required because it is the login, not because it is being collected.
  On-screen reason, already written: *your pieces are kept to your account, so
  you can come back to them from anywhere.*
- **The studio code is a credit grant, not an entry ticket.** The field appears
  twice — `gateCode` at sign-up and `gateCodeIn`/`gateRedeem` after sign-in.
  Same code, redeemable at any time. This matches the locked model: codes are a
  payment method *inside* commerce, redeeming into the same ledger a card will
  later fund. `TESTER-AMBER` = 500 credits. `RHONE3166` = admin.
- **OPEN:** a paying customer has no code, and an open field labelled for one
  suggests they are missing something. Recommend a quiet *Have a studio code?*
  toggle rather than a field sitting open.
- **Missing:** the per-account fulfilment flag distinguishing tester from
  customer. Without it a tester places a real, billable Prodigi order.

---

## 12 · CONFLICTS WITH THE GOVERNANCE DOCUMENTS

Per PROCEDURES §9 a finding that contradicts an accepted document corrects it in
place. **These corrections are pending Rich's approval, not applied.**

| Governed statement | This session |
|---|---|
| `LOCKED-DECISIONS` — "keep the three groups; five/seven-silo proposals shelved" | **Seven silos, 36 effects.** Reinstated. |
| `LOCKED-DECISIONS` — "two-tier Curator deferred" | **Reinstated as the primary path.** |
| `LOCKED-DECISIONS` — "My Collection lives inside Account" (via Philosophy v2) | **Its own surface**, slides over the workshop. |
| `LOCKED-DECISIONS` — Artist Series premium pricing dropped | Still true. Artists Gallery runs on NB2. |
| r81 `--r-pill:999px` | **8px ceiling** per the masthead directive. |

Still true and carried forward: quality tiers dead · guest removed · Aug 9 single
release · Curiosities seam to be wired · testers cannot order Prodigi printing ·
Style Refs supersede influence images · Pass 2 off · outpaint off · storage is
Supabase.

---

## 13 · OPEN RULINGS

**Content — Rich**
1. The seventh silo's name.
2. `victorian` — which silo, or cut.
3. Effect art for seven silo cards, and preview coverage for the new presets.

**Engineering**
4. Route and SQL ownership — **RULED: CUI writes, Rich reviews and runs.**
   Blocked on uploads of `app/api/v1/credits/gate/route.ts` and
   `_recovery/pipeline/009_credits_and_codes.sql`.
5. The single-list fix for the three doors (§3.2).
6. `lib/v1/portraits/portraits-presets.ts` shows no importer — dead or false
   positive?
7. Masthead slots per surface.
8. Account rebase onto canonical tokens.

**Design**
9. Silo card layout — mockup r1 rejected. Rebuild by harvesting r81 and the
   masthead component rather than inventing.

---

## 14 · KNOWN BUGS — scheduled

1. `/api/v1/credits/gate` ignores `cost_per` and spends the raw count. At 10
   credits/image a five-image craft charges 5 instead of 50. **Must be fixed
   route-side** — fixing it client-side would falsify the audit trail. The route
   must spend `count × cost_per` while writing `count` rows at
   `credits_delta: -cost_per`.
2. `redeem_code` writes no redemption row on the admin path — `redeem` returns
   `kind:'admin'` for `RHONE3166` but `balance` returns `admin:false`. **The
   admin code cannot authorise a craft.**
3. `credits/refund` is read-then-write, not atomic. Needs a `refund_credits`
   SECURITY DEFINER RPC before multi-user.
4. `qa-override.ts` reads `LITEN_INTERNAL_TOKEN`; `.env.local` defines
   `LITEN_INTERNAL_KEY`. That header path can never authenticate.
5. `presetLabel()` in `lib/store/checkout.ts` uppercases the id instead of
   looking up the label — Stripe receipts read "Charcoal_chalk".
6. `checkout.ts` still prices at $3.99 with a volume ladder. Superseded.
7. `gotoSeries` map is stale.

---

## 15 · NOT CUI'S, ON THE CRITICAL PATH

- **Sign-in build** — the flow starts with it and it does not exist.
- **Curator reaction route** — new. CENG owns the voice.
- **Engine prompts for the 7 unwritten effects** — CENG.
- **`EFFECT_CATALOG` entries for the 5 invisible presets** — CENG. Without them
  the Curator can never offer plushy, pewter, chocolate, stained_glass or
  driftwood_resin.
- **`MATERIAL_REGISTER`** for pewter, chocolate, stained_glass, driftwood_resin —
  CENG with Rich.
- **Prodigi live key and the per-account fulfilment flag.**
- **Redirect classifier human review** — never done, four reports asked for it.
- **Multi-person Portraits** — up to three people, and selecting one person from
  an image containing up to three. Dormant behind `subject_mode`. Post-Aug 9
  unless Rich pulls it forward.

---

**Thirteen days to August 9.** The pipeline works. What remains is the glass, the
economics, and seven prompts.
