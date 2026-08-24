# SPEC — THE WALLPAPER STORE

**Written by CUI V32, 23 August 2026. Ruled by Rich in session.**
For the CUI that builds it.

Everything below was read from source on 23 August — the bucket, the
filenames, the vocabularies, the counts. Nothing is remembered and
nothing is assumed. Where something was not checked it says so.

---

## 0 · WHAT THIS REPLACES

The Studios are **parked, not deleted.** Three files stay on disk and
lose their door:

```
public/wallpaper-studio.html
public/wallpaper-studio-V001.html
public/wallpaper-studio-V002.html
```

`wallpaper-studio-V002.html` is the one to read — it holds both
vocabularies and is where §3 came from. **Do not delete any of them.**
Parking means the landing stops offering a Studio card; the pages remain
reachable by URL for anyone who has one.

The Studios were the generator. What is being sold now is what they
already generated: **1,029 wallpapers sitting in Supabase.**

---

## 1 · WHAT EXISTS TODAY

### The bucket

`wallpapers`, **public**. Two folders:

| path | count |
|---|---|
| `studio/general/` | 527 |
| `studio/halloween/` | 502 |

Public bucket means a plain URL, no signing:

```
https://<project>.supabase.co/storage/v1/object/public/wallpapers/studio/general/<name>.jpg
```

### The pages

| file | route | state |
|---|---|---|
| `public/wallpapers.html` | `/wallpapers` | the landing. **Rebuilt by this spec.** |
| `public/portrait-wallpaper.html` | `/wallpapers/portraits` | exists, works |
| `public/pet-wallpaper.html` | `/wallpapers/halloween-pets` | exists, works |
| — | Pets, non-Halloween | **does not exist** |
| `public/wallpaper-studio*.html` | — | parked |

**Rich confirmed the two routes and that Pets is not built.** A card
pointing at a page that does not exist is worse than no card, so the
landing carries four cards and not five. Pets joins when it is built.

---

## 2 · THE FILENAME GRAMMAR — read this before writing a parser

Names are the only metadata. There is no table.

**General** — five fields:

```
NNNN _ world _ mood _ energy _ palette .jpg

0000_cosmos_dream_stillness_aurora.jpg
0012_cosmos_twilight_flow_deep_ocean.jpg
```

**Halloween** — six. The sixth is a subject, and it is **not a Studio
axis**; it came from the batch that generated these:

```
NNNN _ world _ mood _ energy _ palette _ subject .jpg

0000_haunted_bewitched_stillness_blood_moon_impossible_scale.jpg
0004_haunted_nightmarish_eruption_blood_moon_material_transformation.jpg
```

### THE CATCH THAT WILL BITE A NAIVE PARSER

**Values are multi-word.** `deep_ocean`, `blood_moon`, `neon_noir`,
`impossible_scale`, `living_architecture`. Splitting on `_` and taking
positions gives the wrong answer for most of the file.

**And two values appear on two different axes.** `inferno` and
`midnight` are each both a Mood and a Palette in the general set;
`midnight` and `eclipse` are both in the Halloween set. So a substring
match is wrong as well.

**Parse left to right, field by field, longest match first, against the
known vocabulary for that field.** Strip the four-digit index, then take
the longest world that matches the head of what remains, then the longest
mood, and so on. Assert the remainder is empty when the last field is
taken — a name that does not fully consume is a name the vocabulary does
not cover, and it should be reported rather than guessed at.

**The subject vocabulary is not written down anywhere.** Derive it from
the filenames: it is whatever remains after the palette. Observed so far
— impossible_scale, living_architecture, beautiful_decay,
hidden_presence, material_transformation, unnatural_light,
ancient_monument, endless_depth, emerging_form, impossible_weather,
organic_geometry, something_watching. **That list is from fifteen files.
Build it from all 502.**

**Do not put a parser in the browser for 1,029 names.** Build a manifest
once — a script that lists the bucket, parses, and writes a JS registry
in the shape the other registries use. Same reason `pets-registry.js`
exists.

---

## 3 · THE VOCABULARIES

Read from `public/wallpaper-studio-V002.html`, 23 August. **Ids are what
is in the filename; labels are what the customer reads.**

### General

**World** (8) — cosmos · ocean · glass · botanical · liquid ·
architecture · light · mineral

**Mood** (6) — dream · storm · twilight · eclipse · midnight · inferno

**Energy** (5) — stillness · drift · flow · surge · eruption
*The order is calm to wild and is meaningful. Do not sort it
alphabetically for display.*

**Palette** (12) — aurora · ember · deep_ocean · ultraviolet · solar ·
neon_noir · emerald · opal · inferno · arctic · midnight · prismatic

### Halloween

**World** (8) — haunted · spectral · infernal · harvest · occult ·
gothic · nightmare · otherworld

**Mood** (6) — bewitched · haunting · ominous · macabre · nightmarish ·
majestic

**Energy** — the same five. Shared deliberately; the Studio comment says
composition means the same thing in a graveyard as in a nebula.

**Palette** (10) — blood_moon · pumpkin_fire · witchlight · ghostlight ·
poison · midnight · dead_forest · gothic_jewel · eclipse · phantom_rose

**Subject** — derived from filenames. See §2.

### Coverage

527 general files across 8 worlds; 59 are cosmos. **Checked** — the
spread is real and the World filter is worth having. Halloween coverage
was not checked; check it before building the rail, and drop any filter
value with no files behind it rather than showing an empty pill.

---

## 4 · THE LANDING · `/wallpapers`

**One screen. Two bands, four cards. No chooser into a chooser** — Rich
was explicit that landing on a page whose only job is to send you to
another page is a wasted click.

```
                    Wallpapers
        For the screen you look at most

  ── Made from your photograph ─────────────────
  [ Portraits ]            [ Pets Halloween ]
     /wallpapers/portraits    /wallpapers/halloween-pets

  ── Ready to buy ──────────────────────────────
  [ Liten & Co · 527 ]     [ Halloween · 502 ]
     /wallpapers/store        /wallpapers/store/halloween
```

**Build it on the `.wgrid` / `.world` card**, which is already in
`index.html` and is the accepted shape for this — a picture at 1:1, a
name, a line of detail, a count in gold. It is used by the Eight Worlds
fold and by the two folds added on 23 August.

**The band headings matter.** The two halves are different products —
one is a craft that costs a photograph and ten credits, the other is a
file that already exists and costs three. A customer who does not see
that distinction on this screen will meet it at checkout, which is the
wrong place.

**The Studio card comes off.** In `wallpapers.html` the rooms come from
`FALLBACK_ROOMS` (line ~834) or `window.WALLPAPER_ROOMS`. The entry to
remove is `{ id:'studio', label:'Studio', freeform:true }`. **Check both
sources** — the fallback is not the only one.

**Pets is absent, deliberately.** Add the card when the page exists.

---

## 5 · THE CATALOGUE PAGES

Two, same page with a different source:

- `/wallpapers/store` — general, 527
- `/wallpapers/store/halloween` — 502

### The filter rail

**Sticky, under the masthead, in gallery's `.jump` pattern.** That
pattern is at `public/gallery.html` line ~214 and was ported to the
community board on 22 August, so there are two working examples.

```css
position:sticky; top:var(--mh-h); z-index:50;
background:transparent;
pointer-events:none;          /* the bar is air */
```
```css
.jump-in{ pointer-events:auto }
```

Pills are **serif italic 1.5rem** on `--coffee-700`, gold when active.
**Not captions.** Rich's standing rule: action elements are visually
substantial, and an undersized control is a recurring critical
frustration.

Four filters for general, five for Halloween. Multi-select within an
axis, AND across axes — a customer picking two palettes wants both, but
picking a palette and a mood wants the intersection.

**Show a count on each pill and hide any value with nothing behind it.**
1,029 files across four axes will leave combinations empty.

### The grid

9:16 tiles. Lazy-loaded — **1,029 images will not go on one page.** Page
them, or virtualise; the board's "Show more" is the cheaper pattern and
already exists.

### The cart

**The queue rail becomes a cart, recoloured.** It is already the right
shape — a list, a total, a button. What changes is that nothing is being
crafted, so the copy changes and the button reads Buy rather than Craft.

**Checkout runs on the credit mechanism**, the same one the rooms use.

---

## 6 · PRICE — ruled 23 August

| | credits |
|---|---|
| one wallpaper | **3** |
| five | **10** |

**Note this is a different ratio from a Crafted Image**, which is 10
credits for one. Nothing here is a discount and it must not be described
as one — "off", "save" and "deal" are on the banned list. State the
price.

Where the five-pack lands when a customer has four in the cart is **not
ruled.** Ask Rich rather than inventing a rule: whether the cart nudges,
whether five is a separate product, and what happens at six.

---

## 7 · THE HOMEPAGE FOLD

Rich asked for this in the same breath and it is not built.

`public/index.html` gained two folds on 23 August — Halloween and the
pets — built on `.worlds` / `.wgrid`. **A wallpapers fold is the same
shape again** and belongs after the pets fold, before the gift.

Current fold order:

```
trip (hero) -> worlds -> likeness -> halloween -> petsfold -> gift -> gift2
```

Wallpapers goes between `petsfold` and `gift`.

**It needs four plates that do not exist yet.** The existing homepage
splash plates live in `public/previews/home/splash/`. Pick four
wallpapers from the bucket and put them there rather than hotlinking
Supabase from the homepage — the fold should not depend on a bucket
being up.

**Copy is Rich's.** Draft it, mark it as a draft in the file, and let him
judge it in place. That is what was done for the Halloween and Pets folds
and it worked.

---

## 8 · THE ORDER TO BUILD IN

**Catalogue pages first, landing second.** The landing's two new cards
point at the catalogues, and shipping the landing first puts two dead
cards in front of customers.

1. the manifest script and the registry it writes
2. one catalogue page, general, filters and grid, no cart
3. the cart and checkout
4. the Halloween catalogue — same page, different source
5. the landing rebuild, Studio card off
6. the homepage fold

---

## 9 · WHAT WAS NOT CHECKED

Stated so nobody treats this document as more certain than it is.

- **Halloween vocabulary coverage.** General was checked; Halloween was
  not.
- **Whether every one of the 1,029 names parses.** Fifteen of each were
  read. Run the parser over all of them and report what does not consume.
- **Whether the images are 9:16.** They are wallpapers and ought to be,
  but it was not verified.
- **What `/wallpapers/portraits` and `/wallpapers/halloween-pets`
  actually render.** Rich confirmed both routes work; the files were not
  read.
- **Whether a credit product exists for a 3-credit purchase.** The rooms
  charge 10 per image. Check the checkout route before assuming three
  will pass.

---

## 10 · RULES THAT APPLY

- **"Studio" does not appear in customer-facing copy** once this ships.
  The word survives in filenames and code ids, which is fine — those are
  not read by anyone.
- **Banned in copy:** sculpt · render · generate · queue · credits as a
  euphemism · off · save · discount · deal · in-situ · upload for the
  output. Say: craft · crafted · finishes · pieces · the studio.
- **Wallpapers are download-only.** Nothing here goes to the print lab,
  and the existing landing already says so in its footer. Keep that.
- **The Curator's spot carries copy about the wallpapers** — V31 ruled
  this. First person, signed `— C.`, two sentences, British spelling. He
  may not quote a price; money goes in the second register.

---

*CUI V32 · 23 August 2026*
