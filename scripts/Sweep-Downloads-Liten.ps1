# Sweep-Downloads-Liten.ps1
# CUI 41A - 24 August 2026
#
# Moves LitenCo work product out of Downloads into the H: archive, under
# one dated sweep folder. Dry run by default; -Apply to move.
#
# ONLY the items named in the lists below are touched. Personal, legal,
# medical and other-business files are not in the lists and are not moved.
# Nothing is deleted, ever -- everything goes to H: via Invoke-TrackedMove
# so each move lands in the FileActions log.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Sweep-Downloads-Liten.ps1
#   powershell -ExecutionPolicy Bypass -File D:\minramas\scripts\Sweep-Downloads-Liten.ps1 -Apply

param(
  [switch]$Apply
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# The tracker provides Invoke-TrackedMove and the FileActions log.
. "$PSScriptRoot\FileOps-Tracker.ps1"

$dl   = Join-Path $env:USERPROFILE 'Downloads'
$dest = 'H:\NO_DELETE_ARCHIVE\Downloads-Sweep-2026-08-24'

if (-not (Test-Path 'H:\')) {
  Write-Host 'REFUSED: H: is not mounted. Nothing moved.' -ForegroundColor Red
  exit 1
}

# -- LITEN FOLDERS ----------------------------------------------------
$folders = @(
  'Liten Launch',
  'Liten Source',
  'Litenco Scripts',
  'Litenco Sources',
  'litenco_collection_mockup',
  'litenco_texture_pack_v1',
  'Portraits Version Ctrl',
  'printshop version ctrl',
  'prodigi price lists'
)

# -- LITEN FILES ------------------------------------------------------
# Work product: scripts, docs, plates. Screenshots of the product too.
$files = @(
  '0014_cosmos_midnight_eruption_deep_ocean.jpg',
  'boot.js',
  'emit-groups-registry.js',
  'gitignore (1)',
  'GROUPS-EXISTING-21-FOR-CARDS-2026-08-24.md',
  'outpaint-splash-ORIGINAL.mjs',
  'Rename-GroupPlates.ps1',
  'Save-Work-CUI42 (1).ps1',
  'SYNC-CENG-2026-08-24-r02.md',
  'Screenshot 2026-08-02 202121.jpg',
  'Screenshot 2026-08-02 202244.jpg'
)

# -- NOT TOUCHED, ON PURPOSE ------------------------------------------
# Case, Medical, Hone Design and Construction, henny penny August,
# the Hone PDFs, HennyPenny_SiteManager_Guide.pdf, panel.php,
# recovery-codes.txt, USN_Image_Deletion_Record.xlsx, the mp4s and
# the unnamed png -- personal or other-business, not Liten's to sweep.
# 'Check in a week and throw out' and 'temp holding pending trash' are
# Rich's own holding pens and are left alone.

Write-Host ''
Write-Host ("mode      " + ($(if ($Apply) { 'APPLY -- moving' } else { 'DRY RUN -- listing only' }))) -ForegroundColor Cyan
Write-Host ("from      $dl")
Write-Host ("to        $dest")
Write-Host ''

$moved = 0; $absent = 0

foreach ($name in ($folders + $files)) {
  $src = Join-Path $dl $name
  if (-not (Test-Path $src)) {
    Write-Host ("  absent    " + $name) -ForegroundColor DarkGray
    $absent++
    continue
  }
  $to = Join-Path $dest $name
  if ($Apply) {
    if (-not (Test-Path $dest)) { New-Item -ItemType Directory -Path $dest -Force | Out-Null }
    Invoke-TrackedMove -Source $src -Destination $to -Note 'Downloads sweep, Liten work product to archive'
    Write-Host ("  moved     " + $name) -ForegroundColor Green
  } else {
    Write-Host ("  would move " + $name)
  }
  $moved++
}

Write-Host ''
Write-Host ("{0} item(s) {1}, {2} absent." -f $moved, $(if ($Apply) { 'moved' } else { 'to move' }), $absent)
if (-not $Apply) {
  Write-Host 'Re-run with -Apply to move them.' -ForegroundColor Yellow
}
