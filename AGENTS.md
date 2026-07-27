# CLAUDE.md — Liten & Co · standing rules for CC
Repo root. Applies to every session, every task, without exception.

---

## 1 · FIDELITY LAW — port, never recreate

**You are not authorized to author UI.** Design is Rich's lane. Your job is to move approved markup, CSS, and copy into place unchanged.

### The rule
When a spec says "port," "bring across," "use," or names a source file/block:
- **Copy the source bytes.** Markup, CSS, class names, attribute order, whitespace, copy strings — all of it.
- Adapt **only** what the spec explicitly names (e.g. "change the ID," "rename the handler").
- Everything the spec does not name stays byte-identical.

### The loophole — closed
Producing markup that *looks equivalent* and *uses the same class names* is **still recreation** and is a violation. So is:
- Rewriting a block "more cleanly" or "more semantically"
- Normalizing whitespace, quote style, or attribute order
- Collapsing repeated markup into a loop or template
- Substituting a token for a literal value, or a literal for a token
- Re-deriving CSS from what the rendered result appears to be
- Improving copy, fixing grammar, or adjusting tone
- Filling a gap with something reasonable

**If the output is not a copy, it is a violation — regardless of how close it looks.**

### When you cannot port verbatim
Stop and report. Do not approximate. Do not proceed to "unblock yourself."
Report: which source block, what you were looking for, what you found instead.
A blocked task logged is correct. An invented block is a defect that costs Rich a review cycle to catch.

### Verification after every port
State in your report, per ported block:
- Source file + line range
- Destination file + line range
- Line count in vs out (must match unless the spec named a change)
- Every deviation, itemized, each traced to the spec line that authorized it

"Ported successfully" without these numbers is not a report.

---

## 2 · NEVER INVENT
The following may only come from Rich. If missing, stop and ask:
- Verbatim composition blocks — Signature, Bust, Statuesque, and all multi variants
- Customer-facing copy of any kind
- Colors, type sizes, spacing values, radii, elevation
- Effect names, preset names, series names
- Prices, credit costs, quantities

---

## 3 · CHANGE ONLY WHAT IS ASKED
Scope is the spec. Not the spec plus improvements.
- No refactors, no renames, no reformatting, no dead-code cleanup unless the task is that
- No dependency changes
- No "while I was in there" fixes — log them instead and move on
- Adjacent bugs get logged, not fixed

---

## 4 · LIVE FILES
- Canonical map lives in `directives/LIVE-FILE-LEDGER.md`. Read it before touching any file.
- **Never edit a live file directly.** Copy to `<name>.next.<ext>`, work there, verify, merge only on Rich's say-so.
- **Never copy a proto or design reference over a live file.** Protos are named `*-proto-*`, `*-designshell-*`, or carry a version stamp. Live files carry the plain name.
- Reference a file as **path + line count + date**, never by name alone. If two sources disagree on line count, stop and reconcile.

---

## 5 · SESSION BEHAVIOR
- Work the whole queue in order. Report once at the end.
- Stop immediately only for: an error, a missing spec, or a destructive/ambiguous change.
- Do not stop to report progress between tasks.
- If a task is blocked, log it and move to the next.
- Verify after each batch: backticks even, braces/parens/brackets balanced, no orphaned readers. Keep batches small enough to verify.

---

## 6 · COPY LAW
- "Crafted Images" — paired phrase, capital C, capital I. Replaces all sculpted/sculpture language.
- Never "sculpture," "sculpted," "sculpt" in customer-facing text.
- Action verb is **Craft**, never Create.
- Banned customer-facing verbs: off · save · discount · queue · render.
- "In Environment" replaces "In-Situ" / "In Situ" in all user-facing copy, UI labels, and model-facing prompt block headers. Internal code IDs may stay `in_situ`.
- Plain language. The audience is diverse — no literary vocabulary, no hype register.

---

## 7 · TYPE AND CONTROLS
- Cormorant Garamond renders ~⅓ smaller than sans at the same px — always compensate.
- Garamond body copy: floor 22px, never below 20px. Serif UI pills/controls: 18px+. Mono/sans labels: never below 12px. No body text below 16px.
- Garamond is weight 400 globally.
- Action buttons and interactive controls must be visually substantial — never micro-links or thin underlined text. Italic serif pills at 1.1rem+, padding ~.5rem .8rem+, oxblood/sage outlined or filled.
- **When in doubt, size up.**


---



---

# CLAUDE.md — Liten & Co · standing rules for CC
Repo root. Applies to every session, every task, without exception.

---

## 1 · FIDELITY LAW — port, never recreate

**You are not authorized to author UI.** Design is Rich's lane. Your job is to move approved markup, CSS, and copy into place unchanged.

### The rule
When a spec says "port," "bring across," "use," or names a source file/block:
- **Copy the source bytes.** Markup, CSS, class names, attribute order, whitespace, copy strings — all of it.
- Adapt **only** what the spec explicitly names (e.g. "change the ID," "rename the handler").
- Everything the spec does not name stays byte-identical.

### The loophole — closed
Producing markup that *looks equivalent* and *uses the same class names* is **still recreation** and is a violation. So is:
- Rewriting a block "more cleanly" or "more semantically"
- Normalizing whitespace, quote style, or attribute order
- Collapsing repeated markup into a loop or template
- Substituting a token for a literal value, or a literal for a token
- Re-deriving CSS from what the rendered result appears to be
- Improving copy, fixing grammar, or adjusting tone
- Filling a gap with something reasonable

**If the output is not a copy, it is a violation — regardless of how close it looks.**

### When you cannot port verbatim
Stop and report. Do not approximate. Do not proceed to "unblock yourself."
Report: which source block, what you were looking for, what you found instead.
A blocked task logged is correct. An invented block is a defect that costs Rich a review cycle to catch.

### Verification after every port
State in your report, per ported block:
- Source file + line range
- Destination file + line range
- Line count in vs out (must match unless the spec named a change)
- Every deviation, itemized, each traced to the spec line that authorized it

"Ported successfully" without these numbers is not a report.

---

## 2 · NEVER INVENT
The following may only come from Rich. If missing, stop and ask:
- Verbatim composition blocks — Signature, Bust, Statuesque, and all multi variants
- Customer-facing copy of any kind
- Colors, type sizes, spacing values, radii, elevation
- Effect names, preset names, series names
- Prices, credit costs, quantities

---

## 3 · CHANGE ONLY WHAT IS ASKED
Scope is the spec. Not the spec plus improvements.
- No refactors, no renames, no reformatting, no dead-code cleanup unless the task is that
- No dependency changes
- No "while I was in there" fixes — log them instead and move on
- Adjacent bugs get logged, not fixed

---

## 4 · LIVE FILES
- Canonical map lives in `directives/LIVE-FILE-LEDGER.md`. Read it before touching any file.
- **Never edit a live file directly.** Copy to `<name>.next.<ext>`, work there, verify, merge only on Rich's say-so.
- **Never copy a proto or design reference over a live file.** Protos are named `*-proto-*`, `*-designshell-*`, or carry a version stamp. Live files carry the plain name.
- Reference a file as **path + line count + date**, never by name alone. If two sources disagree on line count, stop and reconcile.

---

## 5 · SESSION BEHAVIOR
- Work the whole queue in order. Report once at the end.
- Stop immediately only for: an error, a missing spec, or a destructive/ambiguous change.
- Do not stop to report progress between tasks.
- If a task is blocked, log it and move to the next.
- Verify after each batch: backticks even, braces/parens/brackets balanced, no orphaned readers. Keep batches small enough to verify.

---

## 6 · COPY LAW
- "Crafted Images" — paired phrase, capital C, capital I. Replaces all sculpted/sculpture language.
- Never "sculpture," "sculpted," "sculpt" in customer-facing text.
- Action verb is **Craft**, never Create.
- Banned customer-facing verbs: off · save · discount · queue · render.
- "In Environment" replaces "In-Situ" / "In Situ" in all user-facing copy, UI labels, and model-facing prompt block headers. Internal code IDs may stay `in_situ`.
- Plain language. The audience is diverse — no literary vocabulary, no hype register.

---

## 7 · TYPE AND CONTROLS
- Cormorant Garamond renders ~⅓ smaller than sans at the same px — always compensate.
- Garamond body copy: floor 22px, never below 20px. Serif UI pills/controls: 18px+. Mono/sans labels: never below 12px. No body text below 16px.
- Garamond is weight 400 globally.
- Action buttons and interactive controls must be visually substantial — never micro-links or thin underlined text. Italic serif pills at 1.1rem+, padding ~.5rem .8rem+, oxblood/sage outlined or filled.
- **When in doubt, size up.**


---

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->



