# RETRIEVAL MAP — what to hand a session, and when

**2026-07-31 · CUI V23.** Written because pasting everything into every
session is how a thread runs out of room before the work is done, and pasting
too little is how a lane rebuilds something that already exists.

**Read the trigger, not the list.** If nothing on the left is happening, do
not paste the thing on the right.

---

## ALWAYS — every session, every lane

| File | Why |
|---|---|
| `docs/GOVERNANCE/PROCEDURES-AND-LANES-2026-07-27.md` | the lane you are in and the rules that end it |
| `docs/GOVERNANCE/LOCKED-DECISIONS-2026-07-27.md` | what is settled and must not be reopened |
| `docs/GOVERNANCE/LAUNCH-BOARD-2026-07-31.md` | what is outstanding, in one place |
| the most recent carryover for that lane | where the last session stopped |

That is four documents and it is the floor. Everything below is conditional.

---

## THE GLASS — CUI only

| Trigger | Paste |
|---|---|
| **any build touching the stage** | the current `public/litenco-stage-*.html`. There is only ever one. |
| **anything reading effects, silos or poses** | `public/effect-registry.js`. Generated — never edited by hand. |
| **geometry, bands, surfaces, type** | `docs/SYSTEM/SURFACE-TOKENS-2026-07-28.md`. ⚠ its measured table predates s72 — see its own provisional note. |
| **a surface that already has a design** | the prototype, once, at the start: `docs/SURFACES/<surface>/`. Read it before building. Do not build from memory of it. |

**The trap:** a prototype is a specification, not a file to wire. Harvest the
behaviour, correct the drift, build into the live line. Overriding a harvest
with an inference has cost this project two rebuilds.

---

## THE ENGINE — the wiring builds only

| Trigger | Paste |
|---|---|
| **build 1, the merge** | `public/portraits-b2.html`, `MAP-S58-B2`, `scripts/build_1a_strip.py` |
| **anything about what /generate accepts** | `app/api/v1/portraits/generate/route.ts`. It is the contract. |
| **prompt bodies, framing, aspect** | `lib/v1/portraits/portraits-shared.ts` and `portraits-prompt.ts` |

**Do not paste `lib/v1/*` speculatively.** Eighty-seven of those files used to
live in project knowledge and produced wrong answers for a month, because a
copy carries no signal about whether it is current. Pull the one file the
question is about, that day.

---

## MONEY — the credits path

| Trigger | Paste |
|---|---|
| **anything touching credits, purchase or the ledger** | `supabase/migrations/009_credits_and_codes.sql` **and** `010_credits_v4.sql`. 009 alone is misleading — it says admin grants zero and 010 may have fixed it. |
| **the purchase screen** | `docs/SYSTEM/COMMERCE-AND-IDENTITY-2026-07-28.md` §2, and `011_credit_skus.sql` for the five blocks |
| **Stripe session, webhook, confirmation** | `lib/store/stripe.ts`, `lib/store/entitlements.ts`, `app/api/v1/webhooks/stripe/route.ts` |
| **never** | your keys. No command that prints them. `stripe config --list` put two secret keys in a transcript on 7/31. |

---

## PRINT — Print Shop only

| Trigger | Paste |
|---|---|
| **building the surface** | `docs/SURFACES/print-shop/litenco-printshop-2026-07-24-r28.html` — **strip the base64 first**, it is 2.4MB and 86KB without it |
| **pricing or SKUs** | `LOCKED-DECISIONS` print prices; r28 already matches |
| **fulfilment** | `app/api/v1/print/webhook/route.ts` |

---

## HELP — Concierge only

| Trigger | Paste |
|---|---|
| **building or specifying it** | `docs/SYSTEM/CONCIERGE-SPEC-2026-07-30.md` |
| **anything about the likeness gate** | `docs/SYSTEM/QUALITY-GATE-DATA-2026-07-30.md` |
| **disputes** | both, plus §7 of COMMERCE for the re-render cap — they currently disagree |

---

## SCHEMA — before writing any migration

| Trigger | Paste |
|---|---|
| **adding a column to a piece** | `FOCAL-POINT-AND-SUBJECT-REGIONS-2026-07-29.md`. Four columns are already queued: `focal_x`, `focal_y`, `subject_regions`, `likeness_score`. Write them once. |
| **anything with a CHECK constraint** | `git grep -n "check (" -- supabase/migrations` before assuming a value is allowed. `skus.kind` rejected `'credits'` until 011. |

---

## HOUSEKEEPING — CHK only

`docs/GOVERNANCE/CHK-HOUSEKEEPING-CHARTER-2026-07-30.md`, whole, every
session. It is a charter, not a task list, so it does not go stale.

---

## THE ONE THING THAT OUTRANKS ALL OF IT

```powershell
node scripts\boot.js
```

Machine-read that run. Where a document disagrees with the boot report, the
report is right and the document is corrected the same day.

Every session starts here.
