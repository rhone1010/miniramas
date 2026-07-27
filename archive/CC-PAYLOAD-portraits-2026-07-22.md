# CC Payload — Portraits client, Aug 1
**From:** CUI · **Date:** 2026-07-22 · **Target:** `public/portraits.html` (9,872 lines, wired)
**Status:** first CC drop for this file. Nothing has been handed over before this.

All line numbers below were verified against the live file on 2026-07-22.

---

## Ground rules

1. **Do not edit `portraits.html` directly.** Copy to `portraits.next.html`,
   work there, verify, then merge. Definition of Done gate applies.
2. **The file carries 13 `fetch()` calls across 10 routes.** None of the tasks
   below touch a route. If a change requires touching one, stop and report.
3. Every task here is copy/scope/UI. No pipeline or prompt work.

Routes present (do not disturb): `analyze`, `curate-effects`, `curate-upper-body`,
`generate`, `raw-pipeline`, `gate`, `pieces`, `checkout`, `qa/settings`, `samples`.

---

## TASK 1 — Strip tier pricing from the workshop  🔴 ship-blocker

**Verified.** Block is at **4662–4669**, exactly as reported.

Remove `#resolutionControl` in full (4662–4669), including the `Quality`
control-head and all three pills:
- `Web Quality · included` (`data-res="1k"`)
- `Print Quality · + $2.00` (`data-res="2k"`)
- `Collector Print · + $4.99` (`data-res="4k"`)

Quality is a Print Shop concern. Leaving it here creates the double-charge trap:
workshop sells "+$2 print quality," Print Shop then reprices from $99.

**Downstream removals — all verified present:**

| Line | Item |
|---|---|
| 4038–4039 | `/* quality ledger (resolution) */`, `#resolutionPills.ledger-q` |
| 6937–6944 | `#resolutionPills .pill-lg` rebuild loop |
| 6945 | `onResolutionPick()` |
| 7065 | `if (item.resolution && item.resolution !== '1k')` subtitle append |
| 7841 | `RESOLUTION_LABEL` map |
| 2416, 2425–2426, 3481–3495, 3530–3531 | `.control.resolution` CSS rules |

**Do NOT remove** — different concern despite the name: the Tier 1 *source-photo*
resolution gate at 5340–5348, 5473, 5534, 5549, 6421, 6542. That judges the
customer's uploaded photo, not an output tier. Leave intact.

Check `state.resolution` / `item.resolution` writers and default them to `1k`
so nothing downstream reads undefined.

---

## TASK 2 — Remove discount language from the price block  🟡 dead code, still remove

**Correction to the report:** this markup exists but **never renders today.**
`PRICING.tiers` (5113–5115) contains a single tier:

    { minCount: 1, perPiece: 4.99, off: '0%' }

`tier.off` is therefore always `'0%'`, so the strikethrough/percent branch at
**7073–7075** never fires, and `packs: []` is empty. No customer currently sees
"off" language. This is **not** live copy — it is dormant code that would
reactivate the moment a second tier is added.

Remove anyway, so it cannot come back by accident:

- **7073–7075** — collapse `priceBlock` to current price only:
  `<span class="now">${formatUsd(tier.perPiece)}</span>`
- **6871–6873** — same collapse in the `addPrice` path (drop the `was` branch)
- **6908** — `tr.textContent = currentTier.off …` → remove
- **7035** — `const rate = (N >= 2 && tier.off !== '0%')` → simplify
- **1905** — `.queue-row-price .off` CSS → remove

Leave `off:` in the `PRICING` object as an unused field, or drop it — either is
fine, but no customer-facing surface may read it. Banned verbs stand:
**off, save, discount, queue, render.**

---

## TASK 3 — Flag-gate Artist Series  🔴 ship-blocker

**Verified.** `ARTISTS_PRES` at **5057–5063** — six materials: Impressionist,
Torn Paper, Folded Book, Charcoal & Chalk, Pencil Sketch, Sheet Music.

**Gate behind a flag; do not delete.** It returns post-launch at premium pricing.

    const FLAGS = { artistSeries: false }

Touch points — 22 references total, key ones verified:

| Line | Item |
|---|---|
| 4563–4566 | comment block describing Artists Gallery |
| **4574** | `<button … data-series="artists_gallery" …>Artists Gallery</button>` — **hide when flag off** |
| 5054–5063 | `ARTISTS_PRES` definition |
| 5252 | style comment |
| 5611–5615 | `state.style === 'artists_gallery' ? ARTISTS_PRES : PRES` |
| 5626–5645 | series switch: clears location, hides Location control |
| — | 8 × `artists_gallery` entries in `MATERIAL_LOCATIONS` |

Minimum viable gate: hide the series button (4574) and make `onSeriesClick`
reject `'artists_gallery'` when the flag is off. Leave data structures in place.
Verify the Location control still shows correctly, since the series switch
currently hides it for Artists Gallery.

---

## TASK 4 — Redirect CTA  🔴 ship-blocker

**Verified absent.** `status:'redirected'` is handled at **7070**:

    title = 'Better in another Series'; sub = item.error || ''

The engine's message renders, but there is **no button to act on it.** This is a
terminal stall on the single most likely first-timer mistake — a pet or a
landscape dropped into Portraits.

Add a CTA to the redirected state that carries the customer to the suggested
Series. Aug 1 scope is five Series only: **Portraits, Pets, Groups, Action,
Mobile Wallpapers.** If the engine suggests an out-of-scope Series (Houses,
Landscapes), fall back to copy without a dead button — do not link to a Series
that does not ship.

Do not alter `friendlyReject()`, the 500 catch path, or `intake_rejected`
handling — all confirmed good.

---

## TASK 5 — Consent at upload  🔴 ship-blocker

**Verified absent** — zero hits for consent / rights / terms / privacy across
9,872 lines.

Add a single checkbox at the upload step, blocking Craft until ticked:

    ☐ I have the right to use this photo and agree to the Terms.

One checkbox, one line, links to Terms and Privacy. Not a modal, not a
multi-step flow.

---

## TASK 6 — Auto-naming (from r77, approved by Rich)  🟢 additive

Port the "Name your pieces" step from `litenco-portraits-2026-07-21-r77.html`.
Sits between Craft and Pay: `To Be Crafted → [Craft] → NAME → Pay`.

**Source in r77:** `#nameStage` markup (`<!-- NAME YOUR PIECES -->`), CSS section
`/* ===== Name your pieces ===== */`, and JS `nameRowHtml` / `rerenderNames` /
`wireNameRows` / `openNaming` plus helpers `aiName()`, `moderate()`, `esc()`
and the `NAME_A` / `NAME_N` lists.

**Behavior:**

1. **Pre-fill** each row with the locked default `[Effect] — [FirstName] #[n]`
   (e.g. `Reclaimed Bronze — Daniel #1`). `[Effect]` = the pick's existing
   `label`; `#[n]` = per-source sequence from 1.
   **No duplicate-name block** — two pieces may share a name. No dedupe,
   no warning, no auto-suffix beyond the natural `#n`.
2. **Editable** free-text. `input` → `bag[i].name`; `blur` → `moderate()`.
3. **Suggest** button (r77's `↻ suggest`) rerolls via `aiName()` — the
   alternate-name path, not the default.
4. **Moderation** — port `moderate()` unchanged: empty → `Untitled portrait`,
   banned word → reject + red border + `Please choose a different name`,
   clamp 60 chars. Re-validate on Continue; block only on banned words.

**Copy fix — r77's string is corrupted, do not port verbatim.** It reads:

    Each has a suggested name I've suggested a name for each — keep it, or make it yours.mdash; edit it, or tap Suggest for another.

Replace with:

    I've suggested a name for each — keep it, edit it, or tap Suggest for another.

**Persistence:** `bag[i].name` flows through the existing `/api/v1/portraits/pieces`
POST. Per MASTER-LOCKED-ELEMENTS, `collection_pieces.label` is **metadata only —
never rendered into the image** and never passed into a prompt payload.

**Open item — needs Rich.** `[FirstName]` has no source in the engine today.
Options: (a) capture once at Frame ("Who is this?"), reuse per source photo —
recommended; (b) derive from account; (c) drop the token → `[Effect] #[n]`.
**Ship (c) as fallback** so the step is not blocked; keep `[Effect]` and `#[n]`
logic structured so (a) is a one-line addition.

---

## TASK 7 — Verify, do not change  🔵 investigation

The file carries Groups comments and registries verbatim — an inheritance
artifact from Series Inheritance:

- **5038** — `// Style has been removed — Groups is now a flat Material × Location matrix.`
- **5070** — `// groups-shared.ts — keep them in sync.`

Confirm the two maps have not drifted apart. Report findings; do not
unilaterally reconcile.

---

## Confirmed good — do not touch
`friendlyReject()` copy · 500 catch path · `intake_rejected` handling ·
`downloadPiece()` blob logic and taxonomy-ID filenames · the Tier 1 source-photo
resolution gate · `/pieces` persistence (migration 006) · `/gate` source
pre-check.

## Explicitly out of this drop
Responsive/breakpoints (CUI owns, comes last) · CSS/JS file split (post-Aug-1) ·
Print Shop · Sets · Houses · Landscapes.

## Report back
- Any route response field left with nowhere to land after TASK 1
- Groups map drift (TASK 7)
- Whether hiding Artists Gallery breaks the Location control (TASK 3)
