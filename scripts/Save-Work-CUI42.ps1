# Save-Work-CUI42.ps1
# Lane: CUI 42 (wallpapers landing + subpages)
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-CUI42.ps1 "What changed"
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-CUI42.ps1 "What changed" -Extra "path\to\extra-file.ts"

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
# YOUR FILES. Add every path this lane owns.
# Do NOT include another lane's files here.
# Note: wallpapers.html and public\previews\wallpapers\** are listed
# under 41B in SAVE-WORK-PATTERN-2026-08-24.md, but CUI 42 shipped the
# last merged PR against both (PR 51) - per that doc's own rule,
# ownership sits here until Rich resolves the naming with 41B.
# ----------------------------------------------------------------
$LANE_FILES = @(
  "public\wallpapers.html",
  "public\wallpaper-store.html",
  "public\wallpaper-registry.js",
  "public\previews\wallpapers\ready_to_buy"
  # add wallpapers subpages here as they land
)

# Stage
Write-Host ""
Write-Host "-- staging --" -ForegroundColor Cyan
$toStage = ($LANE_FILES + $Extra) | Where-Object { Test-Path $_ }
if (-not $toStage) { Write-Host "  nothing to stage"; exit 0 }
git add @toStage
Write-Host ""; git status --short

# ----------------------------------------------------------------
# REFUSE ON FOREIGN STAGED FILES. The working copy is shared by three
# lanes - something can already be staged before this script ever runs
# (another lane's earlier `git add`, a leftover from a prior session).
# Adding your own files does not clear that. Check the full staged list
# against what THIS lane named; anything else gets unstaged, not
# committed, and the run stops so you can look at it.
# ----------------------------------------------------------------
$staged = git diff --cached --name-only
$allowed = ($LANE_FILES + $Extra) | ForEach-Object { $_ -replace '\\','/' }
$foreign = $staged | Where-Object {
  $s = $_
  -not ($allowed | Where-Object { $s -eq $_ -or $s.StartsWith("$_/") })
}
if ($foreign) {
  Write-Host ""
  Write-Host "REFUSED: staged files outside this lane's list:" -ForegroundColor Red
  $foreign | ForEach-Object { Write-Host "  $_" -ForegroundColor Red }
  Write-Host "Unstaging them. Nothing was committed. Find out whose they are before restaging." -ForegroundColor Red
  git restore --staged -- $foreign
  exit 1
}

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
# gh sometimes writes non-fatal warnings to stderr (e.g. "N uncommitted
# changes" when unrelated files like .gitignore are dirty). Local
# ErrorActionPreference is relaxed for this one call so a warning does not
# halt the script after the push has already succeeded.
Write-Host ""; Write-Host "-- PR --" -ForegroundColor Cyan
$prOut = $null
try {
  $ErrorActionPreference = 'Continue'
  $prOut = gh pr create --fill 2>&1
} finally {
  $ErrorActionPreference = 'Stop'
}
Write-Host $prOut

$prNum = $null
$prText = ($prOut | Out-String)
if ($prText -match 'pull/(\d+)') { $prNum = $Matches[1] }
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
