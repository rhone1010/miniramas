# CUI -> CENG · WALLPAPERS COORDINATION · 2026-08-10

`docs/GOVERNANCE/`

From the glass lane. Everything below was ruled with Rich today. Nothing here
is a proposal — where something is still open it says so.

---

## THE SHORT VERSION

Wallpapers became four rooms under one root, and one of those rooms has no
photograph in it at all. The names in the repo predate that and are now
misleading. This asks CENG for two things: a rename, and a 9:16 generation
path.

**Nothing in `portraits.html` or the Portraits pipeline changes.** The glass
lane has not touched the portrait engine and is not asking anyone else to.

---

## 1 · THE RENAME

`portrait-wallpaper` was an honest name when wallpapers were only made from
portraits. There are now four silos, one of which takes no photograph, so the
name says something untrue on every file that carries it.

**Glass side, CUI is doing:**

    public/portrait-wallpaper.html   ->  public/wallpapers.html
    (new)                                public/wallpaper-studio.html
    middleware.ts PAGES entries      ->  the five routes below

**Engine side, asking CENG to do:**

    app/api/v1/portrait-wallpaper/analyze/route.ts
    app/api/v1/portrait-wallpaper/generate/route.ts
              ->  app/api/v1/wallpapers/analyze/route.ts
                  app/api/v1/wallpapers/generate/route.ts

Also worth a sweep for `pet-wallpaper`, which is in middleware's page map and
points at a file for a Series that does not exist yet.

**Do it now rather than later.** Nothing depends on these paths yet — the
glass that would call them is not built. In a fortnight it will be, and the
rename becomes a coordinated change across two lanes instead of a rename.

---

## 2 · THE ROUTES

Middleware matches exact paths, so every one needs its own entry.

    /wallpapers             the stage, four silos          wallpapers.html
    /wallpapers/portraits   |
    /wallpapers/pets        |- same file, same rail        wallpapers.html
    /wallpapers/groups      |
    /wallpapers/studio      no upload, no Curator          wallpaper-studio.html

Portraits, Pets and Groups share one file deliberately: same Curator rail,
same upload, same craft loop. Only the intake shape and the effect list
differ. Three files would be three copies of the rail and three places to fix
one bug.

---

## 3 · WHAT THE GLASS WILL SEND

**Format.** 9:16. Rich's ruling.

**Floor.** 5 across, 3 down. Fourteen effects plus one upsell card fills the
room exactly. Four rooms, so **56 effects total** when all four exist.

**Price.** $2.99 a piece, **6 credits**. The market will not bear the $4.99
portrait price for a phone screen even though our cost is the same.

**Print.** Wallpapers are download-only and must never reach Prodigi. Already
enforced on the glass — `printable()` in `portraits.html` now returns false
for any series whose name contains "wallpaper", so the Send to Print Shop
button does not render on a wallpaper piece in My Collection or in the
lightbox.

**This is the one thing that needs matching engine-side.** The glass rule is a
courtesy, not a guarantee — anybody can call the print endpoint directly. If
`/api/v1/print/*` will accept a wallpaper piece today, it should refuse one.

**Series naming, and why it matters.** The glass matches on the WORD
"wallpaper" appearing in `collection_pieces.series`, case-insensitive, rather
than on an exact id. So whatever the engine writes into that column must
contain it — `wallpaper`, `wallpapers`, `portrait-wallpaper` all work;
`mobile-9x16` would silently give every wallpaper a Print button. If CENG
wants a series id without the word in it, say so and the glass will match on
an explicit list instead.

---

## 4 · THE STUDIO — A DIFFERENT PIPELINE ENTIRELY

`/wallpapers/studio` is not the craft loop with a different aspect ratio. It
is a separate product that happens to live under the same root.

Full spec: `docs/GOVERNANCE/LATENT-CODE-STUDIO-SPEC-2026-08-10.md` — note
that "Latent Code" was a name Rich has since dropped; the spec's mechanics
stand, the brand name does not.

What CENG needs from it:

**No photograph. No prompt box. No LLM anywhere in the pipeline.** The user
picks World, Mood, Palette and an Energy slider; the prompt is string
concatenation over those four. Calling Claude or 4o-mini to "improve" the
prompt would add a second of latency and a cost per generation to a product
whose whole advantage is being instant and nearly free.

**Model: `black-forest-labs/flux-schnell` on Replicate.** $3 per thousand
output images — 0.3 cents each, read off the model page on 10 August 2026.
Marked Warm, so no cold start. Marked Commercial use.

**HARDCODE THAT STRING. Never read it from config or an environment
variable.** `flux-schnell` is Apache-2.0 and sellable. `flux-dev` is
NON-COMMERCIAL, ten times the price, and one word away in the same namespace.
A typo in a config value would mean selling images we have no right to sell,
and nothing in the product would look wrong.

**Preview small, render on purchase.** Generate four at 768x1344, watermark,
show them. Only the chosen one goes to full phone resolution. Nobody pays for
full res on three images they did not want.

**Prompt components are data, not code.** 8 worlds x 6 moods x 9 palettes x 5
energies is 2,160 combinations; storing them as complete prompts means the
first request to change how "Ember" reads touches 240 strings.

---

## 5 · WHAT THE GLASS STILL NEEDS

To build the wallpaper floor:

- **The effect list per silo**, from the registry, with the same shape the
  Portraits floor consumes. Fourteen live effects per room.
- **Whether `analyze` behaves the same at 9:16** — the glass gates effect
  selection on a photograph being present and on the analyze verdict. If the
  wallpaper path returns a different shape, the gate needs to know.
- **The series string** that will land in `collection_pieces.series`, per
  section 3.

For the Studio:

- The four matrix vocabularies as data the glass can render, or confirmation
  that the glass owns them and the engine only receives the built prompt.

---

## 6 · WHAT CUI HAS ALREADY CHANGED TODAY

So nobody re-reads a file and finds it moved:

- **`middleware.ts`** — gate cookie went from session-only to 30 days idle
  refreshed (the passcode was being asked for on nearly every visit);
  `/community` added to PAGES.
- **`portraits.html`** — masthead nav is now Gallery, Community, My
  Collection, Account. Print Shop and Help left the bar. The Series menu had
  Action, Groups and Pets removed — none of the three is in PAGES, so all
  three were 404ing. `printable()` extended for the wallpaper rule.
- **`gallery.html`, `help.html`** — Community added to nav.
- **`concierge.js`** — docked panel in the workshop, can pulse a named
  control, message-taking now only on `/help`.
- **New: community board** — six tables in `018_community.sql`, an award
  function in `020_community_reward.sql`, nine routes under
  `app/api/v1/community/`, and `lib/v1/_core/text-moderation.ts` (TEXT, via
  OpenAI's free omni-moderation endpoint — separate from CENG's image
  `moderation.ts`, which is untouched).

Note `019` is deliberately left free for the `support_messages` migration
sitting untracked. It was written as `016`, which is already `error_log`.

---

## 7 · ONE THING THAT COST A SESSION TODAY

Worth carrying into the engine lane because it is a whole-file class of bug,
not a glass one.

The wallpaper rule was nearly written as a second function called
`printable()` in a scope that already had one, six hundred lines away. Earlier
the same day, the sitter coin on the effect floor was dead for exactly that
reason: `coinFor` was declared twice in one scope, `var COIN` twice, the later
pair winning silently. Every card fell back to the man's plate and the code
read as correct in isolation.

**Before adding a top-level function or var to a long file, grep the file for
the name.** It cost most of a working session to find, and the fix was a
rename.

---

*CUI · 10 August 2026*
