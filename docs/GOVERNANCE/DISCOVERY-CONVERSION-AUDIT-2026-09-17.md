# Pets · Groups · Halloween — Discovery conversion audit

**Evidence only.** Nothing in the repository was modified to produce this. Read at
HEAD `d5e0e94`, branch `feat/discovery-curator-pass2`, 2026-09-17.

The question this answers: what already exists for Pets, Groups and Halloween, and
what would each need to run the approved Portrait Discovery flow —

    Foyer → Discovery → Review → Format → Stripe → Collection

Every requirement is classified **REUSE UNCHANGED · CONFIG/CONTENT SWAP ·
SMALL ADAPTATION · NEW PRODUCT LOGIC**.

No prompt was rewritten, improved, or proposed for rewriting. Where a prompt is
quoted it is copied.

---

## Method

Three parallel forensic passes, one per product, each citing `file:line`. The
sharpest claim from each pass was then re-verified independently before being
recorded here — specifically: the Pets `forest_guardian` orphan, the Pets
`pet_visible` dead gate, the `credits/gate` preset bypass, the Halloween
server-side age gap, and the Groups prompt-composition and aspect-derivation
rules. Claims that were inferred rather than read are marked **[I]**.

Counts were produced by scripted enumeration, not by eye. Image dimensions were
measured with `sharp`, not assumed.

---

## Three findings that shape everything

### 1. Discovery's front end is already product-agnostic

All five registries expose an **identical** API —

    silos · effects · byId · bySilo · offerableBySilo
    tilesBySilo · offerableTilesBySilo · isVariant · variantFor · poses

with zero missing on any of them, verified by loading each one. Every effect
carries the four fields `buildSilosFromRegistry()` reads (`id`, `label`,
`category`, `body`), every effect is `body:'live'`, and every `category` matches
a declared silo.

| Registry | Effects | Silos |
|---|---|---|
| `public/effect-registry.js` (Portraits) | 66 | 8 |
| `public/pets-registry.js` | 34 | 5 |
| `public/halloween-registry.js` | 28 | 4 |
| `public/pets-halloween-registry.js` | 27 | 4 |
| `public/groups-registry.js` | 34 | 5 |

Discovery's rooms, grid and silo navigation are registry-driven. For these
products that stage is a `<script src>` swap, not a port.

### 2. The render pipeline is the wall

`portfolios` / `portfolio_items` already accept all four series
(`lib/store/portfolio-checkout.ts:31`, `app/api/v1/portfolios/route.ts:29`), but:

- `lib/store/portfolio-render.ts:47` — refuses any series but `portraits`
- `app/api/v1/portfolios/[portfolioId]/dispatch/route.ts:74` — refuses again
- `app/api/v1/portfolios/items/render-poll/route.ts:105` — `.eq('series','portraits')`

**A paid Pets / Groups / Halloween portfolio can be created today and will strand
every item.** `renderOnePortfolioItem` also hardcodes
`fetch(\`${appUrl}/api/v1/portraits/generate\`)`, and each product's route takes a
different body and returns a different envelope.

### 3. The prompts do not need rewriting — but Groups' cannot be used unchanged

See the dedicated section below.

---

## Per-product evidence

### 1 · Effects and canonical IDs

| | Count | Authority | Browser registry |
|---|---|---|---|
| Pets | **34 offered / 33 with prompts** | `lib/v1/pets/pets-catalog-35.ts` | generated `pets-registry.js` |
| Pets Halloween | 27 (`pethw_` prefix) | `lib/v1/halloween/pets-halloween-catalog.ts` | generated |
| Halloween (human) | 28 | `lib/v1/halloween/halloween-catalog.ts` | generated |
| Groups | 34 (30 `group_photo`, 4 `multi_photo`) | `lib/v1/groups/groups-effects.ts` | generated |

No product has a `lib/v1/*/effect-registry.ts`. Portraits' two-file split
(metadata + bodies) is collapsed into one file everywhere else.

**Verified defect — Pets `forest_guardian`.** Registry has 34 ids, catalog has 33
bodies, exactly one orphan (verified by set difference). It carries a live
registry row at `pets-registry.js:240` and a plate at
`previews/pets/pets_forest_guardian.jpg`, but no body — so
`/api/v1/pets/generate` answers 400 `unknown preset_id`, while
`/api/v1/credits/gate` charges first (see §9). `public/index.html` advertises
"thirty-four" and "sixty-one finishes", both counting it.

Groups' silos are **not in the engine** — they live in
`scripts/emit-groups-registry.js`, which refuses to emit if a room exceeds
`CAP = 7`, because `groups.html` slices at 7 with an upsell in the 8th slot.

### 2 · Customer-facing labels

Kept separate from ids in all three, enforced by convention and stated in each
registry header (*"Labels are plain unicode. Key on .id, never on .label."*).
Proven by divergence: `ice → Frost & Ice`, `retro_robot → Atomic-Age Robot`,
`raven_monarch → Raven King / Queen`, `pethw_harvest_god_beast → Harvest God's
Beast`, `family_mosaic → The Family Mosaic`.

Pets, Groups and Halloween all put `label` **on the prompt record**; Portraits
keeps it in a separate registry. Cosmetic, no conversion consequence.

Labels reach the customer through `textContent`, never `innerHTML`, deliberately
— so `"Charcoal & Chalk"` cannot double-escape.

### 3 · Production prompts

| Product | File / export | Composition at request time |
|---|---|---|
| Pets | `pets-catalog-35.ts` → `PETS_35` | none — `body + avoid`, verbatim |
| Pets Halloween | `pets-halloween-catalog.ts` → `PETS_HALLOWEEN_MAIN` | none |
| Halloween human | `halloween-catalog.ts` → `HALLOWEEN_MAIN` | constant framing line appended |
| Groups | `groups-effects.ts` → `GROUPS_EFFECTS` | **framing clause chosen by person count** |

`avoid` occupancy: Pets 14/33 · Groups 17/34 · **Halloween 0/55** (field declared
and composed, never populated).

Pets repeats a shared tail inside every body rather than appending it, because
the bodies *"are going to a SHOOT first, and a body that carries its own rules
can be pasted into a browser and tested on its own."*

**The Groups bodies are locked**, `groups-effects.ts:11` — *"No lane rewrites one
without a green light from him. 'Restore', 'reconcile', 'normalise' and 'align'
are overwrites wearing a different word."* Several carry deliberate typos
(`"rortate the statue"`, `"poured liguid gold"`) that are evidence of the lock,
not defects. They were not touched.

### 4 · Variants

**None of the three has any variant axis**, in every case deliberately. All
registries hardcode `isVariant() → false` and `variantFor()` → identity, each with
a comment explaining why. The inherited Portraits `craftIdFor()` resolver is
still wired in every page and is permanently inert.

- **Pets** — no gender, no species-as-id, no breed. Multi-pet is a runtime count
  (`MAX_PETS = 5`), never an id.
- **Halloween** — `man_`/`woman_` is a **plate filename** only: 14 and 14,
  disjoint sets, so `roomHasBoth` never returns true and the toggle never appears.
- **Groups** — the six costume effects that needed a sex toggle were deleted,
  because *"each re-dressed the whole group and had to guess everybody's sex."*

For Discovery this is a simplification: the `_woman` twin logic simply never fires.

### 5 · Preview assets

| Set | Count | Resolution | Naming |
|---|---|---|---|
| `previews/pets/` | 34 | **800×800** (all) | `pets_<id>.jpg` |
| `previews/halloween/` | 28 | **800×800** (all) | `<man\|woman>_<id>.jpg` |
| `previews/halloween-pets/` | 27 | **800×800** (all) | `<id minus pethw_>.jpg` |
| `previews/groups/` | 34 | **928×1152** (all) | `groups_<id>.jpg` |

**No `@2x` anywhere. No JSON manifest anywhere.** Paths are *derived* from the id
by each registry's `plateFor()`, deliberately — *"There is no plate field and no
lookup table, and none should be added. If a plate ever fails to load, the fix is
the filename on disk."* Portraits is the exception with its manifest and retina
plates.

`previews/groups-plates.txt` is a **stale directory listing**, not a manifest:
every filename in it uses a retired convention and none matches disk.
`previews/groups-small/` is **empty**.

### 6 · Subject / intake / detection

| | Vision calls | Classifies | What it gates |
|---|---|---|---|
| Pets | 2 | **species** (6 values), count, coat, coverage — no age, no gender | account only |
| Halloween | uses **Portraits** `/analyze` + `/gate` | gender, age_group | client-side age gate only |
| Groups | 3 | **hero-subject count**, per-face `age_class` — no gender | price, framing, scoring; refuses `nothing_to_craft` |

**Pets `pet_visible` is computed and never read** — verified by exhaustive grep,
three hits only: declaration, assignment, log string. Combined with a detection
prompt that explicitly ignores humans (*"Humans in the photo are not counted"*),
nothing prevents a human photograph being crafted as a pet.

**Groups' count detection is authoritative and server-side** —
`groups-generator.ts:161` — *"THAT ESTIMATE IS AUTHORITATIVE AND THE CALLER'S IS
NOT. The count drives the framing clause, the scoring bar and the credit band, so
a client that could set it could pick its own price."* It refuses to render at all
without OpenAI rather than charge the wrong number. The most mature intake of the
three.

Neither Pets nor Groups has a `/gate` route, both by explicit ruling.

### 7 · Generation route and model

All three use **Replicate `google/nano-banana-2`**, sync-first (`Prefer: wait=60`)
then poll 30 × 2 s — the same model and the same call shape Portraits uses.

| | Route | maxDuration | Attempts |
|---|---|---|---|
| Pets | `/api/v1/pets/generate` | 180 | 2 |
| Halloween (both rooms) | `/api/v1/halloween/generate` | 180 | 2 |
| Groups | `/api/v1/groups/generate` | **300** | **4** |

One Halloween route serves both the human 28 and the pet 27; the `pethw_` prefix
branches them. Groups returns **HTTP 200 with `passed:false`** on a gate miss —
different failure semantics from Portraits. Groups accepts up to
`MAX_SOURCE_IMAGES = 14` and **refuses rather than slices** above it, after a bug
where a five-photo composite silently dropped its fifth reference.

### 8 · Aspect

| | Support | Values produced |
|---|---|---|
| Pets | `aspect_ratio` on the wire, **no `output_aspect_ratio`**, no UI | `1:1` only |
| Halloween | `aspect_ratio` (bench affordance only) | `1:1` only |
| **Groups** | **no aspect field at all** | **derived from source pixels** → 1:1 / 5:4 / 4:3 |

`output_aspect_ratio` — the field Discovery's Format step sets — exists **only**
in Portraits and the portfolio pipeline.

Groups is the hard case. `groupsAspect()` measures the source JPEG and snaps,
because `groups-generator.ts:538` records that a square output of a landscape
source made *"a wide group become separate stacked figures"* — proved 23 August.
Portrait and square sources are forced to `1:1`, and *"Do not add 3:4 without
him."* Group size does **not** influence shape; only source dimensions do.

A customer-chosen Format would fight a rule that was proven against renders.

### 9 · Pricing / checkout

**All three run on credits, not the portfolio ladder.** Ten credits per image flat
for Pets and Halloween; **Groups is banded by person count**:

    2-3 → 10cr   4-6 → 15cr   7-9 → 25cr   10+ → 40cr

Five generic credit SKUs ($4.99 – $82.34), embedded Stripe
(`credits/purchase`, `ui_mode:'embedded'`). **No product-specific SKU exists for
any of the three.**

**Verified gap** — `app/api/v1/credits/gate/route.ts:175`:

```ts
function canRender(series: string, preset: string): boolean {
  if (series === 'groups') return isGroupsEffectId(preset)
  if (series !== 'portraits') return true        // ← pets and halloween
  ...
```

Pets and Halloween presets are never checked against a catalog before money
moves, although the route's own doc-comment says the gate exists so *"Money must
not move for work that cannot be done."*

### 10 · Collection path

All three write to **`collection_pieces`** via the Portraits-namespaced
`/api/v1/portraits/pieces` — *"My Collection is not a Series. This route is where
every piece the customer owns lives, whatever room made it."* Not `portfolios`.
My Collection's UI already carries series pills for all of them.

Two conflations: **Pets Halloween stores `series:'pets'`**, indistinguishable from
Pets Portraits at DB level (its display label is reconstructed client-side by
string-matching a registry, flagged fragile in-file). And every non-Portraits
piece lands with `product_path='portraits'`, the migration default, because none
sends the field. **[I]**

### 11 · Product-specific restrictions

- **Pets** — the species branch is *in the prompt* (`IF THE ANIMAL IS A HORSE…`
  in all 33 bodies); "the markings are the likeness" governs scoring; head at 20%
  (except `alabaster` at 15%); **no pose step, by ruling** — *"an animal is
  photographed as it was."* The code-side `petFramingClause` is dead (one grep
  hit: its own definition).
- **Halloween** — **not date-gated, not feature-flagged; permanently live.**
  Content constraints are written into bodies (`werewolf`: *"maintain at least 75%
  human"*). Bust/sculpture vocabulary is banned in the engine because it *"sends
  NB2 to classical statuary, which arrives with the arms cut off."*
- **Groups** — `MIN_SUBJECTS = 2` / `MAX_SUBJECTS = 15` **clamp but never refuse**;
  room cap 7; held objects deliberately allowed (the Iron render *"removed the
  bridesmaids' bouquets"*); `expectedSubjects` declared and read by nothing —
  *"Rich's ruling, not yet made."*

### 12 · Foyer / homepage

**There is no foyer for any of the three.** Verified by exhaustive grep: zero hits
for pets, groups or halloween in `public/foyer.html`, `foyer-DATA.js`,
`foyer-handoff.js`, `lib/v1/foyer/*`, `app/api/v1/foyer/*` or
`supabase/migrations/032_foyer_reveals.sql`. No flip deck — the 52 plates
(26 + 26, ≈9.5 MB) are Portraits.

`public/index.html` — **unrouted** since the foyer became the front door — carries
full treatments for all three: dedicated folds, captioned reveal decks with real
copy, hero sequences. **Halloween has a working flip deck on its own product
page** (`.deck`, 420 ms with a 38 ms stagger), the closest existing thing to the
foyer's interaction.

Stale `live:false, 'Coming shortly.'` entries in `index.html` contradict the folds
for both Pets and Groups. **[I]**

`public/icons/halloween/` and `halloween.zip` are **not** Halloween-portrait
assets — they are the four-axis control icons for the Wallpaper Studio's Halloween
vocabulary, referenced by nothing outside their own renamer script.

---

## Can the prompts be reused unchanged?

| Product | Reusable unchanged | Why |
|---|---|---|
| **Pets** | **YES** | `catalogEffect.body + avoid`, verbatim, nothing composed |
| **Pets Halloween** | **YES** | `buildPetsHalloweenPrompt` appends nothing |
| **Halloween human** | **YES** | `buildHalloweenPrompt` appends a *constant*; deterministic |
| **Groups** | **NO** | needs a runtime person count |

Groups, verbatim from `groups-effects.ts:544`:

```ts
if (effect.intake === 'group_photo' && input.subjectCount) {
  parts.push(framingClause(input.subjectCount))   // >= 6 ? head-to-toe : stomach-up
}
```

**No prompt needs rewriting.** What Groups needs is for Discovery to *carry a
person count through to render time* — a field the portfolio pipeline has no
column for. The distinction matters: this is a plumbing requirement, not a
content one.

The corollary for all four: a converted product must call its **existing builder
function**, not read `.body` directly. Reading `.body` would silently drop
Halloween's framing line and Groups' framing clause.

---

## What a per-product Foyer would need

The foyer's render seam is cleaner than its file count suggests.
`renderFoyerReveal` already takes `{sourceImageB64, effectId, subject, ageGroup,
replicateApiToken}` — product-neutral in shape. Six dependencies are
Portraits-bound:

| Dependency | What a swap needs |
|---|---|
| `resolvePresetForSubject` | identity for all three — none has variants |
| `buildEffectPrompt` / `hasBody` | per-product builder — all three exist |
| `loadStyleRefs` | Portraits-only; returns `[]` |
| `POSE_PHRASE[DEFAULT_POSE]` | Portraits-only; omit |
| `revealLabel` → registry `byId` | per-product registry |
| `FOYER_ASPECT = '2:3'` | **conflicts** — plates are 1:1 (Pets/Halloween) or 4:5 (Groups) |

Three further requirements:

1. **The intake axis is wrong.** `/api/v1/foyer/intake` returns
   `'man' | 'woman' | null`. Pets needs species; Groups needs a count. **But
   `lib/shared/subject-redirect.ts` already exists** and classifies
   `person_single · person_group · pet_animal · house_building · landscape_place`,
   with `bestSeriesFor()` mapping each to a series and `SERIES_ACCEPTS` declaring
   what each series takes. It is wired into Portraits' gate today. This is the
   piece a multi-product — or routing — foyer needs, already written.
2. **The handoff carries no series.** `foyer-handoff.js` stores
   `{subject, gender, ageGroup, type, bytes}`. One field plus a reader.
3. **Assets.** The Portraits foyer is 52 plates / ≈9.5 MB. Each product foyer
   needs its own deck; Halloween's product page already has a working flip deck
   to draw from.

---

## Classification

| Stage | Pets | Groups | Halloween |
|---|---|---|---|
| Discovery rooms / grid | REUSE UNCHANGED | REUSE UNCHANGED | REUSE UNCHANGED |
| Preview plate lookup | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP |
| Curated bench | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP |
| Review | REUSE UNCHANGED | REUSE UNCHANGED | REUSE UNCHANGED |
| Format (aspect) | SMALL ADAPTATION | **NEW PRODUCT LOGIC** | SMALL ADAPTATION |
| Stripe / pricing | REUSE UNCHANGED | **NEW PRODUCT LOGIC** | REUSE UNCHANGED |
| Collection | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP | CONFIG/CONTENT SWAP |
| Render pipeline | **NEW PRODUCT LOGIC** | **NEW PRODUCT LOGIC** | **NEW PRODUCT LOGIC** |
| Intake / detection | SMALL ADAPTATION | **NEW PRODUCT LOGIC** | SMALL ADAPTATION |
| Prompts | REUSE UNCHANGED | SMALL ADAPTATION | REUSE UNCHANGED |
| Foyer | NEW (assets) + SMALL (code) | NEW (assets) + SMALL (code) | NEW (assets) + SMALL (code) |

**The render pipeline is NEW for all three, and it is the same work three times** —
a per-series adapter behind `renderOnePortfolioItem`, because each product's route
takes a different body and returns a different envelope.

**Groups is the hardest**, and its three NEW stages are coupled: price depends on
a vision-derived person count, Format fights a proven source-derived aspect rule,
and that same count must reach the prompt builder. Groups is not "Portraits with
different art" — it is a different product shape.

**Halloween is the easiest.** Prompts reusable, plates uniform, no variants, no
pose, flat pricing — and it is the only one already half-wired into shared
machinery: `lib/store/basket-replace.ts:37` supports `'halloween'` via
`HALLOWEEN_MAIN_ORDER`, and throws for pets and groups as unwired.

---

## Open rulings and risks

Four items surfaced by this audit. All are pre-existing; none was introduced by
it, and none was changed.

1. **Halloween has no server-side age gate.** Verified: zero occurrences of
   `age_group`, `age_restricted`, `underage` or `under_18` in
   `app/api/v1/halloween/generate/route.ts` or
   `lib/v1/halloween/halloween-generator.ts`. Portraits has one at
   `app/api/v1/portraits/generate/route.ts:346`. The Halloween engine *calls*
   `detectFaceVisibility` — the function that returns age — and keeps only
   `face_visible` and `subject_count_estimate`. The refusal is browser-only, and
   the page's own comment anticipates the gap: *"The refusal has to exist in
   /portraits/generate as well or it stops only the people who were not trying."*
   Both Halloween rooms are permanently routed and permanently live.
2. **Pets and Halloween charge before validating the preset**
   (`credits/gate/route.ts:175`). `forest_guardian` is the live proof: chargeable,
   then 400.
3. **A non-Portraits portfolio can be paid for and will never render.**
   `VALID_SERIES` accepts four series; `portfolio-render.ts:47` accepts one.
4. **Groups' age rule is ruled but parked** pending legal review
   (`groups-shared.ts:117-135`) — and the per-face `age_class` data the rule needs
   already exists in `detectFaceVisibility` and is discarded.

---

## Sources

Read at HEAD `d5e0e94`. Primary files, by product:

| Product | Catalog / prompts | Registry | Route | Plates |
|---|---|---|---|---|
| Pets | `lib/v1/pets/pets-catalog-35.ts` | `public/pets-registry.js` | `app/api/v1/pets/generate` | `public/previews/pets/` |
| Pets Halloween | `lib/v1/halloween/pets-halloween-catalog.ts` | `public/pets-halloween-registry.js` | `app/api/v1/halloween/generate` | `public/previews/halloween-pets/` |
| Halloween | `lib/v1/halloween/halloween-catalog.ts` | `public/halloween-registry.js` | `app/api/v1/halloween/generate` | `public/previews/halloween/` |
| Groups | `lib/v1/groups/groups-effects.ts` | `public/groups-registry.js` | `app/api/v1/groups/generate` | `public/previews/groups/` |

Shared: `lib/store/portfolio-render.ts` · `lib/store/portfolio-checkout.ts` ·
`app/api/v1/credits/gate/route.ts` · `lib/shared/subject-redirect.ts` ·
`lib/v1/shared/render-aspect.ts` · `lib/v1/foyer/*` ·
`public/discovery-consolidated-draft.html`.

This document is an inventory and goes stale the moment one of those moves.
