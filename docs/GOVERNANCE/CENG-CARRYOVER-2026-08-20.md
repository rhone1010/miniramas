# CENG CARRYOVER — 2026-08-20

`docs/GOVERNANCE/CENG-CARRYOVER-2026-08-20.md`

**Read `docs/GOVERNANCE/READ-THIS-FIRST.md` before anything else, then read
this folder — the whole folder, not the newest file.** Rich's standing
instruction, 20 August. A decision you have not read is a decision you are
about to make again, differently.

This file records what was decided and why. **It makes no claim about what
is currently in any file.** Read the live files for that — see §5, which is
the most important section here.

---

## 0 · WHAT HAPPENED TODAY

A long day. Groups finished and locked at 28. Pets rebuilt from 20 effects
to 34 and wired into the craft path. Both Halloween rooms proven at 1:1. The
Studio completed end to end. A file-operation audit trail built and working.

And three failures of one kind, all documented in §5 because that pattern
cost more time than everything else combined.

---

## 1 · FILE MANAGEMENT — NON-NEGOTIABLE

Two governance documents are now in the repo and both are law:

```
docs/GOVERNANCE/FILE-PLACEMENT.md   how files enter and leave
docs/GOVERNANCE/FILE-TRACKING.md    how they get recorded
```

### Nothing is deleted. Nothing is overwritten in place.

Never suggest `Remove-Item`, `del`, `rm`, or `git checkout` to discard
working changes. Never write one file over another with `Copy-Item` or a
redirect. If a task appears to need a deletion, say so and stop.

### Files enter through Install-File, leave through Archive-File

```
powershell -ExecutionPolicy Bypass -File .\scripts\Install-File.ps1 <repo\relative\path>
powershell -ExecutionPolicy Bypass -File .\scripts\Install-File.ps1 <target> -From "$HOME\Downloads\<name>"
powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 <repo\relative\path>
```

Both archive to `H:\minramas\...` with sequential `_001` numbering. The
`-ExecutionPolicy Bypass` prefix is mandatory — the machine is `AllSigned`.

**Give the command in the SAME message as the file it installs, never as an
example.** Rich ran three example commands as if they were instructions
today, because they were formatted identically to real ones. Downloads is
short-term staging: if a file is not in Downloads it is either already
placed or needs re-delivering.

### Every install is proved by grep, not by the install output

```
findstr /C:"<a string only in the new version>" <path>
```

Not from a commit message, not from a directory listing, not from its
absence in an untracked list. Two deployments have been lost to files
believed to be on disk that were not.

### `npm run dev` is NEVER run

It corrupts Windows logging. To check a build: `npx tsc --noEmit`, which
writes nothing and exits.

**Note that `tsc --noEmit` checks the whole tree** including `scripts/`,
`docs/` and `_route-collection/`, which Next never compiles. A long error
list is not a broken build — separate yours from the pre-existing ones
before reacting.

### File tracking is live and working

`scripts/FileOps-Tracker.ps1` is dot-sourced by five scripts. Every move,
copy, rename and generated file lands in:

```
H:\NO_DELETE_ARCHIVE\Logs\FileActions_<YYYY-MM-DD>.csv
```

One file per day, every script appending to it. That IS the master record.

**Any new script that creates, moves, copies or renames a file must use it.**
`Invoke-TrackedMove` / `Copy` / `Rename`, `Register-GeneratedFile` for
generated output, `Start-TrackedBatch` / `End-TrackedBatch` around loops with
`End` in a `finally`.

Five faults were found and fixed in the tracker on 20 August. **Do not undo
them:** the call stack is walked past the tracker rather than counted (a
fixed depth can never reach the caller); the CSV append retries then shouts;
a logging failure never aborts the file operation; `Get-SafeHash` returns
`NO_FILE` and `HASH_ERROR` as distinct answers; and H: being absent does not
stop a script loading.

**Known gap, accepted:** ~130 Python scripts and the Node batch scripts are
invisible to the tracker. Recorded so nobody reads the CSV in a month and
concludes the Python patches never ran.

---

## 2 · HALLOWEEN — TWO ROOMS, BOTH PROVEN AT 1:1

```
lib/v1/wallpapers/wallpapers-halloween.ts        28 human effects
lib/v1/wallpapers/wallpapers-pets-halloween.ts   27 pet effects
```

Plates: `public/previews/wallpapers/halloween/` (gendered `man_`/`woman_`)
and `public/previews/wallpapers/halloween-pets/` (27, ids minus the
`pethw_` prefix).

### The phone clause was stripped from all 55 bodies

They were written for 9:16 and said so — *"Keep subject in lower 2/3 of
image to allow for phone UI elements"*, *"Exclude the subject from the upper
1/3. This is a mobile wallpaper"*, and five more phrasings woven into
background paragraphs rather than stated as separate sentences.

At 1:1 that produces a square with a third of it deliberately empty.

**Five bodies deliberately kept their darkening upper third** — werewolf,
swamp_creature, raven_monarch, spider_monarch, porcelain_doll. They describe
atmosphere and never mention a phone, and a dark top works in a square.

**The framing now lives on the SURFACE, not in the bodies.**
`WALLPAPER_COMPOSITION` in `wallpapers-shared.ts` re-exports
`PHONE_COMPOSITION` from `lib/v1/shared/render-aspect.ts` and is appended by
the wallpaper path only. A body says what the picture is OF; the surface says
what shape it comes out in.

### Aspect lives in one file

```
lib/v1/shared/render-aspect.ts
  MAIN_ASPECT       '1:1'   litenco main
  WALLPAPER_ASPECT  '9:16'  the wallpaper rooms
  PHONE_COMPOSITION         what wallpapers append
  MAIN_COMPOSITION  ''      what main appends
```

When aspect becomes a customer choice this is the only file that changes.
**Nothing in any prompt body should carry an aspect again.**

### One thing left in the human room

`ghoul` still says *"Thighs-to-head composition occupying the lower
two-thirds"* — phone framing phrased differently from the other 27, so the
strip did not catch it. **Rich's text; flagged and left.** It is the last
phone reference in that file.

`ghoul` was also found CORRUPTED — its entry contained an escaped duplicate
of itself embedded in the body from some earlier edit. Rebuilt clean on
20 August.

### Halloween on main is NOT built

Rich's ruling: Halloween becomes its own Series with its own silos, not a
season flag on Portraits and Pets. Both the wallpaper room AND the main
Series survive — the same bodies serve both surfaces, which is what
`render-aspect.ts` was built for.

**Nothing exists yet:** no page, no route, no registry, no generator. The
bodies still sit in `lib/v1/wallpapers/`, which is misleading now that they
serve two Series. Moving them to `lib/v1/halloween/` was proposed and not
done.

This needs a page before any engine work matters. That is CUI's.

---

## 3 · PETS ON MAIN — 34 EFFECTS, WIRED

### The catalog

```
lib/v1/pets/pets-catalog-35.ts    34 whole bodies
```

Rich's list of 20 August. Thirty-two ported from
`lib/v1/portraits/portraits-bodies.ts`, alabaster rebuilt from the fragment
in `pets-prompt.ts`, **clown written new**.

Rich's numbered list ran to 35 with `ebony` written twice, at 2 and 28.

**The Pets catalog before this was 20 effects, only ELEVEN of which appeared
in the 49-effect plan of 2 August.** The plan and the disk had drifted almost
entirely apart. That is why the list is Rich's own rather than a
reconciliation.

### What the port changed, and why it is not find-and-replace

A Portraits body is written for a bust. Four kinds of clause cannot survive:

**THE SKIN-CLEARING CLAUSE.** *"Clear the skin — blemishes, spots and
blotchiness go"* is correct on a face and catastrophic on a tabby. **AN
ANIMAL'S MARKINGS ARE ITS LIKENESS** — they do for a pet what facial
structure does for a person — and that sentence deletes them. Removed from
every body and replaced by the opposite instruction.

**FRAMING.** Bust rules. Replaced by full body nose to tail, head at about
20% — Rich's figure.

**HELD OBJECTS and the arm-and-hand rule.** Rules for a bust with hands.

**HUMAN LANGUAGE.** This one was got WRONG first time and shipped a render of
a man. See §5.

### The shared tail

Every body ends with the same paragraph: full body, **head and neck only for
a horse**, markings are the likeness, head at 20%, collar and tags welcome as
identity rather than props.

The horse rule came from the shoot: nine effects drew a horse source and all
nine came back as a small animal in a large field. Re-run with head and neck,
the same nine were the strongest pieces in the set.

**It is repeated per body rather than appended at build time** because these
were shot first and a body that carries its own rules can be pasted into a
browser and tested alone. It is a candidate to become one appended constant —
the same lesson as the Halloween phone clause.

### The craft path

`pets-generator.ts` now has **three** prompt paths, resolved in this order:

1. **catalog** — `PETS_35[preset_id]`, a whole approved body
2. **experimental** — the Curiosities, `buildPetExperimentalPrompt`
3. **material** — the composed pipeline, `buildPetsPrompt`

Both the catalog and the composed path are kept deliberately. The composed
path can express a material the catalog has no body for and carries the coat
and feature notes from Stage 0; the catalog carries effects that are a whole
IDEA rather than a surface — Clown, Persian Court, Ukiyo-e — which no
phrase-and-block assembly was going to reach.

`app/api/v1/pets/generate/route.ts` accepts catalog ids on `preset_id` and
returns both lists on a bad one.

### The aspect bug

`pets-generator.ts` called `defaultAspectForStyle`, **which ignores its
argument and returns `'3:4'`** — a leftover from a style axis that no longer
exists. Every Pets craft on main was portrait-shaped while the approved
plates are square. Now `MAIN_ASPECT`.

### Species detection

`analyzePetSourceSet` in `pets-refine.ts` now returns `species` — dog, cat,
bird, reptile, horse, other — alongside `pet_coverage`. Both early-return
fallbacks set it.

`petFramingClause(species)` lives in the same file: horse gets head and neck;
**bird gets the perch named**, because a bird with nothing under its feet
floats and NB2 invents a plinth that fights the material; reptile gets snout
to tail with the frame widening; everything else full body.

**`other` is the fallback and takes full-body framing.** A bad guess of
`horse` would crop a dog to its head, which is worse than a horse rendered
whole.

**NOT YET WIRED into `buildPetsPrompt`.** The catalog bodies carry the horse
conditional themselves and it worked on all 34, so this is a refinement — it
makes the framing deterministic rather than leaving it to NB2's judgment.

### Plates

`public/previews/pets/pets_<id>.jpg` — 34 files, 800×800, quality 72,
resized from the 1024 originals with `Resize-Plates.ps1`. The full-size
renders remain at `H:\minramas\public\previews\pets\35\`.

### What is left

**The page.** `public/pets.html` is 5,938 lines and CUI's. It needs the 34
ids and the new plate paths.

**Two pre-existing type errors** in the live Pets path, both one-line fixes
in `pets-shared.ts` and both older than today:

- `experimental_effect` is READ in six places and DECLARED nowhere on
  `PetsGenerateRequest`. The Curiosities path compiles only because Next's
  build is less strict than `tsc`.
- `preset_id` can be `undefined` where the type says it cannot.

---

## 4 · PETS WALLPAPERS — DERIVED, NOT DUPLICATED

```
lib/v1/wallpapers/wallpapers-pets.ts
```

The same 34 effects at 9:16. **The bodies are imported from
`pets-catalog-35.ts` and ONE PARAGRAPH is swapped.** Change what Bronze looks
like and both rooms get it.

Three instructions reverse for a phone:

- the animal is **CUT OFF at the bottom edge** rather than standing complete
  — Rich's finding in the Portraits room: it stops the render composing as an
  object on a plinth and makes it fill the screen
- the head goes to **20–30%** rather than 20% — a phone is looked at from
  arm's length for two seconds
- the top third is **OCCUPIED but quiet**, dim material-appropriate content,
  never empty sky. An early neon test came back with clean sky and was dead.

Horses still get head and neck, more so here.

**If a body loses the standard tail the module THROWS at load** rather than
silently shipping a print composition to a phone.

Registry is at **103 ids**: Portraits 14, Halloween 28, Pets Halloween 27,
Pets 34.

**Not yet shot.** `scripts/batch-pets-wallpapers.ts` is written and installed;
no plates exist at `public/previews/wallpapers/pets/`.

---

## 5 · THE FAILURE THAT COST THE MOST — ASSUMING INSTEAD OF READING

**Four instances in one day. All the same shape.**

### The Community rebuild

CENG designed a whole schema and five routes from CUI's framing document
without running a single query against the database. **Seven tables and seven
finished routes already existed**, with handles, comments with a moderation
state machine, rewards, and a consent record CENG's version had lost.

All of it was archived back out. The check was one query:
`select table_name from information_schema.tables`.

The framing document itself carried a warning against exactly this, at the
top, in bold.

### The Persian Court render

The Portraits-to-Pets port substituted `subject` and **never touched
pronouns or nouns** — `nobleman`, `him`, `his`, `He`. The body still
described a man throughout, so NB2 drew one and ignored the animal source
entirely.

Twelve uses of `him`, thirteen of `shoulders`, plus turban, waistcoat and
jacket, across the set. Caught only because Rich looked at the render.

### The tracker call stack, twice

Diagnosed as `-Skip 1` should be `-Skip 2`. Wrong. Then diagnosed as a
dot-sourcing quirk. Also wrong. **Both were guesses presented with
confidence.** The answer came from reading the stack rather than predicting
it: walk until a frame is not the tracker, because a fixed depth can never
reach past it.

Then the "fix" tested against the OLD file, because the install had not been
verified first.

### The Groups plate contract

A handoff asserted every plate was `groups_<id>.jpg` lowercase. **The
directory disagreed on 23 of 28** — `_01` suffixes, `.jpg` and `.jpeg` mixed,
seven names that were not the id, and one capital `U` that works on Windows
and 404s on Vercel.

### The rule that would have prevented all four

**Read the code before you describe the code.** If you are about to write
"the route does X" or "every file is named Y", open it. A claim you have not
checked is a guess wearing a suit.

**Check whether it already exists before you build it.** One directory
listing. One schema query.

**The files outrank the documents.** Every document in
`docs/GOVERNANCE/` was true when written and some are not true now.

**Never write a command that depends on a fact you have not confirmed in
this conversation.**

**And the one that matters most late in a session:** constraints do not stop
being true, they stop being CONSULTED. Early commands get scrutiny; later
ones get pattern-matched against the earlier ones. **The longer a session
runs, the more explicitly the rules need re-reading, not less. Fluency late
in a session is not competence — it is the thing to be suspicious of.**

---

## 6 · OPEN, IN ORDER

**Halloween as a Series on main.** Needs a page first. Bodies exist and are
proven; nothing else does.

**The Pets page.** 34 ids and the new plate paths. CUI's.

**The Pets wallpaper shoot.** Script written, nothing rendered.

**Two Pets type errors** in `pets-shared.ts`. Ten minutes with the file open.

**`ghoul`'s last phone clause.** Rich's text, flagged.

**Species wired into `buildPetsPrompt`.** A refinement, not a blocker.

**The Groups page.** CUI made 48 anchored edits after CENG last read it;
CENG has not verified it since.

**Community.** Rich ruled four conflicts on 20 August — handles stay,
comments out, hearts once-ever, and one free heart for anonymous visitors
transferring on signup. **Only the last needs building**, and it changes
`community_hearts`, which currently keys on `owner_key`.

**The board has never had one real post through it.** Carried from V28 and
still true. An empty board and a broken view are indistinguishable.

---

*CENG · 20 August 2026*
