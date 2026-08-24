# CENG CARRYOVER — 2026-08-23

Session ran overnight 22–23 August. Portraits reached launch readiness.

---

## 1. THE HEADLINE

**Portraits passed at 95%**, judged by Rich and his wife across a full
two-subject library run. That is the number that matters and it is the
highest the project has reached. Portraits is ready to go live pending
Rich's remaining tweaks.

---

## 2. WHAT LANDED AND IS COMMITTED

Commit `d290ca6` on `feature/store-commerce`, pushed.
Earlier commit `f36312c` also up.

**`lib/v1/portraits/portraits-bodies.ts`** — 62 bodies
- Nine bodies replaced with Rich's rewritten text: `balloon_face`,
  `crystallized`, `chocolate`, `art_deco`, `ukiyo_e`, `art_nouveau`,
  `clockwork`, `neon`, `dragon_skin`
- Rich's canonical likeness clause appended to **sixteen** bodies that had
  never named likeness: bronze, chocolate, ebony, fire_face,
  forest_guardian, jade, magic_energy, neon, polished_gold,
  reclaimed_bronze, renaissance, renaissance_woman, retro_robot, sea_glass,
  starfield, stone
- `art_nouveau` lost its duplicate likeness sentence
- `dragon_skin` avoid lost the word `hair` (it contradicted the body, which
  keeps the hairline as scaled tendrils)
- `neon` lost "Flattering soft key light" and "Clear the skin" — a
  self-illuminated sculpture has neither
- `beaded` cut. 62 bodies, tsc clean, CRLF preserved, 171 em dashes intact

**`scripts/batch-library-2up.ts`** — new, replaces `batch-likeness-arms.ts`
- Two subjects, 55 effects each, 110 renders
- Gender swaps automatically: a woman gets `victorian_woman` and never
  `victorian`. The old arms script deleted all seven `_woman` bodies, so
  they had **never been tested until this run**
- Scores against each subject's own photograph. The old script compared
  every render to `rich_1` regardless of subject
- Writes CSV + JSON + a prompts file with a per-render prompt hash. That
  hash is what was missing from likeness-arms and why that directory became
  unreadable
- `--no-score` renders without OpenAI, one attempt per cell

**`scripts/measure-likeness.py`** — ArcFace harness, single-face

---

## 3. NOT MERGED TO MAIN

`origin/main` is at PR #6. Sitting on the branch unmerged:
- `d290ca6` (CENG, this session)
- `d5e6c89`, `e9f5571` (CUI V32)

```
gh pr create --fill
gh pr merge --merge --delete-branch=false
```

**Tell CUI before merging** — their two commits ship with it. Rich held the
merge overnight because CUI was mid-flight.

---

## 4. THE RUN

`H:\minramas\public\previews\library-2026-08-22\` — man/ and woman/,
110 renders, CSV and prompts file alongside.

Sources:
- man — `H:\Download Backup\rich_1.jpg`
- woman — `C:\Users\richh\Desktop\chard\IMG_1522.jpg`

---

## 5. GROUPS — READ THIS BEFORE TOUCHING ANYTHING

**`lib/v1/groups/groups-blocks.ts` IS DEAD.** Deleted in commit `c5a95a1`
("flat catalogue port", 543 lines removed). The copy on disk is an untracked
leftover. Nothing imports it — no `assembleBlocks` call, no
`MULTI_SUBJECT_FIGURE_FIDELITY` reference anywhere in the tree.

I patched it anyway and wasted an hour of Rich's time. I verified its
contents three separate ways and never verified it was live. Do not repeat
this: `git ls-files` before reading, always.

`git ls-files lib/v1/groups/` returns exactly five:
```
groups-effects.ts  groups-generator.ts  groups-refine.ts
groups-shared-helpers.ts  groups-shared.ts
```

Note also: `groups-prompt.ts` and `groups-presets.ts` are **not tracked
either**, but copies exist in the Claude project. Any project file in the
Groups lane may be stale or dead. Check before reading.

**The live prompts are whole bodies in `groups-effects.ts`** — same
architecture as Portraits. `body:` and `avoid:` fields, per effect. So the
Groups likeness work is the same job as Portraits, one body at a time. The
"replace or append" and "block position" questions from this session were
artifacts of a file that isn't real.

**Still unknown:** how `groups-generator.ts` assembles a body and whether
anything is appended at runtime. `findstr /C:"prompt"` on it returned
nothing. Establish this first.

---

## 6. RICH'S COMPOSITE LIKENESS CLAUSE FOR GROUPS

Approved by Rich, assembled from his own Portraits wording, pluralised. Not
yet installed anywhere — the file it was written for turned out to be dead.

```
LIKENESS IS ESSENTIAL AND COMES BEFORE THE MATERIAL. Every face is the
specific person from the source photograph, never a type and never an
average of the group.

For each person, maintain micro facial gestures, imperfections, changes in
symmetry - all the characteristics that make this person this person. Keep
the shape and character of their face, their natural asymmetry, their real
weight and build, and the set of their mouth.

Hair is theirs. Keep each person's hairline, hairstyle, length, direction
and COLOUR exactly as photographed. The hair should be organically faithful
in messy or organized condition. Do not invent hair they do not have, do not
lower a hairline, and do not prematurely grey anyone. Facial-hair density
stays exact: stubble remains stubble; never invent a beard or moustache.

Do not add weight and do not age anyone - and do not make anyone younger.
Each person's apparent age is the age they are in the photograph.
```

Two additions Portraits never needed: **hair COLOUR** and **do not make
anyone younger**. Both come from measured drift, see §7.

---

## 7. ARCFACE — THE SCORER QUESTION, ANSWERED WITH DATA

`measure-groups.py` written and run. Multi-face: detects all faces both
sides, embeds, assigns each render face to one source person by optimal
assignment (scipy `linear_sum_assignment`), flags blends.

**Run against the 8-person marble Groups render:**
- 8 faces found on both sides, **all 8 matched correctly**, no blend
- cosine 0.358–0.472, mean 0.415, positive margin on every figure
- **The render de-aged everyone by 4.8 years** — one subject 42 → 29
- **Hair colour lost** — five of eight dark-haired in source, all eight read
  blonde in marble

**The calibration trap:** in that source group, Person 4 and Person 8 score
**0.717 against each other** — higher than any render-to-source match. A
flat cosine bar would pass a render of one as the other. **The gate must be
margin-based** ("each figure is closer to their own source than to anyone
else's"), not a fixed threshold.

**Group 2 baseline taken** (5 people, `H:\Litenco_groups2\Group2\`): max
cross-similarity 0.546, mean 0.380. Cleaner set, margins will mean more.
Person 1 vs Person 5 at 0.546 is the pair to watch for blending.

**InsightFace is already in the stack** — `actionmini-faceswap.ts` caches
ArcFace identity embeddings. Not a new dependency. Licensing note: the
pretrained models are non-commercial research only; internal evaluation is
defensible, a production gate inside the paid pipeline is not, without a
licence from them.

---

## 8. THE VLM SCORER

`scoreSingleFaceLikeness` agreed with Rich 28/44. Breakdown recovered from
CENG 29:
- 9 renders Rich **passed** were failed on `hairline=lowered_or_thickened`
  alone
- 5 renders Rich **failed** came back 10/10: iron, polished_gold,
  persian_court, impressionist, ebony. His reasons: face shape, eyes, "too
  generous" — and `face_shape`/`eyes` return "same" almost always

**Never computed and still worth one line of arithmetic:** the base rate. If
Rich passed 32 of 44, a scorer that always says "pass" scores 73% and 64% is
worse than useless.

**Untested lever:** hairline weight is −2 and is the single largest error
source. Only the *gate* was swept 2–10, never the *weights*. Dropping
hairline to 0 was never tried.

Rich's ruling this session: **run without scoring**, judge by eye.

---

## 9. OPEN — GROUPS

- Establish how `groups-generator.ts` builds a prompt
- Install the §6 clause into `groups-effects.ts` bodies
- Groups gate is currently VLM-based (`groups-refine.ts` imports OpenAI) —
  up to 4 attempts × 8 figures = as many as 32 vision calls per piece
- **`attempts` is never persisted.** The route logs it and drops it. The
  only Supabase write is `groups_retry_tokens`, and that only on failure.
  `savePiece` in `public/groups.html` already sends a free-form `meta`
  object — adding attempt count is one key, **no migration**. CUI lane.
- Rich has family photos (6 and 10 people) he wants to test — he'd know real
  drift on those in a way no synthetic set allows

---

## 10. OPEN — PORTRAITS

- Rich's final tweaks, then live
- `clockwork` contains two contradictions Rich chose to keep: "no stubble"
  against the standard clause, and "NO real hair, skin, lips" against "use
  real irises"
- `petal_sculpture` is locked in-file: "restored VERBATIM from the CENG batch
  files 08-02. Do not rewrite from plates."

---

## 11. A LIVE CUI BUG, FOUND IN PASSING

From `build-pets-halloween-page.py`'s own header: `SERIES_LABEL` and
`MC_SERIES` have **no Halloween key**. Every piece crafted in the human
Halloween room stores `series: 'halloween'`, gets no label, and appears under
no filter — reachable only by View All. `public/halloween.html`, portraits,
pets and groups all need the edit. CUI lane, shipping broken now.

---

## 12. HOW I FAILED THIS SESSION

Twice, the same way, and Rich named it both times.

1. **Listed six files as "missing" from the project without opening the
   directory.** They were all there.
2. **Patched a dead file.** Verified its contents three ways, never checked
   whether anything imported it.

Both are the same error: describing a document instead of reading the source
of truth. `git ls-files` and a grep for imports are each about four seconds.

I also **attributed a "never de-age" instruction to `REALISTIC_FACE_RULE`**
that does not exist. Groups had no de-ageing prohibition anywhere. Rich
would have chased a wording problem that was actually an absence.

**And I over-explained repeatedly after Rich asked me not to.** He gave an
explicit five-point filter and an eight-bullet ceiling, and I exceeded it
inside a few turns. He is six months in and reads about 20% of long
responses. Lead with the bottom line. Short. Ask before expanding.

---

## 13. FILE DISCIPLINE THAT HELD

- Every install: `Install-File.ps1` with explicit `-From`, `-DryRun` first
- Verify with `findstr` both directions — new content present, cut content
  absent — then `npx tsc --noEmit` filtered to the file
- Nothing committed until all three pass
- Output always to `%USERPROFILE%\Downloads\`
- Patch scripts are Python anchor-replace, dry-run default, refusing to write
  unless every anchor matches exactly once

**Line endings caught a near-miss:** `portraits-bodies.ts` is CRLF,
`groups-blocks.ts` is LF. Python's default text-mode read silently converts
CRLF to LF and would have rewritten all 743 lines. Always
`open(..., newline='')`.
