# CENG CARRYOVER — 2026-08-10

CENG 28 → CENG 29. Read `CENG-OPERATING-RULES.md` first.

This file records decisions and reasoning. It makes no claims about what is
currently in any file — read the live files for that.

---

## 0 · WHAT HAPPENED TODAY

Two things, in parallel, all day.

**Groups was rewritten and then pulled out of the build.** The style /
material / location / scale axes are gone, replaced by a flat catalog of 14
effects Rich approved against live renders. The engine files were written but
the transfer to disk kept failing, and after two deployment failures Rich
called it: the Groups API routes were deleted so the silo drops out of the
build entirely. **It is not being worked on.** See §3.

**Mobile Wallpapers went from nothing to 42 locked prompts.** Portraits room
at 14, Halloween room at 28, both shot and signed off by Rich in one sitting.
See §1 and §2.

---

## 1 · WALLPAPERS — THE PRODUCT

9:16, download only, never reaches Prodigi. $2.99 a piece, 6 credits. Floor
is 5 across and 3 down: fourteen effects plus an upsell card in the
fifteenth slot.

**Four rooms, settled:**

    /wallpapers/portraits    14 effects, locked
    /wallpapers/pets         NOT BUILT — this is the next job
    /wallpapers/halloween    28 effects, locked, seasonal
    /wallpapers/studio       no catalog, different model, CUI-owned spec

Groups was in the four earlier in the day and is now out — Halloween took the
slot. Rich's call, made after the survey argument in §1.1 had already been
sent to CUI, so **the reply doc in `docs/GOVERNANCE/` is wrong on this
point** and says Groups is in. Correct it or supersede it.

Halloween carries 28 rather than 14, so that room needs a toggle to flip
between halves of its catalog. CUI's control; the engine just returns 28 ids.

The seasonal room rotates: Halloween through October, Christmas from
November. It wants a rotation date the glass can read rather than a deploy.

### 1.1 · Why Groups was briefly in, since the reasoning still stands

Talker Research polled 2,000 Americans in June 2026 on what is actually on
their phone. Family members and children came first at 19%, ahead of nature
and landscapes at 11%, a personal memory at 11%, and pets at 10% — pets beat
partners and spouses at 7%. Action did not appear in the top seven.

Two things follow that are still true. **Pets is a strong room**, better
supported than most of what is in Portraits. And if Groups ever returns as a
wallpaper room, cap the subject count at three or four — the survey's top
answer is a family, not a reunion, and twelve faces at 9:16 puts every one
below thumbnail size.

---

## 2 · WHAT THE 42 PROMPTS ESTABLISHED

This is the useful part of today. Every finding came off a render Rich
looked at.

**The composition clause works and it is the whole product.** A phone
wallpaper is a picture with a clock and date across the top quarter and an
icon grid over the bottom half. A render that centres the face — correct for
a print — puts the subject exactly where the icons land. Every body carries
framing that puts the subject low.

**Thighs to head.** Not a bust, not a full standing figure. A bust leaves the
bottom of a tall frame empty; a full figure makes the face too small to
recognise at arm's length.

**Legs cut off at image bottom.** Rich's addition. It stops the render
composing as a photographed object on a plinth and makes it fill the screen.

**The top third must be OCCUPIED, not empty.** The first neon test came back
with clean sky and was dead. The fix was dim accent work — thinner tubes
running up and around the top third, dimmed. Every body since names something
quiet up there. The best solutions let something break up the moon: antlers
on Harvest God, bare branches on Hollow Tree, swarming moths on Moth King.

**NB2 draws its own phone UI if not stopped.** It produced a clock reading
"Trnday, Nep 26" on the first neon shot, and a full wifi-and-battery status
bar on The Ferryman. The wording that holds is **"do not include phone
elements"**. Naming a clock and date in the composition clause is what
invites it.

**Bust clauses had to go.** The Portraits print bodies end with "no held
objects" and "an arm or hand appears only when it is touching the body".
Both are rules for a bust and both fight a standing figure with hands.

**"do not accentuate body parts"** — added after a Clockwork render
exaggerated the figure. Carried to Balloon, Impressionist, Pencil, Bronze.
Worth adding to any effect that rebuilds the whole body in a material.

**Framing conflicts are the dominant failure.** Two framing instructions in
one prompt and the later one usually wins. This is the same shape as the
`stained_glass` failure that opened the session: `goofy`'s "soft wraparound
illumination" cancelled the body's "internally lit with nice falloffs" and
the render collapsed from 3D to 2D. **There must only be one instruction per
axis.**

### 2.1 · Still open on the prompts

**The likeness lever has three scales in play.** "keep 60% likeness",
"likeness should be at least 80%", and plain "likeness unmistakable" all
appear across the Halloween room. They were tuned in isolation from each
other. Settle on one before either room ships.

**Two Halloween effects are near-neighbours.** The Ferryman and Lantern
Keeper are both hooded figures with a blue-green lantern in graveyard mist.
They read differently at full size, not from a thumbnail. Do not let them sit
adjacent in the grid.

**Clockwork Corpse puts a huge lit clock face in the top third**, where the
phone's own clock goes. Check on a real screen.

**Headless Horseman varies run to run.** The head must read as severed and
held out; when it renders still attached the concept is lost.

**Victorian and Renaissance and Persian Court are gendered pairs** —
separate `_woman` bodies. All six are locked. Portraits' 14 tiles are
therefore 14 ids where three are pairs.

**Preview plates.** Every wallpaper effect needs a 9:16 preview. The existing
`public/previews/effects/<id>/man@2x.jpg` are portrait-shaped and will
letterbox in a five-across phone grid. `public/previews/wallpapers/` exists
in the repo now; coverage unknown.

---

## 3 · GROUPS — OUT OF THE BUILD, NOT BEING WORKED ON

Rich's call after two failed deploys. `app/api/v1/groups/` was deleted, so
nothing imports the lib and Turbopack skips the folder.

**Do not pick this back up without Rich saying so.**

What exists, for whoever inherits it:

`lib/v1/groups/groups-effects.ts` is committed and holds 14 approved bodies
in a flat catalog with a runtime framing clause. That file is good.

The generator, shared and route rewrites were written but **never landed on
disk**. `groups-generator.ts` and `groups-shared.ts` in the repo are the old
versions; shared was reverted with `git checkout HEAD~1` to restore the
build. The rewrites are in the session outputs only.

`groups-experimental.ts` and `app/api/v1/groups/raw-gpt-image/` were deleted.

**One real bug found and fixed in the rewrite that never shipped:**
`MAX_SOURCE_IMAGES` was 4. The multi-photo composites take one photograph per
person — Family Impressionism composes five — so the fifth reference was
being silently dropped in the slice and the render came back with four faces
and no error. NB2's real ceiling is 14.

**Groups age rule, agreed with Rich, parked pending legal review:** refuse
when the set is a lone minor or all minors; allow when an adult is present.
Needs per-face age from analyze — the existing `age_group` field describes
the hero subject only, so a group with an adult in front passes regardless of
who else is in frame. Rich is initiating the legal look. Do not build it.

---

## 4 · OUTPAINT — REBUILT, TWO MODES

`lib/v1/shared/outpaint.ts` is committed. Ports Rich's own
`scripts/outpaint-splash.mjs` to buffers: same endpoint, same creativity of
0.35, same 2000px ceiling.

**Mode `aspect`, wallpapers.** Pads up and down to 9:16, biased 70/30 upward
so the clock lands on air. **This is a fallback, not the plan** — NB2 renders
9:16 natively, and when it does the call is a no-op returning the original
untouched. The composition clause in each body should be doing the work.

**Mode `margin`, Groups.** Pads all four sides at 8% of the long edge. NB2
does not leave margins and every Groups render crops at the frame edge. Rich
set 8%; tune on renders.

Non-fatal by design. Any failure returns the original buffer with a reason
string.

---

## 5 · WHAT TO UPLOAD NEXT SESSION

For Pets wallpapers, which is the next job:

- `CENG-OPERATING-RULES.md`
- this carryover
- `PETS-SPEC-2026-08-02.md`
- `pets-silos-2026-08-02.json`
- the live `lib/v1/pets/pets-prompt.ts` and `pets-shared.ts`
- the live `lib/v1/wallpapers/wallpapers-shared.ts`,
  `wallpapers-registry.ts`, `wallpapers-halloween.ts`

**Do not upload the Groups files.** That work is parked.

**Project-knowledge `.ts` copies drift. Always ask for the live file.**

### 5.1 · A transfer problem that cost real time today

Downloading a `.ts` file on Rich's machine opens it in an editor rather than
saving it. Two deployment failures came from files that were believed to be
on disk and were not — the build error named line 42 of a file that had never
changed.

**Before claiming a file landed, have Rich grep for a string that only exists
in the new version.** Do not infer it from a commit message or from the file
appearing in a list.

---

## 6 · THE NEXT TWO JOBS, IN ORDER

### 6.1 · Pets wallpapers — 14 effects

Same port as Portraits. Read `PETS-SPEC-2026-08-02.md`, pick 14 with Rich,
strip any framing sentence from each body, and apply what §2 established.

The one open question specific to Pets: **thighs-to-head is a human framing
instruction.** A dog or a cat needs its own equivalent — probably
chest-to-head for a large dog and full-body for a small animal, but that is
Rich's eye, not a rule to invent. Ask before writing it into fourteen bodies.

Add `PETS_WALLPAPERS` to `wallpapers-registry.ts`; the import is already
stubbed there with a comment.

### 6.2 · Batch test everything at 4:5

Rich wants all Halloween and Pets prompts run at **4:5** as well as 9:16, to
see which effects also work as print pieces for the Series.

This is a shoot, not a code change. Notes for whoever builds it:

**`shoot-review.js` reads `j.prompt`** — full prompt text embedded per row. A
manifest of effect ids alone sends `undefined` to NB2 once per row. This has
bitten before.

**Any script rendering outside the app must reproduce the engine's own
resolution**, or emit rows the engine would have produced. The dinner-jacket
error came from a manifest that assigned male bodies to female sources
because the script skipped `resolvePresetForSubject`. Portraits' three
gendered pairs make this live again.

**The composition clause is 9:16-specific and will be wrong at 4:5.** Every
body says the figure fills the lower two-thirds with the top third clear.
That is a phone instruction. At 4:5 it will produce a print with a third of
it empty. The shoot needs either the clause stripped or a 4:5 equivalent —
**ask Rich which before rendering 42 images**, because it is the difference
between a useful test and 42 wasted renders.

**The "do not include phone elements" clause should stay** at any aspect. It
costs nothing and NB2 invents UI unprompted.

---

## 7 · ERRORS MADE TODAY

**Sent file-transfer commands three times against a download that had never
happened.** Rich said "I'm not fighting anything, these are your commands"
and he was right. When a path does not exist, stop issuing variations of the
same command and find out what actually happened.

**Told Rich the Halloween commit had not landed** by reading an untracked
list, where committed files do not appear. Read the log, not the absence.

**Sent CUI a document arguing Groups into the wallpaper lineup** an hour
before Rich replaced it with Halloween. The survey reasoning was sound; the
recommendation was made before he had ruled.

**Assumed the wallpaper generator's freeform path was needed.** The Studio
spec has no prompt box at all — four dropdowns and a slider — so the
moderation concern CENG raised twice was about a product nobody is building.
That path should come out of `wallpapers-generator.ts`.
