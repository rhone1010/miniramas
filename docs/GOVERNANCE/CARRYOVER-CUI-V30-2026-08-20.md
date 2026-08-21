# CARRYOVER — CUI V30 — 20 August 2026

For CUI V31.

**Before anything: read `docs/GOVERNANCE/READ-THIS-FIRST.md`, then read this
folder.** Not the newest file — the folder. The document that settles your
question is usually not the most recent one. That rule was written today
because the same fault happened three times before lunch.

---

## RICH'S PRIORITIES — WHAT V31 IS FOR

These are the session's goals. Everything else is an obstacle in front of
them. Detail in THE ROAD.

1. **Pets, split into two rooms** — Pets Portraits and Pets Halloween.
2. **Halloween** as a Series of its own.
3. **Wallpaper Pets** and **Wallpaper Pets Halloween** rooms.
4. **The Studio is turned off** — both Halloween and Regular. Paused, not
   removed.
5. **Studio becomes a two-card gallery chooser** — Regular and Halloween,
   premade wallpapers, bought directly.
6. **The nav is rebuilt in two levels** once the above exist.

Rich has the prompts and the previews built for all of it. The work is
glass.

---

## HOW A SERIES PAGE GETS BUILT

`scripts/build-groups-page.py` is the working example — it transformed
`portraits.html` into `groups.html` by forty-eight anchored edits, and it is
re-runnable against a fresh `portraits.html`.

**START THE NEXT CLONE WITH TODAY'S FIXES ALREADY IN IT.** Every one of
these was found on the Groups clone after it shipped, and every one will
recur in Pets and Halloween unless the build script carries them:

- **`openWaiting()` hard-codes `series:'Portraits'`.** A craft in progress
  filed itself under the wrong room, so the spinners vanished when you
  filtered to Groups and the piece appeared from nowhere when it landed.
  `savePiece` had the identical bug and the harness caught that one.
  **On any Series clone, grep for a quoted Series name anywhere outside
  `SERIES_LABEL` and `MC_SERIES`.** Those two are lookup tables and are
  meant to carry all of them. Everything else is a leftover.
- **The pose step.** Groups has no poses; the click handler had already
  been short-circuited but the button still said "Next · choose a pose,
  Step 1 of 2" and then charged. Two lies in three lines.
- **`--card-ratio`.** Inherited as `.78`, which is right for portrait
  plates and wrong for square ones. Groups plates are 1180x1180 and a fifth
  of every one was being cropped — on a group photograph, that is whoever
  is standing at the edge. **Ask what shape the plates are before cloning.**
- **The lorem footer.** Five bays of placeholder shipped live on Groups.
- **The paywall gate, the panel boot hook and Post to Community** all had to
  be run against `groups.html` separately after the fact.

`patch-groups-square.py` is worth reading before building another floor. The
finding in it: two `1fr` rows in a fixed-height room take their height from
the viewport, so a card can never be square however wide the floor gets.
Trimming the rails bought 38px of a 87px gap. Content-sized rows plus a
centred floor is what actually worked.

---

## THE STUDIO IS PAUSED

**Both Halloween and Regular.** The freeform four-dropdown UI is turned off,
not deleted. `/wallpapers/studio` currently maps to
`public/wallpaper-studio-V002.html` in middleware.

**What replaces it:** a two-card selection stage — Regular and Halloween —
leading to galleries of premade wallpapers that are **bought directly**. No
craft, no credits gate on the way in, no Curator rail.

Rich's phrasing for Pets is the same shape: "a no-curator two-card selection
stage to get to the next level." The pattern is worth building once and
using in both places.

**Studio open items become moot while it is paused,** but do not delete
them — `session_id` is never sent, `reason:"capped"` falls into the generic
error, and the field reads dim. All still true, all parked with the room.

---

## WHAT SHIPPED TODAY

Everything below is merged to `main` through PR #12.

**Groups went live.** It was in `.vercelignore` under "series out of scope
for Aug 1" the whole time — the page was built, merged and mapped, and the
file never reached the deployment. `public/pets.html` was on the same list
and has been taken off. `actionmini.html` stays excluded; **Rich's ruling:
Action is not going live for some time, and it needs a rename when it does.**

**The Groups plates** — twenty-eight, resized 9.1MB to 2.3MB, committed, and
the registry rebuilt to derive `previews/groups/groups_<id>.jpg` from the id
rather than carry a lookup table.

**Groups floor** — square cards, Curator rail 460→330, queue 330→250, gutter
100→64, room gap 20→16.

**The Halloween wallpaper room was reconciled.** Eight rows on the page had
no engine effect behind them; four of those had plates and looked entirely
real — Mummy, Victorian Spirit, Pumpkin King, Bone Collector would have
taken credits and failed. Swapped for eight that were built but never
offered. All twenty-eight now have an effect and both plates.

**Wallpaper type** — thirty rules were under the brand floor across three
bands. Two were *inverted*: the base `.set-btn` and craft button sat below
what the 1600 and 1400 bands set, so they grew as the screen narrowed.

**Nav, panels and routing** — Groups added to the Series dropdown; Gallery
given the Series switcher and the same four links; `/collection`, `/account`
and `/print` mapped in middleware and opening their panels on arrival, all
three having 404'd for everyone.

**My Collection** — Download, Send to Print Shop, Craft this again and Post
to Community now sit under the featured piece, painted per piece using the
lightbox's own rules.

**Post to Community was built.** The board had been readable, heartable and
commentable since V28 with no way to put anything on it. That is why it has
never had a real post through it. **Putting one piece through it is still
the first thing worth doing.**

**Community sign-in** — `posts/route.ts` has three fallback returns and none
carries `signed_in`, so a failed board read told a signed-in customer to
sign in. The glass now guards against it; the route should still be fixed.

**Soft launch paywall** — while `SOFT_LAUNCH` is true the two browse doors
to the buy panel open only at a zero balance. The shortfall door is never
gated. `SOFT_LAUNCH = false` in `public/portraits.html` reopens the shop.
**Note: `groups.html` has no paywall gate — it was cloned before this
existed.**

---

## THE FILE RECORD — READ THIS BEFORE WRITING ANY SCRIPT

`docs/GOVERNANCE/FILE-TRACKING.md` is the standing instruction. Summary:

**Any script that creates, moves, copies or renames a file must record it.**
Every one, not the important ones. Everything lands in
`H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv`.

```powershell
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) { . $TrackerPath }
else { Write-Host "FileOps-Tracker.ps1 not found - UNTRACKED." -ForegroundColor Red }
```

Then `Invoke-TrackedMove` / `Invoke-TrackedCopy` / `Invoke-TrackedRename`
instead of the raw cmdlets, `Register-GeneratedFile` for anything produced,
and `Start-TrackedBatch` / `End-TrackedBatch` around loops with the end in a
`finally`.

**NO DELETIONS. EVER.** No `Remove-Item`, no `del`, no `rm`, no
`git checkout` to discard. Anything being replaced goes to
`H:\NO_DELETE_ARCHIVE` first, via `Install-File.ps1` or `Archive-File.ps1`.
No log is truncated, rotated or replaced. If a task appears to need a
deletion, say so and stop.

**The machine is AllSigned.** Every PowerShell call needs
`-ExecutionPolicy Bypass`, including a dot-source from an interactive
prompt. `. .\scripts\FileOps-Tracker.ps1` on its own fails; it has to be
`powershell -ExecutionPolicy Bypass -Command ". .\scripts\...; Invoke-..."`.

**The Python gap.** The tracker is PowerShell. Every patch script in this
session is Python and none of it produced a row. That gap is recorded
deliberately in FILE-TRACKING.md. `scripts/make-cui-session-log.py`
reconstructs a session's file actions in the tracker's own column order;
today's output is at
`H:\NO_DELETE_ARCHIVE\Logs\FileActions_2026-08-20_CUI-session.csv`.
**Write one at the end of every session.**

---

## PROCESS — THE THING THAT COST THE MOST TODAY

Every expensive mistake today, in both lanes, was one shape: **asserting the
state of the work instead of reading it.**

**The Groups plate contract.** A handoff said every plate was
`groups_<id>.jpg` and the path therefore derived. The directory disagreed on
twenty-three of twenty-eight.

**The Community rebuild.** CUI wrote a framing document specifying handles,
comments, hearts and moderation without opening `app/api/v1/community`,
where seven finished routes and a spec already existed. CENG built a
parallel set from it. All of it archived back out. **The document carried a
warning against exactly that, at the top, in bold.**

**A stale "still owed".** CUI demanded the `collection_pieces` columns and
the `studio/kept` route in a handoff. Both had been delivered the day
before.

**`/groups` 404ing.** Three rounds of theorising about middleware and
deploys. It was one line in `.vercelignore`. Nobody had opened the file.

**The credit gate.** Reported as broken with 147 credits in hand. Analyze
was healthy, the price was right, and the gate was doing its job. The actual
fault is that a gate refusal for *any* reason opens the credits panel and
says "your pieces are held while you decide" — so a refusal about counting
faces reads as a refusal about money. **That fix is still not made.**

The rule that follows: **never write a command, or a document, that depends
on a fact you have not confirmed in this conversation.** One round trip
costs a minute. Getting it wrong cost hours, repeatedly, in the last stretch
before a launch.

And: **the longer a session runs, the more explicitly the rules need
re-reading.** Fluency late in a session is not competence.

---

## DELIVERY DISCIPLINE

- Every script ships with its install command, its dry run **and** its
  apply, in the same message. Rich is juggling ten things and should not
  have to ask twice for the second half.
- `-From` is always explicit and always a full path. Downloads holds only
  what was handed over minutes ago.
- Nothing is built on top of a file until Rich confirms it landed.
- Every edit is an anchor-replace Python script, dry-run by default, with
  pre-write assertions. **Several assertions fired today and every one was
  right to** — including three that caught the patch's own comment quoting
  the string it was checking for. Nothing was ever written while an
  assertion failed.
- Assertions using absolute counts break the moment two patches meet. Count
  relative to the original, or assert the definition rather than the
  references.

---

## THE ROAD

**1 · Pets, split.** A two-card selection stage, no Curator, leading to
Pets Portraits and Pets Halloween. `public/pets.html` exists, is now
unignored, and **CUI has never opened it** — read it before assuming it is a
clone target or a starting point.

**2 · Halloween as a Series.** No `halloween.html` exists. Ask what shape
the plates are before choosing a card ratio.

**3 · Wallpaper Pets and Wallpaper Pets Halloween.** The wallpaper registry
has `PETS_ROWS: WallpaperRow[] = []` — not written, and it needs a framing
ruling from Rich, because thighs-to-head is a human instruction and a dog
needs its own. `public/previews/wallpapers/halloween-pets/` already holds 27
single plates with no sitter prefix.

**4 · The Studio off, the gallery chooser on.** Two cards, Regular and
Halloween, into galleries of premade wallpapers bought directly.

**5 · The nav, two levels.** Level one: Portraits, Groups, Halloween, Pets,
Wallpapers. Level two under Wallpapers: Portraits, Halloween, Pets.
**Build it after the pages exist, not before.** The same masthead lives in
five files and three have already drifted — `wallpaper-studio-V002.html`
still lists only Portraits and Wallpapers.

---

## STILL OPEN

- **A gate refusal for any reason opens the credits panel.** The one real
  bug found in tonight's credit chase, and it is still there.
- **`groups.html` has no soft-launch paywall gate.**
- **The board has never had a real post through it.** Posting exists now.
- **`man_headless_horseman.jpeg`** — Halloween's last missing plate. Rich
  made it; confirm it landed.
- **Plates on disk matching no id:** `plushie` in portraits wallpapers,
  `forest_revenant` and `gargoyle` in halloween.
- **`elegant_vampire`** — the engine id does not match what Rich calls it.
  Plates were renamed to match the engine; **changing the id is the
  post-launch fix.**
- **`/api/v1/invite/claim` returns 500.** Seen in the console on `/groups`.
- **Access code allocation is ruled but not built** — see
  `SOFT-LAUNCH-ALLOCATION-2026-08-20.md`. Two tiers, 50 and 80. The gate
  card still promises 80 to everybody. `valid()` in middleware compares the
  cookie against *the* code and needs membership instead.
- **Community hearts** — one free heart per browser, then the invitation.
  Ruled, needs CENG.
- **`emit-groups-registry.js` still emits `plate` rows** and will undo the
  derived-path rebuild if it runs.
- **Mobile Wallpapers cannot take a photograph at all.** `#slot` is a button
  with no handler, no file input and no state. Not a gate to add — an
  upload to build.
- **Age gating for Groups: parked pending legal review. Do not build it.**

---

## THE DOCUMENTS CUI V31 NEEDS

Read in this order.

```
docs/GOVERNANCE/READ-THIS-FIRST.md              the standing rule. First, always.
docs/GOVERNANCE/FILE-TRACKING.md                how scripts record what they do
docs/GOVERNANCE/FILE-PLACEMENT.md               how files move
docs/GOVERNANCE/CARRYOVER-CUI-V30-2026-08-20.md this document
```

Then, for the work:

```
docs/GOVERNANCE/CENG-CARRYOVER-2026-08-20.md          the engine's state
docs/GOVERNANCE/CUI-CENG-COMMUNITY-RULINGS-2026-08-20.md   supersedes the framing doc
docs/GOVERNANCE/SOFT-LAUNCH-ALLOCATION-2026-08-20.md  access codes and the paywall
docs/GOVERNANCE/COMMUNITY-BOARD-SPEC-2026-08-10.md    the board, as built
docs/GOVERNANCE/CENG-CUI-GROUPS-2026-08-19.md         the Groups contract
docs/GOVERNANCE/CENG-CUI-GROUPS-CORRECTION-2026-08-19.md   corrects section 2
docs/GOVERNANCE/PETS-SPEC-2026-08-02.md               needed for Pets wallpapers
```

**Archive, superseded:** `CUI-CENG-COMMUNITY-2026-08-20.md`.

Files to read rather than assume about:

```
public/pets.html                                never opened by CUI
lib/v1/wallpapers/wallpaper-registry-rows.ts    PETS_ROWS is empty
lib/v1/groups/groups-effects.ts                 the shape a Series catalogue takes
public/groups-registry.js                       what a glass registry looks like
scripts/build-groups-page.py                    the clone, working
scripts/patch-groups-square.py                  the floor geometry finding
.vercelignore                                   check before believing a 404
```

---

*CUI V30 · 20 August 2026*
