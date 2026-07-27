# POST-WALK FIX BATCH — 2026-07-25
First end-to-end walk PASSED. Batch C effect mapping VERIFIED (5 effects → 5 correct finishes). Below is everything the walk surfaced, split by owner. Target file for all wired changes: **`public/portraits.html`** (the wiring target).

---

# → CC · defect + CSS batch (all against `portraits.html`)

**All items are locked decisions not reflected in the build, or exact CSS values. No design judgment — apply, report diff, HTML byte-identical except named lines.**

## A · Convert pay flow to CREDITS (per CREDITS-AND-CODES-SPEC-v4)
The pay flow still runs the old dollar/Stripe model. Grep confirmed 11 hits.
1. **Line 888** — `Pay $4.99` button → credit debit: "Craft · N images · [N×cost] credits". No dollar figure.
2. **Lines 1136 / 1232 / 1245** — replace `orderTotal()` dollar math with credit cost. Pay total, To-Be-Crafted total, pay-item lines all in credits, not `$`.
3. **Lines 890 / 1248** — delete "wires to Stripe / email at secure checkout" note. No Stripe language in the craft flow.
4. **Line 1977** — refund copy "Refunded to your card $9.99" → source-aware: "credit returned" (test = no card charged). Spec v4 §5.

## B · Remove resolution tier pills (were cut in first strip pass — regressed/present)
5. **Lines 831–832** — `Print Quality +$2.00` / `Collector Print +$4.99` tier rows. Remove per original Task 1 / cover §3. Digital-only, one output, no tiers. Also clear any `orderTotal` extra/`advState.extra`/`.lrow` readers left dangling.

## C · CSS sizing values (exact — apply verbatim, do not restyle beyond these)
6. **Logo** → ×2 current size.
7. **`.tbc-pill .pf`** → `font-size: 16px`
8. **`.btn`** → `font-size: 26px`
9. **`.mainnav a`** → `font-size: 2rem`
10. **`.adv-add`** → `font-size: 26px`; **remove** `width: 100%`
11. **Selected-state checkmark** → match the "+" color (currently green-on-brass; make it the same gold/brass as the "+").

## D · Verify clean after
Re-grep must return ZERO hits in the pay/craft flow: `$` · `Stripe` · `4.99` · `Print Quality` · `Collector`.
Boot-test green. HTML diff = only the named CSS lines + script-confined logic. Report per fidelity format.

## E · Stale-model sweep (root-cause, do this in the same pass)
r80d predates the credits/tier/consent decisions, so it carried stale pay markup. Grep r80d-origin markup for OTHER stale remnants so we stop finding them one screenshot at a time: `sculpt` · `sculpture` · `plaque` · `plinth` · `nameplate` · `quality` · `Web Quality` · `resolution` tier. Report any hits; remove per locked decisions (tiers/quality out, sculpture→Crafted Images).

---

# → CENG · plaque regression (PRIORITY — it's in the render output)

Every craft renders a **"Liten & Co · 2025" plaque** at the base of the piece. Plaques were cut weeks ago. This is baked into the generated image = **prompt/engine, not UI.**
- Grep portraits prompt files (`portraits-prompt.ts`, `portraits-shared.ts`, composition/universal blocks) for: `plaque` · `plinth` · `nameplate` · `Liten & Co` · base-inscription · `2025`.
- Remove it.
- **Report HOW it re-entered** — likely a universal/always-on block (the known "universal blocks must not embed staging assumptions" failure mode). Removing without finding the source means it returns a third time.
- Still owed: source-aware failure copy strings ("credit returned" not "refunded to card"); per-series redirect messages.

---

# → CUI · source-of-record for the CSS values above + responsive

CUI defines the values; CC applies them to the wired `portraits.html` (single-file discipline during wiring). CUI keeps these in the design files too so r80d and the live file don't diverge.
- Logo ×2 · `.tbc-pill .pf` 16px · `.btn` 26px · `.mainnav a` 2rem · `.adv-add` 26px (drop width:100%) · checkmark = "+" color.
- **Responsive reflow** — floor is 1280 (set); mid-range still clips at 1440 per walk. Continue the reflow down through the ladder.
- **Masthead drop** — still open: drop the r2 shared masthead into all three surfaces (all now token-ready). Not done by the Account rebase.

---

# LOGGED — not this batch
- **Map-drift watch (CENG reconciliation pass):** pill effect segment uses curate `preset_label`; server uses `PRESET_LABELS[preset]`. If they drift, provisional pill prefix won't match stored label — cosmetic, self-corrects at craft. Same class as Groups map drift — fold into the one CENG map-reconciliation pass before Jul 31.
- **Cosmetic:** loaded-collection pieces show raw preset id (walnut) not label — `/pieces` GET returns no preset_label; fresh crafts show nice label.
- **Autonaming: DONE** — provisional pill / server-final, option 1. One composer, four surfaces. No action.

---

# RICH'S WALK (after CC's A–D land + re-grep clean)
1. Pay step shows CREDITS — no `$`, no Stripe, no tier pills.
2. Batch C effect mapping still true (held from first walk).
3. Autonaming pill `Portraits - Bronze - rich` (no #); collection card `... - 001` after craft.
4. Plaque GONE from renders (after CENG lands — separate from CC batch).
5. Sizing: logo, nav, buttons, queue font all read at the new sizes.
