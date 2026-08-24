# Install-Batch.ps1
#
# Installs a folder of files over their originals in the repo, one call to
# Install-File.ps1 per file.
#
# WHY THIS EXISTS
#   Resize-Plates.ps1 writes its output to a NEW folder and never overwrites,
#   which is right. Swapping fifty compressed plates back in then means fifty
#   Install-File calls typed by hand. This is that loop and nothing more.
#
# WHAT IT DOES NOT DO
#   It does not copy, move or delete anything itself. Every file goes through
#   Install-File.ps1, so every displaced original lands in H:\minramas\ under
#   a mirrored path and a number that has never been used, and every move is
#   written to H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv.
#
#   If Install-File.ps1 refuses a file, this refuses with it and stops.
#
# THE MIRROR
#   -Source and -Target are folders. The relative path of each file under
#   -Source is preserved under -Target:
#
#     tall-small\halloween\man_ice_wraith.jpg
#       -> public\previews\home\splash\tall\halloween\man_ice_wraith.jpg
#
#   Filenames are taken off disk and never constructed. Vercel is
#   case-sensitive and Windows is not, so a name that drifts here works
#   locally and 404s in production.
#
# DRY RUN BY DEFAULT. Nothing moves until -Apply is passed.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\Install-Batch.ps1 `
#     -Source "D:\minramas\public\previews\home\splash\tall-small" `
#     -Target "public\previews\home\splash\tall"
#
#   ...then the same command with -Apply.

param(
  [Parameter(Mandatory = $true)]
  [string] $Source,

  # Repo-relative, exactly as Install-File.ps1 wants its -Target.
  [Parameter(Mandatory = $true)]
  [string] $Target,

  [switch] $Apply
)

$ErrorActionPreference = 'Stop'

$InstallFile = Join-Path $PSScriptRoot 'Install-File.ps1'
if (-not (Test-Path -LiteralPath $InstallFile)) {
  Write-Host "REFUSED: Install-File.ps1 not found beside this script." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $Source)) {
  Write-Host "REFUSED: source folder not found - $Source" -ForegroundColor Red
  exit 1
}

$SourceRoot = (Resolve-Path -LiteralPath $Source).Path

$files = Get-ChildItem -LiteralPath $SourceRoot -File -Recurse |
         Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' } |
         Sort-Object FullName

Write-Host ""
Write-Host "Install-Batch"
Write-Host "  source   $SourceRoot"
Write-Host "  target   $Target"
Write-Host "  files    $($files.Count)"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will move" }
Write-Host ""

if ($files.Count -eq 0) {
  Write-Host "Nothing to install." -ForegroundColor Yellow
  exit 0
}

# ---- pre-flight -------------------------------------------------------------
# Every target must already exist. This script REPLACES files; it is not for
# adding new ones. A missing target means the mirror is wrong - a typo in
# -Target, or a file that was never in the repo - and finding that out on
# file forty, with thirty-nine already swapped, is the bad version of this.
$missing = @()
foreach ($f in $files) {
  $rel = $f.FullName.Substring($SourceRoot.Length).TrimStart('\')
  $tgt = Join-Path $Target $rel
  if (-not (Test-Path -LiteralPath $tgt)) { $missing += $tgt }
}

if ($missing.Count -gt 0) {
  Write-Host "REFUSED: these targets do not exist in the repo:" -ForegroundColor Red
  foreach ($m in $missing) { Write-Host "  $m" -ForegroundColor Red }
  Write-Host ""
  Write-Host "Nothing was touched. Check -Target, or install new files individually." -ForegroundColor Red
  exit 1
}

# ---- install ----------------------------------------------------------------
$n = 0
$failed = 0

foreach ($f in $files) {
  $rel = $f.FullName.Substring($SourceRoot.Length).TrimStart('\')
  $tgt = Join-Path $Target $rel

  if (-not $Apply) {
    Write-Host ("  {0,-46} -> {1}" -f $rel, $tgt)
    $n++
    continue
  }

  Write-Host ("  {0}" -f $rel)

  & powershell -ExecutionPolicy Bypass -File $InstallFile -Target $tgt -From $f.FullName

  if ($LASTEXITCODE -ne 0) {
    $failed++
    Write-Host ""
    Write-Host "STOPPED: Install-File refused $rel (exit $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "$n file(s) were installed before this. Nothing was deleted." -ForegroundColor Red
    Write-Host ""
    exit 1
  }

  $n++
}

Write-Host ""
if ($Apply) {
  Write-Host "  $n installed, $failed failed"
  Write-Host "  Originals are in H:\minramas\ under the mirrored path."
  Write-Host "  Verify, then commit by explicit path."
} else {
  Write-Host "  $n file(s) would be installed."
  Write-Host "  Dry run. Re-run with -Apply."
}
Write-Host ""
