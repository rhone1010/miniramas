# PORTRAITS — SOURCE OF TRUTH

**v1 · 2026-07-27 · CUI V22**

This is the single reference for the Portraits surface through the August 9
release. It supersedes scattered decisions in chat and consolidates the
2026-07-27 spec session.

**It does not supersede** `docs/GOVERNANCE/PROCEDURES-AND-LANES-2026-07-27.md`
or `LOCKED-DECISIONS-2026-07-27.md`. Those govern. Where this document conflicts
with them, §10 lists the conflict and the correction required.

Everything in §1–§8 marked **RULED** was decided by Rich. Everything marked
**OPEN** is not decided and must not be built on. Nothing here is stated as fact
about the repo unless it was read from live source on 2026-07-27.

---

## 1 · THE THREE FILES — what each one is

### `public/portraits-b2.html` — the working base
8,876 lines · 152 unique ids · 10 route calls · 226 functions · no duplicate ids.

**What it is:** the only file that completes a craft end to end. Upload →
analyze → curate → credits gate → NB2 → likeness → My Collection → download.
Descends from `portraits_recover2.html` via b1.

**What it is not:** current design, current taxonomy, or a source of truth about
the engine. Its markup is superseded. Its *effect list* is stale — do not read
effect ids out of it.

**Rule:** b2 is functionality. It gets us from here to there.

### `litenco-portraits-2026-07-24-r81.html` — the approved skin
1,895 lines · 74 ids · 0 route calls · 70 functions.

**What it is:** the approved visual design and the most recent effect list of
the two files. A **specification** — this is the layout, these are the tokens,
here are the hooks.

**What it is not:** a file to wire, and not the newest taxonomy. Its 24 effects
in 3 groups are superseded by §3.

**Rule:** r81 is the skin. It is modified, not shipped as-is.

### Rich's typed taxonomy, this session — the current catalogue
36 effects across 6 silos. Newer than r81. See §3.

**Rule:** the taxonomy is Rich's, the skin is r81, the plumbing is b2.

### Dead — do not resurrect
`public/portraits.html` (2,118-line replacement) · `portraits.next.html` ·
the 9,872-line uncommitted file. All archived.

---

## 2 · THE FLOW — RULED

```
sign in → upload → Curator reacts → choose silo → choose effects
   → To Be Crafted → craft → paywall → render → My Collection
        → download  |  send to Print Shop
```

**1 · Sign in.** Guest is removed. Sign-in precedes crafting. Neither b2 nor
r81 has one; `docs/SURFACES/entry-gate/litenco-entrygate-2026-07-24-r1.html` is
the design and it is unbuilt. First login lands on Account.

**2 · Empty state.** Curator asks for a photo. This is its whole job at this
point.

**3 · Curator reacts to *that* photo.** Either a specific compliment — the
light on the hair, the expression — or a specific rejection with a clear ask:
too blurry, face too small, upload something clearer. This is a live per-photo
response, not a canned string. **The route does not exist. CENG owns the voice.**

**4 · Silo choice.** *"What kind of effect are you thinking about today?"*
Six silos. Presented as pills carrying Rich's artwork, not plain pills — the
art is Rich's to make, the pill component is CUI's.

**5 · Effect choice.** Drill into a silo, see its effects, **maximum five shown
at a time**. The silo strip stays on screen as a persistent tab row — switching
silos is one click. **There is no back button because nothing is ever behind
them.** The queue is global and survives every silo switch.

**6 · Cycle effects** activates only at this level. Inert above it.

**7 · Selection.** Image tile with a `+` badge; becomes `✓` on add. One
component everywhere.

**8 · To Be Crafted.** Vertical right rail. Price updates live as items are
added, applying the volume arc.

**9 · Craft → paywall.** Paywall only. Nothing else on that screen.

**10 · Auto-naming happens in the background.** The user cannot name or rename.
The assigned ID is the system-wide handle — used locally, stored in Supabase,
and spoken in concierge chat so every party is talking about the same render.

**11 · My Collection.** On completion the user lands here.

---

## 3 · THE CATALOGUE — RULED

**36 effects · 6 silos.** Rich's list, this session. Supersedes r81's 24/3 and
supersedes the "keep three groups, silos shelved" ruling in `LOCKED-DECISIONS`.

| Silo | Count | Effects |
|---|---|---|
| **Earth & Ore** | 7 | Bronze · Iron · Stone · Alabaster · Pewter · Ebony · Walnut |
| **The Artists Gallery** | 8 | Impressionist · Torn Paper · Folded Book · Charcoal & Chalk · Pencil Sketch · Sheet Music · Stained Glass · Driftwood & Resin |
| **Light & Glass** | 7 | Cast Glass · Blown Glass · Amber · Frost & Ice · Liquid Mercury · Enchanted Crystal · Volumetric Light |
| **Myth & Legend** | 6 | Dragon Skin · Fire & Ember · Magic Energy · Living Armor · Living Reef · Reclaimed Bronze |
| **Far & Future** | 5 | Silicon Circuit · Atomic Age Robot · Cosmic Bloom · Nebula Resin · Neon Drawing |
| **Curiosities** | 3 | Plushy · Chocolate · Elizabethan Portrait |

**Curiosities is deliberately thin.** It is the landing zone for new work, not a
leftovers bin. The old 12-effect Curiosities group is dissolved and
redistributed into Light & Glass, Myth & Legend and Far & Future.

**Rulings on the catalogue**
- **Deep Sea is cut.** Present in r81, in no silo, gone.
- **Fantasy Crystal is renamed Enchanted Crystal.** One effect, not two.
- **The list will grow.** Rich is making new effects now.

**Therefore the catalogue ships as a data table, never as markup.** One array of
`{silo, id, label, art}` drives the silo pills, the effect grid, the Advanced
rail, and the My Collection filter. Adding an effect is a one-line data edit and
an art file dropped in a folder keyed by silo. No rebuild.

**Not verified:** which of the 36 have working engine prompts. Fourteen
experimental effects were returning HTTP 400 as of the 2026-07-27 governance
doc. Four presets need `MATERIAL_REGISTER` — pewter, chocolate, stained_glass,
driftwood_resin — CENG with Rich. **Must be checked against the live engine
before build 3, not against b2's HTML.**

---

## 4 · ADVANCED — RULED

- **Remains**, but ships **closed by default**. It is the power-user escape
  hatch, not the path.
- User can open it; that state persists. Default is closed.
- Carries the full effect set.
- **Needs overhaul** for the silo structure. **OPEN:** flat full list, or
  grouped by the six silos?

---

## 5 · CREDITS AND PRICING

**RULED**
- Credits are the currency. Dollars appear only when buying credits.
- Ladder: $4.99 base · −10% at 2 · −15% at 3 · −20% at 4 · −25% at 5 · then −1%
  per image to −30% at 10. `4.99 × images × (1 − pct)`.
- Tiers: **THE SERIES** (1–9) · **THE STUDIO** (10). Credits do not expire.
- Quality tiers are dead. Web / Print / Collector must not reach Stripe or a
  receipt. Resolution is resolved later by upscaling in Print Shop and My
  Collection.
- Credits are sold in blocks with a discount arc mirroring the dollar ladder.
- **The currency must be divisible** — re-renders, credit-back, and other
  part-of-an-image remedies depend on it.

**OPEN — blocking**
- **Credits per image: 10 or 5.** `LOCKED-DECISIONS` and the tester grant run
  on 10 (500 credits = 50 images). Rich said 5 this session. CUI's position:
  **10**, because a partial remedy cannot be expressed cleanly in fifths and 10
  leaves headroom to price a Group above a Wallpaper without fractions. Rich
  rules; whichever loses gets corrected in place.
- Block sizes. Proposed 10/20/30/50 credits at 10-per-image. Reaching THE
  STUDIO needs a 100 block.
- Recraft cost — full price, or free once?
- Is the paywall one transaction for the whole queue, or one per effect? Drives
  the four-succeed-one-fails story.
- Insufficient credits at the paywall — buy inline and continue, or bounce to
  Account?

---

## 6 · MY COLLECTION — RULED

**Its own surface**, contained within r81. Slides over the workshop.

- Curator and Advanced rails are **closed** when it opens. User can open them;
  state persists. Default is closed.
- Shows every successfully rendered piece.
- **Filter tabs:** View All · Portraits · Pets · Groups · Action · Mobile
  Wallpapers. r81 line 1410 is correct; lines 953–959 carry a stale seven
  including Houses and Landscapes and must be corrected. Filter is client-side
  over loaded pieces at launch volumes.
- **Actions:** Download · Send to Print Shop.
- **Multi-select** supported for both actions.
- **Print Shop launches from here.**

---

## 7 · FAILURE AND REJECTION

### 7.1 Pre-craft — exists
r81 carries eight intake states behind `window.__openIntake(1..8)`:
Interrupted · Photograph · At capacity·orphan · Refunded · Face small ·
Blur·BLOCK · Dim · Can't use.

All eight are pre-craft. b2 drives equivalents through `friendlyReject`,
`curatorEnterQualityFail` and `gotoSeries`. The `gotoSeries` map is stale.

### 7.2 Post-render — does not exist in any file
This is the gap. Nothing handles *"it came back and I don't like it."*

**Requirement (RULED):** a user must not be able to self-serve a refund on a
piece that passed our own quality gate without going through the concierge
first.

**Proposed mechanism — OPEN, awaiting ruling:** the gate scores every piece the
moment it renders, checking likeness against source and render quality, and
stores the score on the record. The control the user sees is then already
decided:

- **Below threshold** — we caught it first. The piece arrives pre-flagged with
  a free recraft offered. No complaint, no concierge, no argument.
- **At or above threshold** — no reject control exists. The action is
  *Talk to the concierge*, opening chat with the piece ID and score already in
  context.

The AI adjudicates before the human sees a choice.

**OPEN:** the likeness threshold. No number exists in either file — b2 mentions
90%+ as an observation, not a gate. **CUI proposes 85%.** Renders have been
landing well above; the requirement is that the number is consistent, not that
it is high.

**Also open:** the three remedies — Recraft, Credit, Refund — need their
triggers and costs defined against this gate.

---

## 8 · PIECE ID — OPEN

Auto-assigned at craft, immutable, system-wide. Used locally, in Supabase, and
in concierge chat.

Needs a format that is stable, sortable, and speakable aloud.
**CUI proposes `Portraits-Walnut-0247`** — Series, effect, sequence.

---

## 9 · THE PORT — how b2 becomes the product

Full detail in `PORTRAITS-ID-MAP-2026-07-27.md`.

**The governing fact: b2 and r81 share two ids** — `curatorDeckle` and
`lightbox`. There is no name-level correspondence to port along.

**Consequence:** the mapping is by function, not by id. r81's ids become the DOM
contract; b2's 226 functions are retained and re-pointed. b2 does not finish
with 152 ids. It finishes with r81's markup and b2's behaviour.

**This deviates from the literal base-file law** (`PROCEDURES` §3) and needs
Rich's explicit yes before build 1. The law's purpose — a working file is
modified, never replaced — is served by protecting the *functions and route
calls*, which is where behaviour lives. Id strings are not behaviour.

**All ten route calls survive**, read live 2026-07-27:
`/portraits/gate` · `/qa/settings` ×2 · `/portraits/analyze` · `/checkout` ·
`/portraits/curate-effects` · `/credits/gate` · `/portraits/raw-pipeline` ·
`/portraits/generate` ×2.

`/api/v1/checkout` comes off the craft path and stays wired for buying credits.

**Build sequence:** silo data table → r81 shell → Curator step machine → silo
tier and grid → To Be Crafted in credits → pay stage to credits gate → My
Collection slide-over → intake modal → post-render gate. Each is one gated
Python script. Nothing starts until §9's ruling and the §4 cut list are settled.

---

## 10 · CONFLICTS WITH THE GOVERNANCE DOCUMENTS

Per `PROCEDURES` §9, a finding that contradicts an accepted document corrects
that document in place. These corrections are **pending Rich's approval**, not
applied.

| Governed statement | This session |
|---|---|
| `LOCKED-DECISIONS` — "keep the three groups that exist; five- and seven-silo proposals are shelved" | **Six silos, 36 effects.** Reinstated. |
| `LOCKED-DECISIONS` — "two-tier Curator deferred" | **Reinstated** as the primary path — Curator drives silo then effect. |
| `LOCKED-DECISIONS` — "a Crafted Image costs 10 credits" | Rich said 5 this session. **Unresolved**, §5. |
| `LOCKED-DECISIONS` — "My Collection lives inside Account" (via Philosophy v2) | **Its own surface**, slides over the workshop. |

Also carried from the governance docs and still true: quality tiers dead ·
guest removed · Aug 9 single release · Curiosities seam to be wired · testers
cannot order Prodigi printing · Style Refs supersede influence images.

---

## 11 · OPEN RULINGS — the whole list

Blocking build 1:
1. §9 — adopt r81's ids as the DOM contract, retaining b2's functions?
2. The cut list — `ID-MAP` §4, each line keep or lose.

Blocking anything with a price:
3. Credits per image — 10 or 5.
4. Route and SQL ownership. CC is test-only; the credits gate fix is
   `route.ts` plus a migration, and neither is the glass. Asked 2026-07-27,
   unanswered.

Blocking the remedy surface:
5. Likeness threshold — 85%?
6. Post-render gate mechanism — §7.2 as proposed?
7. Recraft cost.

Blocking later builds:
8. Piece ID format.
9. Advanced when open — flat or grouped?
10. Paywall — one transaction or one per effect?
11. Insufficient credits — inline purchase or bounce to Account?
12. Credit block sizes.

---

## 12 · NOT CUI'S, STILL ON THE CRITICAL PATH

- **Sign-in build** — the flow starts with it and it does not exist.
- **Curator reaction route** — new, does not exist. CENG owns the voice.
- **Engine prompts for the 15 new effects** — CENG.
- **Effect art for six silo pills** — Rich.
- **Preview coverage** for the new presets and Curiosities — Rich.
- **Prodigi live key and the per-account fulfilment flag** — without it a
  tester places a real billable print order.
- **`MATERIAL_REGISTER`** for pewter, chocolate, stained_glass,
  driftwood_resin — CENG with Rich.

---

**Thirteen days to August 9.**
