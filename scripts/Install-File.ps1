<#
.SYNOPSIS
  Put a new file into the repo without destroying the one it replaces.

.DESCRIPTION
  NOTHING IS EVER DELETED, AND NOTHING IS EVER OVERWRITTEN. The file being
  replaced is MOVED to an archive that mirrors the repo's own folder
  structure, under a name that has never been used before. Only then does
  the new file take its place.

    public\wallpaper-studio.html  ->  H:\minramas\public\wallpaper-studio_001.html
    scripts\patch-thing.py        ->  H:\minramas\scripts\patch-thing_001.py
    app\api\v1\x\route.ts         ->  H:\minramas\app\api\v1\x\route_001.ts

  Run it a second time on the same file and the archive gets _002, then
  _003. An existing archived copy is never touched, so a version cannot be
  lost by running this twice.

  Move-Item is the only file operation in here. There is no Remove-Item,
  no -Force overwrite, and no path this can take that ends in a file
  ceasing to exist.

.PARAMETER Target
  Where the file belongs, relative to the repo root. e.g. public\index.html

.PARAMETER From
  The new file. Defaults to the same leaf name in your Downloads folder.

.PARAMETER ArchiveRoot
  Defaults to H:\minramas.

.PARAMETER DryRun
  Say what would happen and touch nothing.

.EXAMPLE
  .\scripts\Install-File.ps1 public\wallpaper-studio.html -DryRun
  .\scripts\Install-File.ps1 public\wallpaper-studio.html
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true, Position = 0)]
  [string] $Target,

  [string] $From,

  [string] $ArchiveRoot = 'H:\minramas',

  [switch] $DryRun
)

$ErrorActionPreference = 'Stop'

function Say-Step { param([string] $m) Write-Host "  $m" }

# ---- where we are ---------------------------------------------------------
# The repo root is this script's parent's parent, so the command works the
# same from anywhere rather than depending on where you happen to be stood.
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

# A Target given as an absolute path inside the repo is still fine; it is
# reduced back to a relative one so the archive mirrors the same shape.
if ([System.IO.Path]::IsPathRooted($Target)) {
  $full = [System.IO.Path]::GetFullPath($Target)
  $rootFull = [System.IO.Path]::GetFullPath($RepoRoot)
  if (-not $full.StartsWith($rootFull, [StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "REFUSED: $Target is not inside $RepoRoot." -ForegroundColor Red
    exit 1
  }
  $Target = $full.Substring($rootFull.Length).TrimStart('\', '/')
}
$Target = $Target -replace '/', '\'
$Target = $Target.TrimStart('\')

$TargetPath = Join-Path $RepoRoot $Target
$TargetDir  = Split-Path -Parent $TargetPath
$LeafName   = Split-Path -Leaf   $TargetPath
$BaseName   = [System.IO.Path]::GetFileNameWithoutExtension($LeafName)
$Ext        = [System.IO.Path]::GetExtension($LeafName)      # includes the dot

Write-Host ""
Write-Host "Install-File" -ForegroundColor Cyan
Write-Host "  repo      $RepoRoot"
Write-Host "  target    $Target"

# ---- the incoming file ----------------------------------------------------
if (-not $From) {
  $dl = Join-Path $HOME 'Downloads'
  $From = Join-Path $dl $LeafName

  # A browser that has seen this name before saves 'thing (1).html'. Take the
  # newest of those rather than failing, but SAY which one was taken - picking
  # a file silently is how the wrong build gets shipped.
  if (-not (Test-Path -LiteralPath $From)) {
    $pattern = "$BaseName*$Ext"
    $cands = @(Get-ChildItem -LiteralPath $dl -Filter $pattern -File -ErrorAction SilentlyContinue |
               Sort-Object LastWriteTime -Descending)
    if ($cands.Count -gt 0) {
      $From = $cands[0].FullName
      Say-Step "found     $($cands[0].Name)  (newest match in Downloads)"
    }
  }
}

if (-not (Test-Path -LiteralPath $From)) {
  Write-Host "  MISSING   $From" -ForegroundColor Red
  Write-Host ""
  Write-Host "Nothing was moved. Save the new file to Downloads first, or pass -From." -ForegroundColor Yellow
  exit 1
}

$FromItem = Get-Item -LiteralPath $From
Write-Host "  new file  $($FromItem.FullName)"
Write-Host "            $($FromItem.Length) bytes, written $($FromItem.LastWriteTime)"

if ($TargetDir -and -not (Test-Path -LiteralPath $TargetDir)) {
  Say-Step "target folder does not exist yet: $TargetDir"
}

# ---- the archive name -----------------------------------------------------
# Mirror the repo-relative folder under the archive root, so a file can always
# be put back by reversing the path.
$RelDir      = Split-Path -Parent $Target        # '' for a file at the root
$ArchiveDir  = if ($RelDir) { Join-Path $ArchiveRoot $RelDir } else { $ArchiveRoot }

$Existing = Test-Path -LiteralPath $TargetPath
$ArchivePath = $null

if ($Existing) {
  if (-not (Test-Path -LiteralPath $ArchiveRoot)) {
    Write-Host ""
    Write-Host "REFUSED: the archive drive $ArchiveRoot is not there." -ForegroundColor Red
    Write-Host "Nothing was moved. The existing file is untouched." -ForegroundColor Yellow
    exit 1
  }

  # Next free number. Reads what is already archived rather than counting,
  # so a gap or a hand-made copy cannot cause a collision.
  $n = 1
  if (Test-Path -LiteralPath $ArchiveDir) {
    $rx = '^' + [regex]::Escape($BaseName) + '_(\d{3})' + [regex]::Escape($Ext) + '$'
    $used = @(Get-ChildItem -LiteralPath $ArchiveDir -File -ErrorAction SilentlyContinue |
              ForEach-Object { if ($_.Name -match $rx) { [int]$Matches[1] } })
    # [int] is not decoration. Measure-Object hands back a Double, and the
    # D3 format specifier below is integer-only - it throws on a Double.
    # That fault only fires on the SECOND archive of a file, so it survives
    # any test that installs something once.
    if ($used.Count -gt 0) { $n = [int](($used | Measure-Object -Maximum).Maximum) + 1 }
  }

  # Belt and braces: never hand back a name that is somehow already taken.
  do {
    $ArchiveName = ('{0}_{1:D3}{2}' -f $BaseName, $n, $Ext)
    $ArchivePath = Join-Path $ArchiveDir $ArchiveName
    $n++
  } while (Test-Path -LiteralPath $ArchivePath)

  Write-Host "  archive   $ArchivePath"
} else {
  Write-Host "  archive   (nothing there yet - this is a new file)"
}

# ---- do it ----------------------------------------------------------------
if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run. Nothing moved. Re-run without -DryRun." -ForegroundColor Yellow
  exit 0
}

if ($Existing) {
  if (-not (Test-Path -LiteralPath $ArchiveDir)) {
    New-Item -ItemType Directory -Path $ArchiveDir -Force | Out-Null
  }
  # No -Force. If anything is at that name the move fails loudly rather than
  # writing over a version we kept on purpose.
  Move-Item -LiteralPath $TargetPath -Destination $ArchivePath
  Say-Step "kept      $LeafName -> $(Split-Path -Leaf $ArchivePath)"
}

if ($TargetDir -and -not (Test-Path -LiteralPath $TargetDir)) {
  New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null
}

# The target is guaranteed free by this point: either it never existed, or it
# has just been moved to the archive.
Move-Item -LiteralPath $FromItem.FullName -Destination $TargetPath
Say-Step "installed $Target"

Write-Host ""
if ($Existing) {
  Write-Host "Done. The old file is at $ArchivePath - nothing was deleted." -ForegroundColor Green
} else {
  Write-Host "Done. Nothing needed archiving." -ForegroundColor Green
}
Write-Host ""
