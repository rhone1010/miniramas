# SPEC REQUEST → UI-Claude · Portraits OCCUPIED states · 2026-07-11

**For UI-Claude.** The empty-state shell is locked and verified — do NOT re-open it.
This asks only for the states the proto never showed: the workshop **with a photo in**.
CC (build-Claude) has the shell working and is inferring these; that inference is the
only remaining churn. Lock them and CC builds to spec in one pass.

## LOCKED — do not change (context only)
- `Prototype Files/portraits-proto.html` = the EMPTY workshop. Passes A–H.
- Shell = `masthead` + `.stage` flex with **adv · curator · main · colrail** (+ `.tbc`
  5th column when carrying). Widths, tokens, fonts, masthead, deckle filter values,
  `$4.99`, Advanced-starts-closed rail — all locked.
- Deckle is **Curator-card only** (feTurbulence `0.014 0.016`, seed 7, scale 5.5).
- Assets: `assets/shared/{shell.css,shell.js}`, `assets/portraits/{portraits.css,
  portraits.js,integration.css}`. Engine renders into the columns; CC scopes engine
  CSS so proto presentation wins.

## NEEDED — the occupied states (deliver a "loaded" proto OR per-state rules)

Ideal deliverable: **one `portraits-proto-loaded.html`** = the same shell with a photo
loaded, showing each column's occupied content. If not a full proto, then explicit
per-column rules for each state below.

### The five-spine occupied layout — lock each column's content
1. **`.adv`** — unchanged (closed rail; opens to the disc/setting/framing/recipe/ledger).
2. **`.curator`** — the ONE Curator card. Lock:
   - Does the card show: **masthead → voice → framing preview**, in that order? Or voice
     then framing? Is the face-aware framing (drag/zoom/tap) **inside** the deckled card
     or a separate element below it?
   - ONE header ("Curator") and ONE deckle edge on this card — confirm.
   - What the voice says at each step (analysis vs. "finishes I'd choose").
3. **`.main`** (Suggested spine) — the suggested grid + preview. Lock:
   - Grid **column count** and **card size** (it must fill a WIDE `.main`; with Advanced
     closed `.main` is ~760px, carrying ~530px — 5 tiles currently leave dead space).
   - Card design (image, label, quality chip, ADD, Curator's-pick star) + the header
     ("Chosen for you"?). Where the **Studio Bundle / All-5** cell sits.
   - Where the source **preview/thumbnail** goes (in `.main`? in `.curator`?).
4. **`.tbc`** — To Be Crafted (appears on first finish selection). Card design, the
   name-this-piece field, Craft button, totals.
5. **`.colrail`** — My Collection. Resting rail (series list) vs. populated (rendered
   pieces) — what shows when.

### State sequence — what each column shows at each step
`empty → analyzing → suggested → carrying(+tbc) → crafting → done`. A one-line note per
column per state is enough (e.g. "carrying: .main keeps grid; .tbc slides in; .curator
holds voice").

### The specific decisions CC keeps guessing (please just answer these)
- Curator card: framing **inside** the card or below it? voice-then-framing or reverse?
- Suggested grid: how many columns, and does it left-align or fill/stretch across `.main`?
- Source thumbnail: which column?
- One deckle confirmed on the Curator card only (the engine also has a curator paper —
  CC neutralizes it; confirm that's right)?

Anything not answered, CC will keep as its current best-effort and flag it.
