# SPEC → CC · PORTRAITS OCCUPIED STATES · 2026-07-11
**From UI-Claude.** Answers the four decisions CC keeps guessing + locks each column per
state. Empty shell is LOCKED (portraits-proto.html, A–H) — nothing here re-opens it.
Format is rules, not a verbatim proto, on purpose: the occupied content is **engine-rendered**
(suggested grid, tbc, collection already exist in the live file). CC is *placing* those regions
into the locked columns, not porting new markup — so this locks placement + behavior.

Tags: **[LOCKED]** = from the Master List / locked shell, non-negotiable.
**[UI-JUDGMENT]** = my call; builds cleanly, Rich may override — but build to it, don't re-guess.

---

## THE FOUR DECISIONS (direct answers)

1. **Curator card — framing INSIDE the card, below the voice. Order: header → voice → framing preview.** [UI-JUDGMENT]
   The source photo + face-aware crop (drag/zoom/tap) lives **inside the one deckled Curator card**,
   beneath the voice line. Rationale: it reads as "the Curator working with your photograph," and
   keeps the card the single home of everything photo-related. Not a separate element below the card.

2. **Suggested grid — FILL/stretch, responsive columns.** [UI-JUDGMENT]
   `grid-template-columns: repeat(auto-fill, minmax(230px, 1fr))`. This fills `.main` at any width:
   ~3 columns when Advanced is closed (~760px), ~2 when carrying (~530px). No fixed count, no
   left-aligned dead space. Cards stretch to consume the row.

3. **Source thumbnail — `.curator` only.** [UI-JUDGMENT]
   The source photo lives in the Curator card (it *is* the framing preview). There is **no** second
   source thumbnail in `.main` or elsewhere. One photo, one home.

4. **One deckle on the Curator card — confirmed, neutralize the engine's paper.** [LOCKED]
   Master List §5: deckle is Curator-card-only. The engine's own curator-paper deckle → **neutralize
   it**, keep the proto's single deckle edge. One header ("Curator"), one deckle, on this card.

---

## THE FIVE COLUMNS — occupied content

- **`.adv`** [LOCKED] — unchanged across all states. Starts closed (rail); opens to
  disc / setting / framing / recipe / dot-ledger. Never restyled by engine CSS.

- **`.curator`** — the ONE deckled card. Contents top-to-bottom: **`C` Curator header → voice line →
  framing preview (source photo + crop control)**. The voice is the only thing that changes by state
  (see sequence). One header, one deckle. [UI-JUDGMENT on order; LOCKED on single-card/single-deckle]

- **`.main`** (Suggested spine) — **"Chosen for you"** header, then the suggested grid
  (auto-fill minmax(230px,1fr)). Each card: render image · effect label · quality chip ·
  **Add** pill · Curator's-pick star on the recommended one. The **Studio Bundle / All-5** cell is a
  full-width row **below** the grid (distinct action, not a same-size tile). [UI-JUDGMENT]

- **`.tbc`** — appears as the 5th column on first Add (absent, not hidden, when empty — [LOCKED] §7).
  Contents: queued piece card(s) · **name-this-piece** field (optional; metadata only, plaque cut) ·
  **Craft** pill · running total. Slides in immediately before `.colrail`.

- **`.colrail`** — My Collection. **At rest:** the series list (Portraits active + others).
  **Populated:** crafted-and-owned pieces join under the current series as they complete. Read-only
  (no ×, no add/delete — [LOCKED] §9). Native aspect first, crop-to-tile only for layout-breaking
  extremes, never cropped in Lightbox.

---

## STATE SEQUENCE — one line per column per state

| state | `.adv` | `.curator` | `.main` | `.tbc` | `.colrail` |
|---|---|---|---|---|---|
| **empty** | closed rail | header + upload invite, no framing yet | mural (empty-state art) | absent | series list |
| **analyzing** | closed rail | source loads into card; voice: "Reading your photograph…" | mural holds (or subtle busy state) | absent | series list |
| **suggested** | closed rail | framing preview active; voice: "Here are finishes I'd choose for you." | "Chosen for you" + suggested grid + Bundle row | absent | series list |
| **carrying** | opens if user designs own | voice holds | grid stays | **slides in**: queued card + name + Craft + total | series list |
| **crafting** | — | voice: "Crafting your piece…" | grid stays; crafting tile shows progress | queued item shows crafting state | series list |
| **done** | — | voice: "Added to your collection." | grid stays (can add more) | item clears from tbc on craft-complete | crafted piece **joins** collection |

Note: `.tbc` is present only while carrying (spawns on first Add, despawns when empty — [LOCKED]).
Crafted pieces move tbc → colrail (To Be Crafted is transient; My Collection is the owned library).

---

## WHAT CC SHOULD NOT DO
- Do not add a second deckle, second Curator header, or a source thumbnail outside `.curator`.
- Do not fixed-count the suggested grid or left-align it — it fills `.main`.
- Do not let engine CSS restyle `.adv` / `.curator` (proto presentation wins on overlap — [LOCKED] §10).
- Do not keep `.tbc` in the DOM when empty (spawn/despawn, not display:none — [LOCKED] §7).

## OPEN FOR RICH (build to the [UI-JUDGMENT] answers; these are the ones he may want to veto)
- Curator card order (framing inside-below vs. below-the-card).
- Studio Bundle as a below-grid row vs. an in-grid cell.
- Whether crafted pieces appear in `.colrail` live during the session or only after checkout.
