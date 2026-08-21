# scripts/Archive-File.ps1
#
# Moves a file OUT of the repo without deleting it.
#
# The counterpart to Install-File.ps1. That one archives what a new file
# replaces; this one archives something that is simply leaving - a dead
# module, a stale mockup, a superseded snapshot.
#
# Same archive root, same _001 numbering, same posture: nothing is ever
# deleted, and the number comes from reading the archive rather than from
# counting anything.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 lib\v1\groups\groups-blocks.ts
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 public\old-page.html -DryRun
#
# Several at once:
#   'a.ts','b.ts' | ForEach-Object { powershell -ExecutionPolicy Bypass -File .\scripts\Archive-File.ps1 "lib\v1\groups\$_" }

[CmdletBinding()]
param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Target,

    [string]$ArchiveRoot = 'H:\minramas',

    [switch]$DryRun
)

# ---- tracking ---------------------------------------------------------------
# The move below is recorded to
# H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv
#
# If H: is absent the tracker says so and the move goes ahead untracked - an
# audit gap is preferable to a script that will not run.
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) {
  . $TrackerPath
} else {
  Write-Host "FileOps-Tracker.ps1 not found - operations will be UNTRACKED." -ForegroundColor Red
}

$ErrorActionPreference = 'Stop'

function Fail([string]$msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    exit 1
}

# Repo root from the script's own location, so this works from any working
# directory rather than only from D:\minramas.
$RepoRoot = Split-Path $PSScriptRoot -Parent

if ([System.IO.Path]::IsPathRooted($Target)) {
    Fail "give a path relative to the repo root, not an absolute one"
}

$src = Join-Path $RepoRoot $Target
if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
    Fail "not found: $src"
}

# If H: is not mounted, STOP. Moving a file to a path that does not exist
# is a delete wearing a different word.
$archiveDrive = Split-Path $ArchiveRoot -Qualifier
if (-not (Test-Path -LiteralPath "$archiveDrive\")) {
    Fail "archive drive $archiveDrive is not available - nothing moved"
}

$archiveDir  = Split-Path (Join-Path $ArchiveRoot $Target) -Parent
$name        = [System.IO.Path]::GetFileNameWithoutExtension($src)
$ext         = [System.IO.Path]::GetExtension($src)

# Next free number, read off the archive. Not a count - a count is wrong
# the moment anything is ever removed by hand.
$n = 1
if (Test-Path -LiteralPath $archiveDir) {
    $used = @(
        Get-ChildItem -LiteralPath $archiveDir -Filter "$name`_*$ext" -File -ErrorAction SilentlyContinue |
        ForEach-Object {
            if ($_.BaseName -match "^$([regex]::Escape($name))_(\d+)$") { [int]$matches[1] }
        }
    )
    # [int] cast matters: Measure-Object returns a Double and the D3 format
    # throws on it. Only fires on the SECOND archive of a file, so it
    # survives any test that archives something once.
    if ($used.Count -gt 0) { $n = [int]($used | Measure-Object -Maximum).Maximum + 1 }
}

$archivePath = Join-Path $archiveDir ("{0}_{1:D3}{2}" -f $name, $n, $ext)

if (Test-Path -LiteralPath $archivePath) {
    Fail "archive slot already taken: $archivePath"
}

Write-Host "Archive-File"
Write-Host "  repo      $RepoRoot"
Write-Host "  target    $Target"
Write-Host "  archive   $archivePath"

if ($DryRun) {
    Write-Host "DRY RUN. Nothing moved." -ForegroundColor Yellow
    exit 0
}

if (-not (Test-Path -LiteralPath $archiveDir)) {
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
    Write-Host "  made      $archiveDir"
}

Invoke-TrackedMove -Source $src -Destination $archivePath -Note "Archive-File: $Target leaving the repo"

# Read it back off the filesystem. A file believed to be somewhere and not
# there has cost this project two deployments.
if (Test-Path -LiteralPath $archivePath) {
    $f = Get-Item -LiteralPath $archivePath
    Write-Host "  archived  $($f.Length) bytes" -ForegroundColor Green
} else {
    Fail "move reported success but nothing is at $archivePath"
}

if (Test-Path -LiteralPath $src) {
    Fail "still present in the repo: $src"
}

Write-Host "Done. Nothing was deleted."
Write-Host ""
Write-Host "If this file was imported anywhere, the build breaks NOW. Stage this move in the SAME commit as whatever replaced it." -ForegroundColor Yellow
