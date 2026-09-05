# LIVE-FILE-LEDGER.md

**Canonical file map. Read this before touching any file.**
Rewritten 2026-07-31 by CHK, superseding the 2026-07-24 version. Every line
count, id count, fetch count and function count below was machine-read from
`node scripts/boot.js` at 2026-07-31 17:34. Rows removed in that rewrite are
listed at the foot — nothing vanished silently.

**Rule:** reference files as **path + role + date**, never by name alone.
Versioned filenames may be references, not live. When counts disagree between
sources, stop and reconcile before acting.

**A file with 0 fetch calls is a prototype** — a specification, never wired.
**A file with fetch calls is an engine.** Never drop one onto the other.

---

## Portraits

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `public/portraits.html` | — | **The live engine. The wiring target.** Not yet written; ruled by Rich 2026-07-31. This is the file that goes live. Everything below feeds it. |
| `public/portraits-b2.html` | 8877 · 143 · 10 · 203 | **Donor.** The only file in the repo that completes a craft end to end. Source for the five wiring builds. Holds in `public/` until `portraits.html` replaces it — not before. |
| `public/portraits_recover2.html` | 8825 · 143 · 9 · 201 | **Recovery base** per `LOCKED-DECISIONS`. Boots clean, reaches Stripe. Do not move. |
| `docs/SURFACES/portraits/litenco-portraits-2026-07-24-r81.html` | 1896 · 67 · 0 · 70 | **Design reference.** Canonical UI, fetchless. r80d is dead — ruled 2026-07-31. |

## Stage

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `public/litenco-stage-2026-07-30-s72.html` | 3830 · 70 · 0 · 52 | **Canonical stage.** Gated by `scripts/gate-stage.js`; boot §7b passes all five checks. Tokens registered in `docs/SYSTEM/SURFACE-TOKENS-2026-07-31.md`. |

s58–s69 archived to `archive/2026-07-31/stage/` on 2026-07-31. Tracked and
recoverable. s70 and s71 never landed in `public/` — expected, not a gap.

## Print Shop

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `docs/SURFACES/print-shop/litenco-printshop-2026-07-24-r28.html` | 1693 · 66 ⚠dup · 0 · 11 | **Canonical.** v2 locked tokens. Hook contract v3 written against it. ⚠ boot flags duplicate ids — unresolved. |

## Masthead

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `docs/SURFACES/masthead/litenco-masthead-2026-07-24-r2.html` | 286 · 7 · 0 · 0 | Reference build for `MASTHEAD-DIRECTIVE-v1`. Espresso, ruled. Drops into every surface unchanged. |

## Account

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `docs/SURFACES/account/litenco-account-2026-07-24-r7.html` | 347 · 2 · 0 · 0 | **Canonical.** v2 tokens, floor released at 1849, rem type. Masthead not yet dropped. |

## Entry gate

| File | Lines · ids · fetch · fn | Role |
|---|---|---|
| `docs/SURFACES/entry-gate/litenco-entrygate-2026-07-24-r1.html` | 375 · 21 · 0 · 3 | Canonical. Absent from the 07-24 ledger entirely; added 2026-07-31. |

## Homepage

| File | Role |
|---|---|
| `app/page.tsx` | **Dead — never renders. Corrected 3 September.** `middleware.ts` PAGES maps `'/'` and `'/home'` to `/index.html`, so every request for the homepage is rewritten past this file before the App Router reaches it. The live homepage is `public/index.html`. The homepage cut recorded here was applied to this file and is therefore not what ships. The underlying question — which of the two is meant to be canonical — is open and untouched; only this row's claim has been corrected. |

## Other Aug-1 series — attach to the proven path after Portraits

| File | Lines · ids · fetch · fn |
|---|---|
| `public/pets.html` | 5939 · 89 · 3 · 106 |
| `public/groups.html` | 464 · 11 · 0 · 10 |
| `public/actionmini.html` | 2266 · 50 · 4 · 35 — **Archived 3 September.** Action is out of the five, see below. |
| `public/portrait-wallpaper.html` | 486 · 16 · 2 · 15 |
| `public/pet-wallpaper.html` | 483 · 16 · 2 · 15 |

Aug 1 scope was five Series: Portraits, Pets, Groups, Action, Mobile Wallpapers.

**Superseded 3 September — Action is out, Halloween is the fifth.** The five
are now Portraits, Pets, Groups, **Halloween**, Mobile Wallpapers.

**Action was never reachable, in any of the six repos.** `public/actionmini.html`
is listed in `.vercelignore` and has no `middleware.ts` PAGES entry, so nothing
on the domain ever linked to it — the reference audit of 3 September found zero
references from any deployed page. Two faults sat behind that: the page calls
`/api/v1/actionmini/analyze-render`, which does not exist, and the homepage tile
pointing at it lives in `app/page.tsx`, which middleware rewrites past
(`/` → `/index.html`), so it never rendered either. Halloween took the fifth
slot in practice — `/halloween` and `/pets/halloween` are both in PAGES and both
linked from the live homepage.

**Do not reopen Action on the strength of the engine being intact.**
`lib/v1/action/` (9 files) and its two routes were archived 3 September to
`H:\LITENCO-ARCHIVE\02-SUPERSEDED-BUILDS\<repo>\`. Nothing was deleted and
restoring it is a move back. What was missing was the routing, not the engine —
reopening means a PAGES entry, an `.vercelignore` removal, and fixing the
`analyze-render` call, not rewriting the Series.

**Archived 3 September** (dead, zero importers outside their own set): Sportsmem,
Interiors, Stadium, Moments, Action, and `lib/v1/generators/` (11 files).

**Held in place** on Rich's instruction, not archived: Houses, Landscapes, their
routes and HTML, and `lib/shared/subject-redirect.ts`. That last one is live —
the Portraits gate imports it, and it still names Houses and Landscapes to
customers in the Curator's Note.

**Out of Aug 1:** `public/houses.html` (4069) · `public/landscapes.html` (2230)
· `public/interiors.html` (122) · `public/sportsmem.html` (371).

## Bench and tooling — never ported into a surface

`public/groups-testbench.html` (286 · 1 fetch) ·
`public/liten-prompt-bench-v3.html` (273 · 0 fetch) ·
`public/print-config.html` (436 · 0 fetch) · `public/index.html` (552 · 0 fetch).

Standing gate: bench tooling never ports forward into a surface.

## Supabase migrations

Applied **through 011** — confirmed by Rich 2026-07-31.
⚠ Two copies of `009_credits_and_codes.sql` exist. `supabase/migrations/`
governs. The duplicate is unresolved and awaiting a ruling.

## Scripts

`scripts/boot.js` — the boot report. Machine truth; outranks every document
including this one. Run it before proposing anything and after any archive.
`scripts/gate-stage.js` — the stage contract gate.

**Two open boot defects, reported 2026-07-31, not fixed — CHK does not write
code.** §1 renders `Last commit: ?` unresolved, and truncates the first
character of paths in the modified/untracked lists (`OOT-REPORT.md`,
`recovery/at-19c3157`).

## Engine lists — three doors, one lock

Read from `lib/` by boot §4. When they disagree, effects go missing.

- `PRESET_LABELS` — `lib/v1/portraits/portraits-shared.ts` — 17 entries
- `EFFECT_CATALOG` — `lib/v1/portraits/portraits-effect-curator.ts` — 12 entries
- `EXPERIMENTAL_EFFECTS` — `lib/v1/portraits/portraits-experimental.ts` — 14 entries

⚠ Five presets render but the Curator cannot name them: `plushy`, `pewter`,
`chocolate`, `stained_glass`, `driftwood_resin`. The Curator is the customer
path — an effect it cannot name is invisible. CENG's, not CHK's.

---

## REMOVED 2026-07-31 — what the 07-24 ledger said, and why it went

| Row | Why removed |
|---|---|
| `public/portraits.html` — "**Live engine** (13 fetch calls), currently pre-merge/boot-broken" | Not on disk. Rich ruled 7/31: it is the target, not yet written. The 13-fetch claim was never true of a file that exists. |
| `public/litenco-portraits-2026-07-24-r80d.html` — "**UI base.** Approved design." | Superseded by r81; Rich ruled 7/31 that r80d no longer matters. Not on disk. |
| `public/portraits.next.html` — "**Behavior reference.** Port FROM." | Not on disk. Being recreated as the wiring proceeds. |
| `archive/litenco-portraits-2026-07-21-r77.html` · `public/portraits-proto.html` | Both marked "do not use". Neither on disk. No value in carrying dead rows. |
| `public/printshop.html` — "**STALE** (`--lime`), archive" | Not on disk. Nothing to archive. |
| `public/homepage-light.html` — "Design reference only" | Not on disk. |
| Extracted modules: `portraits.css` · `portraits.ui.js` · `portraits.wizard.js` · `litenco-tokens.css` | Boot §2 scans `.html` only, so none could be confirmed this pass. Removed rather than asserted. **Restore these rows once verified on disk.** |
| `scripts/boot-test.js` — "mandatory boot gate" | Unverified. The gate that exists and runs is `scripts/boot.js`. |
| Header: "CC reads this before touching any file (per `AGENTS.md` §4)" | CC is retired. `AGENTS.md` is a stale root file, dated 18 March, pending Rich's ruling. |

Six of these files are absent because they are being recreated as the build
proceeds — Rich, 2026-07-31. Their absence is not loss and needs no recovery.
