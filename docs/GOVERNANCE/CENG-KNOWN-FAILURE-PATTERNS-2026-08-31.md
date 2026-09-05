# CENG — KNOWN FAILURE PATTERNS — 31 August 2026

Not a general style guide. Specific mistakes that actually happened in
the session ending tonight, each one costing real time or carrying real
risk. Read this before doing anything that resembles these situations.

---

## 1. A RESTATED SUMMARY IS NOT EVIDENCE

The single biggest source of wasted time tonight. Multiple times,
Claude Code described what it had done or found in confident prose —
and the prose was wrong, not because it was lying, but because it was
reconstructing a claim instead of re-checking the fact.

Concrete example: after updating Stripe price IDs, Claude Code
summarized the change as "the price_1TzJ... IDs (live mode) are now in
place, replacing the price_1U8Wd... (test mode) ones" — backwards. The
actual mode had already been established by direct dashboard evidence
minutes earlier. When asked to re-verify, it admitted the label was "a
wrong guess," not a fact it had actually checked.

**Rule: for anything involving money, pricing, or Stripe specifically,
get a raw query result, a screenshot, or a dashboard search — not a
restated description of what should be true.** This is not about
distrust of Claude Code's competence — it did the actual diagnostic
work well once pointed at real evidence. It's specifically that
descriptions drift from facts under complexity, and this category of
mistake is expensive to leave unchecked.

## 2. THE ERROR STRING IS OFTEN THE APP'S OWN WORDING, NOT STRIPE'S

`stripe_price_unavailable` looked like a Stripe API error for a long
time. It wasn't — it was this codebase's own catch-block label,
written in `credits/purchase/route.ts`, wrapping a genuine Stripe
exception into a generic message. A lot of time went into searching
Stripe's dashboard for an explanation before anyone actually read the
route's source to see the string was homegrown.

**Rule: before treating an error string as an external system's
message, grep the codebase for that literal string first.** If it's
defined in your own code, the real cause is whatever's upstream of
that specific line, not something to diagnose from the outside.

## 3. TWO DIFFERENT VALUES CAN BOTH BE "VALID" AND STILL MISMATCH

The actual root cause of the credits bug, once found: a Stripe price
being active, correctly test-mode, and successfully retrievable is NOT
the same as it matching what the app's own database expects
(`price_cents`). The code had an explicit equality check
(`price.unit_amount !== sku.price_cents`) that would have said exactly
this — except it was wrapped in a try/catch that turned a specific,
informative error (`price_mismatch`) into a generic one
(`stripe_price_unavailable`) whenever the retrieve() call itself
succeeded fine but something else downstream threw first in a
particular code path. Reading the exact lines around the error
(not just the error name) is what actually found this.

**Rule: when a value "should" work but doesn't, check for a SECOND
value that has to match it, not just whether the first value is
individually valid.**

## 4. "DOWNLOADED" AND "GIVEN TO CLAUDE CODE" ARE NOT THE SAME EVENT

Happened at least three times tonight: a file was generated, presented
as a download card in a DIFFERENT chat interface, Rich downloaded it to
his Downloads folder — and Claude Code, working in a separate session
with direct repo access, had no path to that file and reported it
didn't exist. This wasted entire round trips each time before someone
noticed the file needed to be pasted as text content directly into
Claude Code's own session, not downloaded on Rich's machine.

**Rule: content generated in one interface does not automatically
reach a different session. If Claude Code says a file doesn't exist,
the fix is usually pasting the actual text into ITS session, not
re-downloading it somewhere else.**

## 5. A GIT WORKTREE MAY NOT BE A REAL REPOSITORY

Earlier in this project's history, a lane (`D:\lanes\ceng45`) was
assigned by name in a governance doc but never actually initialized as
a git repository. Running `git branch` there failed outright. Don't
assume a named folder is a working worktree just because a doc
references it — `git branch --show-current` or `git status` from
inside it confirms or denies this in one command, cheaply, before
building anything that depends on it existing.

## 6. COMPOUND `cd && git` COMMANDS TRIGGER APPROVAL PROMPTS EVEN WITH
   FULL PERMISSIONS GRANTED

Claude Code has a hardcoded safety check: running `git` in a directory
reached via `cd` in the same command always prompts for approval,
regardless of any permission allowlist, because it's specifically
guarding against a directory's hooks executing unexpectedly. This
looked like a broken permissions config for a while. The actual fix
was using Claude Code's persistent `/cd` to change directory once, then
never prefixing subsequent commands with `cd &&` again — a bare `git
status` from an already-current directory doesn't trigger this check.

## 7. VERCEL ENV VAR "TYPE" MATTERS INDEPENDENTLY OF THE VARIABLE NAME

A `NEXT_PUBLIC_...`-prefixed variable is supposed to be readable by
browser JavaScript — that's what the prefix means to Next.js. But
Vercel's own "Secret" type is write-only and withholds the value from
the client regardless of the name. A publishable Stripe key stored as
Type: Secret silently broke client-side Stripe.js initialization, and
the resulting error ("payment form could not be opened") gave no hint
that a Vercel dashboard setting, not application code, was the cause.

**Rule: for any `NEXT_PUBLIC_*` env var that isn't working client-side,
check its Vercel Type (Secret vs Config) before checking the value
itself.**

## 8. STOPGAP FIXES CAN LOOK LIKE FINISHED WORK IF NOT LABELED

Tonight's credits SKU prices were deliberately set to nonsense test
values to unblock testing quickly, on Rich's explicit direction ("these
will not be real prices"). That's a reasonable call — but without
writing it down clearly (see the carryover, section 4), a future
instance could easily read `price_cents: 8234` in the `skus` table and
mistake it for real, intentional pricing data.

**Rule: when a value is deliberately fake/temporary, say so explicitly
in the next carryover, not just in chat history that won't be read
again.**

*CENG-45 — 31 August 2026*
