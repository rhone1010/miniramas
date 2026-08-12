# THE STUDIO · PROMPT ALGORITHM v1 · 2026-08-11

`docs/GOVERNANCE/`

Worked out with Rich, 10-11 August 2026. Supersedes the pricing and route
sections of `LATENT-CODE-STUDIO-SPEC-2026-08-10.md` — that name is dropped.
Everything else in that document stands.

---

## WHAT CHANGED SINCE THE FIRST SPEC

**Price is $1.99, not $2.99.** Five unlocks a free one, the same Set
mechanic as the photo rooms — but with no catalogue there is nothing to
name, so the sixth is simply free rather than a named special edition.

**Halloween is a season, not a room.** Ruled 11 August. Halloween holds
every Halloween thing — photo transformations, pets, and generated art —
so it opens onto its own set of cards rather than straight onto a floor.
Christmas will do the same in November.

That makes the stage two kinds of thing side by side: Portraits, Pets and
Studio are **kinds**, Halloween is a **season**. Worth stating plainly
because it is the sort of asymmetry that gets tidied away by somebody who
does not know it was deliberate.

---

## THE BUILDER

    BASE + COMPOSITION + WORLD + MOOD + PALETTE + ENERGY + VARIATION

Concatenation. No model in the loop, no LLM, no prompt rewriting. Each
component is one data entry and every entry is editable without touching
code.

Order matters and this order is deliberate: **the composition block sits
near the front, before anything decorative.** A four-step model weights
early tokens heavily, and composition is the thing that must survive.

---

## 1 · THE COMPOSITION BLOCK — THE MOST IMPORTANT THING HERE

Fixed. Rides every generation. Nobody chooses it and nobody sees it.

This block is what separates a wallpaper from a tall picture, and it is the
single largest quality lever in the product **because it is free** — it
costs nothing per image and it applies to all 2,160 combinations at once.
Most wallpaper generators fail here rather than on style.

What it has to carry:

- **Vertical 9:16, edge to edge, full bleed.** No borders, no framing, no
  vignette that reads as a frame.
- **The top third stays quiet.** The clock and the lock-screen furniture
  live there. Nothing with detail, nothing with a focal point, nothing
  bright enough to fight white type. Say *what goes there* — open sky,
  gradient falloff, deep shadow, atmospheric haze — rather than what does
  not.
- **The subject sits in the lower two-thirds**, weighted below centre.
- **No text, no letterforms, no signatures, no logos.** Say it explicitly.
  Diffusion models put text in things unprompted and it is the fastest way
  to make an image unsellable.
- **Depth in three planes** — near, middle, far. This is what stops a
  wallpaper reading as a flat pattern, and it is the difference between an
  image that survives on a home screen with icons over it and one that
  turns to soup.

**Never name the clock.** Learned on the photo-side wallpapers: naming
phone furniture makes the model draw phone furniture. Say "the upper
region is open and unadorned," never "leave room for the clock."

---

## 2 · WORLD — CONCRETE NOUNS ONLY

Eight: Cosmic · Botanical · Liquid · Glass · Mineral · Atmospheric ·
Geometric · Surreal.

**A four-step model rewards nouns and punishes adjectives.** This is the
rule that governs how every entry in every vocabulary gets written, and it
is worth more than any other single decision.

> *"Ethereal, dreamlike, otherworldly"* produces mush.
> *"Backlit fog over wet obsidian, one lamp, water beading on stone"*
> produces an image.

Schnell has four steps to resolve a whole frame. Abstractions give it
nothing to resolve; objects with materials and light give it everything.
Every World entry should name **three or four physical things and how the
light behaves on them**, and nothing else.

Cosmic is not "space, vast, infinite." Cosmic is *nebula filaments, dust
lanes lit from behind, a star field with real depth of field, one bright
source off-centre.*

---

## 3 · MOOD — LIGHT AND WEATHER, NOT FEELING

Six: Dreamy · Dark · Electric · Serene · Strange · Luxurious.

A mood is a lighting instruction wearing a mood's name. "Dark" is not an
emotion the model can render; **low key, single raking source, deep
falloff, detail retained in shadow** is.

Written as: the quality of the light, its direction, the contrast ratio,
and the atmosphere it travels through. That is the whole of it.

"Detail retained in shadow" earns its place in Dark specifically — without
it a low-key prompt returns black mud, which is the commonest failure in
this register.

---

## 4 · PALETTE — RICH'S, AND THE REASON THEY WORK

Twelve, written by Rich on 11 August. **Every one names a ground**, not
just a triad, which is what most palette lists miss and why these will hold
where a list of three colour names would not. A colour is only itself
against something.

| Palette | Direction |
|---|---|
| **Aurora** | electric cyan + violet + emerald, luminous against midnight |
| **Ember** | molten orange + crimson + amber against charcoal |
| **Deep Ocean** | cobalt + teal + turquoise + tiny aqua highlights |
| **Ultraviolet** | saturated violet + magenta + electric blue against black |
| **Solar** | radiant gold + amber + warm ivory against deep bronze |
| **Neon Noir** | hot magenta + cyan + violet against near-black |
| **Emerald** | deep forest + emerald + jade + luminous chartreuse accents |
| **Opal** | pearl + lavender + pale cyan + blush with iridescent highlights |
| **Inferno** | scarlet + vermilion + molten gold against black |
| **Arctic** | ice blue + silver + white + restrained cobalt shadows |
| **Midnight** | navy + indigo + black with sparse electric-blue illumination |
| **Prismatic** | controlled spectrum colour, rich refraction, luminous transitions |

Two words doing quiet work in that list, both worth keeping in any palette
added later: **"tiny"** on Deep Ocean's highlights and **"restrained"** on
Arctic's shadows. Both are limits, and a palette without a limit renders as
every colour at full saturation. **"Controlled"** on Prismatic is doing the
same job — spectrum colour without it is a rainbow smear.

---

## 5 · ENERGY — FIVE STOPS, STILL TO WILD

Not a style. **A density instruction**: how much is in the frame, how much
of it is moving, and how much empty ground is left.

- **1 · Still** — one subject, generous negative space, minimal motion, a
  single light source.
- **3 · Middle** — a composed scene with a clear focal point and secondary
  interest.
- **5 · Wild** — layered depth, motion through the frame, multiple light
  sources, spectacle.

**Low energy is the harder end and the more valuable one.** A generative
model's default is to fill a frame; producing restraint takes an explicit
instruction and produces the wallpapers people actually keep. Somebody
looks at a phone screen a hundred times a day and spectacle wears out. The
Still entries should be written with more care than the Wild ones, not
less.

---

## 6 · THE FOUR IN A ROUND — NOT FOUR SEEDS

**Four seeds on one prompt gives four near-identical images and the round
reads as broken.** The customer sees the same picture four times and
concludes the machine is stuck.

So the four vary along **one deliberate axis**, seeded differently as well:

- **1** the chosen Energy
- **2** one stop calmer
- **3** the chosen Energy, alternate composition variant
- **4** one stop wilder

Bounded at the ends: at Energy 1 the round runs 1 · 1 · 2 · 3.

That gives four images that are recognisably the same idea and visibly
different pictures, which is what makes a set feel like a choice rather
than a glitch. It costs nothing — the same four calls either way.

---

## 7 · THE HALLOWEEN VOCABULARY

Same four controls, same builder, different words. **This is the whole
mechanism for seasonality** — a season is a vocabulary, not a product, so
Christmas in November is one more data file rather than one more thing to
build and maintain.

Sketch, for Rich to write properly:

**Worlds** — Graveyard · Haunted House · Deep Woods · The Abyss ·
Cathedral · Moor · Carnival · Crypt

**Moods** — Eerie · Malevolent · Melancholy · Uncanny · Feverish · Solemn

**Palettes** — Blood · Bone · Witchlight · Rot · Candle · Frost

Halloween palettes need grounds exactly as the others do. *Witchlight:
poison green and pale cyan against wet black.* *Candle: warm tallow and
amber against soot, everything else swallowed.*

---

## 8 · WHAT SCHNELL IS BAD AT, AND WHAT TO DO

Four steps is fast and it is not free. Known failure shapes and the
counter for each:

- **Text and letterforms appear unprompted.** Excluded explicitly in the
  composition block. Not negotiable — an image with garbled type on it
  cannot be sold.
- **Faces at small scale go wrong.** Nothing in the Studio vocabulary
  should produce a human face. This room has no photograph in it and no
  reason to want one; keep people out of the Worlds entirely.
- **Long prompts dilute.** Every component contributes and the total should
  stay tight. If the built prompt is running long, the fix is cutting an
  adjective from a World entry, never adding a clarifier.
- **Abstractions return mush.** See section 2. This is the same failure as
  long prompts wearing a different hat.
- **Symmetry creeps in.** Centred, mirrored compositions look generated.
  The composition block should ask for an off-centre focal point.

---

## 9 · WHAT IS NOT IN THE PIPELINE

No LLM. No prompt rewriting. No seed exposed, no steps, no model name, no
negative-prompt box, no free text of any kind.

**The absence of free text is also the absence of a moderation problem.**
Four dropdowns and a slider cannot be talked into anything, which is why
this design is safe at volume in a way a prompt box never would be.

---

## OPEN

- The World, Mood and Energy entries themselves — written to section 2's
  rule. Rich's, as the palettes were.
- Whether the seasonal vocabulary rotates with the photo-side room
  (Halloween through October, Christmas from November) or stays available
  once built.
- Watermark design.
- Whether previews expire, and when.
- Upscale path: regenerate at full size on the same seed, or upscale the
  preview. Regeneration is cleaner and costs another 0.3 cents.

---

*CUI · 11 August 2026*
