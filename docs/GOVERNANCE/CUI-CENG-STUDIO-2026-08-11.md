# CUI -> CENG · THE STUDIO · 2026-08-11

`docs/GOVERNANCE/`

From the glass lane. Everything below was ruled with Rich on 10-11 August.
The page and the prompt builder are written and working; what is missing is
two routes.

Read alongside `docs/GOVERNANCE/STUDIO-PROMPT-ALGORITHM-2026-08-11.md`,
which carries the reasoning. This carries the contract.

---

## THE SHORT VERSION

The Studio is a wallpaper generator with no photograph, no prompt box and no
LLM. Four dropdowns and a slider, concatenated into a prompt, sent to
flux-schnell. Four images a round, watermarked, free to look at, $1.99 to
keep one.

**It is a lead magnet.** Rich's framing: *"pocket change, but really we want
their emails and memories for prints."* The number that matters is not
wallpapers sold, it is how many people who came for a free toy end up
crafting a portrait.

---

## WHAT IS ALREADY WRITTEN

    public/wallpaper-studio.html            the page. Complete except for
                                            the two fetch calls below.
    lib/v1/wallpapers/studio-prompt.ts      the builder. Type-checks strict,
                                            all 2,880 combinations build.

`studio-prompt.ts` is the server's, not the page's. It exports:

```ts
buildPrompt(choice, opts?)   -> string
buildRound(choice)           -> [{ prompt, energy }] x 4
randomChoice()               -> Choice
remix(prompt, remixId)       -> string
WORLDS MOODS ENERGIES PALETTES REMIXES
isValid(partialChoice)       -> type guard
```

Call `buildRound` and you have the four prompts. Nothing else to write on the
prompt side.

---

## 1 · THE PAGE SENDS FOUR IDS AND NEVER A PROMPT

```
POST /api/v1/wallpapers/studio/generate
{ world, mood, energy, palette, season }     // season null or 'halloween'
```

**Validate every id against the vocabulary and refuse anything unknown.** Do
not accept a prompt, a fragment of one, a seed, a step count, a model name or
a negative prompt, whatever a future caller sends.

This is the whole safety story for the Studio. Four dropdowns cannot be
talked into anything — which stops being true the moment a browser is trusted
with words that reach the model. The absence of free text is also the absence
of a moderation problem, and it is worth more than any classifier we could
put in front of it.

Response:

```json
{ "ok": true, "images": [ { "id": "...", "preview": "https://..." } ] }
```

Four of them, in the order `buildRound` returned. The page shows each as it
lands rather than waiting for all four — the first arriving in a second or
two makes the whole wait feel like nothing.

---

## 2 · KEEP

```
POST /api/v1/wallpapers/studio/keep
{ id }
```

Spends **4 credits** ($1.99). Returns the clean, unwatermarked, full-size
file:

```json
{ "ok": true, "url": "https://..." }
```

Refusals the page already handles by name: `signed_out` sends them to sign
in and back; `no_credits` sends them to buy some.

**Four credits, not six.** The photo wallpapers are 6 ($2.99); the Studio is
cheaper because nobody's face is in it and the market will not bear a
portrait's price for something a stranger's face is not in.

---

## 3 · THE MODEL, AND THE ONE TRAP

**`black-forest-labs/flux-schnell` on Replicate.** $3 per thousand output
images — 0.3 cents each, read off the model page on 10 August 2026. Marked
Warm, so no cold start. Marked Commercial use.

**HARDCODE THE STRING. NEVER READ IT FROM CONFIG OR AN ENVIRONMENT
VARIABLE.**

`flux-schnell` is Apache-2.0 and sellable. `flux-dev` is NON-COMMERCIAL, ten
times the price, and one word away in the same namespace. A typo in a config
value means selling images we have no right to sell, and **nothing in the
product would look wrong** — the images would be good, the page would work,
and the fault would surface as a letter rather than an error.

Preview at **768x1344**. Full size only on keep. Nobody pays for full
resolution on three images they did not want.

---

## 4 · THE WATERMARK IS BURNED IN

Ruled 11 August. Not a CSS overlay — anybody can screenshot past an overlay,
and the clean file is the entire thing being sold.

- Source: `liten-and-co.svg`, white fill, viewBox 1821 x 1528.
- **18-25% opacity**, white.
- Angled, roughly 30 degrees.
- The mark plus "LITEN CO".
- Composited server-side onto the 768x1344 preview, before it is stored.

Visible enough to matter, faint enough that somebody screenshots and shares
it anyway — **a watermarked wallpaper on somebody's phone is an
advertisement**, so this is not trying to make the preview useless. It is
trying to make the clean one worth $1.99.

The clean file is generated or held separately and released only by `keep`.

---

## 5 · THE CAP

Free, unlimited generation is the only place in this business with no ceiling
on it. At 0.3 cents it is a nuisance rather than a risk, but it needs a
number.

- **15 rounds per session** — 60 images, about 18 cents.
- **40 rounds per IP per day.**
- **Queue depth of one per session**, so nobody holds four generations open.
- **The cap resets on any purchase.**

**What happens at the wall matters more than the number.** Somebody who has
generated fifteen rounds and bought nothing is somebody who liked it enough
to try fifteen times — the worst possible moment to say no. The response
should be an offer, not a refusal. Rich to write the line; it is the
Concierge's register, not an error's.

---

## 6 · PREVIEWS ARE NOT KEPT

Ruled 11 August. Nobody pays to store rounds nobody wanted.

The four previews live as long as the session needs them and are swept after.
Only a kept image becomes a `collection_pieces` row.

---

## 7 · SEASONS

`season` arrives as `'halloween'` or null. **A season is a vocabulary, not a
product** — the same four axes, the same builder, different words. Christmas
in November is one more data file rather than one more thing to build.

Rich is writing the Halloween vocabulary. Until it lands, `season` should be
accepted and ignored rather than refused, so the page can ship first.

Written to the same rule as the general one, which is worth restating because
it is what makes the matrix real:

    WORLD    what the image is made of
    MOOD     light, atmosphere, contrast — NEVER a place or a subject
    ENERGY   composition and motion — never material, light or colour
    PALETTE  colour, always against a ground

Rich's test: Glass x Storm, Architecture x Dream, Botanical x Eclipse and
Cosmos x Midnight must each be independently sensible. The day a Mood says
"at sea", 8 x 6 stops being a matrix and becomes a list of combinations
somebody happened to think of.

---

## 8 · THE FREE SIXTH

Five kept from the Studio and the sixth is free. **Per season** — Halloween
keeps its own count.

No named special edition here, unlike the photo rooms. There is no catalogue
to name one from, and in a room of 2,880 combinations the right reward is
another go rather than an object somebody else chose.

---

## 9 · WHERE IT LIVES

    /wallpapers/studio                    the general Studio
    /wallpapers/studio?season=halloween    from the Halloween stage

Middleware maps `/wallpapers/studio` to `wallpaper-studio.html`. Already
patched.

**Halloween is a season, not a room.** It holds the photo effects, pets in
costume, and this. That is why the Studio is reachable from two places and
why the season arrives as a parameter rather than a different page.

---

## 10 · WHAT NOT TO ADD

No LLM anywhere in this pipeline. No prompt rewriting, no "improve the
prompt" call, no seed exposed, no steps, no model selection, no negative
prompt, no free text of any kind, no photo upload, no device selection, no
desktop sizes.

Every one of these makes the product worse at the only job it has, which is
to be understood in four seconds.

---

## OPEN

- Rich's Halloween vocabulary.
- The line shown at the generation cap.
- Whether the clean file is regenerated at full size on the same seed or
  upscaled from the preview. Regeneration is cleaner and costs another 0.3
  cents, which is nothing against $1.99.

---

*CUI · 11 August 2026*
