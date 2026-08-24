# GIT — THE COMMANDS, AND WHY THEY ARE THESE ONES

**For any CUI instance.** Written by CUI 41A, 23 August 2026.

Two instances write to `feature/store-commerce`. Everything below exists
because of that.

---

## 0 · THE SHAPE

```
feature/store-commerce  ->  PR  ->  main  ->  Vercel Production
```

Nothing is committed to `main` directly. **A PR created but not merged
ships nothing** — Vercel builds twice, Preview from the branch commit and
Production from the merge commit on `main`. Only Production is live.

---

## 1 · THE SEQUENCE, EVERY TIME

Run it in two messages, not one. Look at `git status --short` before
staging anything.

```powershell
cd D:\minramas
git status --short
```

Read that. Then:

```powershell
git add public/portraits.html public/pets.html scripts/patch-mobile-r9.py
git status --short
```

Read it again — this time you are checking that nothing else got picked
up. Then:

```powershell
git commit -m "Mobile: floor cards placed by the grid, not the eight-column rules"
git pull --rebase
git push
gh pr create --fill
```

`gh pr create` prints the PR number. Then:

```powershell
gh pr view 34 --json files
gh pr merge 34 --merge --delete-branch=false
```

---

## 2 · WHY EACH ONE

**`git status --short` before staging.** Files appear that were not there
ten minutes ago. In one session today `public/index.html`,
`public/gallery.html` and two `community/posts` route files all turned up
mid-run from the other lane. Staging without looking sweeps them in.

**`git add` by explicit path. NEVER `git add -A`.** This is the single
most important line in this document. `-A` takes the other instance's work
in progress, untracked CENG scripts, `__pycache__`, and anything else
sitting in the tree, and puts your name on all of it.

**`git status --short` again, after staging.** The staged column is the
first character. `M ` with the M in column one means staged; ` M` means
modified but not staged. Check that only your files show a staged mark.

**`git pull --rebase` before pushing.** The other lane has probably pushed
since you last looked. Rebase rather than merge so the branch history stays
one line.

**`gh pr create --fill`** takes the title and body from the commits. `gh`
is the GitHub CLI and is a different program from `git` — `git push` alone
does not open or merge a PR.

**`gh pr view <n> --json files` before merging.** Confirms the PR holds
what you think it holds and nothing else. An empty or surprising file list
is the last chance to catch a bad stage.

**`--delete-branch=false`.** Never delete the branch. Both lanes are on it.

---

## 3 · READING `git status --short`

```
 m _recovery/at-19c3157          <- submodule, ignore
 M public/gallery.html           <- modified, NOT staged, not yours
M  public/portraits.html         <- staged, yours
A  scripts/patch-mobile-r9.py    <- staged, new file, yours
?? scripts/batch-groups-3up.ts   <- untracked, CENG's, leave it
?? scripts/__pycache__/          <- byproduct, never commit
```

Column one is the index, column two is the working tree. Anything with a
mark in column one is going into your commit.

**`__pycache__` appears whenever one patch script imports another.** It is
never committed. If it keeps turning up, it belongs in `.gitignore`.

---

## 4 · WHEN THINGS LOOK WRONG

**"nothing to commit" but you just installed files.** They were already
committed on an earlier run. Check with `git log --oneline -3` rather than
re-running the install.

**The PR is empty.** Either the commit did not happen or it was pushed
before. `gh pr view <n> --json files` says which.

**"Pull request was already merged".** Auto-merge, or the other lane
merged it. Confirm with `gh pr view <n> --json files` and move on.

**A file you did not touch is in your diff.** Stop. You staged too widely.
`git restore --staged <path>` takes it back out without changing the file.

---

## 5 · THE TWO-LANE RULES

- **Say which files you are holding** before you touch them.
- Commit and push **the same day**. `PROCEDURES-AND-LANES` §5 records
  fifteen days of work that once existed only in a working tree.
- A patch that **reads the live repo** carries the other lane's work
  through correctly. A patch built against a stale copy pasted into chat
  does not.
- **Whoever installs second overwrites the first.** Git will not warn you,
  because by the time git sees it there is only one version.

---

## 6 · THE WHOLE THING, TO COPY

```powershell
cd D:\minramas
git status --short
```

```powershell
git add <explicit paths>
git status --short
git commit -m "<what changed, in plain words>"
git pull --rebase
git push
gh pr create --fill
```

```powershell
gh pr view <n> --json files
gh pr merge <n> --merge --delete-branch=false
```

*CUI 41A · 23 August 2026*
