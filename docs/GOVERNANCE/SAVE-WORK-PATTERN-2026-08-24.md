# SAVE-WORK SCRIPTS -- EVERY LANE
24 August 2026. Written by CUI 41A after the three-lane git problem.

---

## THE PROBLEM

Three lanes on one branch. Every commit requires `git status`, careful
manual staging by explicit path, a second `git status` to verify, commit,
pull, push, PR, file-list check, merge. That is nine commands minimum,
and any one of them staging the wrong file contaminates another lane's work.

## THE SOLUTION

Each lane writes one script: `Save-Work-<LANE>.ps1`. It lives in `scripts\`.
Run it with a commit message and it does everything:

```powershell
powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-CENG.ps1 "What changed"
```

That is the entire git workflow, one command.

---

## HOW TO BUILD YOUR SCRIPT

Copy the pattern below. Change two things only:
1. The lane name in the comments
2. The `$LANE_FILES` list -- your files, not mine

```powershell
# Save-Work-LANE.ps1
# Replace LANE with your lane name (CENG, 41B, etc.)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-LANE.ps1 "What changed"
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-LANE.ps1 "What changed" -Extra "path\to\extra-file.ts"

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Message,
  [string[]]$Extra = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

# ----------------------------------------------------------------
# YOUR FILES. Add every path your lane owns.
# Do NOT include other lanes' files here.
# ----------------------------------------------------------------
$LANE_FILES = @(
  "lib\v1\groups\groups-effects.ts",
  "lib\v1\groups\groups-generator.ts",
  "scripts\patch-groups-likeness-clause.py",
  "scripts\patch-groups-cut-skin-keylight.py"
  # ... add yours
)

# Stage
Write-Host ""
Write-Host "-- staging --" -ForegroundColor Cyan
$toStage = ($LANE_FILES + $Extra) | Where-Object { Test-Path $_ }
if (-not $toStage) { Write-Host "  nothing to stage"; exit 0 }
git add @toStage
Write-Host ""; git status --short

# Bail if nothing new
if (-not (git diff --cached --name-only)) {
  Write-Host "  nothing new to commit"; exit 0
}

# Commit
Write-Host ""; Write-Host "-- committing --" -ForegroundColor Cyan
git commit -m $Message

# Pull
Write-Host ""; Write-Host "-- pulling --" -ForegroundColor Cyan
git pull --rebase

# Push
Write-Host ""; Write-Host "-- pushing --" -ForegroundColor Cyan
git push

# PR
Write-Host ""; Write-Host "-- PR --" -ForegroundColor Cyan
$prOut = gh pr create --fill 2>&1
Write-Host $prOut

$prNum = $null
if ($prOut -match 'pull/(\d+)') { $prNum = $Matches[1] }
if (-not $prNum) {
  $open = gh pr list --state open --json number,headRefName 2>$null | ConvertFrom-Json
  $prNum = ($open | Where-Object { $_.headRefName -eq 'feature/store-commerce' } |
            Select-Object -First 1).number
}

if ($prNum) {
  Write-Host ""; Write-Host "-- verifying PR #$prNum --" -ForegroundColor Cyan
  gh pr view $prNum --json files | ConvertFrom-Json |
    Select-Object -ExpandProperty files |
    Format-Table path, additions, deletions, changeType

  Write-Host ""; Write-Host "-- merging PR #$prNum --" -ForegroundColor Cyan
  gh pr merge $prNum --merge --delete-branch=false
} else {
  Write-Host "  could not determine PR number -- merge manually" -ForegroundColor Yellow
}

Write-Host ""; Write-Host "Done." -ForegroundColor Green
```

---

## RULES

**Never use `git add -A`.** It sweeps up every lane's work. The whole point
of this script is that it stages only your files.

**Keep `$LANE_FILES` current.** When you produce a new file, add it to your
list before the next save. Otherwise the script silently skips it and it
never ships.

**Use `-Extra` for one-offs.** A file you are not going to own permanently
can be passed at the command line rather than added to the list:

```powershell
powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-CENG.ps1 "Patch groups" -Extra "public\groups.html"
```

**The PR file list is printed before the merge.** Read it. If another
lane's file appears, do not merge -- remove it with `git restore --staged`
and re-run.

**Pure ASCII only in `.ps1` files.** PowerShell 5.1 breaks on em dashes,
curly quotes and box-drawing characters. Use plain hyphens in comments.

---

## THE .GITIGNORE

A `.gitignore` is committed at the repo root. It silences:

- `__pycache__/` and `scripts/__pycache__/`
- `.next/`
- `public\previews\groups-small\` and other generated plate folders
- `.env` files
- OS noise (`.DS_Store`, `Thumbs.db`)

Run `git status --short` after the first commit. The noise should be gone.
If a folder still appears, add it to `.gitignore` and commit the change.

---

## LANE FILE OWNERSHIP (current)

| Lane | Owns |
|---|---|
| CUI 41A | `public\*.html`, `scripts\patch-*.py`, `scripts\boot-reel.js`, `docs\GOVERNANCE\*.md`, splash plate images |
| CENG | `lib\v1\**`, `app\api\**`, `scripts\patch-groups-*.py`, `scripts\batch-*.ts`, `supabase\migrations\**` |
| 41B | `public\wallpapers.html`, `public\gallery.html`, `public\community.html`, `public\previews\wallpapers\**` |

When a file is in dispute, the lane that last had a PR merged for it owns
it until the conflict is raised with Rich.

*CUI 41A - 24 August 2026*
