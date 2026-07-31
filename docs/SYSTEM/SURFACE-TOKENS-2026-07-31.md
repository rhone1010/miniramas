# SURFACE TOKENS — the register

**2026-07-31 · CHK.** Supersedes `SURFACE-TOKENS-2026-07-28.md` (CUI V22),
same file, renamed by date. Three corrections, one added gap, provisional
marks on everything measured before s72. Every geometry and surface value Rich
has accepted on the glass. This document exists so the numbers stop being
rediscovered.

Source of truth: `public/litenco-stage-2026-07-30-s72.html`, gated by
`scripts/gate-stage.js`. **If a value here disagrees with the file, the file is
right and this document is corrected the same day.**

The s58–s69 revisions were archived to `archive/2026-07-31/stage/` on
2026-07-31. They remain tracked and recoverable; they are no longer the line.

---

## THE PATTERN — how any textured surface is built

Three layers, in this order, with one job each:

```
noise on ::before          grain only            opacity + blend
tone gradients             colour and light      alphas
the veil                   how much stone shows  --*-wash
the texture image          depth                 --*-tile
```

**The rule that keeps it clean: the gradients carry the tone, the noise carries
only grain.** Mixing those jobs is what turns a chosen colour into mud.

Two knobs per surface, always named the same way:

- **`--x-wash`** — a veil in the surface's own base colour laid over the
  texture. `1` hides the texture entirely, `0` shows it raw.
- **`--x-tile`** — texture scale. Larger reads as ground, smaller as slab.

The veil is the surface's own colour, never a neutral. A vellum veil over a
dark ground would grey it.

---

## GEOMETRY — locked s1–s7

| Token | Value | Note |
|---|---|---|
| root `font-size` | **a clamp, floor 16px, 19.2px at 2560** | corrected 2026-07-31 |
| `--stage-gutter-max` | `100px` | |
| `--stage-gutter` | `min(5%, var(--stage-gutter-max))` | the one gutter value; the masthead reads it too. **Not true at 1366 — see the gap below.** |
| `--stage-w` | `max(90%, calc(100% - 200px))` | 90% until the gutter would exceed 100px, then the stage keeps growing |
| `--stage-pad` | `24px` | |
| `--mh-h` | **`90px` / `76px` / `60px` by band** | corrected 2026-07-31 |
| `--r-panel` / `--r-card` | `8px` | 999px only on pills ≤72px tall, or a true circle |

**Correction — root `font-size`.** This document previously read *"16px, fixed
— never a clamp"*. That is wrong. The file ramps: 16px at the floor, 19.2px at
2560. Boot report 2026-07-31 §7b reads *"root type has a 16px floor"* and §8
gates *"only :root may size type with clamp(), and its floor is 16px"* — the
standing gate presumes a clamp. The exact clamp expression has not been re-read
from source; **read it from s72 before quoting it anywhere.** The original note
— that a clamp once resolved to 13px and made every rem ~20% small — is a real
failure and the reason the 16px floor is gated. The floor was the fix, not the
removal of the clamp.

**Correction — `--mh-h`.** Previously `90px` flat. The file is banded 90 / 76 /
60. Rich confirmed 2026-07-29 that 60 at 1366 is correct. The MASTHEAD section
below still reads 90px; that is the top band only.

`body` is a **block**. Never flex or grid — that made the stage a flex item and
width stopped being authoritative. Confirmed by boot §7b and §8, 2026-07-31.

### Measured behaviour — PROVISIONAL

**Measured pre-s72, not re-read.** These five rows are believed to hold: they
all sit above the band that moved. Treat as provisional until regenerated.

| Viewport | Stage | Gutter |
|---|---|---|
| 1366 | **not recorded — known gap** | **not recorded — known gap** |
| 1440 | 1296 | 72 |
| 1920 | 1728 | 96 |
| 2000 | 1800 | 100 |
| 2560 | 2360 | 100 |
| 3840 | 3640 | 100 |

**The 1366 gap.** 1366 is the band that changed at s65 — the gutter moved from
5% to 3.9% so the queue rail could reach 200px. This table has never carried a
1366 row, so the change is invisible here. Recorded as a gap rather than left
silent. The `--stage-gutter` token above does not describe 1366.

## ROOMS — locked s8

| Token | Value |
|---|---|
| `--spine-w` | `clamp(340px, 24%, 460px)` — rail + Curator together |
| `--rail-w` | `52px` — the closed "Design your own" spine |
| `--queue-w` | `clamp(200px, 13%, 280px)` |
| `--room-gap` | `20px` |
| `--footer-h` | `120px` |
| `--footer-pad` | `18px` |

One grid, named areas, so proportions are declared rather than emergent:

```
"curator workshop queue"
"footer  footer   footer"
```

## MASTHEAD — locked s7

Height below is the top band only. See `--mh-h` above for the full ramp.

| Element | Value |
|---|---|
| height | `90px` at the top band, espresso `#26201a`, sticky, z-60 |
| inset | `padding-inline: var(--stage-gutter)` — never a flat padding |
| zones | `minmax(0,1fr) auto minmax(0,1fr)` — three, never a fourth |
| wordmark | Cormorant `36px`, `--vellum-100`, "& Co" in `--gold` |
| nav | Cormorant `1.8em`, `10px 0` padding, `--vellum-300` |
| nav gap | `32px`, `.88em` scale below 1400 |
| series title | `1.8em`, `--series #d7bd89`, `--series-gap 50px` after it |
| series menu | coffee panel, items `1.45em`, `20px` padding |
| controls | 44px tall, radius 8px, Manrope 16px/600 |
| cart badge | 24px circle, oxblood, mutes at zero, never hides |

## GROUND — locked s1

| Token | Value |
|---|---|
| `--ls-tile` | `900px` |
| `--ls-wash` | `.42` |
| image | `/textures/limestone.jpg` |
| grain | `/textures/noise.png` @ 240px, `.025`, multiply |

Fixed, `inset:0`, edge to edge, behind the stage. Confirmed fixed by boot §7b,
2026-07-31. The atmosphere gradients sit on their own layer so their
percentages resolve against the viewport rather than against a box that also
carries a tiled image.

---

## SURFACES — ALL PROVISIONAL

**Every value in this section was measured pre-s72 and has not been re-read.**
These were judged by eye, not calculated, so they cannot be regenerated — they
need Rich's eye against s72. Until then, provisional.

### Curator card — **ACCEPTED s11** · provisional against s72
Warm vellum. Rich: *"clean and tight."*

| | |
|---|---|
| base | `#f7f2e9` |
| texture | `--cur-stone` `limestone.jpg` |
| wash | `--cur-stone-wash` **`.42`** |
| tile | `--cur-stone-tile` **`800px`** |
| noise | `.045` @ 14rem, **multiply** |
| border | `rgba(137,105,67,.2)` |
| shadow | `inset 0 1px 0 rgba(255,255,255,.62)`, `0 .7rem 1.6rem rgba(59,41,25,`**`.15`**`)` |

### Footer — proposed s12, awaiting Rich · provisional against s72
Pale limestone, quieter than the Curator.

| | |
|---|---|
| base | `#f5efe6` |
| texture | `--foot-stone` `limestone.jpg` |
| wash | `--foot-stone-wash` `.62` *(provisional)* |
| tile | `--foot-stone-tile` `1100px` *(provisional)* |
| noise | `.035` @ 16rem, **multiply** |
| extra | two repeating hairline gradients at `.012` / `.010`, 15rem — fibre, not graph paper |

### Queue and My Collection — proposed s12, awaiting Rich · provisional against s72
Dark coffee. **soft-light, never multiply** — multiply crushes the shadows.

| | |
|---|---|
| base | `#1a1613` |
| texture | `--queue-tex` `leather.jpg` *(provisional — swap in the inspector)* |
| wash | `--queue-tex-wash` `.88` *(provisional)* |
| tile | `--queue-tex-tile` `900px` *(provisional)* |
| noise | `.12` @ 13rem, **soft-light** |
| border | `rgba(174,133,78,.2)` |

Alternate base tones, keep soft-light either way:
warmer coffee `#211915` · near-black espresso `#151210`.

### Curator's Pick — built, no element yet · provisional against s72
Elevated ivory. The recommendation panel, not the badge over an effect image.

| | |
|---|---|
| base | `#fbf6ef` |
| noise | `.04` @ 14rem, **multiply** |
| border | `rgba(183,135,65,.42)` plus an inner rule at `inset .35rem`, `.18` |

---

## BLEND DISCIPLINE — gated

```
light grounds  →  multiply,   ceiling .08
dark grounds   →  soft-light, ceiling .20
```

Above those the noise stops being grain and starts carrying tone. The gate
fails the build rather than letting it drift.

---

## ASSETS

| File | Size | Note |
|---|---|---|
| `limestone.jpg` | 157KB | 800×800, replaced a 3.1MB png |
| `noise.png` | 521KB | 800×800, 8-bit |
| `noise.jpg` | 231KB | alternative — use only if the png has no alpha |
| `paper-grain.jpg` | 85KB | not referenced — the Curator's paper is a filter, not an image |

Unreferenced and available: beige-marble, natural-beige-stone, natural-stone,
polished-marble, rough-slate, weathered-bronze, weathered-concrete-surface,
subtle-textured-paper, textured-handmade-paper, leather.

Boot 2026-07-31 §6 counts 16 items in `public/textures/`.

**Open:** `noise.png` at 521KB is large for 800×800 grain. A 16–32 grey palette
would likely land under 60KB. Not blocking.

---

## STILL OPEN

1. **Re-measure against s72.** Two different jobs, and only one needs Rich.
   - *Stage and gutter figures are computed from tokens, not observed.* CUI can
     regenerate the Measured behaviour table without a browser, and should add
     the 1366 row while doing it.
   - *The s11/s12 surface values were judged, not calculated.* Those need
     Rich's eye against s72; no script can settle them.
2. **Read the root `font-size` clamp expression from s72** and write it here
   literally. Floor and ceiling are known; the middle term is not.
3. **Record the `--mh-h` band breakpoints.** The three heights are known,
   the viewport widths that switch them are not written down anywhere.
4. Nav link colour — `--vellum-300` currently; Rich struck it in the inspector.
5. The active-nav treatment — the series switcher may already say "you are here".
6. The Liten & Co **L** as SVG, and the Curator **C** mark from
   `public/icons/curator-c.svg`, referenced rather than inlined.
7. Workshop room has no surface of its own — the stone shows through. Intended?
