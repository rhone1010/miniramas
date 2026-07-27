# MASTHEAD — DIRECTIVE v1

Authored by CUI V21 · 2026-07-24 · **for Rich's ruling, then CLAW to issue**
Reference build: `litenco-masthead-2026-07-24-r1.html`
Applies to: Portraits Workshop · Print Shop · Account / My Collection

The masthead is the only component that appears on every surface. It is
therefore the only place where a disagreement between surfaces is visible as
the customer navigates. This directive exists to end that.

---

## 0 · THE RULING NEEDED — dark or light

The three surfaces currently disagree.

| Surface | Ground | Height | Inset |
|---|---|---|---|
| Portraits r80d (approved) | espresso `#26201a` — **dark** | 68px | flat 36px |
| Print Shop r28 | vellum `#f3ecdd` — **light** | 72px | tracks the container edge |
| Account r6 | neither — no shared masthead | — | — |

**Recommend: espresso, dark.**

The v2 design system establishes two rooms — Vellum for the daylight surfaces
and Coffee for the lamplit ones. The masthead sits above both. If it takes the
colour of a room it becomes part of that room and changes as you move between
them; if it stays espresso it reads as the building the rooms are inside. That
is the gallery register, and it is what the approved Portraits file already
does.

The rest of this directive assumes espresso. If the ruling goes light, only §2
changes.

---

## 1 · STRUCTURE — locked

Three zones, one row, in this order. No fourth zone.

```
[ wordmark ]        [ navigation ]        [ credits · cart ]
   left                 centre                   right
```

- Wordmark is a link to `/`. Always visible, never collapses, never truncates.
- Navigation is centred on the **page**, not on the space between the outer
  zones. Grid, not flex — `minmax(0,1fr) auto minmax(0,1fr)` — so the nav stays
  optically centred when the right cluster grows.
- Right cluster is credits then cart, in that order, right-aligned.

Do not add search, account avatar, notifications, or a hamburger on desktop.

## 2 · SURFACE — locked

- Ground: `--espresso #26201a`
- Bottom rule: 1px `--card-line`
- Height: **72px**. Portraits' 68 and Print Shop's 72 reconcile upward — 68 is
  tight for a 24px serif nav with a 44px control beside it.
- `position: sticky; top: 0; z-index: 60`
- No shadow, no blur, no gradient. The rule is the whole separation.

Contrast on espresso: wordmark `--vellum-100`, nav `--vellum-300` at rest and
`--vellum-100` on hover, controls on `--coffee-700` with `--card-line` borders.

## 3 · INSET — locked, and this is the part that has bitten us

The masthead must align to the **content container edge**, not to a fixed
padding. Portraits uses a flat 36px; Print Shop tracks the container. Flat
padding is wrong: the wordmark then sits at a different distance from the page
edge than the content beneath it, and the misalignment grows with screen width.

```css
padding-inline: max(
  calc((100% - var(--container)) / 2),
  calc((100% - var(--container-max)) / 2)
);
```

This tracks the ladder automatically at every breakpoint. **Never hardcode.**

## 4 · GEOMETRY LADDER — inherited, do not redefine

```
--container: 86%;  --container-max: 2200px;  --container-min: 1850px;
@media (max-width:1849px) { --container-min: 0;  --container: 92%; }
@media (max-width:1199px) { --container: 94%; }
@media (max-width:767px)  { --container: 100%; }
```

**The floor must always be released below its own value.** An unreleased
`min-width` is what clipped the wordmark and the cart on Print Shop and would
have done the same on Account. Portraits releases it correctly at 1849 — that
is the pattern.

## 5 · TYPOGRAPHY — role-based, locked

Cormorant is what the gallery says. Manrope is what the interface says.

| Element | Face | Size | Weight |
|---|---|---|---|
| Wordmark | Cormorant | 2.267rem | 400 |
| Navigation | Cormorant | 1.6rem | 400 |
| Cart label | Manrope | 1rem | 600 |
| Credits value | Manrope | 1rem | 600 |
| Credits unit | Manrope | 1rem | 400 |
| Count badge | Manrope | 0.867rem | 600 |

Cormorant never bolds — hierarchy is size, never weight. Cormorant never renders
below 1.333rem. Both are enforced by the build gate.

All sizes are rem against `clamp(12px, 0.38vw + 6px, 15px)`.

## 6 · CONTROLS — locked

- Height 44px. Radius `--radius-pill` (8px ceiling). Never a 999px pill.
- Count badge is the only circle in the component.
- Badge ground `--oxblood`. At zero, `data-empty="true"` — **the badge mutes to
  grey, it never hides.** A cart that disappears reads as broken.
- Credits ships `hidden`. Unhide when a signed-in balance exists.

## 7 · ACTIVE STATE — locked

Exactly one nav item carries `.on` per page. `--oxblood` text plus a 2px
`--oxblood` rule 2px beneath the label. No pill, no fill, no background change.

## 8 · RESPONSIVE — locked

| Breakpoint | Behaviour |
|---|---|
| ≥1850 | Full. Container-tracked inset. |
| 1200–1849 | Container 92%. Nav gap tightens, nav drops to 1.467rem. |
| 768–1199 | Container 94%. Nav collapses to a menu. Wordmark and cart persist. |
| <768 | Container 100%. Inset becomes a flat 16px. |

**The wordmark and the cart never clip and never hide, at any width.** Navigation
is what gives way. If something has to be sacrificed it is never the way home
and never the way to pay.

## 9 · HOOKS — CUI owns, CC binds

| Hook | Owner | Behaviour |
|---|---|---|
| `#masthead` | CUI | Container. |
| `.mh-nav a.on` | CC | Exactly one per page. |
| `#mhCartBtn` | CC | Opens the cart. |
| `#mhCartCount` | CC | Line count. `data-empty="true"` at zero. |
| `#mhCreditsBtn` | CC | `hidden` until a signed-in balance exists. |
| `#mhCreditsCount` | CC | Bare number. The word "credits" is markup, not data. |

**Every surface writes the badge through the masthead component's API.** The
`#mhCartBtn` / `#mhCartCount` IDs that appear inside Print Shop carry
`data-owner="masthead-component"` and exist only so that mock renders. CC must
not query them directly from a page script — that is how two surfaces end up
disagreeing about the count.

## 10 · WHAT MAY BE CHANGED

Permitted without a new directive: hover timing, focus ring treatment, icon
weight, the exact nav gap at each breakpoint.

Not permitted: adding a zone, changing the ground, changing the height,
hardcoding the inset, bolding Cormorant, restoring a 999px radius, hiding the
cart, or defining any `--color-*` token. The canonical accents are locked —
`--oxblood #7d4242`, `--brass #75623a`, `--ink #2a241e`, `--gold #b68a53` — and
must not be shadowed by near-miss values. That drift is what produced two design
systems in the first place.

---

## 11 · ADOPTION

1. Rich rules §0.
2. CUI rebuilds the component to the ruling — one file, one revision.
3. CUI rebases Account onto canonical tokens and the container ladder. It is
   the last surface still off the system, and it carries the unreleased 1850
   floor.
4. The component drops into all three surfaces unchanged.
5. CAQ audits the wordmark and cart at 1024 / 1280 / 1440 / 1850 / 2560 on all
   three, and confirms the count agrees across a navigation.

Step 4 is one paste per surface. Everything before it is the actual work, and
step 3 is the only piece still outstanding.
