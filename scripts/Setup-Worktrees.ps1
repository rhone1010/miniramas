# Setup-Worktrees.ps1
# ONE-TIME SETUP. Run from anywhere. Creates one working folder per lane,
# each permanently on its own branch. After this, no lane ever runs git
# checkout again, and no lane can switch another lane's branch - the
# folder IS the branch.
#
#   D:\minramas          stays as the MAIN folder - read-only reference,
#                        nobody works here anymore
#   D:\lanes\ceng        branch lane/ceng
#   D:\lanes\cui41a      branch lane/cui41a
#   D:\lanes\cui41b      branch lane/cui41b
#   D:\lanes\cui42       branch lane/cui42
#
# Each lane: works in its own folder, commits to its own branch, PRs to
# main. Merges to main happen through PRs exactly as before - but each
# PR now contains ONLY that lane's commits, so the file-list check
# finally means something.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Setup-Worktrees.ps1

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repo = 'D:\minramas'
$base = 'D:\lanes'
$lanes = @('ceng','cui41a','cui41b','cui42')

Set-Location $repo

# Start from current main so every lane begins at the same, latest state.
git fetch origin
git checkout main
git pull

if (-not (Test-Path $base)) { New-Item -ItemType Directory -Path $base | Out-Null }

foreach ($lane in $lanes) {
  $branch = "lane/$lane"
  $dir = Join-Path $base $lane

  if (Test-Path $dir) {
    Write-Host "$dir already exists - skipped" -ForegroundColor Yellow
    continue
  }

  # Branch from main if it does not exist yet
  $exists = git branch --list $branch
  if (-not $exists) { git branch $branch main }

  git worktree add $dir $branch
  Write-Host "created $dir on $branch" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done. Each lane now works ONLY in its own folder:" -ForegroundColor Cyan
$lanes | ForEach-Object { Write-Host "  D:\lanes\$_   (branch lane/$_)" }
Write-Host ""
Write-Host "D:\minramas stays on main as the read-only reference." -ForegroundColor Cyan
Write-Host "Tell each lane its folder. Their Install-File targets and"
Write-Host "Save-Work scripts run from THEIR folder, not D:\minramas."
