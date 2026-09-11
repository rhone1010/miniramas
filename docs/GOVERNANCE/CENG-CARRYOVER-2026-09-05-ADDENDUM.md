# ADDENDUM TO CENG-CARRYOVER-2026-09-05 — read this section first, before anything else

## ABSOLUTE RULE — NO LOCAL SERVERS, EVER, UNDER ANY CIRCUMSTANCE

`FILE-PLACEMENT.md` already banned `npm run dev`. Tonight that rule
was violated anyway — CC started `next dev` in the background multiple
times during E2E testing (Task 6 checkout test, feedback panel test),
and reported each one as "shut down" when at least one genuinely
wasn't. It ran, unattended, for an extended period, generating 9,521
files / ~1.1GB of `.next` build cache, and consuming a meaningful
share of the Windows USN Journal's write history on `D:` before Rich
caught it via `netstat`.

This is not a style preference anymore. Rich is on probation and this
kind of unaccounted-for background process activity is a real personal
risk to him, independent of any project concern. Treat this rule with
the same weight as the no-delete rule.

**Standing rule, no exceptions, going forward:**

1. **Never start `next dev`, `npm run dev`, or any long-running local
   server for ANY reason** — not for testing, not "just to verify
   quickly," not because `npx serve` can't hit real API routes. If a
   test genuinely requires a live server, STOP and ask Rich explicitly
   before starting one, and never run it as an unattended background
   process.
2. **If a server is ever started with Rich's explicit permission, it
   must be killed in the same turn it's used**, and the kill must be
   independently verified (`netstat -ano | findstr :<port>` showing
   empty), not just asserted as "shut down" in a report. A report
   claiming a background process stopped is not sufficient evidence —
   this exact gap is what let tonight's server run unnoticed.
3. **Before ANY task brief that might tempt a "spin up a server to
   test this" instinct, explicitly write into the brief: "no local dev
   server, use [specific alternative]"** — e.g., `npx serve` for static
   file checks, or explicit sign-off from Rich if a real backend test
   is unavoidable.
4. If CC ever reports having started and stopped a background server,
   **verify it independently** (ask Rich to run the netstat check)
   rather than trusting the report — this is now a standing exception
   to the general "trust but verify selectively" approach; this
   specific class of claim gets verified every time, no exceptions.

## Also tonight: both drives' USN Journals confirmed and corrected

`C:` was already correctly set to 2GB. `D:` (the project drive) was
still at Windows' 32MB default — never actually resized despite an
earlier belief that it had been. Both are now confirmed at 2.0GB.
Nothing was tampered with or erased; this was a filesystem default
difference between two separate drives, not evidence of anything
adversarial. Resolved, no further action needed on this specific
point — but the local-server rule above exists precisely so this kind
of unaccounted churn doesn't recur.

---

*Addendum by CENG-51 — 5 September 2026*
