# DIRECTIVE — FILE HANDLING

**For CUI 41A, and every CUI instance after it.**
Written by CUI V32, 22 August 2026, after a day in which four separate
file mistakes cost time.

This is not ceremony. Every rule below traces to something that actually
went wrong, and the ones in bold went wrong today.

---

## 0 · THE ONE SENTENCE

**A file has four different versions at any moment — the live repo, the
`H:` archive, project knowledge, and whatever is in the chat — and only
the first one is real.**

Almost every mistake in this document is some version of forgetting that.

---

## 1 · THE FOUR PLACES A FILE LIVES

| where | what it is | trust |
|---|---|---|
| `D:\minramas\...` | the live repo | **the only truth** |
| `H:\minramas\...` | archived versions, mirrored folder shape | the undo |
| project knowledge | a snapshot Rich uploaded, some time ago | **stale until proven otherwise** |
| the chat | what Rich pasted or Claude produced | a copy, not a file |

**Project knowledge is the dangerous one.** It looks authoritative, it is
searchable, and it silently ages. `PROCEDURES-AND-LANES` §9 bans `.ts` and
engine `.html` from project knowledge for exactly this reason, and the ban
is not currently enforced — there are 87 `.ts` files in there right now.

**Before asserting anything about a file, check its hash against a copy
Rich sent that day.** Today CUI announced that `portraits.html` was a
stale June copy at 258KB. It was neither. The project copy and the live
copy were byte-identical, same MD5, 524,705 bytes. The claim came from
misreading `ls` output and pattern-matching a date string inside the file.

That cost twenty minutes and Rich's confidence. It was avoidable with one
`md5sum`.

---

## 2 · THE FLOW, WHICH NEVER VARIES

```
Claude writes a file
        v
  Rich DOWNLOADS it to %USERPROFILE%\Downloads
        v
  Install-File.ps1 moves it into the repo
        v
  the displaced version lands in H:\minramas\<same path>\<name>_NNN.ext
        v
  Rich verifies with findstr
        v
  git add / commit / push / PR / merge
```

Nothing skips a step. Nothing goes into the repo by hand.

---

## 3 · DOWNLOADS IS THE ONLY STAGING AREA

Every file Claude produces goes to `%USERPROFILE%\Downloads\<final
filename>`. Never `public/`. Never a `staging/` or `_incoming/` folder
invented for the occasion. Never the repo directly.

Scripts that write output write it to Downloads too.

**The filename Claude gives the file IS the filename it will be installed
under.** `Install-File.ps1` defaults `-From` to Downloads by the target's
leaf name, so the two must match or the command needs an explicit `-From`.

---

## 4 · THE MISTAKE THAT HAPPENS MOST

**A batch of commands whose first line installs a file that is still
sitting in the browser.**

The install fails with `MISSING C:\Users\richh\Downloads\<file>` and every
command after it runs into nothing. This happened again today, twice.

**Always write "download this, then run" above the commands.** Never
assume the card was clicked. If Rich reports MISSING, the answer is
almost never a path problem — it is that the file was never downloaded.

---

## 5 · A BEHAVIOUR IN Install-File.ps1 THAT NOBODY HAS WRITTEN DOWN

When the exact filename is not in Downloads, the script does **not** fail.
It searches for `<basename>*<ext>` and takes **the newest match**, then
prints which one it took:

```
found     portraits (1).html  (newest match in Downloads)
```

This is helpful — browsers append ` (1)` when a name has been seen before
— and it is also the quietest way to ship the wrong build. A stale
`portraits (2).html` from three days ago will be picked without complaint
if today's download went elsewhere.

**Read that `found` line every time it appears.** If a filename with a
number in brackets is installed, check the byte count against what Claude
produced before going further.

**Clear Downloads of old copies of a file before installing a new one.**

---

## 6 · WHAT Install-File.ps1 GUARANTEES, AND WHAT IT DOES NOT

Guarantees, read out of the script itself:

- **`Move-Item` is the only file operation in it.** No `Remove-Item`, no
  `-Force` overwrite. There is no path through it that ends in a file
  ceasing to exist.
- The displaced version goes to `H:\minramas\` under a mirrored folder
  path and a number that has never been used — `_001`, then `_002`. An
  existing archive is never touched.
- It **refuses outright** if `H:` is not mounted and the target already
  exists. Nothing moves.
- `-DryRun` exits before touching anything.
- A `Target` given as an absolute path outside the repo is refused.

Does not guarantee:

- That the file you downloaded is the file being installed (see §5).
- That the move is logged. The tracker is dot-sourced, and if
  `FileOps-Tracker.ps1` is missing it prints one red line and **carries on
  untracked**. If that line appears, stop and say so.

---

## 7 · WHERE THE LOG ACTUALLY IS

**`_ledger.csv` IS DEAD.** It holds one row, dated 19 August.
`Install-File.ps1` contains no reference to it and has never written to
it. Rich spent part of today reading it as though it were current and
concluding three days of work had gone unrecorded.

The real record is written by `Invoke-TrackedMove` on every move:

```
H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv
```

One file per day. Today's is 33KB, the 21st is 124KB. Nothing has ever
been lost.

**Rename `_ledger.csv` so nobody reads it as current again.** Do not
delete it.

**The Python gap.** Patch scripts written in Python move files without
going through the tracker, so they produce no row.
`scripts/make-cui-session-log.py` reconstructs one. It has not been run
for the last three sessions.

---

## 8 · NEVER DELETE

`Archive-File.ps1` moves a file to `H:\NO_DELETE_ARCHIVE\`. That is the
only way anything leaves the repo.

No `rm`. No `Remove-Item`. No `git rm`. No "cleaning up". A file that
looks dead is a file whose purpose has not been found yet — `_ledger.csv`
looked dead all day and turned out to be evidence of how the tracking
actually works.

---

## 9 · VERIFY, THEN BUILD

Every install is followed by verification in the same message. For HTML
there is no `tsc`, so it is two `findstr` calls:

```
findstr /S /C:"<the new string>" public\<file>.html     -> expect N lines
findstr /S /C:"<the old string>" public\<file>.html     -> expect nothing
```

For `.ts`:

```
npx tsc --noEmit 2>&1 | findstr /C:"<filename>"
```

**"Ran" is not verification. The output is.** Rich saying a command
completed tells you the shell returned; it does not tell you the change
landed. Ask for the output, every time, and read it before building
anything on top.

Nothing is built on a file until Rich confirms it landed.

---

## 10 · BEFORE WRITING A PATCH SCRIPT

- **Ask for the current file.** Say plainly: "my copy is dated X, send me
  the live one." An anchor written against a stale copy does not corrupt
  anything — the script refuses — but it wastes a round.
- **Confirm the anchor exists exactly once** in every file the patch
  touches, before writing the script. One `findstr /S /N /C:` across all
  of them.
- **Simulate against real copies before delivering.** Every patch today
  was run against the actual files first and two defects were caught that
  way: an LF/CRLF mismatch in an inserted comment, and an assertion that
  refused a legitimate shrink because "Rooms" is shorter than
  "Portraits". Both would have reached Rich.
- The script itself: anchor-replace, dry run by default, pre-write
  assertions that refuse to write, post-write verification that refuses to
  write.
- **Pure ASCII in PowerShell.** Em dashes break PS 5.1.
- **JS has no nested block comments.** A patch that comments out the
  original and prepends a replacement ships a broken file. Replace the
  whole function.
- **A post-write assertion will catch the patch's own comment** if the
  comment quotes the string being grepped for. Split the string in the
  source rather than weakening the check.

---

## 11 · TWO CUIs, ONE REPO

Both instances write to `feature/store-commerce`. It has worked for two
days and it works because of this:

- **Say which files you are holding.** CUI V32 is holding the six room
  pages plus `community.html` and `gallery.html`. 41A has mobile
  responsive work, which means media queries in those same room pages.
  **Whoever installs second overwrites the first.**
- `git status --short` before staging. Always.
- **Stage by explicit path. Never `git add -A`** — it sweeps up the other
  lane's work in progress, and today `git status` showed three untracked
  CENG files sitting in the working tree.
- Commit and push the same day. §5 of `PROCEDURES-AND-LANES` records
  fifteen days of work that once existed only in a working tree.
- `gh pr create --fill`, then `gh pr merge --merge
  --delete-branch=false`. **Never delete the branch.**
- **A PR created but not merged ships nothing.** Vercel builds twice —
  Preview from the branch commit, Production from the merge commit on
  `main`. Only Production is live.

---

## 12 · MIGRATIONS

Not a file rule, but it cost most of a day and belongs somewhere.

**Never wrap a migration in `begin`/`commit` for the Supabase SQL
editor.** The editor manages its own transaction. A wrapped script reports
"Success. No rows returned" and applies nothing — except that DDL in the
same file DOES commit. One wrapped file today created a table and silently
dropped every GRANT in it, with no error either way.

Verify grants with `has_table_privilege`, not
`information_schema.role_table_grants` — the latter returned zero rows for
grants that had genuinely applied.

CUI writes migrations. **Rich reviews and applies them.** CUI never runs
one.

---

*CUI V32 · 22 August 2026*
