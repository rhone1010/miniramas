# Portraits Workshop — Hook Contract v1

Source of truth: `litenco-portraits-2026-07-24-r80d.html` (approved)
Authored by CUI V21 · 2026-07-24 · **for CLAW to issue**
Consumer: CC

**Boundary law.** CUI owns every byte of HTML and CSS. CC attaches behaviour in
a separate JS file against the hooks below and never edits markup. A hook that
isn't listed is requested, not invented. Verified by HTML diff — the markup CC
returns must be byte-identical.

**Fidelity law applies to the port.** `public/portraits.html` is the live engine
file with 13 existing `fetch()` calls. r80d is a fetchless reference. Port the
deltas line-count-matched with deviations reported. Never drop the reference
onto the engine file — that has happened before and cost a git restore.

---

## 0 · Step machine

Four steps, in order: **`upload` → `frame` → `picks` → `pay`**.
Labels are markup, not data: `{upload:'Upload', frame:'Frame', picks:'Picks', pay:'Pay'}`.

| Hook | CC responsibility |
|---|---|
| `#wzSteps` | Step indicator. Reflect the current step; never let it lead the actual state. |
| `#picksBack` | Return `picks` → `frame`. Preserves selections. |
| `#payBack` | Return `pay` → `picks`. Preserves the To Be Crafted list. |

Backward navigation is non-destructive at every step. Nothing is discarded until
the customer removes it explicitly.

## 1 · Intake

| Hook | CC responsibility |
|---|---|
| `#s1file` | File input. Accept the upload, run the analyze route. |
| `#s1img` | Preview of the accepted source. |
| `#s1consent` | Consent control. `#s1continue` stays `disabled` until it is satisfied. |
| `#s1continue` | Advance to `frame`. |
| `#s1another` | Replace the source before committing. |
| `#srcThumb` | Persistent source thumbnail once past `upload`. |
| `#changePhoto` | Return to intake, discarding downstream selections — **the one destructive back path.** Confirm before acting. |

### Intake failure — `#intakeModal`

Two classes, per the CENG floor spec. CC reads `intake.class` from the route
response; **confirm that field exists before relying on it.**

- **hard block** — blur at `sharpness:'poor'`, face under 40px absolute, no face
  detected, moderation trip. No override path. `#redirectCta` / `#redirectGo`
  offer the way forward, `#redirectMsg` carries the reason.
- **soft warn** — face 40–70px, dim lighting, occluded face. Proceed is allowed.

`#mclose` dismisses. A dismissed soft warn does not re-fire for the same source.
`data-role="modal"` marks the dialog for focus trapping.

**Blur is a hard block, not a soft warn.** It moved categories deliberately.

**State 3, "At capacity", is a design orphan.** No engine status emits a
`deferred` state. Do not wire it. Raise it if the engine ever does.

## 2 · Framing and effects

| Hook | CC responsibility |
|---|---|
| `#stageGrid` | Primary effect grid. |
| `#allGrid` | Full effect set. |
| `#featBox` / `#miniBox` | Featured and secondary preview surfaces. |
| `#cycleBtn` | Cycle the featured preview. |
| `#curatorDeckle` | Curator card. Container only — CUI owns the deckle filter. |
| `#curNote` | Curator copy. **Composition only, never price.** See §7. |
| `#curSource` / `#curCrop` | Source reference and crop indicator. |

## 3 · Advanced panel

`#adv`, opened by `#advOpen`, closed by `#advClose`.

State shape CC owns:
`{ mat, set, frame, base: 4.99, extra: 0 }`

| Hook | Drives |
|---|---|
| `#advSwatches` | `mat` |
| `#advModes` | `set` |
| `#advFrames` | `frame` |
| `#advGlyphs` | ornament selection |
| `#advRecipe` | resolved summary of the four above |
| `#advLedger` | `base + extra` for this configuration |
| `#advAdd` | Commit the configuration to To Be Crafted |

## 4 · To Be Crafted

**Never "queue" in customer copy.** The rail is `#railTbc`.

| Hook | CC responsibility |
|---|---|
| `#tbcPills` | One pill per staged image. |
| `#tbcMsg` | Status line. |
| `#tbcPrice` | Order total from the ladder in §5. |
| `#tbcCraft` | Commit to `pay`. |

## 5 · Pricing ladder — LOCKED

`PCT = {1:0, 2:.10, 3:.15, 4:.20, 5:.25, 6:.26, 7:.27, 8:.28, 9:.29, 10:.30}`

Formula: `4.99 × count × (1 − PCT[count])`. Hard cap 10.
Tiers: **THE SERIES** (1–9), **THE STUDIO** (10).

| Hook | CC responsibility |
|---|---|
| `#payStage` | Payment step container. |
| `#payItems` | One line per staged image. |
| `#payTierLabel` | THE SERIES or THE STUDIO. |
| `#payTotal` | Ladder result. |
| `#payBtn` | Commit. Debits credits — see §6. |

**Copy law:** the bare `−XX%` value only. No *off*, *save*, *discount*, or
struck prices anywhere near it.

## 6 · Credits

`#creditsCount` ships `hidden` with `<b>0</b> credits`.

Unhide when a signed-in balance exists. The number is data; the word "credits"
is markup and CC does not write it. Single noun everywhere — never "crafts
remaining."

Per `CREDITS-MODEL-v1`: a Crafted Image is 5 credits, debited at craft start,
refunded on studio failure. **Ratio and pack table are pending Rich's ruling** —
wire the debit path, not the numbers.

## 7 · Curator voice

`#curNote` advises on composition. It does not sell.

Two lines in the philosophy doc carried price grammar and are struck in the v2
amendment — *"the next image is nearly half price"* and *"add another and each
drops 10%"*. Do not reintroduce that register. Pricing appears as data in
`#tbcPrice` and `#payTotal`, argued nowhere.

## 8 · Crafting and failure

| Hook | CC responsibility |
|---|---|
| `#crafting` | Progress surface. |
| `#craftBar` | Progress. Never synthesise motion the engine isn't reporting. |
| `#craftTitle` / `#craftSub` | Status copy. |
| `#retryBtn` | Retry path. |

Studio failure offers three parallel remedies — **Recraft · Credit · Refund** —
never ranked, never defaulted. Recraft costs 0 credits.

## 9 · Collection and outputs

| Hook | CC responsibility |
|---|---|
| `#railCollection`, `#collView`, `#collTabs`, `#collLatest`, `#collLine` | Collection surfaces. |
| `#lightbox` + `#lbImg` `#lbName` `#lbFx` `#lbPrev` `#lbNext` `#lbClose` | Lightbox. Arrow keys and Escape. |
| `#actDownload` | Download the file. |
| `#actPrint` | Route to Print Shop. |

**The intent gate lives here, not in Print Shop.** Arriving at the Print Shop
already means print. Mobile Wallpapers is download-only, 9:16, and must not
appear in Print Shop filters.

## 10 · Sets

`#setsView`, `#svGrid`, `#svPrev`, `#svNext`, `#svBack`.

**Sets are cut for Aug 1.** The markup stays; do not wire it. Flag-hide rather
than delete — same pattern as Gallery Canvas in Print Shop.

## 11 · Navigation and QA

`#navWorkshop` / `#navCollection` — surface switches.
`#rightRail` — container only.
`#qaPanel` — internal, never shipped visible. Confirm it is gated before launch.

---

## Definition of done

- Every hook above is bound, or explicitly reported as not-yet-applicable.
- No markup or CSS changed. HTML diff clean.
- `scripts/boot-test.js` passes — it exists because a `const` was used ~1,800
  lines above its declaration and only failed at runtime.
- Browser console clean on boot.
- All 13 existing `fetch()` calls in `public/portraits.html` still present and
  functioning.

## Known defect to fix during the port

`body{min-width:1440px; overflow:hidden}` in r80d is a floor with no release
breakpoint. Below 1440 the page clips with no way to scroll to what is cut. The
`--container` ladder inside the file is correct and releases properly at 1849 /
1199 / 767; this one line does not. **Release it or remove it** — the identical
bug in `.container{min-width:1850px}` clipped the masthead on Print Shop and
Account.
