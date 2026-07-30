# CENG STANDING BRIEF + SESSION STATE
**Updated:** 2026-07-30 · **Read this first. It is short on purpose.**

Paste this whole file at the start of a new CENG thread. Everything else is reference:
`CENG-CARRYOVER-2026-07-29-STYLE-REFS.md` (deep detail, 63KB — grep it, don't read it),
`EFFECTS-REVISION-2026-07-29.md` (effect list), `REF-BATCH-01-2026-07-30.md` (prompts),
`LITEN-EFFECT-TRACKER-2026-07-30.xlsx` (status per effect).

---

## PART 1 — THE STANDING BRIEF

*The rules that aren't obvious, and why each exists. This part changes rarely.*

### The single most important finding

**Reference images outrank prompt text.** At three total inputs (customer photo + 2 refs),
a ref overrides even the universal prompt blocks. Proven repeatedly:

- a ref with talons → render produced hands despite "no hands at all" in `STUDIO_DIRECTIVES`
- a ref with a plaque → render reproduced "Liten & Co · 2025" with no plaque instruction
- refs with garbled signage → text bans do not hold

**Consequence:** anything visible in a ref frame is a candidate for reproduction. A ref plate
shows material behaviour and lighting, and nothing else.

**Exception found 2026-07-30:** for `neon`, the visible transformers, wiring and small
hardware labels are *load-bearing* — they make it read as a fabricated object rather than a
glowing drawing. The rule is therefore: **ban text where it's incidental, keep hardware where
it's credibility-bearing.**

### Short prompts beat long ones

Repeatedly confirmed. Rich's five-line prompts outperformed CENG's three-paragraph versions
on `neon`, `volume_light`, and `beaded`. When a long prompt fails, the fix is usually to cut,
not to add. Write the mechanism in one clause and stop.

### Failure/fix pairs (all observed in production)

| Failure | Real cause | Fix |
|---|---|---|
| Photoreal skin on a transformed body | NB2's portrait prior | Explicit ban naming face/neck/forehead/ears + "this is the most common failure" |
| Bare chest / bare shoulders | Classical bust convention; worse on translucent materials | "fully clothed in source garment, collar closed, no bare shoulders" |
| Orange artifacts on nose, lips, ears | An SSS clause escalating to an internal lamp | Drop SSS for stone entirely. Amber and jade tolerate it *bounded*: "pale and stone-toned, the ears do not light up, light originates outside the piece" |
| Grain / veining / burl crossing the face as blotches | Material character applied uniformly | "face carved from the cleanest, most uniform grain — no figuring crossing the eyes, nose or mouth; confine it to garment and shoulders" |
| Flat, no depth, reads 2D | Banning flatness doesn't work | **Name volume positively**: "a full rounded volume wrapping around the form like a leaded Tiffany lampshade, not a flat panel" |
| Dark material lost on a dark ground | No silhouette separation | Light background for dark materials; dark for light materials |
| Face too dark to read | Key with no fill | Soft fill front-right at half the key's intensity |
| Rim light rendered as a visible lamp prop | Source in frame | "source out of frame" |
| Uniform, ghostly, characterless translucency | Material described as homogeneous | Demand internal variation: "clear regions against cloudy opaque zones and darker seams within one piece" |
| Effect looks cheap | Too much of it, everywhere | Sparseness and negative space. Density *implies* surface — it doesn't have to become one |

### Translucent materials make people look older — never fix it with de-aging

Three mechanisms, none of them the subject's age:
1. Refraction turns a crease into a light-bending edge — glass amplifies what stone hides.
2. A raking key gives every crease a bright caustic and a dark core.
3. Glass eyes lose the white sclera and specular catchlight, so the socket reads hollow —
   this is what reads as "tired," more than any wrinkle.

**Fix:** "the facial surface is smoothly polished — fine lines and hollows do not accumulate
refractive detail. The eyes stay bright and alert with a clear specular highlight and a
defined iris, never sunken or hollow." Applies to amber, ice, cast_glass, blown_glass,
fantasy_crystal, melted_wax.

**A de-aging clause was proposed and rejected.** It contradicts `STUDIO_DIRECTIVES` (age
locked exactly) and `CRAFT_PERSONALITY` (no idealization), and would quietly make older
customers look younger than they are. The material fix solved the real problem.

### Monochrome with value variation is a house technique

Three for three: `neon` (blues only), `beaded` (reds only), `amber` (honey through cognac).
Restricting hue forces *value* to do the depth work, and it separates effects that would
otherwise collide in the "glowing colourful thing" space. Reach for it.

### Plinth rule

Plinth for `material` effects — an object needs something to sit on, and without a bottom
edge NB2 extends downward and the classical nude-torso prior fills in. No plinth for
`costume` effects — it turns a portrait into a trophy. No plinth for dissolving forms
(`volume_light`, `magic_energy`, `nebula_resin`, `wireframe`) or for `beaded` (deliberately
free-floating). Low and plain; ornate plinths compete.

### Camera and expression are NOT per-effect

**Corrected 2026-07-30.** CENG had been putting "head turned 30 degrees, camera slightly
below eye level" in every prompt. Wrong — camera and expression belong to the customer's pose
step. Include a camera clause **only when the material needs its volume proved** (stained
glass, wireframe, anything reading flat). Otherwise stay silent.

### Uncanny faces

Detail on a soft or abstracted face is where uncanny lives. Plush with glossy bead eyes,
white sclera and individual teeth reads creepy; simple embroidered eyes and a stitched mouth
read warm. Real toys simplify for exactly this reason. Same principle for any effect that
abstracts the face.

### Ref plate checklist

- No plaque, no legible text (unless credibility-bearing hardware)
- Clothed, collar closed, no bare shoulders
- Face in-material — no skin leak
- Clean face — no pattern crossing eyes, nose, mouth
- Face reads ~25–30% of frame
- Background unique per effect, nothing inheritable
- Cap 3 inputs total (source + 2 refs)
- **Refs double as preview images** — one shoot, one review pass
- Folder name must be **snake_case matching the engine id exactly** — a hyphen loads zero
  refs, silently, with no error

### Who decides what

Rich judges every render. CENG is blind to output — visual correctness is entirely Rich's
eye. When Rich pastes a screenshot it is a directive, not ambiguous data. Do not respond to
a rejected render with multiple-choice questions; diagnose and give the fix.

---

## PART 2 — WHERE THINGS STAND, 2026-07-30

### Approved today

`amber` · `neon` · `beaded` · `chocolate` (matte version) — plus `polished_gold` and
`volume_light` close, `plushy` one iteration away.

### Approved 2026-07-29 (to current standard)

jade · quartzite (`stone`) · ebony · walnut · impressionist · watercolor · folded_book ·
charcoal_chalk · sheet_music · driftwood_resin · stained_glass

### Approved early, BEFORE the standard existed — Rich to decide on re-shooting

`bronze` · `iron` · `alabaster`. Shot in the first hour, different crop and lighting. They
sit adjacent in the grid, so inconsistency will show.

### Rich is personally auditing the whole list

He is going through folder by folder rather than trusting the tracker. The tracker's "DONE"
meant "approved at the time," which is a weaker claim than it sounds. **Ground truth is the
folder listing plus which files he kept.** Ask for it before assuming any effect is finished.

---

## PART 3 — PROMPTS SAVED TODAY (Rich's own, verbatim — do not rewrite)

These outperformed CENG's longer versions. Use them as the register to match.

### `neon` — LOCKED

> highly detailed neon tube sculpture. fully 3d in all three directions. implied volume. use negative space. use monochromate blues with variations on value. mounted in a small shops storefront window at night, rain on the glass, the shop dark behind. wires and electrical lines visible. at least 100 tubes

*"Sparse" was dropped deliberately — it fought "at least 100 tubes" and Rich preferred the
dense result. Hardware and labels stay; they sell it as fabricated.*

### `volume_light`

> volumetric light sculpture of a figure emerging from darkness. the entire body is made of suspended luminous particles and droplets at varying density and size — sections of highly dense clusters imply the surface of a cheekbone or shoulder without ever becoming solid, thinning to sparse motes elsewhere. no skin, no fabric, no solid surface anywhere. features are read from where the particles gather, not from drawn detail. the colors vary between orange and gold depending on particle density. some particles gather to form sculptural wispy tendrils tying elements together. Likeness is imporant. match photo pose and zoom level

*Pending: `particle density is highest across the face — tight enough that the features read
sharply — loosening through the shoulders.` Background should be pure black, no set —
anything in frame gives NB2 a surface to resolve against.*

### `beaded` — NEW EFFECT, approved

> highly detailed sphere basic sculpture of the subject in the photo. the sculpture is fully 3d and made from beads and orbs of different sizes that are lighting with an internal falloff. The color of the spheres, orbs and beads are monochromatic red with variations in value to create interest. Leave some negative space to show volume. likeness is important. Scupture should not be contained it should be free floating, no containers or plinth or visible means of support. the sculpture ends at the chest with shoulders and garment resolved in beads
> Background is an Indian dye market — deep vermilion, crimson and madder pigment heaped in open sacks and brass bowls, stained cloth hanging above, warm low light from a doorway. Heavily blurred. Subjects face should be at least 25% of the image. No real skin, hair, eyes

*Known conflict: "face at least 25%" fights "ends at the chest" — pushing face size crops the
chest out. Pick one. Bead-scale variation (fine at the face, large at hair and shoulders) is
what makes the effect work.*

### `polished_gold` — NEW EFFECT

Replaces the `golden_idol` slot — this is contemporary decor, not votive. Needs
`framing: 'statuesque'` for the chin-on-hand gesture.

> Transform the entire figure into a contemporary polished gold sculpture — mirror-bright warm gold with a high specular finish, the surface smooth and flowing with no visible tool marks. Forms are simplified and stylised: broad clean planes across the cheeks, brow and collarbone, features refined rather than literal, hair rendered as a single sweeping sculptural mass of thick ribbon-like locks with deep carved separations catching bright highlights. The subject rests their chin on one hand, elbow drawn in and the forearm rising to meet the jaw — a thoughtful, settled pose. The hand and fingers are fully resolved in gold, long and simplified, with clean separations. A generous figure — head, full shoulders, the whole chest and upper torso — substantial and grounded, not a small cut-off bust.
>
> No human skin anywhere — the face and hand are polished gold like the rest. Avoid a matte, patinated or antiqued finish. Avoid heavy realistic detail — pores and fine wrinkles are simplified into clean sculptural planes. Avoid malformed or fused fingers. Avoid greenish or reddish gold — warm yellow gold throughout.
>
> Background is a gilder's workshop — books of gold leaf on the bench, agate burnishers and squirrel-hair tips laid out, a half-gilded frame propped against the wall, warm low light. Heavily blurred.
>
> Fully clothed in source garment rendered in gold, collar closed, no bare shoulders. Low black marble plinth. No letters, no plaque.

### `chocolate` — approved (matte)

> convert the subject into a rich chocolate sculpture. smooth brown milk chocolate with highly detailed features. do not crop subject. head and shoulders should be visible. Background should be a chocolate shop (blurred). no visible letters

*Open: matte vs satin. The approved render is matte and reads slightly clay-like; tempered
chocolate has a soft gloss. Adding `soft satin sheen, gentle highlights on the raised
features` brings it back, but too much pushes it toward bronze.*

### `plushy` — one iteration away

> Transform the entire figure into a soft stuffed plush toy — highly detailed. very visible stitching. slightly over stuffed feeling. Very soft. Plushy is nestled on a bed against pillows with other stuffed animals but looks like a child's favorite from its position. the whole scene evokes loved, comfy. Likeness is critical. Face should occupy at least 30% of the image

*Last render was rejected as creepy. Cause: glossy black bead eyes with white sclera plus a
full toothy grin. **Fix:** `the eyes are simple embroidered or felt shapes — no glossy plastic
bead eyes, no visible white sclera. the mouth is a simple stitched or appliquéd curve without
individual teeth.` Optional pushes Rich liked: doll-scale felt garment with visible seams;
heavier overstuffing; visibly handmade with uneven stitching and wear.*

### `amber` — approved

Key clause that fixed the "ghost-like uniformity" complaint:

> The amber is NOT uniform: clear glassy regions where light passes straight through sit against cloudy, milky opaque zones and darker cognac-brown seams, with fine crazing and internal fracture planes catching light between them. Strong subsurface scattering — light entering from the offscreen key diffuses through the mass and glows warm at the thinnest sections. Keep the face in the clearer amber so the likeness stays sharp; concentrate the cloudy zones, dark seams and inclusions in the garment and shoulders.
>
> Background is a naturalist's cabinet — specimen drawers half open, brass loupe and tweezers, pinned wings far out of focus, cool grey daylight from a window to the left. No legible labels or text on the drawers or specimen cards.

---

## PART 4 — REGISTRY (CENG-OWNED)

`lib/v1/portraits/effect-registry.ts` is the single source of truth for ids, labels, silos and
flags. **CUI and CC read the generated `public/effect-registry.js` and never hand-edit either
file.** After any edit: `node scripts/emit-effect-registry.js` (run from the repo root).

The generator validates and reports — it catches silo count drift, non-snake_case ids, and
HTML entities in labels automatically.

Current state: 8 silos, 57 effects, 26 live / 9 authored / 22 todo, `light_glass` over by one.

**Not yet added to the registry:** `beaded`, `polished_gold`, `quilted`. Also pending:
`watercolour` → `watercolor` (US spelling; the folder on disk is already `watercolor`).

---

## PART 5 — OPEN DECISIONS

1. **`cast_glass` in or out** — `light_glass` is at 8 slots. Rich deferred.
2. **Re-shoot `bronze` / `iron` / `alabaster`?** — approved before the standard existed.
3. **Subject consistency** — 2–3 recurring people across the grid, or deliberate diversity
   across race, age and gender? Rich leaned toward diversity as being inclusive and removing
   the need for gendered ref selection at all. If so, `refSelector: 'gender'` may be
   unnecessary entirely.
4. **`polished_gold` silo** — it's a material finish, so Earth & Ore fits, but that silo is
   full at 7.
5. **`chocolate` matte vs satin.**
6. **Duplicate pairs still untested:** `reclaimed_bronze` vs `bronze`; `nebula_resin` vs
   `cosmic` vs `magic_energy`.
7. **Three folder renames outstanding** — `volume-light` → `volume_light`,
   `fire-face` → `fire_face`, `water_face` → `flowing_water`. Until done, those refs load
   silently empty.

---

## PART 6 — THE OTHER LANE (context only, not CENG's job)

CUI V23 is rebuilding the interface — a three-floor rotating deck (silos → effects → poses),
global queue capped at 10, 10 credits per image. That work is slow by design; the UI is the
hard part and a broken interface has cost real time before.

**Engine state, resolved 2026-07-29:** `public/portraits.html` was ticketed as a CSS/JS
extraction but was actually *replaced* with a wizard file — 250 functions became 85.
`portraits.next.html` (241 functions, 15 fetches) is the real engine and the merge base.
Credits and wizard port ONTO it, not the reverse. A standing rule now applies to any
engine-file work: **report function count and fetch count before and after; counts must not
decrease.**

Rich is deliberately leaving "apparent holes" — code that exists elsewhere or in backups.
**Do not fill a gap without asking why it's there.**
