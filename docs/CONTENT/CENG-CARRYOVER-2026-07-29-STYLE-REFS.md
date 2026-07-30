# CENG Carryover — Style-Ref System & Effect Taxonomy
**Date:** 2026-07-29 · **Lane:** CENG (prompt engineering) · **Series:** Portraits

---

## 0. WHAT THIS SESSION PRODUCED

1. A **style-reference system** — additional source images sent to NB2 alongside the
   customer photo, per effect. Validated in production; materially improves output.
2. A **reusable ref-generation prompt template** plus nine hard-won failure/fix pairs.
3. **13 effect ref plates** generated and approved (12 confirmed, sheet_music pending).
4. A **56-effect / 8-silo taxonomy** replacing the flat effect list.
5. **Six schema fields** required to support the above.
6. A **critical engine-state finding** — `public/portraits.html` was replaced, not split.

---

## 1. ENGINE STATE — READ THIS FIRST

**This is the highest-priority item in this document.** It is not a prompt matter but it
blocks everything else.

### The finding

`public/portraits.html` was ticketed to CC as a CSS/JS extraction. It is not one.

| File | Lines | Functions | fetch() |
|---|---|---|---|
| `portraits.html` @ HEAD (canonical engine) | 9,872 | 250 | 13 |
| `portraits.html` working tree (today) | 2,118 | 85 | 12 |
| `portraits.ui.js` (untracked) | 139 | 8 | 0 |
| `portraits.wizard.js` (untracked) | 681 | 66 | 0 |
| `portraits.css` (untracked) | 514 | 0 | 0 |
| **working-tree total** | **3,452** | **159** | **12** |
| `portraits.next.html` (untracked, 7/25) | 10,065 | **241** | **15** |

~250 functions were replaced with ~80 new ones sourced from the r80d wizard reference.
Diff of function names showed near-total non-overlap. The new names (`craftBatch`,
`dealSuggestions`, `runIntake`, `openNaming`, `enterCrop`, `refreshCredits`,
`refundCredits`, `doRedeem`) are the wizard flow plus the credits system.

### Direction (settled)

`portraits.next.html` is the **engine mid-flight** — 241 functions, 15 fetches, no credits
code. It is the merge base.

**Credits + wizard port ONTO `.next`.** Not the reverse. Porting 241 functions onto an
85-function wizard repeats the same mistake in the opposite direction.

### Do NOT restore

`git checkout HEAD -- public/portraits.html` would recover the 250 functions and destroy
the uncommitted credits work. Both bodies of work are real and divergent. This is a merge.

### Route fetch parity (live vs .next)

```
analyze              live:1  next:1
curate-effects       live:1  next:1
curate-upper-body    live:0  next:1
gate                 live:1  next:2
generate             live:1  next:1
pieces               live:1  next:2
raw-gpt-image        live:0  next:0
raw-pipeline         live:0  next:1
unlock               live:0  next:0
```

`.next` is a strict superset. `raw-gpt-image` is API-only by design (keep). `unlock` is
referenced only in a comment in `lib/store/preview.ts` re: preview re-delivery — Aug 15
commerce, keep.

### CC ticket (narrow)

> Base: `public/portraits.html` (promoted from `portraits.next.html` — 10,065 lines,
> 241 functions, 15 fetches).
> Reference: the wizard file (2,118 lines, 85 functions) + `portraits.wizard.js`,
> `portraits.ui.js`, `portraits.css`.
> Port ONTO the base, additively: credits gate (`refreshCredits`, `refundCredits`,
> `doRedeem`), intake (`runIntake`), naming (`openNaming`, `composeName`, `aiName`),
> crop (`enterCrop`).
> Do NOT remove or rename any existing function.
> Report function count and fetch count before and after. Both must be ≥241 and ≥15.

### New standing rule for CLAUDE.md

**Any engine-file work reports function count and fetch count before and after. Counts
must not decrease. A decrease is stop-and-report, not proceed.**

Line-count-matching alone did not catch this — a 2,118-line file with 514 lines of CSS
extracted looks plausible until you count functions. Add the count check to Definition of
Done alongside `node scripts/boot-test.js`.

### Confirmed dead TS files (delete)

- `lib/v1/portraits/portraits-presets.ts` — `buildPresetPrompt`, self-referencing only.
  Other Series have their own live copies; unaffected.
- `lib/v1/portraits/portraits-shared-helpers.ts` — `assemblePrompt`, used in Action and
  Groups, never in Portraits.

**Keep:** `portraits-gpt-image.ts` (generator :189 + raw route), `portraits-pass2.ts`
(generator :224 — disabled by config but wired), `portraits-effect-curator.ts` (live),
`portraits-experimental.ts` (live in generate route :33/:156/:163 — the project-knowledge
copy is stale and lacks the experimental branch).

---

## 2. THE STYLE-REF SYSTEM

### Concept

Per effect, 2–3 curated reference images are appended to NB2's `image_input` array after
the customer's source photo. NB2 reads them as visual anchors for material behavior,
lighting, and construction — things text describes poorly.

### Validated finding: refs outrank text

Confirmed repeatedly. At three total inputs, a reference image overrides universal prompt
blocks:

- `haunted` refs had talons → render produced hands despite "no hands at all" in
  `STUDIO_DIRECTIVES`
- a bronze ref had a plaque → render reproduced "Liten & Co · 2025" with no plaque
  instruction in play
- `retro_robot` refs had garbled signage → text ban is unlikely to hold

**Consequence:** anything visible in a ref frame is a candidate for reproduction.

### Ref rules (hard)

1. **No plaques, no text, no legible signage** anywhere in frame.
2. **No distinctive base or ornament** — low plain dark stone block only.
3. **Fully clothed, collar closed, no bare shoulders** — bare-chest drift teaches undressing.
4. **Bust framing, chest-up**, consistent crop.
5. **Nothing in the background you don't want inherited.**
6. A ref plate shows **material behavior and lighting, and nothing else.**

### Refs double as previews

Decided: **the style refs become the preview images.** One shoot, one review pass.
~112 images instead of ~336.

Ref rules govern both (stricter set wins). Slight cost: previews get less staging drama.

**Open mechanical decision:** `public/style-refs/portraits/<id>/1.jpg` and
`public/previews/portraits/<id>/1.jpg` are separate trees. Recommend **collapsing to one
tree** — halves repo weight and removes a sync burden.

### Folder convention

```
public/style-refs/portraits/<effect_id>/
  1.jpg        ← neutral anchor, always loads
  2.jpg        ← second neutral plate
  2_man.jpg    ← gendered plate (costume silos only)
  2_woman.jpg
  2_neutral.jpg ← fallback when gender confidence is low
```

`<effect_id>` must be **snake_case, matching the engine id exactly.** A hyphen means zero
refs load, silently. (`fire-face` → `fire_face`.)

Loader reads the folder rather than a hardcoded count, so dropping a new ref in requires no
code change.

### Ref budget

- **Cap at 2–3 refs.** Source photo occupies slot 1; `MAX_SOURCE_IMAGES` is 8.
- Every added ref dilutes identity signal from the customer's face. Small-face drift is the
  #1 quality driver per bench data.
- Order: **source first, refs last.** NB2 weights early inputs for identity.
- Runtime cost is zero — Replicate bills per output, not per input.

### Gender selection

**Decision: gendered refs only where the costume differs** — `another_age` and `handmade`.
Neutral for the five material silos. A doublet and a gown are different garments; bronze
behaves identically on anyone.

**Superseding note (late session):** with a deliberately diverse ref set across race, age,
and gender, `refSelector: 'gender'` may be unnecessary entirely. Diverse neutral plates
mean no customer sees a grid that excludes them, and it removes the misgendering failure
surface. **Revisit before building the selector.**

### Provenance

Original refs began as sourced images, heavily modified — the ambiguous middle. Resolved
by generating replacements through the raw pipeline. All plates in §4 are own-generated.

Self-improving loop: each ref generation raises the floor for the next. **Caveat:** refs
generated from refs converge toward a house look over successive cycles. Mostly desirable
(it *is* the Liten visual identity) but Series will start resembling each other unless
deliberately re-diversified every few cycles.

### Repo weight

~112 refs ≈ 40–80MB. **Git history is permanent** — binaries never leave it, and the only
fix is a history rewrite. Decide **Git LFS or Supabase Storage before `git add`**, not
after. The trigger to watch is *replacement*: swapping the full library twice triples
weight with no recoverable space.

`public/style-refs/` is currently untracked. This is the moment.

---

## 3. REF-GENERATION PROMPT TEMPLATE

Assembled from a full session of iteration. Slot the material paragraph in; the rest is
constant.

```
[MATERIAL TRANSFORMATION — verbatim from engine, or newly authored]

[AVOID CLAUSES — verbatim from engine, plus the skin ban below]

No human skin anywhere — the face, neck, forehead and ears are all
[MATERIAL], not skin. The [MATERIAL] continues across the entire face.
This is the most common failure.

[TAIL / STAGING — background, lighting]

Facing the camera directly, warm natural smile, eyes to the viewer.
Camera at eye level.
Head, shoulders and upper chest fill the frame with a little breathing
room, face roughly 30% of the image.
Fully clothed in source garment, collar closed, no bare shoulders.
Ending at the chest. Low plain dark stone plinth.
No letters, no plaque.
```

### Nine failure/fix pairs (all observed this session)

| # | Failure | Cause | Fix |
|---|---|---|---|
| 1 | Photoreal skin face on transformed body | NB2 portrait prior | Explicit skin ban naming face/neck/forehead/ears + "most common failure" |
| 2 | Bare chest / bare shoulders | Classical bust convention; worse on translucent materials | `fully clothed in source garment, collar closed, no bare shoulders` |
| 3 | Orange/amber artifacts on nose, lips, ears | SSS clause escalating to emissive | Drop SSS entirely for stone; for jade bound it: *pale and stone-toned, the ears do not light up* |
| 4 | Internal glow / lamp inside the piece | "slight internal lighting" | *Light originates outside the piece; the material transmits it, never emits* |
| 5 | Grain/veining/burl crossing the face as blotches | Material character applied uniformly | *Face carved from the cleanest, most uniform grain — no burl or figuring crossing eyes, nose, mouth. Confine to garment and shoulders* |
| 6 | Flat frontal, symmetrical, no key | Camera/light unspecified | Name it numerically: *head turned 30 degrees, camera slightly below eye level, hard directional key from upper left, deep shadow right, strong falloff* |
| 7 | Dark material lost against dark background | No silhouette separation | Light background for dark materials (`bright white gallery wall`); dark for light materials |
| 8 | Face too dark to read | Key without fill | *Soft fill from front-right at half the key's intensity — brow, cheekbones, nose and jaw all clearly readable* |
| 9 | Rim light rendered as a visible ring lamp prop | Source in frame | *Rim light on hair and shoulder edges from behind, light source out of frame* |

### Plinth decision

**Plinth for `material` effects. None for `costume` effects.**

- A material effect is an *object* — objects sit on something, and the plinth makes the
  fiction legible. Without one, a chest-cut figure reads as a floating fragment (and NB2
  fills downward with a nude classical torso — see failure #2).
- A costume effect is a *portrait* — a plinth turns it into a trophy.
- The plaque needs a surface. `plaque_text` / `DEFAULT_PLAQUE_TEXT` exist and the plaque
  line is appended to every material prompt.
- Contrast sells the material: a neutral dark base gives the eye a reference for
  translucency.
- **Low and plain.** Ornate plinths compete for attention.

Note: `ARTISTS_BLOCKS.impressionist` specifies a **round** plinth. Decide whether plinth
shape is per-effect or standardized.

### Background library (validated)

| Background | Best for |
|---|---|
| Deep-shadow black studio, subtle gradient, no props | Safest for refs — nothing to inherit; highest material contrast |
| Bright white gallery wall, softly lit | Dark materials (ebony, iron) — silhouette separation |
| Brutalist concrete, one high window, hard shadow | Stone, quartzite — reads architectural and expensive |
| Conservatory at dusk — cast-iron ribs, rain on glass, cool green light | Warm stone; strong complementary contrast |
| Dim panelled room, marble mantel, firelight below-left | Bronze, warm metals — reads *owned* rather than exhibited |
| Artist's studio, skylight, works-in-progress | Artists Gallery — match the medium to the works on the walls |
| Grand two-storey library, spiral stair, mezzanine | folded_book |
| Empty symphony hall, stands and instruments | sheet_music |
| Coastal woodworker's studio / dune path to beach | driftwood_resin |

Museum-gallery-with-pedestal became visually stale across a long batch. Rotate.

**Watch:** background works-in-progress reproducing the subject's own face (happened three
times in charcoal). Add *the surrounding works are of different unrelated subjects.*
**Watch:** legible spines/titles/canvas signatures. Add *no legible text or titles.*

### Subject consistency

Ref subjects **should** span race, age, and gender deliberately — an inclusive grid means
no customer sees a set that excludes them, and it removes the need to match users at all.

Counter-consideration: holding 2–3 recurring subjects across all 56 makes the *material*
the only variable and reads as a catalog rather than a scrapbook. **Unresolved tension.**
Current plates use ~6 different subjects.

If refs skew young, spot-check one senior source through three effects — NB2 may pull older
subjects younger, fighting the age lock. (Tested: driftwood held a 70s subject's age
faithfully. Age lock works.)

---

## 4. APPROVED REF PLATES (13)

Every prompt below produced an approved `1.jpg`. Material paragraphs marked **[ENGINE]**
are verbatim from `lib/v1/portraits/portraits-prompt.ts`.

### 4.1 Earth & Ore — 7/7 COMPLETE

**bronze** — clothed, hands clean, gallery interior. Verdigris in recesses, polish on
raised features. Source-garment watch survived as bronze detail (strong likeness signal).

**iron** — plain plinth, no plaque, distinct from bronze. *First attempt carried a
"Liten & Co · 2025" plaque inherited from a ref — rejected, re-run clean.*

**alabaster** — jacket over knit, museum gallery. Translucent depth correct.
*Note: "only illuminate the thinnest parts" caused orange nose/ear artifacts — removed.*

**stone → relabeled QUARTZITE**

> make the subject into a realistic carved Taj Mahal quartzite bust — warm ivory-to-honey
> stone with soft translucent depth and fine gold-brown veining. Subtle subsurface
> scattering: light diffuses just beneath the polished surface, warming the thinnest
> sections softly. The scattering stays pale and stone-toned — never orange, never a bright
> glow, and the ears do not light up. Head turned 30 degrees to the left, camera slightly
> below eye level. Hard directional key light from the upper left with deep shadow across
> the right half of the face and strong falloff. Professional magazine-cover photography.
> No letters, no plaque. Background is a conservatory at dusk — cast-iron ribs, rain on
> glass, cool green light, heavily blurred. Fully clothed in source garment, collar closed,
> no bare shoulders. Low plain dark stone plinth. The face is carved in the cleanest part
> of the matrix — smooth, evenly toned, no veining crossing the eyes, nose or mouth.
> Concentrate veining in the garment and shoulders. The entire sculpture is quartzite — no
> other materials, no real skin, hair or nails.

*Limestone tested first and dropped — boring. Keep id `stone`; renaming touches
`PortraitsPresetId`, `PRESET_LABELS`, `STYLE_MATERIALS`, Pass 2. **Label only** → Quartzite.*
**Pass 2 debt:** `PASS2_MATERIAL_REFINEMENT_BY_PRESET.stone` still says rough-chiseled with
visible tool marks and variegated color bands. Contradicts polished quartzite. Inert today
(Pass 2 off for stone) — rewrite before ever enabling.

**ebony**

> make the subject into a realistic carved ebony bust — deep near-black hardwood with
> visible grain flow and dramatic dark-on-dark figuring. The face is carved from the
> cleanest, most uniform grain — completely free of burl, whorls, knots and swirl patterns.
> No figuring anywhere on the face or neck. All burl and figuring is confined to the
> garment and shoulders. Polished on the face and raised features, rougher hand-tooled
> character at the shoulders. Head turned 30 degrees to the left, camera slightly below eye
> level. Soft fill light from the front-right at half the key's intensity, lifting the face
> out of shadow — the brow, cheekbones, nose and jaw all clearly readable. Bright rim light
> on the hair and shoulder edges from behind, source out of frame. Professional
> magazine-cover photography. No letters, no plaque. Background is a bright white gallery
> wall, softly lit, gently blurred, no props. Fully clothed in source garment, collar
> closed, no bare shoulders. Low plain dark stone plinth. The entire sculpture is ebony —
> no other materials, no real skin, hair or nails. No paint, no subsurface scattering.

*Three iterations: burl on face → clean-grain clause; dark bg → white wall; too dark →
fill light.*

**walnut**

> make the subject into a realistic carved walnut bust — honey-brown hardwood with dramatic
> contrast between dark chocolate grain lines and pale amber sapwood, clearly lighter and
> warmer than ebony. Visible grain flow, polished on the face and raised features, rougher
> hand-tooled character at the shoulders. The face is carved in the cleanest, most uniform
> grain — no burl or figuring crossing the eyes, nose or mouth; concentrate burls and
> whorls in the garment and shoulders. Head turned 30 degrees to the left, camera slightly
> below eye level. Bright rim light on the hair and shoulder edges from behind, light source
> out of frame, face in soft warm fill. Professional magazine-cover photography. No letters,
> no plaque. Background is a dim room, gently blurred, no props. Fully clothed in source
> garment, collar closed, no bare shoulders. Low plain dark stone plinth. The entire
> sculpture is walnut — no other materials, no real skin, hair or nails. No paint, no
> subsurface scattering.

*The "clearly lighter and warmer than ebony" clause is load-bearing — without it walnut and
ebony are indistinguishable at thumbnail size.*

**jade** — NEW EFFECT (replaces `pewter`, which is out)

> make the subject into a realistic carved jade statue, dramatic lighting, sub-surface
> scattering, highly polished. professional grade photography for a magazine cover. No
> letters, no plaque. The background should be a japanese temple in a cherry blossom park
> at night (slightly blurred). Buttoned or closed collar with no bare chest — jacket over a
> knit or shirt. Bust ending at the chest on a simple dark stone plinth. The entire
> sculpture should be jade — do not use other materials or real skin, hair and nails. The
> eyes are carved jade like the rest of the piece, holding the subject's own eye shape and
> gaze — never photoreal, amber, or glass eyes. Light transmits through the thinnest
> sections; the light originates outside the piece and the jade transmits it, never emits.
> Do not over illuminate facial features internally. Polished but not glassy — a soft waxy
> lustre.

Four iterations: bare chest → garment layering; emissive amber core → transmission-only;
photoreal amber eyes on the male plate → eyes-in-material clause.
Schema: **`monolithic: true`** (one substance, one hue family → takes `HUE_LOCK`; that's
what stops the source garment colour returning as tinted jade). Gold veining survives
`HUE_LOCK` as mineral variation, not foreign hue — but bound it (*fine gold veining at
edges and hair strands*) or NB2 reinvents the quantity each render.
The approved plate came back **matte/waxy nephrite rather than polished jadeite** — reads
more expensive and keeps freckles and knit texture legible instead of losing them to
speculars. Name it.

### 4.2 The Artists Gallery — 5/7 (sheet_music pending, pencil_sketch outstanding)

**impressionist** **[ENGINE]** — APPROVED

> Transform the entire figure into an impressionist paint sculpture rendered in thick
> impasto strokes carrying real visible texture and dimensional thickness. The complete
> sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is built from
> layered impasto paint applied with sculptural mass. Maintain strong impasto across
> clothing and shoulders, not just face. Each brushstroke has physical depth. Thick visible
> paint covers the head, hair, neck, shoulders, garment, chest, and arms equally. The paint
> also runs down onto a round plinth the sculpture sits on. Use tones natural to this
> person's complexion and clothing throughout.
>
> Avoid smooth painted surfaces, flat color application, photo-realistic finishing, 2D
> painted treatment, or thin paint layers. The paint must carry physical mass and
> dimensional depth.
>
> Sculpture on a base in an artist's studio, center focused. A high skylight casts luminous
> volumetric light down and around the sculpture. Half-finished paintings on easels and
> leaning against the walls behind, paint-spattered floor, brushes in jars. Strong depth of
> field heavily blurring the background. Museum-quality craftsmanship. Fine-art collectible
> sculpture.
>
> Head turned 30 degrees to the left, camera slightly below eye level. Fully clothed in
> source garment, collar closed, no bare shoulders. No letters, no plaque.

Polychrome — **hue-lock exempt**, source colours carry through. Artists tails bake their own
staging, so `LOCATION` is a no-op for these presets; don't swap in the black studio.

**watercolour** — NEW EFFECT (replaces `torn_paper`, which is out — too similar to
folded_book and sheet_music). Fills the transparent-pigment gap; nothing else in the
catalog is translucent *pigment*.

> Transform the entire figure into a watercolour sculpture — translucent washes of pigment
> sculpted into dimensional form, built from layered transparent glazes with visible wet
> edges and hard-dried pooling lines where each wash stopped. Colour blooms and bleeds
> across the hair, shoulders and garment, with pale unpainted paper-white showing through in
> the highlights. The subject's own colours carry through as loose transparent washes.
> Deliberate drips and runs of colour trail down the form onto a round plinth, pooling at
> the base. The face is clearly defined and unmistakably this person, built from transparent
> washes, never opaque and never photographic. Delicate, luminous, and fluid.
>
> Avoid opaque or thick paint — every wash is transparent and light passes through it. Avoid
> flat even colour; wet edges, blooms and pooling lines are required. Avoid a flat 2D
> painting on paper — this is a dimensional sculpted object. Avoid muddy overmixed colour.
>
> Sculpture on a base in an artist's studio, high skylight, half-finished works behind,
> heavily blurred. Head turned 30 degrees to the left, camera slightly below eye level.
> Fully clothed in source garment, collar closed, no bare shoulders. Ending at the chest.
> No letters, no plaque.

*Approved first attempt. Note: dark drips on a maroon garment can read as blood — name the
palette if that matters.*
**Lock the spelling** — `watercolour` or `watercolor` — it's a code identifier.

**folded_book** **[ENGINE]** — APPROVED, best render of the session

> Transform the entire figure — face included — into a fine-art sculpture assembled from
> folded and layered book pages, emerging from an open book. Every surface is paper: the
> face, hair, neck, shoulders, chest, garment, and arms are all built from curled paper
> ribbons, folded pages, and layered printed sheets. The paper layers across the face follow
> the person's real facial structure — overlapping pages shape the planes of the forehead,
> brow, nose, cheeks, and lips so the likeness stays clearly recognizable, while the surface
> reads unmistakably as layered paper rather than skin. Hair is formed from paper ribbons
> that follow the source subject's actual hairstyle exactly — same length, direction,
> volume, and character; the paper interprets the real hair and never invents wild curls,
> paper spirals, or fantasy hair shapes. Broad sweeping ribbons define the major forms;
> individual printed pages stay visible throughout. The construction continues uninterrupted
> across the whole figure. The sculpture feels assembled from pages rather than carved into
> pages.
>
> Avoid a photo-realistic or smooth lifelike face — the face is built from layered paper
> like the rest of the figure, not left as skin. Avoid carved relief, engraved surfaces,
> stacked page-edge carving, paper-cut or woodcut techniques, and topographic page slicing.
> Avoid chaotic paper strips that destroy the likeness, and avoid generic wild paper curls or
> spirals replacing the real hairstyle — the paper must follow the person's true facial
> structure and real hair so they remain recognizable.
>
> Sculpture on a base in a grand two-storey private library — a wrought-iron spiral
> staircase rising to a mezzanine gallery, floor-to-ceiling shelves on both levels, a tall
> arched window, warm lamplight, dust in the air. Strong depth of field heavily blurring the
> background. Museum-quality craftsmanship. Extraordinary dimensionality. Elegant paper
> architecture. Fine-art collectible sculpture.
>
> Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level.
> Fully clothed in source garment, collar closed, no bare shoulders. Ending at the chest.
> No plaque. No legible text or titles on the surrounding books.

**Divergence noted:** engine tail includes *"Visible printed text"*. Dropped for the ref
plate (conflicts with no-letters, produces garbled type). **Keep it in the live engine** —
printed text is part of the effect's appeal. Ref and engine deliberately diverge here.
`monolithic: true` per engine comment (takes the hue lock).

**charcoal_chalk** **[ENGINE]** — APPROVED

> Transform the entire figure into a fine-art sculpture constructed from compressed
> charcoal, broken charcoal sticks, charcoal dust, and white Conté chalk. The complete
> sculpture—including head, hair, shoulders, chest, garment fabric, and arms—is physically
> built from charcoal materials with sculptural mass; the sculpture is not drawn. Material
> density must extend through sweater, shoulders, arms, and base fragments — equal carving
> complexity across every part of the figure. All planes—face, hair, shoulders, clothing
> folds, chest, and arms—are carved from dense charcoal masses with visible chisel marks,
> fractured edges, and layered charcoal fragments. White Conté chalk forms raised highlights
> and structural details across the entire figure, creating dimensional contrast against
> deep black charcoal surfaces. Floating charcoal dust, chalk powder, and broken fragments
> drift in the surrounding air as if the sculpture is still emerging from the material. Hair
> forms from sweeping charcoal ribbons, fractured charcoal splines, and layered charcoal
> shards.
>
> Avoid drawn charcoal portraits, 2D charcoal renderings, smooth surfaces, blended shading,
> or paper-as-substrate aesthetics. The charcoal must carry true sculptural depth and
> physical mass everywhere on the figure. Avoid losing the likeness in the fracturing — the
> person stays clearly recognizable.
>
> Sculpture on a base in a corner of an artist's studio, viewed from the side — a
> north-facing window to the left throwing cool overcast daylight across the piece, deep
> shadow to the right. Large charcoal and chalk drawings in progress pinned to the walls and
> leaning on easels, drawing boards, sticks of charcoal and Conté in trays, fixative bottles,
> smudged rags. Strong depth of field heavily blurring the background. Museum gallery
> lighting reveals the texture of compressed charcoal, chalk buildup, carved surfaces, and
> airborne particles. Fine-art contemporary sculpture. Dramatic craftsmanship. Highly
> dimensional, tactile, expressive.
>
> Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level.
> Tight close crop — the head and shoulders fill the frame, face occupying at least 40% of
> the image. Shallow depth of field. Fully clothed in source garment, collar closed, no bare
> shoulders. Ending at the chest. No plaque. No legible text on the surrounding works.

*Known residual: background drawings reproduced the subject's own face (×3). Fix if
re-running: `the surrounding drawings are of different unrelated subjects`. Airborne dust
can read as spatter — cut the floating-dust clause if it does.*
`monolithic: true` per engine comment.

**driftwood_resin** **[ENGINE]** — APPROVED. Engine text existed in full (not missing as
initially assumed).

> Transform the entire figure into a contemporary sculpture combining weathered driftwood
> and glossy colored epoxy resin — the live-edge resin-river aesthetic. The driftwood
> preserves the form and the likeness: the face and the structural planes of the head,
> shoulders, and major contours are carved from pale, silvery, weathered driftwood with
> visible grain, knots, cracks, and organic live edges, keeping the subject clearly
> recognizable. Flowing rivers and pools of translucent colored epoxy resin run through and
> between the wood — deep teal, ocean blue, amber, or emerald — filling the live-edge gaps,
> the cracks, and the negative spaces, catching and refracting light. The resin is where the
> color and translucency live; the wood is where the likeness lives. The whole piece is
> finished in a high-gloss polish so the resin reads as liquid-clear and the wood as
> satin-smooth.
>
> No human skin anywhere — the face, neck, forehead, ears and every visible surface are
> weathered driftwood, not skin. The wood grain, cracks and live edges continue across the
> entire face. This is the most common failure. Avoid an all-wood sculpture with no resin,
> or an all-resin sculpture with no wood — both materials must be present and distinct.
> Avoid a matte or unfinished surface; the glossy high-polish finish is required. Avoid resin
> that looks opaque or painted — it must read as translucent, light-catching epoxy. Avoid
> driftwood so abstract the face stops being recognizable; the wood carries the likeness.
>
> Sculpture on a base in a coastal woodworker's studio — a wide window onto grey sea and
> sky, live-edge slabs leaning against the walls, clamps and resin buckets, sawdust light.
> Strong depth of field heavily blurring the background. Contemporary gallery presentation.
> High-gloss finish catching the light. Translucent resin rivers. Weathered live-edge
> driftwood. Museum-quality craftsmanship. Highly tactile and dimensional. Fine-art
> mixed-media sculpture.
>
> Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level.
> Head, shoulders and upper chest fill the frame with a little breathing room, face roughly
> 30% of the image. Fully clothed in source garment, collar closed, no bare shoulders.
> Ending at the chest. No plaque.

*The explicit skin ban was required — two prior attempts produced skin-with-wood-texture.
Watch: resin crossing the face. If it drifts, add `no resin crossing the eyes, nose or
mouth`. Age lock verified on a 70s source.*
Polychrome — **hue-lock exempt** by design.

**sheet_music** **[ENGINE]** — PENDING APPROVAL (in flight at session end)

> Transform the entire figure into a museum-quality sculpture constructed from sheet music,
> musical notation, manuscript pages, and flowing musical scores. The complete
> sculpture—including head, hair, shoulders, chest, garment fabric, and arms—emerges from
> thousands of folded, curled, layered, and suspended pages. No conventional human surfaces
> remain anywhere on the form. Musical staffs sweep across the face, neck, shoulders, chest,
> garment, and arms like topographic contours. Notes, rests, clefs, and dynamic markings
> become structural elements that define the nose, lips, cheeks, hair, collar, shoulder line,
> and arm contours. Hair is formed from cascading ribbons of sheet music twisting through
> space like melodies frozen in motion. Portions of the sculpture appear to unravel into
> floating pages and drifting notes, creating a sense of music escaping the form.
>
> No human skin anywhere — the face, neck, forehead and ears are all built from layered
> notation pages, not skin. The staffs and notation continue across the entire face. This is
> the most common failure. Avoid flat printed surfaces, 2D sheet music collage, or pages
> without dimensional architecture. Avoid losing the likeness — the notation follows the
> person's true facial structure so they remain clearly recognizable.
>
> Sculpture on a base on the stage of an empty symphony hall — music stands and chairs in
> rows behind, a cello and timpani left where the players finished, tiered seating receding
> into darkness, a single shaft of stage light from above. Strong depth of field heavily
> blurring the background. Museum gallery lighting reveals paper texture, page edges, layered
> depth, and extraordinary craftsmanship. Fine-art paper sculpture. Highly dimensional,
> emotional, elegant.
>
> Facing the camera directly, warm natural smile, eyes to the viewer. Camera at eye level.
> Head, shoulders and upper chest fill the frame with a little breathing room, face roughly
> 30% of the image. Fully clothed in source garment, collar closed, no bare shoulders.
> Ending at the chest. No plaque.

Added a likeness clause the engine `avoid` lacks — notation across a face is a real drift
risk. **Notation stays legible here; that's the effect.** No no-text clause.
Polychrome — hue-lock exempt.

---

## 5. TAXONOMY — 8 SILOS × 7 EFFECTS = 56

Silos are the Curator's first choice; effects are the second. `*` = body/avoid not yet
written.

### `earth_ore` — Earth & Ore (7 — all built, all refs shot)
`bronze` Bronze · `iron` Iron · `stone` **Quartzite** · `alabaster` Alabaster ·
`jade` Carved Jade · `ebony` Ebony · `walnut` Walnut

*`pewter` OUT. `jade` in.*

### `artists_gallery` — The Artists Gallery (7)
`impressionist` Impressionist · `watercolour` Watercolour · `folded_book` Folded Book ·
`charcoal_chalk` Charcoal & Chalk · `sheet_music` Sheet Music ·
`driftwood_resin` Driftwood & Resin · `pencil_sketch` Pencil Sketch

*`torn_paper` OUT (too similar to folded_book / sheet_music). `watercolour` in.
`stained_glass` MOVED to Light & Glass — it is glass.
Standing concern: folded_book and sheet_music are both "portrait made of book pages."
They survive as a pair (structural folding vs printed notation) but a customer may not see
the difference.
`pencil_sketch` has `skipUniversal: true` — handles its own composition (side-angle
asymmetric emergence). Its ref prompt needs authoring accordingly.*

### `light_glass` — Light & Glass (7)
`cast_glass` Cast Glass · `blown_glass` Blown Glass · `stained_glass` Stained Glass ·
`amber` Amber · `ice` Frost & Ice · `mercury` Liquid Mercury ·
`fantasy_crystal` Enchanted Crystal · `dichroic_glass` Dichroic Glass*

**OVER BY ONE — needs Rich's call.** Open question: is `cast_glass` in or out? It was
authored this session with one render behind it, and `blown_glass` is its closest
neighbour. If `cast_glass` is out, `dichroic_glass` makes 7.
*`volume_light` MOVED to Far & Future — reads as energy, not material.*

### `myth_legend` — Myth & Legend (7)
`dragon_skin` Dragon Skin · `fire_face` Fire & Ember · `magic_energy` Magic Energy ·
`armor` Living Armor · `reclaimed_bronze` Reclaimed Bronze · `golden_idol`* · `runestone`*

*`coral` MOVED to Living World.
**Duplicate flag:** `reclaimed_bronze` vs `bronze` — now in different silos, which makes it
worse not better. Put them side by side; if they read the same, cut one.*

### `far_future` — Far & Future (7)
`retro_robot` Atomic Age Robot · `cosmic` Cosmic Bloom · `nebula_resin` Nebula Resin ·
`neon` Neon Drawing · `volume_light` Volumetric Light · `wireframe` Wireframe Model* ·
`hologram`*

*`circuit` OUT — never worked well. **This retires Example B in the ChatGPT authoring
brief** (`CENG-EFFECT-AUTHORING-BRIEF-2026-07-24.md`) — swap in `armor` or `dragon_skin`
before handing that doc out again.
`deep_sea` OUT (cut earlier).
`cosmic` overlaps `nebula_resin` and `magic_energy` hard — check side by side; `cosmic` may
need to *replace* one rather than join it.*

### `another_age` — Another Age (7) — GENDERED REFS
`elizabethan` Elizabethan Portrait · `renaissance`* · `deco_twenties`* · `victorian`* ·
`samurai`* · `wild_west`* · `ancient_egypt`*

All `mode: 'costume'`, all likeness-preserving. Period costume is the most popular
portrait-transform genre; this silo was the biggest commercial gap in the old taxonomy.

**`elizabethan` — DECIDED: 3D render, not painting.** The Holbein / Horenbout / Teerlinc /
Toto / Penni painting direction is **dead**. Rich's tested 3D-render prompt works:

> recreate the subject as a fully 3D rendered elizabethan style member of royalty. change
> expression to one that is neutral from the period. thoughtful. skin should have a mild
> pale color. background should be a rich dark folded tapestry with warm pooled lighting as
> if from the sun

Refs, after cleanup (deleted a watermarked iStock engraving of an identifiable monarch, and
a redundant period painting):
```
elizabethan/1.jpg        ← period painting (neutral style anchor)
elizabethan/2_man.jpg    ← own NB2 output, male composition plate
elizabethan/2_woman.jpg  ← own NB2 output, female composition plate
```
**Needs `skipExpression`:** the tested prompt asks for neutral-period, and
`STUDIO_DIRECTIVES`'s mandated settled smile overrode it in one of three outputs.

**Authoring notes for the six new ones:**
- **`victorian` is a rewrite, not a first draft** — it was cut for failing. Root cause is
  the general costume failure: `mode: 'costume'` removes the material anchor, leaving
  nothing to resist NB2's photographic prior. **Fix: the body must name a *medium*** —
  hand-tinted photograph, painted oil portrait, albumen print — not just "Victorian
  styling." Same fix that made elizabethan work.
- **`samurai` and `ancient_egypt`** will drift toward ethnic recasting of the subject's
  features. The `avoid` must block this explicitly or it's a support problem.

### `living_world` — Living World (7) — PARKED, Rich experimenting
`coral` Living Reef · `flowing_water`* · `frozen_splash`* · `moss_stone`* · `blossom`* ·
`autumn_leaf`* · `butterfly_wing`*

*Water has been historically problematic. Root cause is the same as `volume_light`: "made
of water" reads as "wet person." **The body must say the water IS the structure and the
silhouette breaks into spray and droplets.** `frozen_splash` is the easier win — a caught
splash has real form to hold a likeness.*

### `handmade` — Handmade (7) — GENDERED REFS
`plushy` Plushy · `chocolate` Chocolate · `origami`* · `mosaic`* · `topiary`* · `wicker`* ·
`embroidery`*

---

## 6. NEW EFFECTS AUTHORED THIS SESSION (not yet in the engine)

Full `body`/`avoid` pairs written during this session, pending entry into
`portraits-experimental.ts`. All were validated by Rich's own renders except where noted.

### `volume_light` — Volumetric Light — TESTED AND WORKING, do not edit the body

```ts
{
  id: 'volume_light',
  label: 'Volumetric Light',
  monolithic: false,
  mode: 'material',
  styleRefs: true,
  body:
    `Transform the entire clothed figure into volumetric fluid light — dense luminous vapor and ink-in-water plumes that ARE the substance of the person, not smoke drifting past a solid body. Colored light pools through the mass: magenta and violet gathering in the hair, cyan and cobalt across the shoulders and chest, hot orange and gold catching the brow, nose, and jawline where the light rakes across the form. The garment reads as vapor too — collar, shoulder line, and sleeves resolved in denser, cooler fluid. The form is dense and legible at the face, loosens through the shoulders, and dissolves into curling tendrils and open darkness at the edges. The face is clearly defined and unmistakably this person — but formed from luminous fluid, never from skin. Weightless, radiant, and alive.`,
  avoid:
    `Avoid photorealistic skin on the face with vapor added around it — the face itself is luminous fluid; this is the most common failure. Avoid a solid opaque body with smoke painted over the surface; the fluid IS the structure and the silhouette breaks open into tendrils. Avoid a bare torso or exposed chest; the garment is present, resolved in denser vapor. Avoid flat even haze — bright cores and near-black falloffs are required. Avoid a cheap smoke-overlay look — this is museum-grade.`,
}
```

Needs the **likeness-gate bypass** — a form dissolving into tendrils fails strict scoring
even when excellent, and will silently burn retries. Also a candidate for `skipStaging`
(carries its own light source, conflicting with the mandated gallery key).

### `fire_face` — Fire & Ember

```ts
{
  id: 'fire_face',
  label: 'Fire & Ember',
  monolithic: false,
  mode: 'costume',
  styleRefs: true,
  body:
    `Depict the subject as a realistic portrait engulfed in living fire — the person's own face, skin, and features rendered accurately and lifelike, unmistakably this exact person. The facial skin is SMOOTH, CLEAR, AND UNBURNT, lit hot by the surrounding flame: deep orange and gold raking across the brow, cheekbones, nose, and jawline, with the shadowed side falling to near-black. Hair lifts and streams in the updraft, strands catching ember light at the tips. The garment is blackened molten crust veined with glowing magma, cracking open across the chest and shoulders. Flame, embers, and drifting sparks fill the surrounding dark. Fierce, radiant, and alive.`,
  avoid:
    `Avoid burnt, blistered, cracked, charred, or scarred facial skin — the face is smooth and unburnt; this is the most common failure. Avoid rendering the face as flame or glowing material; it is the person's own real skin, lit by fire. Avoid losing the likeness in the glare — features stay sharp and readable through the light. Avoid a flat orange wash; hot key and near-black falloff are required. Avoid a cheap composite look — this is museum-grade.`,
}
```

**Folder rename required:** `fire-face` → `fire_face`. A hyphen means zero refs load,
silently.
Gate stays **strict** — likeness is the point.
Unresolved: `COSTUME_DIRECTIVES` mandates gallery relighting; the refs are lit entirely by
the fire. Wants `skipStaging`.
Register flag: this is the first `costume` effect whose refs are photoreal people rather
than sculpture. Eyeball the first renders against the gallery line.

### `coral` — Living Reef

```ts
{
  id: 'coral',
  label: 'Living Reef',
  monolithic: false,
  mode: 'material',
  styleRefs: true,
  framing: 'statuesque',   // hands are required here
  body:
    `Transform the figure entirely into living reef coral — EVERY surface, including the face, hands, and body, built from coral polyps, calcified branching structures, encrusting plates, and soft waving growth. The facial skin is smoothed brain coral: fine dense meandering ridges following the contours of brow, cheek, nose, and jaw, worn smooth enough that the likeness reads cleanly at a glance. The hair is a mass of sea anemone tentacles, thousands of soft pink, magenta, and cream fronds drifting and streaming in the current. Staghorn and plate corals build the shoulders and chest; the hands are fully formed in branching coral, fingers distinct and gesturing. The face occupies a substantial portion of the frame and remains the clear focal point. Shafts of sunlight rake down through blue water, catching suspended particles and fine bubble streams; the pose is open, dynamic, and alive with current. The face is clearly defined and unmistakably this person — built from coral, never from skin. Vivid, alive, and otherworldly.`,
  avoid:
    `Avoid photorealistic human skin anywhere — face, hands, and body are all coral; this is the most common failure. Avoid a rough, jagged, or lumpy face that buries the likeness — the facial coral is smoothed brain coral and the features stay sharp and readable. Avoid dead, bleached, or grey coral; this reef is vividly alive. Avoid flat even underwater haze — volumetric light shafts, bright cores, and deep blue falloff are required. Avoid malformed or fused hands; fingers are distinct and fully resolved in coral.`,
}
```

`framing: 'statuesque'` is load-bearing — hands are requested, and every universal forbids
them under bust framing.
Refs: source + `2.jpg` (brain-coral texture plate — the smoothed-face anchor, most valuable
plate) + one gendered composition plate. **Drop the reef-environment plate** — no figure,
pulls composition toward landscape, dilutes identity.
Gate stays **strict** — solid opaque form with resolved features; a fair test.

### `retro_robot` — Atomic Age Robot

```ts
{
  id: 'retro_robot',
  label: 'Atomic Age Robot',
  monolithic: false,
  mode: 'material',
  styleRefs: true,
  body:
    `Transform the subject into a smooth-skinned retro-futurist robot in the style of 1950s atomic-age illustration. EVERY surface is polished metal — face, hair, and hands included, with no human skin, no real hair, and no fingernails anywhere. The facial plating is smooth brushed steel and warm copper, divided by fine precise panel seams that trace the brow, cheekbones, jawline, and around the eyes; the seams follow and reveal the likeness rather than cutting across it. The hair is sculpted metal formed into the subject's own hairstyle, every wave and part rendered in fine machined detail. Hands are articulated metal with segmented fingers and visible joints. Behind the figure, a retro-future city of streamlined towers, elevated monorails, and saucer craft under a wide sky. Palette and light are period-accurate: teal, coral, cream, and burnished copper under warm dusk light. Optimistic, precise, and beautifully engineered.`,
  avoid:
    `Avoid photorealistic human skin, real hair, or fingernails anywhere — every surface is metal; this is the most common failure. Avoid seams that slash across the face and destroy the likeness; panel lines are fine, precise, and follow the facial contours. Avoid any legible text, signage, lettering, or logos in the background — the city reads through shape, silhouette, and light only. Avoid a grimy or industrial look; this is clean optimistic atomic-age design. Avoid modern sci-fi or military styling.`,
}
```

**Ref cleanup required before use:**
1. Both refs contain garbled signage ("FAMCES futures", "Rhaentine VIHITLE", "ROBO-SER").
   Refs outrank text — **crop the signage out** or accept garbled text on every render.
2. The refs disagree on clothing: one keeps a fabric hoodie, one is full body armour with
   no garment. Pick one. **Recommend the fabric-garment-in-metal** — preserves what the
   customer was wearing, consistent with `STUDIO_DIRECTIVES`.
3. `1_girl.jpg` → `2_woman.jpg`. Do not introduce an age axis on top of gender — it doubles
   the matrix and doubles the misdetection surface.

### `cosmic` — Cosmic Bloom

```ts
{
  id: 'cosmic',
  label: 'Cosmic Bloom',
  monolithic: false,
  mode: 'costume',
  styleRefs: true,
  body:
    `Depict the subject against deep space — the person's own real face and features rendered accurately and unmistakably as this exact person, with luminous color flowing ACROSS the skin rather than replacing it. Swirling iridescent patterns in magenta, teal, orange, and violet trace the cheekbones, brow, and jaw like living paint, leaving the facial structure fully readable beneath. Hair lifts and streams into ribbons of colored light, threaded with sparks and drifting bokeh. The garment dissolves into flowing translucent veils of nebula and starlight across the shoulders and chest. Behind the figure, spiral galaxies, star fields, and drifting iridescent spheres fill the dark. Radiant, joyful, and infinite.`,
  avoid:
    `Avoid replacing the face with abstract color — the real person stays clearly recognizable and the facial structure reads through the pattern; this is the most common failure. Avoid distorting facial proportions or idealizing the features. Avoid a bare torso or exposed chest; the garment is present, resolved in flowing light. Avoid flat even brightness — deep black space and luminous bright cores are both required. Avoid a cheap face-paint or photo-filter look; the color is integrated and lit.`,
}
```

`mode: 'costume'` is deliberate — the refs keep real skin with colour painted over it.
Overlap warning per §5.

### `ice` — Frost & Ice

```ts
{
  id: 'ice',
  label: 'Frost & Ice',
  monolithic: true,
  mode: 'material',
  styleRefs: true,
  body:
    `Transform the entire clothed figure into carved and frozen ice — EVERY surface, including the face, built from clear and frosted ice, fine crystalline lattice, and delicate frost filigree. The facial ice is smooth and clear enough that the likeness reads sharply, with faceted planes catching light across the brow, cheekbones, and jaw, and fine frost tracery gathering at the temples and hairline. The hair is frozen into swept frost ferns, dendritic snowflake structures, and slender icicle strands. The garment reads as thick frosted ice with a deeper blue-green core; collar and shoulder line stay clearly resolved. Light passes through the mass — bright refracted cores, occasional prismatic rainbow scatter at thin edges, and deep blue shadow in the thickest parts. Fine snow drifts through the surrounding dark. The face is clearly defined and unmistakably this person — carved in ice, never in skin. Brilliant, crystalline, and cold.`,
  avoid:
    `Avoid photorealistic skin on the face with frost added on top — the face itself is ice; this is the most common failure. Avoid glowing, colored, or non-human eyes; the eyes are ice and hold the subject's own shape and expression. Avoid a rough opaque slab that buries the likeness — the facial ice is clear and the features stay sharp. Avoid a bare torso or exposed chest; the garment is present in thick frosted ice. Avoid flat even white — refraction, blue depth, and bright cores are required.`,
}
```

`monolithic: true` — one substance, one hue family; `HUE_LOCK` stops the source garment's
colour bleeding through as tinted ice. Prismatic scatter is refraction, not a foreign hue —
no conflict.
**Ref problems:** `1_man.jpg` is a woman (a child, in fact). Rename, and replace with an
adult male plate — a child ref pulls adult subjects younger, fighting the age lock.
Glowing orange eyes from the second ref are killed in the `avoid`.

### `cast_glass` — Cast Glass

```ts
{
  id: 'cast_glass',
  label: 'Cast Glass',
  monolithic: false,
  mode: 'material',
  styleRefs: true,
  body:
    `Transform the entire clothed figure into solid cast glass — EVERY surface, including the face, is translucent and transparent colored glass with real thickness and internal depth. The facial glass is smooth and clear, refracting light through the mass so the brow, nose, lips, and jawline read as sharply defined glass volumes; hair is formed in flowing glass strands, and the garment resolves in thicker, more heavily refractive glass with visible collar and shoulder structure. Warm offscreen light rakes across and through the piece, throwing long caustic patterns and pooled highlights against the interior of the glass body and across its surface, with soft extended falloff into shadow. The head fills a substantial portion of the frame. The background is the same glass material, lit as a smooth continuous gradient. The face is clearly defined and unmistakably this person — cast in glass, never in skin. Luminous, weighty, and precise. The facial glass is smoothly polished — fine lines, creases, and hollows do not accumulate refractive detail, and the surface stays clean and even across the cheeks, brow, and around the eyes. The eyes stay bright and alert, catching a clear specular highlight with a defined iris, never sunken or hollow.`,
  avoid:
    `Avoid photorealistic skin on the face — the face itself is glass; this is the most common failure. Avoid a flat opaque surface with a glassy sheen painted on; light must pass through the mass with real internal refraction and caustics. Avoid a bare torso or exposed chest; the garment is present, resolved in thicker glass. Avoid harsh even lighting — a warm directional key with long caustic falloff is required. Avoid a plastic or resin look; this reads as heavy cast glass. Avoid a tired, gaunt, or hollow-eyed look — the eyes are bright and clear, and the facial surface is smooth. Avoid deep raking shadow that carves creases into the face; the key light is warm and soft across the features while staying directional overall.`,
}
```

**Important sub-finding — why translucent materials age people.** An earlier version made
subjects look older and tired. Three causes, all in the material, not the age:
1. **Refraction amplifies creases.** In transparent material a fold stops being a soft
   shadow and becomes a refractive edge that catches and bends light. Glass turns fine
   lines into features; opaque materials hide them.
2. **A raking key carves them deeper.** On bronze it flatters. On a translucent face, every
   crease gets a bright caustic on one side and a dark core on the other — maximum contrast
   exactly where age shows.
3. **"Tired" is the eyes.** Glass eyes lose the white sclera and the specular catchlight,
   so the socket reads as a hollow. That reads as fatigue more than any wrinkle.

The smoothing + bright-eyes clauses above are the fix. **Apply the same pair to
`blown_glass`, `amber`, `fantasy_crystal`, and `ice`** — `ice` especially, whose frost
tracery will happily settle into wrinkles.

**REJECTED APPROACH — de-aging.** Rich's original prompt asked to reduce apparent age by ten
years for subjects over 45. **Not included, deliberately.** It contradicts
`STUDIO_DIRECTIVES` (age locked exactly, never idealized) and `CRAFT_PERSONALITY` (no
idealization or beautification), and it would quietly make older customers look younger
than they are. If it's wanted, it belongs as a `skipAgeLock` flag applied consistently
across the catalog, not buried in one effect. Rich re-ran without it and the material fix
solved the underlying problem.

### `haunted` — DROPPED

Written, then dropped. Scary-clowns-at-a-carnival is stock genre territory — clown,
carnival, moonlight, ruined Ferris wheel are unprotectable tropes and anything built from
that vocabulary lands in similar territory independently.

**Two useful findings survive it:**
1. The pipeline **held the source garment through a costume effect** (teal sweater, dark
   curly hair carried from source). The clothing lock works on the costume path.
2. It **resolved talons under bust framing** because the refs had them. Strongest single
   piece of evidence that refs outrank universals.

Also validated: `variants` (randomized costume selection) was **killed**. It buys atmosphere
and costs determinism, support clarity, and a schema field. A customer hitting Recraft would
get a different character.

---

## 7. SCHEMA DELTAS REQUIRED

```ts
interface ExperimentalEffect {
  id:         ExperimentalEffectId
  label:      string
  monolithic: boolean
  mode?:      'material' | 'costume'

  // NEW
  category?:      SiloId          // the 8-silo taxonomy — see §5
  styleRefs?:     boolean         // loader reads public/style-refs/portraits/<id>/
  refSelector?:   'neutral' | 'gender'
  framing?:       Framing         // per-effect override (coral needs 'statuesque')
  likenessFloor?: 'strict' | 'relaxed' | 'bypass'
  skipStaging?:   boolean         // effects carrying their own light source
  skipExpression?: boolean        // superseded — see EXPRESSION_BLOCK below

  body:  string
  avoid: string
}
```

**`variants` — dropped.** Do not build.

### The unified registry is the long pole

There is **no unified effect catalog.** Realistic lives in `MATERIAL_PHRASE`, Artists in
`ARTISTS_BLOCKS`, experimental in `EXPERIMENTAL_EFFECTS` — three shapes, three builders,
and only the experimental one exposes a button list.

**Before the UI can render silos, one registry must exist that all three feed into, with
`category` on every effect.** That's CC's lane and it blocks the whole Curator redesign.

### `likenessFloor` needs data, not guesses

Replace the boolean `evalPassed = true` bypass with a three-band per-effect floor:

| Band | Effects |
|---|---|
| strict | all Earth & Ore, Artists Gallery, `fire_face`, `retro_robot`, `coral` |
| relaxed | translucent and partially-dissolving materials |
| bypass | `volume_light` |

**Thresholds are not set.** Pull the bench's fidelity-score distribution for the existing
experimental effects and set the bands from real data.

### `EXPRESSION_BLOCK` — replaces `skipExpression`

The third Curator step (pose/expression) collides with Tier 1 in two places:

1. **`STUDIO_DIRECTIVES` mandates a settled smile** and forbids stern or severe. Pick
   "thoughtful" and the universal overrides it. Expression **cannot be appended — it has to
   replace that paragraph.**
2. **"Same pose as source" reinstates removed behaviour.** The old *match the photo exactly,
   same head angle and gaze* line was cut because it forced flat frontal replication.
   `STUDIO_DIRECTIVES` now *requires* a three-quarter or raking angle and explicitly forbids
   a passport-style copy.

**Fix:** make EXPRESSION a lookup rather than a constant —
`EXPRESSION_BLOCK[choice]`, assembled at the same tier position, same pattern
`FRAMING_BLOCK` already uses. Entries: `as_photographed` · `smiling` · `laughing` ·
`thoughtful` · `dramatic` · `goofy`.

This generalizes `skipExpression` properly. `elizabethan` simply picks `thoughtful`.

Two product notes:
- **"As photographed" must mean expression only, not camera angle.** Let customers keep the
  smile, not the snapshot's framing.
- **"Goofy" fights the museum register** on every material — it will read as a broken render
  on bronze. Consider Handmade-only, or rename to "Playful."

**Pose must be text, not an image.** A pose reference image is a photograph of a *different
person* injected into an input set whose entire job is preserving the customer's identity.
It is the one addition that actively fights likeness, and expression is something NB2 handles
well from text. Zero cost, zero dilution, zero new assets.

### Recraft determinism

If `refSelector` picks a gendered ref at render time, store `ref_set` on the render record —
otherwise a Recraft can't reproduce the original. Studio failure remedies explicitly offer
Recraft.

---

## 8. SOURCE-IMAGE FAILURE GATES (from the top of the session)

Two failure classes, not one. **Hard block** never spends a credit; **soft warn** renders
anyway with consent. NB2 handles low resolution well; blur it cannot recover.

### Hard block
- Face min dimension **< 40px absolute** — not enough identity pixels
- **Sharpness = poor** on the hero face (motion blur or out-of-focus) — the real killer
- No face detected in a face-required Series
- Content moderation trip

### Soft warn — proceed with a one-line Curator nudge
- Image min(W,H) **300–719px** — NB2 handles this; say likeness will be approximate
- Face min dimension **40–70px**
- Lighting = poor (dim / harsh shadow) — recoverable
- Occluded or turned face — likeness will drift, customer's call

### Auto-pass
min(W,H) ≥ 720 **and** face ≥ 70px **and** sharpness good.

This **drops the hard resolution floor from 480 → 300** and **moves blur from advisory to
blocking** — inverting the current weighting to match NB2's actual behaviour.

**Open:** `sharpness` in `analyzeSourceSet` is a vision-model judgment, not a Laplacian
variance measure, so it will be inconsistent at the margin. Decide whether to add a numeric
sharpness measure alongside it.

**Open:** "inappropriate content" needs splitting — moderation gate (nudity, violence,
illegal) vs suitability gate (screenshot, artwork, existing AI render, watermarked stock).
The second is cheap to add to `analyzeSourceSet`; the first wants a provider moderation
endpoint.

---

## 9. OPEN DECISIONS

| # | Decision | Blocks |
|---|---|---|
| 1 | **`cast_glass` in or out of Light & Glass** — silo is at 8 | Taxonomy lock, `dichroic_glass` |
| 2 | **One tree or two** for refs/previews | Loader implementation, LFS decision |
| 3 | **Git LFS or Supabase Storage** for `public/style-refs/` | Must decide **before** `git add` |
| 4 | **Bust-with-resolved-hands** — allowed or not? Two approved plates disagree | Ref consistency, `framing` |
| 5 | **Plinth shape** — standardized vs per-effect (impressionist specifies round) | Ref consistency |
| 6 | **Crop standard** — folded_book/impressionist are wider than charcoal's 40% | Grid consistency at button size |
| 7 | **Subject consistency** — 2–3 recurring vs deliberate diversity | Whether to re-shoot 4 plates |
| 8 | **`refSelector` at all** — diverse neutral plates may make it unnecessary | Gender-detection plumbing |
| 9 | **`reclaimed_bronze` vs `bronze`** — duplicate? | Myth & Legend slot |
| 10 | **`cosmic` vs `nebula_resin` vs `magic_energy`** — overlap | Far & Future slots |
| 11 | **`likenessFloor` thresholds** — needs bench data | Gate config |
| 12 | **`skipAgeLock`** — de-aging as a deliberate product choice, or never? | Catalog-wide policy |
| 13 | **Aug 1 vs Aug 5** — ship the new effects dark, or push the date? | Scope |

---

## 10. IMMEDIATE ACTIONS

1. **Commit.** Both bodies of engine work plus all new refs and previews are uncommitted.
   ```
   git add -A public/ && git commit -m "WIP snapshot pre-merge 2026-07-29"
   git branch backup/pre-merge-2026-07-29
   ```
   Sort out LFS after — an untracked 18MB is a smaller problem than losing two weeks of
   engine work.

2. **Promote the engine** (order matters — copy the wizard aside FIRST):
   ```
   Copy-Item public\portraits.html      public\litenco-portraits-wizard-2026-07-29-ref.html
   Copy-Item public\portraits.next.html public\portraits.html -Force
   node scripts/boot-test.js
   ```

3. **Paste the §1 engine-state correction to CLAW** at the next session start.

4. **Add the function/fetch count rule to CLAUDE.md** Definition of Done.

5. **Delete** `portraits-presets.ts` and `portraits-shared-helpers.ts`.

6. **Rename** `public/style-refs/portraits/fire-face` → `fire_face`.

7. **Fix the `retro_robot` refs** — crop signage, resolve the clothing conflict, rename
   `1_girl.jpg`.

8. **Replace the `ice` child ref** with an adult male plate.

9. **Swap Example B** in `CENG-EFFECT-AUTHORING-BRIEF-2026-07-24.md` — `circuit` is retired.

10. **Regenerate all preview images** — the old set carries plaques and sculpture-on-plinth
    staging that violates the ref rules and copy law.

---

## 11. SESSION SCORECARD

**Refs shot and approved: 13** (12 confirmed, sheet_music pending)
- Earth & Ore: **7/7 complete**
- Artists Gallery: **5/7** (+1 pending; `pencil_sketch` outstanding)

**Remaining ref shoots: ~43 effects × 2 refs ≈ 86 images.**
Money cost ≈ $50 at ~5¢/render with 2–3 attempts per keeper. **The constraint is Rich's
eyes** — roughly 8 hours of selection judgment that doesn't compress.

**Bodies still to author: 20** — 6 Another Age, 6 Living World, 5 Handmade, plus
`golden_idol`, `runestone`, `wireframe`, `hologram`, `dichroic_glass`, and the `victorian`
rewrite.
