# Save-Work-CUI.ps1
# CUI 41A  ·  24 August 2026
#
# Stages only the CUI lane's known files, commits, pulls, pushes,
# opens a PR and merges it. Four git commands replaced with one.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Save-Work-CUI.ps1 "What changed"
#
# The commit message is required.

param(
  [Parameter(Mandatory=$true, Position=0)]
  [string]$Message,
  [string[]]$Extra = @()
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

$CUI_FILES = @(
  # HTML room pages
  "public\portraits.html",
  "public\pets.html",
  "public\groups.html",
  "public\halloween.html",
  "public\pets-halloween.html",
  "public\pets-chooser.html",
  "public\community.html",
  "public\index.html",
  "public\help.html",
  "public\wallpapers.html",
  "public\gallery.html",

  # Splash plates (committed when new ones are added)
  "public\previews\home\splash\tall\groups",
  "public\previews\home\splash\tall-small\groups",
  "public\previews\home\splash\tall\halloween\man_haunted_scarecrow.jpg",
  "public\previews\home\splash\tall\pets\pets_victorian.jpg",
  "public\previews\home\splash\tall-small",

  # Patch scripts this lane produces
  "scripts\patch-mobile-r1.py",
  "scripts\patch-mobile-r2.py",
  "scripts\patch-mobile-r3.py",
  "scripts\patch-mobile-r4.py",
  "scripts\patch-mobile-r5.py",
  "scripts\patch-mobile-r6.py",
  "scripts\patch-mobile-r7.py",
  "scripts\patch-mobile-r8.py",
  "scripts\patch-mobile-r9.py",
  "scripts\patch-mobile-rooms3.py",
  "scripts\patch-index-reel-r10.py",
  "scripts\patch-index-reel-r11.py",
  "scripts\patch-index-r12.py",
  "scripts\patch-index-r13.py",
  "scripts\patch-index-r14.py",
  "scripts\patch-index-r15.py",
  "scripts\patch-index-r16.py",
  "scripts\boot-reel.js",

  # Governance docs this lane has produced
  "docs\GOVERNANCE\INSTALL-FILE-HOW-AND-WHY-2026-08-23.md",
  "docs\GOVERNANCE\GIT-COMMANDS-2026-08-23.md",
  "docs\GOVERNANCE\QE-FIELD-GUIDE-2026-08-24.md"
)

# ── STAGE ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- staging CUI files --" -ForegroundColor Cyan

$toStage = @()
foreach ($f in ($CUI_FILES + $Extra)) {
  if (Test-Path $f) {
    $toStage += $f
  }
}

if ($toStage.Count -eq 0) {
  Write-Host "  nothing to stage" -ForegroundColor Yellow
  exit 0
}

git add @toStage

# Also stage .gitignore if it is modified
if ((git status --short .gitignore 2>$null) -match '^\s*[MA]') {
  git add .gitignore
}

Write-Host ""
git status --short

# ── CONFIRM ───────────────────────────────────────────────────────────
$staged = git diff --cached --name-only
if (-not $staged) {
  Write-Host ""
  Write-Host "  nothing new to commit -- already up to date" -ForegroundColor Yellow
  exit 0
}

# ── COMMIT ────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- committing --" -ForegroundColor Cyan
git commit -m $Message

# ── PULL ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- pulling --" -ForegroundColor Cyan
git pull --rebase

# ── PUSH ──────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- pushing --" -ForegroundColor Cyan
git push

# ── PR ────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "-- opening PR --" -ForegroundColor Cyan
$prOut = gh pr create --fill 2>&1
Write-Host $prOut

# Extract PR number
$prNum = $null
if ($prOut -match 'pull/(\d+)') {
  $prNum = $Matches[1]
} elseif ($prOut -match 'already exists.*pull/(\d+)') {
  $prNum = $Matches[1]
}

if (-not $prNum) {
  # Already merged or no commits — check open PRs
  $open = gh pr list --state open --json number,headRefName 2>$null | ConvertFrom-Json
  $prNum = ($open | Where-Object { $_.headRefName -eq 'feature/store-commerce' } | Select-Object -First 1).number
}

if ($prNum) {
  Write-Host ""
  Write-Host "-- verifying PR #$prNum --" -ForegroundColor Cyan
  gh pr view $prNum --json files | ConvertFrom-Json | Select-Object -ExpandProperty files | Format-Table path, additions, deletions, changeType

  Write-Host ""
  Write-Host "-- merging PR #$prNum --" -ForegroundColor Cyan
  gh pr merge $prNum --merge --delete-branch=false
} else {
  Write-Host "  could not determine PR number -- merge manually" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Done." -ForegroundColor Green
