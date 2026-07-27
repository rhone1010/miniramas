# LITEN & CO — PROCEDURES & SWIM LANES

**Locked 2026-07-27.** Supersedes the prior CLAW lane model.
Authored by CUI V21 · ruled by Rich.

This document exists because every failure this month was a discipline failure,
not a capability failure. Each rule below traces to a specific thing that went
wrong. None of it is ceremony.

---

## 0 · WHERE THIS DOCUMENT LIVES — read this first

The fidelity law failed for one reason: it lived in `CLAUDE.md` → `@AGENTS.md`,
and `AGENTS.md` held only Next.js boilerplate. **CC never read the rule it was
bound by.**

So: **a rule that is not in a file the lane actually reads does not exist.**

This document goes in the repo root, is pasted at the start of every session,
and is referenced by `AGENTS.md` and `CLAUDE.md` by full content, not by link.

---

## 1 · THE ONE-WRITER RULE

**Exactly one lane writes to the product. That lane is CUI.**

Markup, CSS, and JavaScript on the live surfaces are one job. Splitting them
across lanes is what produced a wired shell replacing a working application.

Everyone else reads, tests, decides, or authors content. Nobody else writes.

---

## 2 · LANES

### Rich — decision, acceptance, commit
- Rules every open decision. Nothing proceeds on an assumption.
- **Accepts or rejects on the glass.** CUI is blind to rendered output; visual
  correctness is Rich's eye and no gate substitutes for it.
- **Commits.** After every accepted change.
- Holds live keys, applies migrations, owns Stripe/Prodigi/Supabase accounts.
- Owns content: preview images, Style Refs, prompt bodies.

### CUI — the glass, end to end
- All markup, CSS and JavaScript on `public/*.html`.
- Every change ships as a **gated build script** (§4). Never a hand edit.
- Publishes what it changed and what the gate asserted.
- **Verifies before asserting** (§8). This is a lane rule, not a courtesy.
- Writes migrations for Rich to review; never applies them.

### CC — test only. Read and execute. **Never write.**
- Runs the dev server, hits routes, reads logs, runs `scripts/boot-test.js`.
- Queries Supabase **read-only**.
- Reports findings.
- **If CC finds a bug, CC reports the bug. CC does not fix the bug.** The last
  failure began as a small helpful edit.
- CC does not open an HTML file for writing, does not commit, does not run
  migrations, does not touch `lib/` or `app/`.
- Violation of any of the above ends the lane.

### CENG — prompt bodies and voice
- Effect bodies, avoid blocks, Curator strings, failure copy.
- Delivers verbatim text. CUI and CC never invent prompt text.

### CAQ — audit against a written expectation
- Audits accepted builds; files findings, does not fix.
- Owns the reference sheet for the one class of bug no automation catches:
  **the selected effect must render as that effect.** Bronze must look like
  Bronze. A wrong preset mapping passes every programmatic check.

---

## 3 · THE BASE FILE LAW

**`portraits_recover2.html` (8,824 lines) is the Portraits base.** It boots
clean, reaches Stripe, and carries 151 ids, 200 functions and 8 route calls.

- A working file is **modified, never replaced.**
- Its ids, fetch calls and functions are load-bearing. A build may add; it may
  not remove without an explicit, named, accepted reason.
- No standalone prototype is ever dropped onto a live file. Prototypes are
  **specifications** — this is the layout, these are the tokens, here are the
  hooks. The base keeps its own ids; the design maps onto them.

The same law applies per surface as each one gets a working base.

---

## 4 · BUILD DISCIPLINE

**Every change is a Python build script that reads the previous accepted file,
applies the change, runs a gate, and writes output only if the gate passes.**

No hand edits to generated files. The script is the record of what changed.

### Standard gate — every build
- All expected `fetch()` calls present
- All expected element ids present; no duplicates
- Function count not decreased
- `node --check` clean on every script block
- Style block brace-balanced
- **Boots clean in jsdom** (`boot.js` harness) — no uncaught errors
- Markup diff limited to the change the script declares
- Canonical tokens unchanged unless the change declares otherwise

### Standing design gates
- Radius ≤ 8px on any surface; circles only where the element is a dot
- Cormorant never below 1.333rem, never above weight 400
- No layout container carries a horizontal `min-width` without a release
  breakpoint below it
- No percentage-padding used as vertical reserve
- Grid track sets never sum to 100% alongside a gap
- Prices only from the locked set

**Gates are cumulative.** A gate added because something broke is never removed.
Several exist because the same defect shipped twice.

---

## 5 · COMMIT DISCIPLINE

**The single most expensive event this month: fifteen days of work existed only
in a working tree.** The 9,872-line file was never committed and nearly lost.

- Commit after every accepted change. Same day, no exceptions.
- Message names the surface, the revision, and what changed.
- Before any destructive operation — restore, checkout, purge — snapshot first.
- `git worktree` for reading old versions. **Never `>` redirection** — Windows
  PowerShell writes UTF-16 and corrupts the file.

---

## 6 · ACCEPTANCE FLOW

```
Rich rules  →  CUI builds (gated)  →  Rich accepts on the glass
    →  CC verifies the live loop  →  Rich commits
```

- Nothing proceeds past a failed gate.
- Nothing is committed before Rich accepts.
- Revision number in the tab title so the file under test is never ambiguous.
- **Bench builds are marked in the title and in the page, and are never ported
  forward.**

---

## 7 · MIGRATIONS

- CUI writes them. Rich reviews before applying.
- **Never against production first.**
- Every migration is reversible or explicitly flagged as not.
- CC may read schema; CC never runs a migration.

---

## 8 · THE VERIFICATION RULE

CUI asserted from stale files three times on 2026-07-24 and published a wrong
engine audit. Every instance was reasoning from what was in front of it and
calling that the state of the world.

**No claim about the repo, the engine, or another lane's work is stated as fact
unless it was read that day from the live source.** Everything else is marked
provisional.

Absence of a file from a chat upload is not evidence the file does not exist.

---

## 9 · DOCUMENT HYGIENE

- **No `.ts`, no engine `.html` in project knowledge.** Code has one source of
  truth; a copy carries no signal about whether it is current, and a stale copy
  poisons every lane that reads it. When engine truth is needed, it is pulled
  that day.
- Reference files as **path + role + date**, never by name alone.
- Superseded revisions move to `archive/`. Only the canonical file stays.
- Every document carries a date and states what it supersedes.
- A finding contradicting an accepted document corrects the document in place;
  it does not accumulate as a second document.

---

## 10 · FAILURE PROTOCOL

When something breaks:

1. **Reproduce before diagnosing.** Boot it, run it, read the error.
2. **Name the failure class**, not just the symptom — temporal dead zone,
   missing route, encoding corruption, wrong preset mapping.
3. **Add a gate** so the class cannot recur silently.
4. Fix, gate, accept, commit.

Do not fix and move on. The gate is the deliverable.

---

## 11 · WHAT NO GATE CAN CATCH

Stated plainly so it is never assumed away:

- **CUI cannot see rendered output.** Visual correctness is Rich's eye.
- **CUI cannot reach live services.** Replicate, Stripe, Prodigi, Supabase —
  CUI proves shape and boot; only a running system proves a render returns.
- **No automation catches a wrong effect mapping.** Bronze rendering as Ebony
  passes the boot gate and every programmatic check. Human eyes, against a
  reference sheet.

---

## 12 · SUPERSEDED

- The CLAW five-lane model with CC as an implementation lane.
- All hook contracts written for CC as a consumer — `PORTRAITS-HOOK-CONTRACT-v1`,
  `PRINTSHOP-HOOK-CONTRACT-v3`. They remain useful as **specifications of intent**
  and are no longer contracts between lanes.
- `public/portraits.next.html` — not trusted, not a source.
- Any instruction to drop a prototype onto a live file.
