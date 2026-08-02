# CENG CARRYOVER — 2026-08-01 (V23)

**Supersedes** `CENG-CARRYOVER-2026-08-01.md` (the V22 morning file) in the ways noted in §6.
All locked bodies are in `locked-2026-08-01.json`, verbatim. This file is the reasoning.

---

## 0. UPLOAD THESE ON DAY ONE

1. This file
2. `locked-2026-08-01.json` — **37 bodies, verbatim. The important one.**
3. `apply-locked.js` — merges 2 into the registry
4. `CENG-CARRYOVER-2026-08-01.md` (V22 morning) — §1 standing rules still hold
5. `CENG-HANDOFF-2026-07-30.md`
6. `effects.json` / `effects-batch2.json` — historical, now largely superseded
7. `style-refs-index.json`
8. Fresh extraction: `node scripts/extract-effects.js . --out=effects-registry.json`
   **Use `--out`, not `>`.** Rich's 07-31 run used `>` and produced UTF-16 with a BOM.

---

## 1. THE HEADLINE

**The catalog is closed. 56 of 56 slots filled. Every effect has a current, captured body.**
No stale engine text. No plate-without-prompt. No empty slot.

That was not true this morning. It is true now, and it exists **only in
`locked-2026-08-01.json`** — nothing has been written to the repo.

---

## 2. THE SILO MODEL — CHANGED

The 8-silo model was rebuilt this session. Old names Myth & Legend, Far & Future and
Living World are retired or renamed.

| silo | n | contents |
|---|---|---|
| **Earth & Ore** | 7 | quartzite · ebony · petrified_wood · bronze · iron · jade · sandstone |
| **Light & Glass** | 7 | ice · sea_glass · cast_glass · stained_glass · neon · polished_gold · mercury |
| **Print & Pattern** | 7 | art_nouveau · ukiyo_e · art_deco · daguerreotype · cubism · folded_book · sheet_music |
| **The Artists Gallery** | 7 | impressionist · charcoal_chalk · watercolour · pencil_sketch · oil_impasto_palette_knife · linocut · +1 |
| **Made by Hand** | 7 | plushy · quilted · beaded · balloon_face · chocolate · origami · porcelain |
| **Fantasy & Future** | 7 | dragon_skin · fire_face · forest_guardian · petal_sculpture · retro_robot · starfield · clockwork |
| **The Living World** | 7 | tidewood · driftwood_resin · coral · lichen_granite · reclaimed_bronze · crystallized · sand_form |
| **Another Age** | 7 | victorian · renaissance · persian_court · wild_west · deco_twenties · samurai · elizabethan |

**Another Age carries a men ⇄ women toggle**, not two silos. One tile, gender is a control
inside it, previews swap on tap. That is what makes 8×7 work — a gendered split would have
cost a whole silo. 14 bodies, 7 slots.

**`pencil_sketch` moved** painterly → Print & Pattern.
**`magic_energy` moved** particulate → Fantasy & Future (it is now a flat 2D illustration).
**`folded_book` and `sheet_music` moved** to Print & Pattern on material grounds.

Artists Gallery is one short if you count strictly — reconcile against the live registry.

---

## 3. THE FINDINGS THAT MATTER

### 3.1 Name the craft object. It beats every describing clause.

The single most useful result of the session. Three cases:

- `retro_robot` hair went right when the prompt said **"overlapping pressed-metal strips
  about the width and thickness of gum wrappers."** Four earlier describing clauses failed.
- `quilted` eyes went right as **buttons**; embroidered eyes went photoreal.
- `coral` (V22) went right on **"hard calcareous coral skeleton."**

This is §1.1 — *name the object, don't legislate the outcome* — with a sharper edge:
name a **specific manufactured thing**, not a material quality.

### 3.2 Every material effect leaks at eyes, mouth, or hair.

Confirmed across dragon_skin, cast_glass, crystallized, sand_form, forest_guardian,
retro_robot, petrified_wood. "No skin" never covers them.

**Standing instruction: name all three explicitly in every new material body.**
Eyes, mouth (lips/teeth/gums), hair. A general no-skin clause will not hold them.

### 3.3 Substrate, not surface.

The reliable phrasing is *"the whole figure is X all the way through, with no skin beneath"*
— not *"X across the surface"* and not *"grown over."*

`amber_inclusion` and `fungal_bloom` were both **cut** for exactly this: they produced a real
photographed person with the effect around or on them. `salt_crystal` failed the same way and
was replaced by `crystallized`, which names the substrate up front.

### 3.4 A closed mouth is required on translucent and glossy materials.

Carved teeth in cast glass and obsidian read as a skull. `cast_glass` locked with
**"Closed mouth, expression carried in the eyes."** `daguerreotype` gets it free from period.
`obsidian_flow` was cut but would probably work with the same edit.

### 3.5 The `§1.3` tail is not universal — trim it per material.

- **"Clear the skin — blemishes, spots and blotchiness go"** invents speckling on no-skin
  materials. It put freckles on the `ice` woman and on the Persian noblewoman. Drop it
  wherever there is no skin.
- **"The subject's own garment carries through in the same material"** is what preserved the
  real shirt on three `dragon_skin` plates. Where a garment must be *rebuilt*, remove the line
  and say "rebuild the garment in X."
- Rich's ruling stands: the prompt is the rule. Do not flag tail duplication as a fault.

### 3.6 A negative example holds a variable better than a rule.

`petrified_wood` lost the likeness until the body said **"short and tightly coiled stays
short and tightly coiled."** Naming what must *not* change, by example, held it.

### 3.7 The idealism/photography language

Two lines, now standard:

> Material: *Idealized and beautiful. Photographic — a real object photographed in real light, not an illustration.*
> Costume: *Idealized and striking while remaining completely believable as a photograph.*

Better still, from the `cast_glass` lock:

> *Preserve what makes the face distinctive rather than making it conventionally perfect.*

That last one is a better idealizing clause than the tail's never-list. Reuse it.

### 3.8 Retired flag

The §5 texture-into-facial-planes clause was applied to `forest_guardian` and worked
(the seam and the age-carving both went). **Rich ruled coral, tidewood and impressionist are
solid as they are.** Do not re-raise. The clause is a tool, not a standing defect list.

---

## 4. WHAT IS OUTSTANDING

**Highest priority — nothing from this session is in the repo.**

1. Run `apply-locked.js` (see §5). 37 bodies live only in the JSON.
2. **Idealism append** to 8 ids — chocolate · reclaimed_bronze · polished_gold ·
   petal_sculpture · sea_glass · neon · lichen_granite · deco_twenties.
   `wild_west` pair is **exempt** — weathered is intentional and approved.
   The script flags these; the insert point is manual.
3. **Five new ids need registry rows**: ukiyo_e · cubism · daguerreotype · art_deco ·
   petrified_wood · crystallized · sand_form · origami · porcelain · starfield · clockwork ·
   linocut · oil_impasto_palette_knife · quilted · cast_glass · balloon_face.
   `--emit-new=` writes them ready to paste.
4. **Another Age gender toggle** needs a UI decision and a `refSelector` contract (§9 item 9
   in the V22 file). `gender` is carried in the JSON as `refSelector`.
5. **Style-refs folder aliases** — nine folders do not match their ids:
   `forest_gaurdian` → `forest_guardian` (typo) · `deco_20s` → `deco_twenties` ·
   `persian` → `persian_court` · `samurai` → the pair · `petals` → `petal_sculpture` ·
   `stone` → probably `quartzite`.
   Gendered folders (`renaissance`, `wild_west`, `victorian`) hold both sexes in one directory
   — the toggle decision determines whether they split.
6. `forest_guardian` **id still unresolved** — it took `moss_stone`'s slot.
7. Refs exist with **no catalog entry**: `living_vines`, `cosmic`, `volume_light`, `alabaster`,
   `walnut`. All cut. `haunted` and `melted_wax` cut this session.

---

## 5. HOW TO APPLY

```bash
cd D:\minramas

# 1. dry run — prints every add and update, writes nothing
node apply-locked.js locked-2026-08-01.json

# 2. get the new ids as pasteable TS
node apply-locked.js locked-2026-08-01.json --emit-new=new-effects.ts

# 3. apply (backs up effect-registry.ts first)
node apply-locked.js locked-2026-08-01.json --write --idealism

# 4. regenerate — NEVER edit public/effect-registry.js directly
node scripts/emit-effect-registry.js

# 5. verify
npx tsc --noEmit          # baseline is 53 pre-existing errors; no new ones
git status                # named files only, never -A
```

The script never writes without `--write`, and backs up `effect-registry.ts` when it does.
Anything it cannot match unambiguously it reports and leaves alone — check that list.

---

## 6. WHAT IS NOW STALE IN THE V22 MORNING FILE

- §2 lock list — most bodies superseded. `locked-2026-08-01.json` wins.
- §3 `art_nouveau` "never shot" — shot and locked.
- §4.1 Living World → Natural World — **wrong now**, it is The Living World and the silo
  model changed entirely (§2 above).
- §4.2 alabaster's open slot — **filled by `petrified_wood`.** `ebony` live-edge is written.
- §4.4 silo arithmetic — obsolete.
- §5 the four-effect texture fault — **Rich closed this** (§3.8).
- §6.5 `blown_glass` parked — now **cut**. `amber` also cut.
- §8 gaps — **all closed.** `houses-curiosities.ts` supplied; `elizabethan`, `stained_glass`,
  `samurai` male, `victorian_woman`, `balloon_face` all have bodies.
- §9 items 5, 6, 7, 8, 11 — **closed.** Items 1, 2, 3, 4, 9, 10, 12, 13 still open.

---

## 7. CURIOSITIES — THE ANSWER

Rich asked where Curiosities was wired. Findings:

- **Houses** has `lib/v1/houses/houses-curiosities.ts` — complete, five presets, and
  **entirely dead code.** Nothing imports it. `Mode` is `'materials'|'seasons'|'events'|'artists'`
  with no `'curiosities'`; `PresetId` lacks the five ids; `buildPresetPrompt` has no branch;
  and `houses-generator.ts` gates outpaint/refine off on `mode === 'artists'` only — so the
  file's own header comment about forcing those off is false today.
- **Pets** has none. `PetsStyleId = 'realistic'`, single style, 8 sculptural materials.
- **Portraits** has it in substance under another name: `EXPERIMENTAL_EFFECTS` in
  `portraits-experimental.ts`, and the front end already labels that group **Curiosities**
  (`data-g="curios"` in the workshop proto; the flow contract's "cabinet of curiosities" shelf).

Three of the five Houses curiosities ported cleanly to Portraits and are now locked:
`ukiyo_e`, `cubism`, `daguerreotype`. `art_deco` and `art_nouveau` were rewritten from scratch
for portraits — the Houses versions are architectural reliefs and share only the name.

---

## 8. HOW RICH WORKS

Unchanged from V22 §10, plus two sharpened this session:

**Do not over-constrain.** Rich's words: *"NB2 does better with guidance not control."*
A long legislating block loses to a short naming one. When a body runs past ~5 sentences of
rules, cut it.

**The prompt is the rule.** Tail duplication, framing said twice, a clause that contradicts
another — none of these are faults. Raise only: material contradicting itself, a clause that
inverted the result across plates, a background fighting the subject, or quality/legal/decency.

He is the sole visual judge. Diagnose and give the fix. Never offer multiple choice on a
rejected render. When he says a diagnosis is wrong, it is wrong — check again.

**Log every locked body verbatim at the time it is locked.** That is what
`locked-2026-08-01.json` is for. "We didn't do that today" is not an acceptable answer.
