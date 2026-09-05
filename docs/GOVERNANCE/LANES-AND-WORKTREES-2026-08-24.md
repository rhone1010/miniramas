# LANES AND WORKTREES - THE RULES
24 August 2026. Written by CUI 42 after a day in which four lanes on one
shared folder flipped each other's branches three times, swept each
other's staged files into commits twice, and pushed to main directly
once. Every one of those is structurally impossible under this setup.

---

## THE SHAPE

One repo, five folders:

| folder | branch | who |
|---|---|---|
| `D:\minramas` | `main` | NOBODY WORKS HERE. Read-only reference. |
| `D:\lanes\ceng` | `lane/ceng` | CENG |
| `D:\lanes\cui41a` | `lane/cui41a` | CUI 41A |
| `D:\lanes\cui41b` | `lane/cui41b` | CUI 41B |
| `D:\lanes\cui42` | `lane/cui42` | CUI 42 |

They are git worktrees: one shared history, separate working files.
A checkout in one folder cannot touch another folder. Staging in one
folder cannot sweep another lane's files, because the other lane's
uncommitted work is not in your folder.

## THE FIVE RULES

1. **Work only in your folder.** Your Downloads-to-Install-File flow,
   your patches, your Save-Work script - all pointed at YOUR folder.
2. **Never run `git checkout` for branches.** Your folder is your
   branch. There is nothing to switch to.
3. **Ship by PR to main, same as always.** Commit, push, `gh pr create`,
   check the file list, merge. The file list now contains only your
   commits, so the check is finally meaningful.
4. **Start each task by pulling main into your branch:**
   `git pull origin main` from your folder. That is how you receive
   other lanes' merged work.
5. **D:\minramas is for looking, not touching.** It tracks main. If you
   need to read the live state of a file, read it there.

## WHAT THIS ENDS

- A lane switching the branch under another lane mid-commit
- `git add` sweeping another lane's staged or working files
- Save-Work committing to whatever branch happened to be checked out
- PR file lists full of other lanes' work, unverifiable before merge
- Direct pushes to main because the folder happened to be on main

## WHAT IT COSTS

- Each folder needs its own `node_modules` if that lane builds locally
  (most lanes never run a build - Vercel builds from main)
- Rich runs Install-File against the right lane's folder for whichever
  lane produced the file - the lane states its folder in every message
  that carries a command

## SAVE-WORK SCRIPTS

Each lane's Save-Work-<LANE>.ps1 lives in its own folder's scripts\ and:
- refuses to run if the current branch is not that lane's branch
- pulls origin/main before pushing, so PRs merge clean
- PRs its own branch to main

*CUI 42 - 24 August 2026*
