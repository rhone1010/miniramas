# HANDOFF — CUI V23 → V24

**2026-07-31. Six days to Aug 7.**

This is not the carryover. The carryover tells you where the work stopped.
This tells you what you are walking into.

---

## 1 · PASTE THESE FOUR, EVERY SESSION

```
docs/GOVERNANCE/PROCEDURES-AND-LANES-2026-07-27.md
docs/GOVERNANCE/LOCKED-DECISIONS-2026-07-27.md
docs/GOVERNANCE/LAUNCH-BOARD-2026-07-31.md
docs/GOVERNANCE/CARRYOVER-CUI-V23-2026-07-31.md
```

For build 1, also: `MAP-S58-B2-2026-07-28.md`, `public/portraits-b2.html`,
the current stage file, `public/effect-registry.js`,
`scripts/build_1a_strip.py`.

`docs/GOVERNANCE/RETRIEVAL-MAP-2026-07-31.md` says what else to pull and
when. Read the trigger; if it isn't happening, don't paste the file.

---

## 2 · WHO YOU ARE WORKING WITH

Rich is the founder, sole developer, sole visual authority, and the only
person who commits. Thirty years in marketing and media. He has an
exceptional eye and he is right about the glass more often than you will be.

**He is terse.** "locked", "not working", "and woman", "what about persian?"
He expects you to carry state and infer context. This is not rudeness; it is
someone moving fast who has already explained it once.

**He corrects directly.** Take it, fix it, move on. Do not apologise at
length, do not re-litigate, do not get defensive. He does not want
reassurance and he does not want narrative.

**When he says "locked", it is closed.** Do not re-flag it a week later
because you have found a new angle.

**When he pastes a screenshot or a CSS rule, that is a directive.** Read it,
identify what changed, implement it. Do not respond with clarifying
questions unless something is genuinely ambiguous — and if it is, ask one
question, not three.

**He will tell you when you are being too verbose.** He did today, twice, and
he was right both times. Lead with the bottom line. Short paragraphs. No
tables or long bullet lists in chat — documents can be thorough, chat should
not be.

---

## 3 · WHAT THIS PROJECT HAS SURVIVED

You need this because it explains every rule you are about to follow.

**Fifteen days of work existed only in a working tree** and was nearly lost.
A 9,872-line file, never committed. That is why `git status` runs before
every add and again after every push, and why nobody ever runs `git add -A`.

**CC was ended as a lane.** It was an implementation lane; it wrote to files
it did not own and replaced a working application with a wired shell. The
failure began as a small helpful edit. That is why exactly one lane writes to
the glass and it is you.

**CLAW was retired.** Routing through a coordinator lane added a hop and lost
information. Rich routes now.

**The b-line was rejected on the glass.** b3 through b7, built in a night,
put r81's markup onto b2's engine. `body{display:flex}` made every width
calculation meaningless and the lane patched symptoms instead of finding it.
Rich rejected the whole line and the s-line was rebuilt clean-room from an
empty stage. **That is the file you are working on.**

**A lane asserted from stale files three times in one day** and published a
wrong engine audit. Hence: no claim about the repo is stated as fact unless
read that day from live source.

**Prompt `.ts` copies in project knowledge drifted from the live code** and
produced wrong answers for a month. Hence: never paste `lib/v1/*`
speculatively; pull the one file the question is about, that day.

Every rule you are about to follow is a scar. None of it is ceremony.

---

## 4 · HOW I FAILED TODAY, AND THE PATTERN

Be honest with yourself about this, because you will do the same things.

**Structural errors, at first pass.** I said the catalogue was the single
source of truth for the glass — the stage doesn't load it. I said
`app/api/webhooks`; it's `app/api/v1/webhooks`. I was wrong twice about
aspect ratio in a row, because I reasoned about it instead of reading the
route. **Read the file. Every time. The instinct to answer from memory is the
enemy.**

**Overriding a harvest with an inference.** Rich said My Collection's design
was in r81. I built a flat grid, and wrote in the build header that r81's
featured layout was *deliberately not ported*. It wasn't deliberate; I hadn't
read it. **When he says the answer is in a file, ask for the file.**

**Shipping something dead.** s63 passed every gate and was completely inert —
a constant declared below the `renderQueue()` that ran at init. `var` hoists
the name, never the value. Init threw, every listener below it never
attached. Rich found it in the browser. **The boot gate exists because of
this. Do not remove it.**

**The same fault, three times.** s63, then s66's first cut, then s72's. Each
time a constant below its caller. **A gate that catches a recurring fault is
not the same as preventing it — I added a positional check on the third
occurrence and should have on the first.**

**Wasting his time on plumbing.** I suggested the Stripe CLI to batch five
products, then spent six exchanges on PATH, key rotation and PowerShell
version differences — and told him to run a command that printed his secret
keys into the transcript. The dashboard would have taken ten minutes.
**When a tool detour exceeds the task, stop and do the task.**

---

## 5 · THE BUILD DISCIPLINE — do not shortcut this

Every change to the glass is a **Python assertion script** that reads the
previous accepted file, applies the change, runs a gate, and writes output
only if the gate passes. No hand edits. The script is the record.

**Anchor-replace, not regex-over-the-file.** Assert every anchor appears
exactly once before applying anything. If an anchor isn't unique, find a
better one — do not add `[0]`.

**The gate asserts, at minimum:**

- route call count — the number is in the carryover and it changes
  deliberately, never by accident
- ids not lost, functions not lost, faces still three
- `node --check` on every inline script
- style-block brace balance
- **jsdom boot, and proof the file is ALIVE** — a file that throws on line 1
  is silent too. Assert the button was labelled, eight silo cards rendered,
  `window.POSES` is reachable. Drive the interaction, don't just load it.

**Gates are cumulative.** One added because something broke is never removed.
Current standing set, each earned:

| Gate | Because |
|---|---|
| jsdom boot | s63 shipped inert |
| constant above its caller | three separate TDZ faults |
| strip comments before testing code | two gates flagged the comment explaining their own fix |
| radius: card curve, pill, or circle — never the middle | 12px on one card disagreed with its five siblings |
| banned vocabulary | I wrote `sculpt` into a Curator line, four accepted revisions old |
| labels via `textContent`, never innerHTML | the registry emits real ampersands |
| `align-content` never `center` with overflow | centred grid rows overlap |

**And it caught my own build script over-excising 78 functions today.** That
is the one to remember. The gate is not bureaucracy; it is the only thing
standing between you and shipping something dead.

---

## 6 · BEFORE EACH BUILD, TELL HIM TWO THINGS

**What he will see** when he opens it.
**What will still be wrong.**

If the answer is "this will not look like anything yet", say so before he
spends the click. He tests at 1920 and 2560 and will tell you which. Confirm
browser zoom is at 100% before judging type — an hour was lost to a 90% zoom
making every size read 10% small.

**You cannot see rendered output.** You cannot reach Replicate, Stripe,
Prodigi or Supabase. You cannot tell a wrong effect mapping from a right one.
**Never estimate a pixel measurement from a screenshot — ask for the computed
value.** That cost hours before I arrived.

---

## 7 · BUILD 1 — the merge

`s72` is glass with zero route calls. `b2` is 8,876 lines and the only file
that completes a craft. **They have never met.** Everything else waits on
this.

**Rich ruled: s72 grows.** b2 is the donor. Its functions come across one
lane at a time — Curator machine, then queue, then run orchestration — and
each build ends with him crafting a real image to prove that lane still
works. Slower, but a failure is isolated to the lane you just touched.

**The strip failed twice today. Do not iterate on my script.**

First attempt counted braces and was defeated by a `//` comment containing
one — it removed 78 functions when asked for 25. Second anchored on
indentation and still over-cut, because a nested block whose closing brace
sits at the function's indent ends the cut early. Five functions weren't
found at all: nested, or declared as expressions.

**Do it differently.** Stop cutting text. Parse the script block, walk the
function declarations, rebuild it from the ones that survive. Regex and
brace-counting have now failed twice on this file and will fail a third time.

**Do not cut `qaAccept`, `qaRefund`, `qaRerender`.** Named as QA, and are
not: they set `user_decision` on a queue item, and `qaRerender` carries the
one-gate-re-render-per-piece rule Rich ruled on 7/29. Cutting "the QA panel"
wholesale deletes a policy.

**Check every cut candidate against the payload.** `/generate` reads from
queue-item fields: `source_image_b64, additional_images_b64, style_id,
preset, location, scale, aspect_ratio, resolution, plaque_text?`. Several
functions on the cut list write state that reaches those. That is why my pass
took only the certainly-dead set and left the rest.

**Routes: 10 → 7.** Both `/qa/settings` go with the sliders, `/raw-pipeline`
goes with raw mode. The gate asserts 7 from build 1 onward.

---

## 8 · THINGS THAT WILL SAVE YOU AN HOUR EACH

**Portraits already renders 1:1.** `DEFAULT_FRAMING = 'signature'` →
`ASPECT_FOR_FRAMING.signature = '1:1'`, and b2 sends no `framing`. **The
route ignores `body.aspect_ratio` entirely.** I was wrong about this twice
before reading the route.

**Framing is already dead on the wire.** No `framing` field in the surviving
payload. It only labels a queue row.

**`isExperimentalEffect` IS wired**, route line 156. The twelve Curiosities
return 400 because the client never sends `experimental_effect` — the door
exists, nobody uses it.

**The effect registry is generated.** `lib/v1/portraits/effect-registry.ts` →
`node scripts/emit-effect-registry.js` → `public/effect-registry.js`. Never
edit the `.js`. Effect changes go through CENG.

**Everything keys on ids, not labels.** `data-silo-id`, `data-effect-id`,
`keyOf(siloId, effectId)`, queue stores `{siloId, effectId}` and looks labels
up at paint time. Labels are display-only and will change.

**`_recovery/at-*` are `git worktree` checkouts of real history**, not junk.
I raised a false alarm about them costing Rich a backup he didn't need. Check
`git worktree list` before concluding anything is unprotected.

**The money path works end to end as of today.** Payment → webhook →
`grant_credits` → ledger, replay-safe. Proven, not assumed.

---

## 9 · WHAT WOULD HURT MOST

From the launch board, and worth re-reading before you touch anything:

**No per-account fulfilment flag.** A tester with granted credits places a
real, billable Prodigi order. Invisible until the invoice.

**Prodigi's wholesale cost appears in no document.** Prints are priced
against a cost nobody has checked.

**The statement descriptor reads `BRASSOWLAI.COM`.** That is what a customer
sees on their card statement. Chargeback risk.

---

## 10 · LAST THING

Rich has been let down by this lane repeatedly — a wired shell replacing a
working app, fifteen days nearly lost, a whole build line rejected on the
glass. He is still here, still shipping, still generous when you get it
wrong.

The way to repay that is not enthusiasm. It is reading the file before you
answer, saying plainly when you do not know, and refusing to write something
you cannot verify.

The gates will catch your code. Only you can catch your assumptions.
