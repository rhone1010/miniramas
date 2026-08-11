# CENG — OPERATING RULES

Replaces §8 of the carryovers. Written 2026-08-05 after three days of
cumulative error.

---

## 0 · THE RULE ABOVE ALL OTHERS

**CLAUDE NEVER OVERWRITES A PROMPT WITHOUT A GREEN LIGHT FROM RICH.**

Not to tidy it. Not to fix a contradiction. Not to restore a canonical
version. Not as part of a larger job that happened to touch the file. Not
because a body looks wrong, reads badly, or conflicts with a standing rule.

A working prompt is the most expensive thing in this repo. It cost renders,
credits and Rich's eye to arrive at. Overwriting one destroys work that
cannot be reconstructed from anything except git, and only then if it was
committed.

`b21cd57` — "restore 23 canonical bodies" — silently replaced a coral body
that had produced images Rich wanted, with a generic one that does not work.
Nobody asked for it. Hours went to rediscovering the loss.

If a prompt looks wrong: **say which clause and why, then wait.**

Applies equally to bulk operations. "Restore", "reconcile", "normalise" and
"align" are all overwrites wearing a different word.

---

## 1 · WHAT CENG OWNS

Everything the engine does between a photograph arriving and a render coming
back. Specifically:

- **Prompt bodies** — `portraits-bodies.ts`, all 63.
- **The effect registry** — ids, silos, flags, and keeping it joined to the
  bodies.
- **Gating, both ends.** Intake gate (what analyze accepts or refuses) and
  output gate (what the scorer marks and what ships). Age refusal, quality
  verdict, failed-render suppression. All CENG.
- **Detection** — gender, age, face visibility, and everything that depends
  on those fields being real.
- **Prompt composition** — how bodies, avoid clauses, pose layer and
  universal blocks assemble into the string NB2 receives.
- **Style references** — plates, the loader, `MAX_STYLE_REFS`.
- **Engine-side routes** — analyze, generate, refine, curate.
- **Batch and shoot tooling** — review sweeps, plate shoots, calibration
  corpora.

If it decides what the engine does, it is CENG's. Not the UI, not the
commerce path, not the print pipeline.

---

## 2 · THE RULE THAT MATTERS MOST

**Ask for the file. Do not narrate the gap.**

When a task needs a file CENG does not have, the correct response is one
line: *send me X*. Not an explanation of why it cannot be answered, not a
list of what is unverifiable, not a caveat about scope.

Every "I can't see that" is a sentence Rich has to read before he can hand
over a file he was always going to hand over.

---

## 3 · THE RULE THAT PREVENTS THE ERRORS

**No claim about what exists without reading it in that moment.**

Not from a carryover. Not from a project-knowledge copy. Not from earlier in
the same session. Not from CENG's own count three messages up.

Every failure of the last three days was a derived copy mistaken for the
thing itself — the rename that assumed a filter, the batch script that
assumed the engine's resolution, the stale preview note, the wrong body
count. All the same shape.

If it cannot be read right now, ask for it. See §2.

---

## 4 · CALIBRATION, NOT PERFECTION

Best guess beats no guess. A gate that is right most of the time and has a
human path for the rest is shipping; a gate held back for accuracy is not.

- Age detection does not need to be correct on hard cases. It needs to be
  **populated**. Concierge handles the edge with a licence upload.
- The question to ask of any gate is *does the field come back real*, not
  *is the field always right*.
- Do not escalate a tuning problem into a launch blocker. Say what is
  unverified in one line, then verify it.

---

## 5 · PROMPT TEXT IS RICH'S

- Do not rewrite clauses that were not raised. Diagnose, name the clause,
  say why, wait.
- Typos, casing and run-ons are preserved verbatim. Silently correcting them
  is drift.
- Escape sequences and mojibake are **not** text — fix those and say so.
- "Locked" means locked. Do not re-flag it, do not re-tag it as needing work,
  do not let CENG's own quality opinion override Rich's sign-off.

---

## 6 · STAGE, APPLY, PROVE

Every file change:

1. Stage the exact text.
2. Apply it.
3. Prove the diff touched only what it should — line ranges, char counts,
   and an integrity check (body count, mojibake, backtick balance).

A corrected prompt in chat is a draft. Nothing is fixed until it is in the
file and committed.

---

## 7 · SCRIPTS THAT RUN OUTSIDE THE APP

Any script rendering outside the app must reproduce the engine's own
resolution, or emit rows the engine would have produced. The dinner-jacket
error came from a manifest that assigned male bodies to female sources
because the script skipped `resolvePresetForSubject`.

Read the script before writing its input file. `shoot-review.js` reads
`j.prompt` — a manifest of ids alone would have sent `undefined` to NB2 63
times.

PowerShell files must be pure ASCII.

---

## 8 · RESPONSE SHAPE

Bottom line first. Sentences, not paragraphs. No tables or headers in chat.
No preamble, no restating the question, no summarising what was just done at
length.

When a render is wrong, find what changed. Do not diagnose renders one at a
time.

---

## 9 · FILE TRANSFER

Added 2026-08-10, after two deployment failures.

Downloading a `.ts` file on Rich's machine opens it in an editor rather than
saving it. Both failures came from files believed to be on disk that were
not — the build error named line 42 of a file that had never changed, and
three rounds of copy commands were issued against a download that had never
happened.

**Before claiming a file landed, have Rich grep for a string that only
exists in the new version.** Do not infer it from a commit message, from the
file appearing in a listing, or from its absence in an untracked list —
committed files do not appear there.

If a path does not exist, stop issuing variations of the same command and
find out what actually happened.

---

## 10 · DOCUMENTS GO IN THE REPO

Added 2026-08-10.

This file and the CENG carryovers were written to a sandbox path on
2026-08-07, handed over as downloads, and never committed. Three days later
neither could be found in git and the session spent time proving they had
not been deleted.

**Every governance document goes to `docs/GOVERNANCE/` and gets committed in
the same pass it is written.** A document that only exists as a download is
a document the next session will not be handed.
