# CARRYOVER — CUI V22 → V23

Session ended 2026-07-28. Read `docs/GOVERNANCE/` first — those govern.
Then `docs/SYSTEM/COMMERCE-AND-IDENTITY-2026-07-28.md` and this.

---

## 1 · WHERE THINGS STAND

**The workshop surface is built.** `public/litenco-stage-2026-07-28-s58.html`
is the canonical file. It carries locked geometry, the masthead, four textured
surfaces, the silo floor with a two-sided flip, the Curator speaking at every
step, the footer, the To Be Crafted rail, and eight intake modals.

It has **zero route calls**. It is glass, and it is inert.

`public/portraits-b2.html` remains the engine — 10 route calls, 203 functions,
the only file that completes a craft.

### The line
```
litenco-stage-2026-07-28-s1    geometry locked
  └─ s7    masthead, series dropdown            committed
      └─ s17   logo, four surfaces accepted     committed
          └─ s40   floor, Curator, modals       committed
              └─ s58  ← CURRENT
```

Everything between is in `archive/2026-07-28/stage/`.

---

## 2 · WHAT WAS BUILT TODAY

**The stage contract** — `scripts/gate-stage.js` enforces it and catches every
fault below if it returns.

- `body` is a **block**. It was `display:flex`, which made the stage a flex item
  where `width:86%` competed with flex distribution and auto margins. Gutters
  were unpredictable at every viewport. This was the root cause of weeks of
  layout confusion.
- Root type is a **ramp with a 16px floor**, tunable at `--type-vw`,
  `--type-off`, `--type-max`. The old `clamp(12px, .38vw + 6px, 15px)` resolved
  to 13px, which made every rem measurement read ~20% small since March.
- Stage is **90% wide, gutters capped at 100px**. Above 2000px the gutter holds
  and the stage keeps growing.
- Ground is **fixed and edge to edge**; the stage sits on it at 90%.

**Four bands** — ≥1921 · ≤1920 · ≤1599 · ≤1366. The values Rich tuned at 1920
were briefly in the base `:root` and therefore applied at 2560 as well. Now
confined to the band they were judged in.

**The silo floor** — eight columns, so a row of one, two or three can sit
centred against a row of four. Card size never changes; placement does. Capped
at seven effects plus the upsell in slot eight.

**The flip** — the floor turns over rather than swapping. Each card on its own
axis with a 38ms stagger.

**The Curator** — four states in one panel. No step dots, no cycle button. Own
type scale, because the panel does not widen as fast as the root ramp.

**Credits and identity** — see §4.

---

## 3 · FAULTS FOUND AND FIXED

| Fault | Where |
|---|---|
| `body{display:flex}` broke every width calculation | s1 |
| Root clamp resolved to 13px | s33 |
| Rich was testing at 90% browser zoom — every size judged 10% small | — |
| `grid-column:span 2` + `grid-column-start` collapses cards to one column | s28 |
| `min-height` on the footer meant the height token was ignored | s47 |
| Fixed-px containers with rem contents break when the root ramps | s54, s55 |
| `const` does not create a `window` property — effects face was empty | s24 |
| `bundleCardHTML(list)` where the array is `SUGGEST` — silent ReferenceError | s19 |
| `align-content:center` with overflow makes grid rows **overlap** | s19 |
| Modal classes `.cur`, `.c-mark`, `.cur-say` collided with the Curator panel | s40 |
| `public/Icons` vs `public/icons` — would have 404'd on Vercel, not on Windows | — |

---

## 4 · CREDITS — three of four closed

**The contradiction.** The volume ladder was applied twice: once buying
credits, again when queueing images. An image costs 10 credits; five cost 50.
There is no room for a percentage. **Ruled: the ladder belongs to the purchase
and nowhere else.** Craft now reads `50 credits` and nothing more.

**Blocks extended** to 200 credits at 38% and 300 at 45%. At 300 the studio
takes $82.34 and spends about $7.40.

**Fixed and written, awaiting deploy:**

| File | Was | Now |
|---|---|---|
| `credits/gate/route.ts` | spent the image count | spends `count × cost_per` |
| `credits/refund/route.ts` | refunded 1 per image, read-then-write, no idempotency | refunds `cost_per`, atomic RPC, idempotent by `ref_id` |
| `credits/balance/route.ts` | guest fallback | guest removed, returns `owner` |
| `010_credits_v4.sql` | — | tester grants 50→500, `refund_credits`, ledger reason constraint |

**The gate now refuses to spend on a preset the engine cannot render.** Seven
effects have no prompt; the floor greys them and the route rejects them before
the balance moves.

**Still open — needs a ruling:** `spend_credits` moves the balance, the route
writes the ledger separately. If the spend succeeds and the route fails, money
moves and no record explains it. **This has already happened once on the test
account** — one credit gone with no craft row. Fixing it means moving the
ledger write inside the function, which changes the contract for every caller.

**RHONE3166 — the carryover's diagnosis was wrong.** It blamed `redeem_code`
for not writing a redemption row. It does write it. The data is correct: the
code is `admin`, active, redeemed by `b4f556b0-4003-47e6-81a9-4abe03350eac`.
The bug may not exist. **Verify by hitting `/api/v1/credits/balance` signed in**
and checking `owner` matches that UUID and `admin` is true.

---

## 5 · IDENTITY — ruled

- **Email is the identity.** Magic link, no password. Required — the gate
  refuses without an owner.
- **No first name on the gate.** The Curator asks after they are in: *what
  should I call you?* Conversation, not a form field.
- **Marketing consent** — unticked checkbox, separate from terms, store the
  timestamp and wording.
- **Retention** — 12 months for anything crafted, 90 days for an account that
  never crafted, indefinite for print orders. Email the link at 30 and 60 days
  if never downloaded.
- **Print Shop** collects shipping only at order time.

**Sign-in comes at craft, not at upload.** Hold the photograph client-side until
then; nothing touches Supabase until there is an identity to attach it to.

**OPEN:** the entry gate is unbuilt. `requireUser()` still redirects to the
`/?signin=1` modal that `LOCKED-DECISIONS` retired.

---

## 6 · POSE — ruled, unbuilt

The Curator asks once, after the photo reaction, before the rooms:

> Would you like me to reinterpret the pose?
> ○ Keep it as photographed  ○ Give it more presence

Choose the first and nothing changes. Choose the second and **the floor flips
to four mood cards** — Thoughtful, Dramatic, Heroic, Playful — then flips again
to the rooms. Same gesture the floor already makes; one extra flip only for
those who asked.

The moods cannot be described, only shown. That is why they belong on the stage
rather than as radio buttons in the Curator.

**Needs:** four images at `/previews/moods/*.jpg`, 0.78 portrait, same subject
in all four. And four prompt blocks from CENG.

**Not per image.** Once, for the queue. Per-image tuning multiplies the failure
story and belongs after launch.

---

## 7 · PUNCHLIST

**Blocking**
1. Deploy the three route files and 010, then verify: craft one image, ledger
   should read `-10`.
2. `/api/v1/credits/balance` signed in — does `owner` match the UUID and is
   `admin` true? Settles whether RHONE3166 is broken at all.
3. Ruling: does the ledger write move inside `spend_credits`?
4. `credits/redeem/route.ts` — the last file with a guest path. Not yet seen.

**Content — Rich**
5. Seven effects have no prompt: `cast_glass`, `frost_ice`, `volumetric_light`,
   `fire_ember`, `living_reef`, `atomic_robot`, `cosmic_bloom`.
6. Twelve experimental effects still 400 until `isExperimentalEffect()` is
   wired at the guard.
7. Effect art per effect — cards currently reuse the silo image.
8. Four mood images.
9. The eighth silo needs naming. `eigth.jpg` is misspelled.
10. Artists Gallery holds 8 against a cap of 7 — one effect has no home.

**Build**
11. Entry gate — unbuilt, and the flow starts with it.
12. Credit purchase screen with the 200 and 300 blocks — unbuilt.
13. Curator's name question — unbuilt.
14. Pose step — unbuilt.
15. Post-render remedy surface — unbuilt. Intake modals are pre-craft only.
16. Wire s58 to b2's engine.
17. Per-account fulfilment flag. Without it a tester places a real Prodigi
    order. Password-gating the Print Shop payment is not the same protection.

**Hygiene**
18. `public/previews/source/` can be deleted — nothing references it.
19. `noise.png` at 521KB for 800×800 grain; a 16-grey palette lands under 60KB.
20. Two copies of `009_credits_and_codes.sql`. `supabase/migrations/` governs.

---

## 8 · FIRST FIVE MINUTES NEXT SESSION

1. `node scripts/boot.js` — paste the report.
2. Paste `docs/SYSTEM/COMMERCE-AND-IDENTITY-2026-07-28.md`.
3. Punchlist items 1–3. They gate everything with a price in it.
4. Then the entry gate, because the flow starts there.

**Twelve days to August 9.**
