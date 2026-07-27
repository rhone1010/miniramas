# CC PAYLOAD — Liten & Co, Aug 1 Release
**From:** CUI · **Date:** 2026-07-22 · **Route:** CUI → CLAW → CC
**Status:** first handover. CC has received nothing before this.

Read this file first. It indexes everything and states the order of work.

---

## Release scope (locked)

**Five Series only:** Portraits · Pets · Groups · Action · Mobile Wallpapers.
Houses, Landscapes, For Fun, The Artist Series are **out** — no tiles, no cards,
no placeholders.

**Cut:** Sets. **Paused:** Print Shop (branch preserved, resumes next release).

**Path:** Homepage → entry gate → Portraits workshop → My Collection → download.

---

## File manifest

| File | Type | Use |
|---|---|---|
| `CC-PAYLOAD-MASTER-2026-07-22.md` | this file | index + order of work |
| `CC-PAYLOAD-portraits-2026-07-22.md` | spec | 7 portraits client tasks, line-verified |
| `SPEC-autonaming-2026-07-22.md` | spec | naming step (supersedes Task 6 in the above) |
| `litenco-portraits-2026-07-21-r77.html` | design ref | source for naming markup/CSS/JS |
| `litenco-account-2026-07-22-r6.html` | design ref | Account page — build to this |
| `litenco-tokens.css` | asset | shared tokens, resets, masthead |
| `portraits.css` | asset | workshop styles |
| `portraits.ui.js` | asset | UI behavior, 0 backend calls |
| `portraits.wizard.js` | asset | step controller (route seam) |
| `litenco-printshop-2026-07-21-r9.html` | parked | do not build for Aug 1 |

---

## Ground rules — apply to every task

1. **Never edit `public/portraits.html` directly.** Copy to `portraits.next.html`,
   work there, verify, merge. Definition of Done gate applies.
2. `portraits.html` carries **13 `fetch()` calls across 10 routes**. No task in
   this payload requires touching one. If a change seems to, stop and report.
3. Routes present, do not disturb: `analyze`, `curate-effects`,
   `curate-upper-body`, `generate`, `raw-pipeline`, `gate`, `pieces`,
   `checkout`, `qa/settings`, `samples`.
4. Copy law: action verb is **Craft**, never Create. Banned customer-facing
   verbs: **off, save, discount, queue, render**. "Crafted Images" is a paired
   phrase, capital C capital I. Never "sculpture/sculpted/sculpt".
5. Responsive/breakpoints are **CUI-owned and come last**. Do not attempt.

---

## Order of work

**A. Confirm the floor** — is the backend restored to commit `8796549`
(route.ts + engine .ts modules)? CUI cannot see repo state. Confirm before
anything else. If not done, do it first and verify the request/response contract.

**B. Portraits client corrections** → `CC-PAYLOAD-portraits-2026-07-22.md`
Tasks 1–5 and 7. All line-verified against the live 9,872-line file.
Ship-blockers: strip tier pricing (T1), flag-gate Artist Series (T3),
redirect CTA (T4), consent checkbox (T5).

**C. Auto-naming** → `SPEC-autonaming-2026-07-22.md`
Optional "Who is this?" at Frame; `[Effect] — [FirstName] #[n]` defaults;
intercepts `runAll()`. **Use this file, not Task 6 in the portraits payload.**

**D. Download end state** — §1 below.

**E. Account page** — §2 below.

**F. Homepage cut** — §3 below.

**G. CSS/JS split** — §4 below. Optional for Aug 1.

**Not specced, needs a product decision first:** identity / entry gate (§5).

---

# §1 · Download end state  🔴 ship-blocker

**Status:** `downloadPiece()` works — blob logic and taxonomy-ID filenames
confirmed good, do not touch. The **terminal screen** does not exist.

After a piece is crafted and downloaded, show two soft CTAs and nothing else:

    Craft another          → returns to upload, clears the source
    Your Collection        → opens My Collection

**No commerce on this screen.** No print upsell, no pricing, no tier language,
no Print Shop link. This is the end of the Aug 1 path.

Verify: both CTAs work; download still produces taxonomy-ID filenames;
no price string renders anywhere on the screen.

---

# §2 · Account page  🔴 ship-blocker

**Build to:** `litenco-account-2026-07-22-r6.html` (design reference, complete).

First-login destination, plus a masthead entry point.

**Layout (locked global system):**
- Content container **centered, 86% wide, max 2200px, min 1850px**
- Header **72px**
- Sidebar **17%** / main **83%**
- Radius: cards 12px, panels 16px, buttons 999px
- Elevation: cards `0 8px 24px rgba(0,0,0,.08)`, panels `0 18px 48px rgba(0,0,0,.12)`
- Spacing rhythm: 8 / 12 / 20 / 32 / 48 / 72px
- Texture: background stone 6%, noise 3%. **No paper, leather, or wood.**

**Live for Aug 1:**
- Identity strip — avatar, name, "Collector since", email, **Sign Out**
- Crafts remaining ("38 of 50") with progress bar
- Welcome hero → **Continue Crafting** (resumes workshop)
- **My Collection folded in as the page body** — series chips
  (All · Portraits · Pets · Groups · Action · Wallpapers), piece grid,
  hover download, total count. Contained, not a separate route.
- **Invite Friends** (referral) — share code, copy affordance, progress
  counter "2 of 3 friends joined · 1 to go"
- **Craft This Again** — right rail, with source thumbnail
- **Print History** — sidebar entry
- **Cart** — masthead
- Discover & Craft — Try Groups / Try Pets / Try Action, plus a reserved
  **Mobile Wallpapers** slot ("Make a wallpaper from a piece you already
  crafted") marked Coming soon

**Built but flag-hidden for Aug 1:**
- **Buy Credits** (both the masthead pill and the rail card). Ship the markup,
  hide behind a flag. Note: the `hidden` attribute alone is not enough —
  `.buycred{display:flex}` overrides it. The reference file includes
  `[hidden]{display:none!important}`; keep it.

**Credits design rules (gallery register, not arcade):**
- No low-balance nag, no depleted meter, no countdown pressure
- No bonus-credit tier ladders — quiet quantity pricing only
- Buying is a considered act inside Account, **never an interstitial mid-craft**

**Structural room only — do not wire:** Saved Source Photos, Credits & History,
Redeem a Code, Profile & Security, Preferences. Dimmed so they read as
coming-soon, not dead links.

**Absent by design:** Sets, Billing & Plans, Pro/Upgrade, Order History,
Rewards, Materials Unlocked, Houses, Landscapes.

---

# §3 · Homepage cut  🟡

**File:** `homepage-light.html`

1. **One primary CTA.** Keep **"Upload Your Photo"** → Portraits workshop.
   **Remove "Start with the Curator"** (verified present).
2. **Five series tiles, each wired.** Portraits · Pets · Groups · Action ·
   Mobile Wallpapers. **Remove Houses, Landscapes, For Fun** (all verified
   present). No ghost tiles — every tile must lead somewhere real.
3. Headline stays locked: *"We turn your photographs into Crafted Images."*
   Sub-line: *"Your favorite moments, reimagined by the studio — kept as
   digital files, printable on demand."*

---

# §4 · CSS / JS split  🟢 optional for Aug 1

Four extracted modules are supplied, all validated (`node --check` passes on
both JS files; CSS brace-balanced).

| File | Lines | Role |
|---|---|---|
| `litenco-tokens.css` | 29 | tokens, resets, masthead — **shared across surfaces** |
| `portraits.css` | 514 | workshop-only |
| `portraits.ui.js` | 138 | UI behavior — **0 backend calls, verified** |
| `portraits.wizard.js` | 680 | step controller — the route seam |

Link order: `litenco-tokens.css` **before** `portraits.css`.
JS before `</body>`: `portraits.ui.js`, then `portraits.wizard.js`.

**Two warnings:**
1. These were extracted from **r77, which is fetchless** (0 fetch calls). They
   are a UI reference. The port direction is **r77 UI → into `portraits.html`**,
   never the reverse. Do not ship r77 as the client.
2. `litenco-tokens.css` is the workshop's vellum/coffee palette. Account and
   Print Shop use the newer limestone layout lock. **Two token systems exist.**
   Do not reconcile them during Aug 1 work.

Ship as one file if time is short. This is a refactor with no user-visible
benefit — it earns its place only if you are already opening the file.

---

# §5 · Identity / entry gate  ⚫ blocked, not specced

Verified absent — essentially zero hits for magic-link or supabase auth in
`portraits.html`. Supabase Auth is the unbuilt foundation under Account,
My Collection persistence-per-user, credits, and referral.

The locked intent was: **code field + magic-link sign-in + one consent
checkbox**, before render. The consent checkbox is specced (portraits payload
Task 5) and can ship independently. **Sign-in cannot be specced until someone
decides whether Aug 1 testing is code-gated, magic-link, or open.**

CLAW: this is the decision that gates the most surface area. Everything else
in this payload can proceed without it.

---

## Report back

1. Backend restore status (commit `8796549`) — done or not
2. Any route response field left with nowhere to land after tier-strip (T1)
3. Whether hiding Artists Gallery breaks the Location control (T3)
4. Groups map drift between `portraits.html` and `groups-shared.ts` (T7)
5. Anything in the Account reference that has no data source yet
