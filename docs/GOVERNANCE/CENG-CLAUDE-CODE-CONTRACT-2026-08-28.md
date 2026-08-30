# CENG — CLAUDE CODE CONTRACT — 28 August 2026

Read this before touching anything. This supersedes the copy-paste
workflow in `ONBOARD-CUI-2026-08-26.md` **for CENG only**. CUI stays on
the human-mediated model — Rich's call, not up for debate here. If this
doc and reality disagree, reality wins, and this doc gets corrected —
same rule as before.

---

## 0. WHAT ACTUALLY CHANGES

You have direct read/write access to `D:\lanes\ceng` and can run `git`,
`python`, `npm`, `tsc` yourself. This removes the entire
Downloads-to-Install-File relay: no more producing a file, waiting for
Rich to download it, waiting for him to run Install-File, waiting for
him to paste output back so you can read it. You do that yourself, now.

**This is the fix for a real, repeated failure mode from the prior
session:** file corruption from writing through an intermediate script
under the wrong codepage, patch anchors that silently didn't match
because you couldn't see the live file directly, a stuck git merge that
needed the same manual fix five separate times because neither party
could just run `git config core.editor` once. All of that was a
bandwidth problem between two parties relaying text through a chat
window. Direct access removes the relay. It does not remove the need
for care — see section 2.

## 1. WHAT DOES NOT CHANGE

- **Lane discipline is identical.** `D:\lanes\ceng`, branch `lane/ceng`.
  Never touch another lane's folder. Never `git checkout` to switch
  branches — your folder is your branch.
- **Ship by PR to main.** Commit, push, `gh pr create --fill`, verify
  the file list, merge. Nothing merges to `main` without that loop.
- **Read the newest CENG carryover before starting work.** Same rule,
  same reason: you don't know what changed since your training or since
  the last session without checking.
- **Two failed attempts at finding something means stop and ask Rich
  one precise question.** Direct file access does not mean you know
  the business logic, the pricing rulings, or which of two conflicting
  docs is current. When those are ambiguous, ask — don't infer from
  file contents what should have come from Rich.
- **Product/pricing/copy decisions are Rich's.** You execute, you flag
  once, you don't decide. This is unchanged by tooling.
- **Swim lanes still apply.** If CUI-45 or another instance is actively
  working files at the same time, don't touch them. Ask Rich to confirm
  who owns what before editing anything that isn't unambiguously yours.

## 2. NEW DISCIPLINE, SPECIFIC TO DIRECT ACCESS

Direct access makes some old failure modes impossible and introduces
new ones. Both matter.

**Encoding corruption should no longer happen, but verify anyway.** The
em-dash/codepage corruption from the prior session happened because a
Python script wrote a file under the OS's default codepage instead of
UTF-8. Your own file-write tools handle this correctly — but if you
ever DO shell out to a script that writes a file (a generator, a
migration tool, anything), open the result and confirm it's what you
meant before committing. Don't assume a tool got encoding right because
it usually does.

**You can verify before asserting — so do it every time.** You no longer
have the excuse "I can't see Rich's disk." You can. That means there is
no acceptable version of "I assumed the file still said X" — open it,
read it, then act. The old rule ("never assert what a file contains
without output proving it") gets STRICTER under direct access, not
looser: now a wrong assertion is a tooling failure on your part, not a
communication gap between two parties.

**Run your own verification, don't ask Rich to run it for you.** `tsc
--noEmit`, `git status`, `git diff` — run these yourself before telling
Rich something is ready. The one exception: if a command is expensive
or risky enough that Rich previously said "don't run this locally"
(full builds, anything that installs `node_modules` at meaningful
cost/time), ask first rather than assuming direct access means no
restriction ever applies.

**Full-file writes vs. patches — the calculus changes, but the caution
doesn't.** The old patch-script-with-dry-run convention existed partly
because you couldn't see the live file to verify a patch would apply
cleanly. You can now. That doesn't mean every edit should be a blind
full-file overwrite — for small changes to a large existing file, a
targeted edit is still lower-risk than rewriting the whole thing, for
the same reason it always was: less surface area for an unrelated part
of the file to get clobbered. Use judgment; don't default to maximum
force just because the safety rail that used to force restraint is
gone.

**Nothing is ever deleted — this still applies.** You now have `rm`
available in a way you didn't before. Don't use it. Archive or leave in
place, matching the existing `H:\NO_DELETE_ARCHIVE` convention. If
something needs to stop being live, move or rename it — never delete a
file that represents real work, even superseded work.

**You still commit real messages and real PRs.** Direct access doesn't
mean bypassing the PR flow — it means you can complete every step of it
yourself instead of relaying each one through Rich. The PR itself, its
file list, and Rich's review before merge are all unchanged.

## 3. THE ONE THING TO GET RIGHT IMMEDIATELY

`git config core.editor "cmd /c exit 0"` — set this once, in
`D:\lanes\ceng`, before your first `git pull`. This was manually
re-fixed five times in the prior session because it kept coming up as a
stuck merge with no committed fix. Check it's set; if it's not, set it;
don't let this recur a sixth time.

## 4. CUI STAYS HUMAN-MEDIATED — DO NOT ASSUME PARITY

Rich has explicitly ruled Claude Code off glass/UI work — not a
temporary state, a standing call based on prior experience. If a task
touches `public/*.html`, CSS, or anything CUI owns, that is not yours to
pick up just because you technically have file access to those paths.
Stay in `app/`, `lib/`, `middleware.ts`, and migrations — the same
CENG-owned surface named in every prior onboarding doc. If a task seems
to require touching CUI's files, stop and ask Rich, don't assume direct
access changes ownership.

*CENG — 28 August 2026*
