# CENG CARRYOVER — STYLE REFS v2
**Date:** 2026-07-30 · **Lane:** CENG (V22) · **Supersedes:** `CENG-CARRYOVER-2026-07-29-STYLE-REFS.md` §§3, 6, 9
**Companion:** `EFFECTS-REVISION-2026-07-29.md` (effect list) · `LITEN-EFFECT-TRACKER-2026-07-30_A.xlsx` (row state)

This doc records the 2026-07-30 session: eleven effects locked, one silo closed, and four
standing rules changed by evidence. **Every prompt below is verbatim.** Where a plate was shot
without its prompt being captured, the row says so rather than reconstructing it.

---

## 1. WHAT CHANGED AT THE RULE LEVEL

### 1.1 The medium fix is RETIRED

**Old rule (07-29):** `mode: 'costume'` strips the material anchor, leaving nothing to resist
NB2's photographic prior. Therefore every costume body must name a *medium* — hand-tinted
photograph, albumen print, painted oil. This was recorded as the root-cause fix for
`victorian`'s original failure and prescribed forward to `renaissance`, `wild_west`,
`samurai` and `ancient_egypt`.

**Finding:** seven costume effects were shot today. **None names a medium. None drifted.**
`renaissance` was authored as an oil painting, rejected by Rich in favour of "a real person
but feels like a painting," and the photoreal version worked first time.

**New rule:** the anchor is **a specific enough costume plus a period-lit room**. A costume
with an unambiguous silhouette gives the model no reason to reach for a medium cue. Where a
period feeling is wanted, it comes from **palette and light falloff**, not from naming a
medium.

**Action:** strike the medium prescription from the tracker's `victorian`, `renaissance`,
`wild_west`, `samurai` notes. It is a live instruction that would degrade output.

### 1.2 Loose hair is NOT the likeness lever — FALSIFIED

Asserted three times during the session that loose hair framing the face carries likeness,
after the first onna-musha plate failed with a scraped-back bun.

**Falsified twice.** The second onna-musha plate ties hair *under the helmet* with a few
escaped strands and holds likeness cleanly. The `deco_twenties` male plate is slicked flat
and pomaded; the female is a short marcel wave close to the head. All three read well.

**What actually matters:** the face **lit, unobstructed, and large enough in frame.** The
first onna-musha failure was the missing kabuto (costume incomplete, two costumes fighting)
and navy-on-navy separation — not the hair.

**Action:** do not add loose-hair clauses to bodies. Where a period demands controlled hair,
let it. If likeness reads soft, the lever is **framing and separation**.

### 1.3 The muting clause is period-conditional

`persian_court`, `wild_west` and `renaissance` all needed *muted, low contrast, no clean
whites, aged and softened* to escape a contemporary-editorial feel.

`deco_twenties` needed the opposite. Gloss and hard contrast **are** the Deco register — a
crisp white shirt against black is the entire silhouette. The muting clause was deliberately
withheld and the plate is stronger for it.

**Rule:** mute by default for pre-1900 costume. Withhold for Deco and later.

### 1.4 Background readability is a period signal

Consistent across the session: a fully readable background reads modern regardless of
costume. The fix that worked repeatedly —

> heavily out of focus, only shapes and glow readable. deep shadow, warm dim light falling
> off fast.

**Even fill light is half of what reads contemporary.** Falloff matters as much as blur.

---

## 2. LOCKED THIS SESSION — MATERIAL & HANDMADE

### `chocolate` — LOCKED · `1.jpg`

> convert the subject into a rich chocolate sculpture. smooth brown milk chocolate with highly detailed features. do not crop subject. head and shoulders should be visible. Background should be a chocolate shop (blurred). no visible letters. satin sheen on entire sculpture

**Open decision closed: matte vs satin → SATIN.** Remove from the open list.

**Plate inheritables (unresolved):** gold earring (non-chocolate metal), scalloped bust base,
veined marble plinth. Rules call for a low plain dark stone block. Rich accepted the plate
as-is; noted so a re-shoot doesn't silently "fix" it.

**Also on the plate:** brown subject against brown bonbon trays — separation is carried
accidentally by white chocolate at frame edges. Face ≈20% against the 25–30% nominal.

---

### `plushy` — LOCKED · `1.jpg`

> Transform the entire figure into a soft stuffed plush toy — highly detailed. very visible stitching. slightly over stuffed feeling. Very soft. Plushy is nestled on a bed against pillows with other stuff animals but looks like a childs favorite from its position. the best is plush and cozy. the entire scene evokes loved, comfy. Likeness is critical. Face should occupy at least 30% of the image.  head and shoulders fill the frame, face roughly 30% of the image. no letters

**Withdrawn:** the pending eye/mouth fix from the 07-29 carryover (no white sclera, no
individual teeth) is not in this body and not in the plate. Rich locked regardless. Mark
withdrawn, not outstanding.

---

### `blown_glass` — LOCKED · `1.jpg` `2.jpg`

> make the subject from the source photo fully colored translucent and transparent glass. Show warm glow of light with long falloff and caustics from offscreen casting against interior of glass body and surface . apply the new effect to the portrat p015. Face should occupy 25% of the image. Likeness is essential. Background should be made of the same glass material and lit with a smooth gradient light. no real skin

**Struck from an earlier draft of this body, at Rich's instruction:**
~~Make the age accurate. if subject is over 45 years old in appearance reduce wrinkles and
age by 10 years.~~ — consistent with the `skipAgeLock` rejection recorded in Part 1. The
recorded substitute remains the anti-ageing clause pair (polished facial surface + bright
alert eyes), not de-ageing. **Not currently in this body.** Add only if an older subject
shows the tired-socket problem.

**Tracker row is stale:** shows refs 0 and Rich's note *"Do not include in batch. This needs
experimentation."* Both retired — body locked, two plates shot.

**Caustics behaviour confirmed correct:** a third render placed caustics on the wall behind,
cast from offscreen. This is failure-pair #4 (light originating outside the piece) avoided,
and it is the model for the other translucents.

**Pair note:** `1.jpg` has an opaque knit garment; `2.jpg` is glass throughout. A third render
resolved this — coloured-glass garments hold without competing with the face, so `1.jpg` is
the outlier. Not re-shot. Both plates carry metal/diamond jewellery as inheritables.

**Standing collision:** reads warm honey-gold throughout, and `amber` sits in the same silo on
honey-through-cognac. At button size they may collide. The monochrome-with-value-variation
finding would solve it — push one cool, let `amber` own warm. **Unresolved.**

---

## 3. ANOTHER AGE — SILO CLOSED

Went from 1 done to 7 in one session. Was the largest body-authoring gap in the catalog.

### 3.1 Roster change

| out | in | reason |
|---|---|---|
| `ancient_egypt` | `persian_court` | thin at bust framing; gold-mask risk hides the face; same ethnic-recasting exposure with less costume to justify it. Persian is dense at exactly the framing in use — turban, brocade, sash, layered jewellery all between chest and crown. |

**CC action:** `ancient_egypt` must not be inherited into the registry or
`PortraitsPresetId`. Id `persian_court` chosen because the reference reads Safavid/Mughal
rather than ancient Persia — the id will outlive the label.

### 3.2 The ethnic-recasting warning — DOWNGRADED, NOT CLEARED

The 07-29 doc flagged `samurai` and `ancient_egypt` as certain to drift toward ethnic
recasting, requiring an explicit `avoid` block or "it's a support problem rather than a
portrait."

**Both samurai plates preserved the subject's features with no explicit block** beyond
`do not modify ethnicity` in the body. Mechanism: the costume is unambiguous enough that the
model has no reason to reach for facial cues to signal setting.

**Keep `do not modify ethnicity` in every costume body.** It is cheap and it is in every
plate that worked. Do not assume the risk is gone — it was never tested at higher zoom or on
a less complete costume.

### 3.3 The seven

| id | label | plates | body |
|---|---|---|---|
| `elizabethan` | Elizabethan Portrait | 3 (pre-session) | unchanged — see 07-29 |
| `victorian` | Victorian Portrait | male ✅ | §3.4 |
| `renaissance` | Renaissance Portrait | male ✅ · female ⬜ | §3.5 |
| `persian_court` | Persian Court | male ✅ (v1) · female ⬜ | §3.6 |
| `samurai` | Samurai | male ✅ · female ✅ | §3.7 |
| `wild_west` | Wild West | male ✅ · female ✅ | §3.8 |
| `deco_twenties` | Deco Twenties | male ✅ · female ✅ | §3.9 |

---

### 3.4 `victorian` — LOCKED · male `1.jpg`

**Status: REWRITE → done.** Previously cut for failing.

> make the subect a victorian upper class subject. create a realistic period portrait photo .full color image. deep saturate colors on man. man facing front, zoom in for torso and headshot. face should be 20% of image. slight smile
> Background: a Victorian parlour — a rich mahogany roll-top desk with its tambour open, a brass gas lamp bracketed on the wall with a frosted glass shade, patterned wallpaper in deep saturated colour above white painted wainscot and trim.

**Load-bearing:** the white wainscot gives a light band for a dark suit to separate against.
Confirmed on the plate — navy velvet against the white trim.

**Dropped from the locked body vs. the drafted background:** `No framed pictures.` and
`No visible letters.` The plate is clean, so no issue now — a risk only on re-shoot. The
`charcoal_chalk` failure (background works reproducing the subject's own face ×3) is the
precedent.

**A female Victorian plate exists** (teal gown, parlour, three-quarter turn) and was approved
in conversation as the direction. **Its prompt was not captured.** Either re-shoot from the
locked body or supply the text.

**Retired diagnosis:** a rose-suit render failed earlier in the session and was analysed as
period-inaccurate. Rich's guardrail — *plausible and believable, not expert-authenticated* —
supersedes that. The real failure was likeness: eyes closed, head turned away, face ≈8%.

---

### 3.5 `renaissance` — male LOCKED · `1.jpg`

Rich's edit of the drafted body. Verbatim:

> make the subject a realistic photo of a Renaissance nobleman.  warm earth palette of umber, ochre, deep red and black. slashed velvet doublet with full soft sleeves, a fine linen shirt at the collar, a single gold chain. no ruff. man facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image. calm, settled expression. do not modify ethnicity.
> Background: a painter's loggia — stone arches opening onto a Tuscan hillside, cypresses, warm late afternoon light, slightly out of focus.

**Note:** Rich's edit dropped the explicit light clause (`single warm window light from the
left…`) and it still reads painterly — the loggia's low sun does that work.

**Differentiation from `elizabethan`:** both are now photoreal, so the split is carried by
silhouette alone — no ruff, soft sleeves, earlier decade. **Watch the two side by side.**

**Female — body written, plate not shot.** A first attempt in a walled garden was rejected as
too modern; diagnosis was bright chlorophyll green (absent from an old-master palette), flat
even daylight, and a crisply readable background. Background changed to an interior:

> make the subject a realistic photo of a Renaissance noblewoman. warm earth palette of umber, ochre, deep red and black. velvet gown with a squared low neckline over a fine linen chemise, full sleeves tied at the shoulder with the chemise puffing through the lacing, hair parted at the centre and dressed with a fine pearl net, a single gold chain. no ruff. woman facing front, three-quarter turn of the shoulders. zoom in for torso and headshot. face should be 20% of image. calm, settled expression. do not modify ethnicity.
> Background: a Renaissance interior — a plastered wall in warm ochre, a carved walnut chest, a heavy tapestry with faded figures, a leaded window off to the left throwing one shaft of light. deep shadow, warm dim air, slightly out of focus.

Loggia (male) and interior (female) share light and palette, so the pair still reads as one
world.

---

### 3.6 `persian_court` — male plate shot from v1; v2 body is current

**v2 — current body, not yet shot:**

> make the subject a realistic photo of a Persian nobleman of the Safavid court. deep rich palette of crimson, gold and umber — muted and low in contrast, no clean whites, aged and softened. a wound silk turban, a brocade robe over a fine linen shirt, layered strands of pearl at the neck. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the turban. face should be 20% of image. do not crop the turban. calm, settled expression. do not modify ethnicity.
> Background: a palace interior — carved stucco, a faded hanging, an oil lamp, deep shadow, warm dim lamplight falling off fast. heavily out of focus, only shapes and glow readable.

**v1 plate failed on:** face ≈11%, and a fully readable background competing with the
subject. Four changes in v2 — framing to chest, do-not-crop-turban (horns/turban push out at
that zoom), palette muted, background to shapes-only with fast falloff.

**Female — body written, plate not shot:**

> make the subject a realistic photo of a Persian noblewoman of the Safavid court. deep rich palette of crimson, gold and umber — muted and low in contrast, no clean whites, aged and softened. a fine silk veil draped over a small jewelled cap, a fitted brocade coat over a linen chemise, layered strands of pearl at the neck, gold at the ears. hair falling loose from beneath the veil. woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the cap. face should be 20% of image. do not crop the veil. calm, settled expression. do not modify ethnicity.
> Background: a palace interior — carved stucco, a faded hanging, an oil lamp, deep shadow, warm dim lamplight falling off fast. heavily out of focus, only shapes and glow readable.

Veil-over-cap sits at the same height as a turban, so framing and crop clauses carry across
unchanged. **Note:** the `hair falling loose` clause predates the §1.2 falsification — it is
optional, not load-bearing.

---

### 3.7 `samurai` — both plates shot

**Male plate: prompt NOT CAPTURED.** The plate exists (red-and-gold ō-yoroi, kabuto with gold
maedate, tatami room, armour stand at right, face ≈18%). Supply the text or re-shoot.

**Female — Rich's body, verbatim:**

> Professional documentary portrait of a female samurai in authentic Edo-period lacquered armor. Historically accurate construction with layered lamellar plates, thick silk lacing, visible weight and bulk. Hair tied beneath the helmet with only a few loose strands escaping. Light weathering, worn lacquer, tiny scratches and natural fabric creases. Soft overcast daylight with realistic reflections. Neutral expression. High-end medium-format photography, shallow depth of field, subtle color grading, absolutely photorealistic. zoom out to keep helmet to chest framing

**Onna-musha decision:** female `samurai` is the historical female warrior in armour, not a
court noblewoman in jūnihitoe. Rationale — keeps the silo's promise (she gets the armour, not
the decorative alternative), and it is one prompt with a costume noun swapped rather than two
divergent bodies to maintain.

**First female attempt failed on three counts, all diagnostic:**
1. **No kabuto** — a court hairstyle with kanzashi sitting on battle armour reads as two
   costumes fighting. The helmet also frames and shortens the face.
2. **Navy on navy** — armour against a navy armour stand and dim walls. The male plate works
   because red-and-gold sits against warm cream.
3. A naginata blade running the full frame height, pulling attention off the face.

**Open — pair consistency:** male is warm interior candlelight, glossy, saturated crimson and
gold. Female is overcast documentary, desaturated, matte, weathered brown. **For generation
this is fine** — costume mode does not depend on consistent surface behaviour the way `bronze`
or `blown_glass` does, and the costume reads identically in both. **For previews it is a
problem** if the grid shows both plates: reads as two products. Decide per grid design.

**Background inheritable:** a full second suit of armour on a stand at frame right. Refs
outrank text — this is a candidate for reproduction as a background figure.

---

### 3.8 `wild_west` — LOCKED · male `1.jpg` · female `2.jpg`

**Male:**

> make the subject a realistic photo of a frontier man of the American West, 1880s. muted palette of dust, tobacco brown, faded indigo and oxblood — low in contrast, no clean whites, everything worn and sun-faded. a wool waistcoat over a collarless shirt, a knotted neckerchief, a broad felt hat creased and stained with wear. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the hat. face should be 20% of image. do not crop the hat. calm, settled expression, weathered skin. do not modify ethnicity. likeness is important
> Background: a saloon back room — plank walls, a stove, bottles on a shelf, one dirty window off to the left. deep shadow, warm dim light falling off fast. heavily out of focus, only shapes and glow readable.

**Female:**

> make the subject a realistic photo of a frontier woman of the American West, 1880s. muted palette of dust, tobacco brown, faded indigo and oxblood — low in contrast, no clean whites, everything worn and sun-faded. a high-collared calico bodice buttoned to the throat, a small cameo at the collar, a wool shawl over the shoulders. hair pinned up but loosening, strands falling around the face. woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, weathered skin. do not modify ethnicity. Likeness is essential
> Background: a saloon back room — plank walls, a stove, bottles on a shelf, one dirty window off to the left. deep shadow, warm dim light falling off fast. heavily out of focus, only shapes and glow readable.

**Best-matched pair of the session** — same room, same stove, same window, same light. The
first set that reads as one sitting rather than two.

**The wear language is doing the anti-costume-shop work** the tracker asked for: creased,
stained, sun-faded. New clothes are what make this genre look rented.

**⚠️ OPEN — `weathered skin` is adding years.** Both plates read roughly a decade older than
source: deeper lines around eyes and mouth, greyed stubble on the male. **Consistent across
the pair, therefore reliable rather than occasional.** This is the same failure class as the
translucents that made subjects look tired, arriving through wardrobe instead of refraction —
and it is a clause actively pushing against the age lock. Rich locked with it in.
**Cleanest fix if revisited: move the wear entirely into the fabric and drop the skin clause.**
The hat and waistcoat already carry the harshness.

---

### 3.9 `deco_twenties` — both plates shot · not explicitly locked

**Male:**

> make the subject a realistic photo of a man at a party in 1926. black dinner jacket with satin lapels, white wing-collar shirt, black bow tie, a white silk pocket square. hair slicked flat and pomaded with a hard side part, clean shaven. man facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, faint smile. do not modify ethnicity. likeness is essential.
> Background: a hotel ballroom — mirrored panels, gold sunburst motifs, low warm lamps, cigarette haze. deep shadow, hard glamour lighting falling off fast. heavily out of focus, only shapes and glow readable.

**Female:**

> make the subject a realistic photo of a woman at a party in 1926. a beaded drop-waist evening dress with a low scooped neck, long ropes of pearls, a beaded headband low across the brow, drop earrings. hair in a short marcel wave close to the head. woman facing front, three-quarter turn of the shoulders. framed from mid-chest to the top of the head. face should be 20% of image. calm, settled expression, faint smile. do not modify ethnicity. likeness is essential.
> Background: a hotel ballroom — mirrored panels, gold sunburst motifs, low warm lamps, cigarette haze. deep shadow, hard glamour lighting falling off fast. heavily out of focus, only shapes and glow readable.

**Deliberate departure:** no muting clause on either. See §1.3.

**⚠️ OPEN ×2, both fixable by clause rather than re-shoot:**

1. **Background figures on both plates.** Two seated and one standing on the male; a seated
   figure left and a standing woman right on the female. Faces are indistinct enough to be
   safe now, but refs outrank text and this teaches *people in frame*. The `charcoal_chalk`
   precedent is background works reproducing the subject's own face. **Add a no-other-people
   clause.**
2. **Bare shoulders on the female plate.** First plate this session to break the standing ref
   rule (*fully clothed, collar closed — bare-chest drift teaches undressing*). A 1926 evening
   dress makes it hard to avoid without adding a stole or capelet.

**Also:** both plates land at ≈15–18% face against a 20% ask. The framing clause is read
loosely at this composition.

**Falsifies the marcel-wave concern** raised when the female body was drafted — see §1.2.

---

## 4. TRACKER CORRECTIONS — `LITEN-EFFECT-TRACKER-2026-07-30_A.xlsx`

| row | correction |
|---|---|
| `chocolate` | refs 0 → 1. BATCH NOW → DONE. Body live → locked (satin). |
| `plushy` | refs 0 → 1. BATCH NOW → DONE. |
| `blown_glass` | BATCH NOW → DONE. Retire Rich's note *"Do not include in batch"*. Refs 2 confirmed as `1.jpg` `2.jpg`, convention-named. |
| `victorian` | REWRITE → DONE (male). Strike the medium prescription. |
| `renaissance` | NEEDS BODY → male DONE, female authored. Strike the medium prescription. |
| `ancient_egypt` | **DELETE ROW.** |
| `persian_court` | **ADD ROW.** Body authored v2, male plate from v1 (superseded), female authored. |
| `samurai` | NEEDS BODY → both plates shot. Male prompt not captured. Downgrade the recasting warning per §3.2. |
| `wild_west` | NEEDS BODY → DONE, pair locked. Strike the medium prescription. Flag `weathered skin`. |
| `deco_twenties` | NEEDS BODY → both plates shot, pending lock. |
| `beaded`, `polished_gold` | absent from the tracker entirely — add or confirm dropped. |

### 4.1 Legend correction — URGENT

The Legend's standing **Camera** clause still reads:

> "Head turned 30 degrees to the left, camera slightly below eye level."

**Struck 07-30.** Camera and pose are solved by baseline conditions plus the user's pose
selection, not per effect. It sits in the reusable-clauses block, which is exactly where it
gets copied from. **Remove.**

### 4.2 Silo counts

Light & Glass is at 8 (`cast_glass` — known, open). **Handmade is also at 8** — `quilted` is
the extra. Second over-count, not previously recorded.

---

## 5. OPEN — CARRIED FORWARD

**Pre-`git add`, and both get harder once committed:**
1. Git LFS vs Supabase for `public/style-refs/` — still untracked.
2. One tree or two — refs and previews are separate directories with identical filenames.

**Product decisions:**
3. `cast_glass` in or out — Light & Glass at 8.
4. `quilted` in or out — Handmade at 8.
5. `reclaimed_bronze` vs `bronze` — duplicate across silos.
6. `cosmic` / `nebula_resin` / `magic_energy` — three-way overlap.
7. `blown_glass` vs `amber` — both warm honey. Push one cool.
8. `refSelector` at all — a deliberately diverse neutral ref set may remove the need, and
   removes the misgendering failure surface. **Note: `another_age` shot gendered pairs all
   session, which is the strongest argument yet for keeping it in the costume silos.**
9. `polished_gold`'s silo.
10. `samurai` pair consistency for previews — §3.7.
11. `likenessFloor` thresholds — needs the bench fidelity distribution. Cannot be guessed.

**Loose rather than decided:**
- Plinth shape — impressionist round, others dark block, beaded none.
- Crop standard — 25–30% nominal, but costume plates land 15–20% and read fine. **This may be
  a bust-framing rule rather than a catalog-wide one.** Seated full-body compositions
  (`victorian` female) land near 10% and still work.

**Still needed from Rich:**
- Folder listing of `public/style-refs/portraits/` plus which files were kept. Never supplied;
  the tracker's DONE is a weaker claim.
- `REF-BATCH-01-2026-07-30.md` — referenced, not supplied.
- `samurai` male prompt text.
- `victorian` female prompt text.

---

## 6. FOLDER HYGIENE — UNCHANGED, STILL OPEN

Renames outstanding from the 07-30 handoff. A hyphen loads **zero refs, silently.**

| current | required |
|---|---|
| `volume-light` | `volume_light` (and delete 3 junk files — cap is 3) |
| `fire-face` | `fire_face` |
| `water_face` | `flowing_water` |
| `watercolour` (registry id) | `watercolor` — flip registry to match the folder |

New this session: create `persian_court/`. Do not create `ancient_egypt/`.
