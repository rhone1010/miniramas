# Save-Work-CENG.ps1
#
# The whole git workflow for the CENG lane, in one command.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\Save-Work-CENG.ps1 "What changed"
#   powershell -ExecutionPolicy Bypass -File .\scripts\Save-Work-CENG.ps1 "What changed" -Extra "path\to\one-off.ts"
#   powershell -ExecutionPolicy Bypass -File .\scripts\Save-Work-CENG.ps1 "What changed" -NoMerge
#   powershell -ExecutionPolicy Bypass -File .\scripts\Save-Work-CENG.ps1 "What changed" -DryRun
#
# Built from SAVE-WORK-PATTERN-2026-08-24 by CUI 41A. Three lanes on one
# branch means nine commands per commit, and any one of them staging too
# widely puts CENG's name on another lane's work in progress.
#
# ---- WHAT IT WILL NEVER DO -------------------------------------------------
#
# Stage everything. Not once, not behind a flag. The entire reason this
# script exists is that it stages CENG's paths and nothing else.
#
# ---- PATTERNS, NOT JUST FILES ----------------------------------------------
#
# CENG produces a new patch script most sessions. A hardcoded file list goes
# stale the moment that happens, and a file missing from the list is silently
# never shipped - which is the failure PROCEDURES-AND-LANES section 5 records
# as fifteen days of work living only in a working tree.
#
# So directories and wildcards are used where the lane owns everything inside
# them, and the other lanes' files are named explicitly as a guard.

param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Message,

  # One-offs that are not permanently CENG's. Passed rather than added.
  [string[]] $Extra = @(),

  # Stage, commit and push, but stop before the PR. For when the other lanes
  # are mid-flight and Rich is holding the merge.
  [switch] $NoMerge,

  # Show what would be staged and stop. Nothing is committed.
  [switch] $DryRun
)

# Git writes warnings to stderr - line-ending notices, rebase chatter - and
# PowerShell treats native stderr as a terminating error under 'Stop'. That
# killed this script mid-stage on its first run, leaving files staged and the
# commit never reached. 'Continue' plus explicit $LASTEXITCODE checks after
# every git call is the correct posture: real failures are still caught, and a
# CRLF warning no longer aborts a commit.
$ErrorActionPreference = 'Continue'

$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

$BRANCH = 'feature/store-commerce'

# ---- CENG'S PATHS -----------------------------------------------------------
# Per LANE FILE OWNERSHIP in SAVE-WORK-PATTERN-2026-08-24.
$LANE_PATHS = @(
  'lib/v1',
  'app/api',
  'supabase/migrations',
  'scripts/patch-groups-*.py',
  'scripts/batch-*.ts',
  'scripts/groups-candidates.ts',
  'scripts/measure-*.py',
  'scripts/Install-Batch.ps1',
  'scripts/Archive-NonCardPlates.ps1',
  'scripts/Save-Work-CENG.ps1'
)

# NEVER STAGED, even though they sit inside CENG's own directories.
# `lib/v1` is CENG's, but lib/v1/portraits/effect-registry.ts.bak-2026-08-02
# is a backup and staging it would put a dead file in the repo forever. These
# are unstaged again immediately after the add.
$NEVER = @(
  '*.bak-*', '*_STALE.bak', '*.orig', '*.rej', '__pycache__'
)

# NOT CENG's. Checked against the staged list before committing, because a
# glob widening by accident is exactly the failure this guards.
$FOREIGN = @(
  'public/index.html', 'public/gallery.html', 'public/community.html',
  'public/wallpapers.html', 'public/portraits.html', 'public/pets.html',
  'public/groups.html', 'public/halloween.html', 'public/pets-halloween.html',
  'public/pets-chooser.html'
)

Write-Host ""
Write-Host "Save-Work-CENG" -ForegroundColor Cyan
Write-Host "  repo    $repo"
if ($DryRun) { Write-Host "  MODE    dry run - nothing will be committed" }
Write-Host ""

$current = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "  branch  $current"
Write-Host ""
if ($current -ne $BRANCH) {
  Write-Host "REFUSED: on '$current', expected '$BRANCH'." -ForegroundColor Red
  Write-Host "All lanes commit to $BRANCH. Switch, or stage by hand." -ForegroundColor Red
  exit 1
}

# ---- BEFORE ----------------------------------------------------------------
Write-Host "-- working tree before --" -ForegroundColor Cyan
git status --short
Write-Host ""

# ---- STAGE ------------------------------------------------------------------
$toStage = @()
foreach ($p in ($LANE_PATHS + $Extra)) {
  if ($p -match '[\*\?]') { $toStage += $p }
  elseif (Test-Path $p)   { $toStage += $p }
}

if ($toStage.Count -eq 0) {
  Write-Host "  nothing matched. Nothing staged." -ForegroundColor Yellow
  exit 0
}

Write-Host "-- staging --" -ForegroundColor Cyan
foreach ($p in $toStage) {
  git add -- $p 2>$null
}

# Backups and byproducts come straight back out. A .gitignore entry does not
# help here - git ignores only UNTRACKED files, and one of these may already
# be tracked from an earlier accident.
$staged = @(git diff --cached --name-only)
$junk = @()
foreach ($f in $staged) {
  foreach ($pat in $NEVER) {
    if ($f -like "*$pat*") { $junk += $f; break }
  }
}
if ($junk.Count -gt 0) {
  Write-Host "-- unstaging backups and byproducts --" -ForegroundColor Yellow
  foreach ($f in $junk) {
    Write-Host "  $f"
    git restore --staged -- $f 2>$null
  }
  Write-Host ""
  $staged = @(git diff --cached --name-only)
}

if ($staged.Count -eq 0) {
  Write-Host "  nothing new to commit." -ForegroundColor Yellow
  Write-Host "  If you expected something here it is probably already committed -"
  Write-Host "  check with: git log --oneline -3"
  exit 0
}

foreach ($f in $staged) { Write-Host "  $f" }
Write-Host ""

# ---- THE GUARD --------------------------------------------------------------
# A file belonging to another lane in the staged list means a glob widened or
# an -Extra was wrong. Stop rather than commit it - git will not warn, and by
# the time it is pushed the other lane's work has CENG's name on it.
$trespass = @($staged | Where-Object { $FOREIGN -contains $_ })
if ($trespass.Count -gt 0) {
  Write-Host "REFUSED: these belong to another lane and are staged:" -ForegroundColor Red
  foreach ($f in $trespass) { Write-Host "  $f" -ForegroundColor Red }
  Write-Host ""
  Write-Host "Take them back out with:" -ForegroundColor Red
  foreach ($f in $trespass) { Write-Host "  git restore --staged $f" -ForegroundColor Red }
  exit 1
}

if ($DryRun) {
  Write-Host "Dry run. $($staged.Count) file(s) staged, nothing committed." -ForegroundColor Yellow
  Write-Host "Unstage with: git reset" -ForegroundColor Yellow
  Write-Host ""
  exit 0
}

# ---- COMMIT -----------------------------------------------------------------
Write-Host "-- committing --" -ForegroundColor Cyan
git commit -m $Message
if ($LASTEXITCODE -ne 0) { Write-Host "commit failed." -ForegroundColor Red; exit 1 }

# ---- PULL AND PUSH ----------------------------------------------------------
# Rebase rather than merge so the branch stays one line with three lanes on it.
Write-Host ""
Write-Host "-- pulling --" -ForegroundColor Cyan
git pull --rebase
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "REBASE STOPPED. Your commit exists locally and nothing is lost." -ForegroundColor Red
  Write-Host "Resolve, then: git rebase --continue, then git push" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "-- pushing --" -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) { Write-Host "push failed." -ForegroundColor Red; exit 1 }

if ($NoMerge) {
  Write-Host ""
  Write-Host "Pushed. No PR opened (-NoMerge)." -ForegroundColor Green
  Write-Host "A PR created but not merged ships nothing - open one when the lanes are clear."
  Write-Host ""
  exit 0
}

# ---- PR ---------------------------------------------------------------------
Write-Host ""
Write-Host "-- PR --" -ForegroundColor Cyan
$prOut = gh pr create --fill 2>&1
Write-Host $prOut

$prNum = $null
if ("$prOut" -match 'pull/(\d+)') { $prNum = $Matches[1] }
if (-not $prNum) {
  $open = gh pr list --state open --json number,headRefName 2>$null | ConvertFrom-Json
  if ($open) {
    $prNum = ($open | Where-Object { $_.headRefName -eq $BRANCH } | Select-Object -First 1).number
  }
}

if (-not $prNum) {
  Write-Host ""
  Write-Host "Could not determine the PR number. Pushed, not merged." -ForegroundColor Yellow
  Write-Host "  gh pr list --state open" -ForegroundColor Yellow
  Write-Host "  gh pr merge <n> --merge --delete-branch=false" -ForegroundColor Yellow
  exit 0
}

# The last chance to catch a bad stage before it reaches main.
Write-Host ""
Write-Host "-- PR #$prNum holds --" -ForegroundColor Cyan
gh pr view $prNum --json files | ConvertFrom-Json |
  Select-Object -ExpandProperty files |
  Format-Table path, additions, deletions, changeType

Write-Host "-- merging PR #$prNum --" -ForegroundColor Cyan
gh pr merge $prNum --merge --delete-branch=false

Write-Host ""
Write-Host "Done. Production builds from the merge commit on main." -ForegroundColor Green
Write-Host ""
