# LATENT CODE STUDIO · SPEC v1 · 2026-08-10

`docs/GOVERNANCE/`

Worked out with Rich, 10 August 2026. Not built. Read before wiring.

---

## WHAT THIS ACTUALLY IS

A wallpaper generator with no photographs and no prompt box. Four choices, a
button, four images.

**It is a lead magnet, and the wallpapers are not the product.** Rich's
framing, and it changes every decision below: *"nice to have pocket change
but really we want their emails and memories for prints."*

So the number that matters is not wallpapers sold. It is **how many people who
came for a free toy end up crafting a portrait.** A month where Latent Code
takes $400 and sends nobody to the workshop is a worse month than one where it
takes $80 and sends thirty.

Everything here is built to that. Where fun and conversion disagree, fun wins,
because a toy nobody enjoys converts nobody.

---

## THE MATRIX

Four controls. No technical parameters are ever exposed - no seeds, no steps,
no model names, no negative prompts.

**WORLD** (large visual cards) — Cosmic · Botanical · Liquid · Glass ·
Mineral · Atmospheric · Geometric · Surreal

**MOOD** — Dreamy · Dark · Electric · Serene · Strange · Luxurious

**PALETTE** (swatches, not words) — Aurora · Ember · Ocean · Midnight ·
Pearl · Moss · Candy · Monochrome · Surprise Me

**ENERGY** — a five-stop slider, STILL to WILD. Low is restrained and
spacious; high is movement, depth and spectacle.

8 × 6 × 9 × 5 = **2,160 combinations** before variation seeds. That is the
whole appeal and it costs nothing to hold.

### How the prompt is built

    BASE + WORLD + MOOD + PALETTE + ENERGY + WALLPAPER RULES + VARIATION

Each component is a separate data entry. **No complete prompts are stored** -
2,160 hardcoded strings is a thing nobody can edit, and the first request to
change how Ember reads would mean touching 240 of them.

The composition rules ride on every generation: vertical, edge to edge, no
text, no logos, nothing important where the clock and the lock-screen
furniture sit. That last one is what separates a wallpaper from a tall
picture, and it is the rule most likely to be quietly dropped.

### THERE IS NO LLM IN THIS PIPELINE

Worth stating because it is the mistake waiting to be made. The prompt is
string concatenation over the matrix. Calling Claude or 4o-mini to "write a
better prompt" adds a second of latency and a cost per generation to a product
whose entire advantage is being instant and nearly free.

---

## THE MODEL

**`black-forest-labs/flux-schnell` on Replicate.** $3 per thousand output
images - **0.3 cents each**, read off the model page on 10 August 2026, not
from an aggregator. Marked Commercial use and Warm, so there is no cold start
and no licence question.

A four-image round costs **1.2 cents**. Against a $2.99 sale that is four
tenths of one per cent.

**Hardcode the model string. Never read it from config.**
`flux-schnell` is Apache-2.0 and sellable. `flux-dev` is NON-COMMERCIAL, ten
times the price, and one word away in the same namespace. A typo in an
environment variable would mean selling images we have no right to sell, and
nothing in the product would look wrong.

The provider layer stays swappable - fal.ai quotes the same price with
sub-second latency and no charge on server errors, and is worth benchmarking
once this works. Swappable means the model choice is one function; it does not
mean the model name is a setting.

### Preview small, render on purchase

    Generate 768x1344 -> watermark -> show four -> they choose -> upscale -> deliver

Nobody pays for full resolution on three images they did not want.

---

## COST, AND THE ONE UNCAPPED THING

Generation is free, unlimited, and needs no account. That is the only place in
the whole business with no ceiling on it.

At 0.3 cents, ten thousand scripted rounds costs **$120** - a nuisance, not a
disaster, and the earlier worry about this was overstated. Still worth:

- a per-session round cap (start at 20, tune from real numbers)
- a per-IP hourly cap
- a queue depth of one per session, so nobody holds four generations open

**Not a sign-in wall.** See below.

---

## SIGN-IN: GENERATE FIRST, ASK AT UNLOCK

**Anybody can generate without an account.** Asking a stranger to register
before they have seen anything is how a lead magnet stops generating leads,
and the thing we want from them is worth more when they want something back.

The email is asked for at **unlock** - the moment they have chosen one and
want it clean. That is the only moment in the funnel where the answer is
obviously yes.

Magic link, same as everywhere else. The four generated previews are held
against the anonymous session and attach to the account on sign-in, exactly as
the workshop already restores a queue through `/auth/callback`. **A person who
signs in must not lose the image they signed in for** - that is the whole
transaction.

---

## THE DOWNLOAD SCREEN IS THE PRODUCT

The single most important surface in Latent Code, and the one most likely to
be built as an afterthought.

Somebody who has just paid $2.99 for a wallpaper is the warmest lead this
business will ever have: they have an account, a payment method on file, and
they are pleased. **The moment to tell them we make portraits from their own
face is here, on this screen, while they are pleased** - not in an email on
Thursday when they have forgotten who we are.

What sits under the download:

- their wallpaper, clean, with the download control
- one line and one image: what we make from a photograph
- a single button into the workshop

Not a banner. Not a modal that interrupts the download. The offer sits *below*
the thing they came for, and it is the last thing on the screen.

**Instrument this.** `wallpaper_unlocked` and `wallpaper_to_workshop` as named
events, so the conversion rate that justifies the whole product is a number
Rich can read in the admin panel rather than a feeling.

---

## PRICING, AND WHY BUNDLES ARE CREDITS

**One wallpaper: $2.99.** Configurable, never hardcoded.

**Bundles are sold in CREDITS, not in wallpapers.** This is the decision that
makes Latent Code worth building.

A four-wallpaper bundle is a dead end: they buy four, they get four, they
leave. A credit bundle spends on wallpapers *or* on a portrait, so somebody
who bought for the toy already holds the currency for the thing we actually
sell. The doorway is the balance itself, and it does not need a marketing
email to walk through.

It also folds Latent Code into the ledger that already exists - one balance,
one `credit_ledger`, one Account panel - instead of a second wallet nobody
asked for.

Wallpaper unlock costs **6 credits** at the existing rate, matching what was
already ruled for the photo-based wallpapers.

---

## REMIX AND DISCOVERY

**MORE LIKE THIS** - same matrix, new variation seeds.

**REMIX** - six fixed nudges, no prompt editor: More Glassy · More Organic ·
More Dramatic · Simpler · Stranger · Change Colours. Each is a modifier
appended to the built prompt.

**SURPRISE ME** - a random legal combination.

**MAKE SOMETHING IMPOSSIBLE** - a curated recipe, not a random draw. Recipes
are data, not code, so Rich adds one without a deploy: Liquid Mercury Storm,
Impossible Glass Garden, Frozen Aurora, Cosmic Silk, Bioluminescent Forest,
Mineral Nebula, Liquid Chrome, Botanical Crystal, Prismatic Smoke, Electric
Coral, Impossible Architecture, Atmospheric Gold.

The recipes are also the marketing. A named collection is postable; a slider
position is not.

---

## WHAT IT LOOKS LIKE

Inside Liten & Co and using its money, its accounts and its storage - but
**more digital and more experimental than the portrait studio**. Latent Code is
allowed to feel like a toy. The Curator does not appear here; this is not her
room and she has nothing to advise on.

Artwork dominates. Controls are beautiful and secondary. Mobile first, because
the output is a phone screen and half these people will be on one.

The vocabulary laws still hold: no *sculpture*, no *queue*, no *render* as a
verb the customer reads.

---

## DO NOT BUILD IN V1

Photo uploads. Prompt entry. Device selection. Desktop wallpapers. Editing
tools, layers, masks, brushes. Seeds, negative prompts, model selection, any
technical control at all.

**Brutally simple.** Every one of these is a thing that makes the product
worse at the only job it has, which is to be understood in four seconds.

---

## WHERE IT LIVES

Open question. `/wallpapers` currently maps to `portrait-wallpaper.html` in
middleware, which is the PHOTO-BASED wallpaper series - a different product
with uploads, silos and effects.

Two different things cannot both be Mobile Wallpapers in the Series menu. The
cleanest reading is that Latent Code is its own entrance - `/studio` or
`/latent` - and the photo-based wallpapers stay a Series. **Rich to rule.**

---

## OPEN

- The route above.
- Watermark design. Visible enough to matter, tasteful enough that somebody
  screenshots it anyway and that is fine - a watermarked wallpaper on
  somebody's phone is an advertisement.
- Whether previews expire. Holding four 768x1344 images per anonymous session
  forever is storage nobody is paying for.
- Upscale path: regenerate at full size with the same seed, or upscale the
  preview. Regeneration is cleaner and costs another 0.3 cents.
- Whether the four in a round vary by seed alone or by a deliberate spread
  across the ENERGY value, so the set reads as four options rather than four
  near-identical images.
- Bundle sizes and prices.

---

*CUI · 10 August 2026*
