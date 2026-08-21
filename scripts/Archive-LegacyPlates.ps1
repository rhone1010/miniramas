# Archive-LegacyPlates.ps1
#
# The Groups preview folder holds two naming schemes for the same pictures.
# The originals came off the shoot with names like groups_balloon_01.jpeg and
# groups_wood_carved_01.jpg; a second, id-named set was added on 19 August -
# groups_balloon_face.jpg, groups_carved_family.jpg - and byte sizes confirm
# they are the same images.
#
# The id-named set is the one that stays. With it, the path derives from the
# effect id and groups-registry.js needs no lookup table, which is what CENG's
# handoff described in the first place. It also kills groups_Ukiyo-e_01.jpg,
# whose capital U works on Windows and 404s on Vercel.
#
# This moves the legacy set to H:. NOTHING IS DELETED - Archive-File.ps1 moves
# each file to the mirrored path with sequential _001 numbering, so every
# picture is still on disk afterwards, just not in the repo.
#
# DRY RUN BY DEFAULT.
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-LegacyPlates.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-LegacyPlates.ps1 -Apply
#
# THE KEEP LIST IS THE TWENTY-EIGHT EFFECT IDS, not a list of files. A file is
# kept only if its name is groups_<id>.jpg for an id the engine accepts. That
# way a stray, a misspelling or a cut effect's plate cannot survive by
# accident - groups_iron.jpg is the example, and Iron was cut on 19 August.

param(
  [string] $Repo   = "D:\minramas",
  [string] $Folder = "public\previews\groups",
  [switch] $Apply
)

# ---- tracking ---------------------------------------------------------------
# This script moves nothing itself - Archive-File.ps1 does, once per file, and
# that script logs each move. The markers below wrap the loop so a run of
# twenty-three archives reads as ONE act rather than twenty-three unrelated
# moves a week later.
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) {
  . $TrackerPath
} else {
  Write-Host "FileOps-Tracker.ps1 not found - the batch markers will be missing." -ForegroundColor Red
}


$ErrorActionPreference = 'Stop'

$IDS = @(
  'bronze','ebony','stone','reclaimed_bronze','porcelain','carved_family','retro_robot',
  'plushy','folded_book','origami','balloon_face','layered_paper','pencil_sketch','sea_glass',
  'cubism','art_nouveau','ukiyo_e','family_impressionism','family_mosaic','neon','ice',
  'victorian','elizabethan','renaissance','persian_court','samurai','wild_west','clockwork'
)

$dir = Join-Path $Repo $Folder
if (-not (Test-Path $dir)) { Write-Host "MISSING  $dir"; exit 1 }

$archiver = Join-Path $Repo "scripts\Archive-File.ps1"
if (-not (Test-Path $archiver)) {
  Write-Host "MISSING  $archiver"
  Write-Host "This script does not move files itself - Archive-File.ps1 does,"
  Write-Host "and it is the only thing here that knows the H: mirror layout."
  exit 1
}

$keep = @{}
foreach ($id in $IDS) { $keep["groups_$id.jpg"] = $true }

Write-Host ""
Write-Host "Archive-LegacyPlates"
Write-Host "  folder   $dir"
Write-Host "  keeping  $($IDS.Count) files, one per effect id"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will be moved" }
Write-Host ""

$files   = Get-ChildItem -Path $dir -File | Sort-Object Name
$kept    = @()
$missing = @()
$move    = @()

foreach ($f in $files) {
  if ($keep.ContainsKey($f.Name)) { $kept += $f.Name } else { $move += $f }
}

# An id with no plate is a blank card, and it is worth knowing BEFORE the
# other copy has been moved off to H:.
foreach ($id in $IDS) {
  if (-not (Test-Path (Join-Path $dir "groups_$id.jpg"))) { $missing += $id }
}

if ($missing.Count) {
  Write-Host "REFUSED - these effects have no groups_<id>.jpg:"
  foreach ($m in $missing) { Write-Host "    $m" }
  Write-Host ""
  Write-Host "Archiving now would leave those cards blank with the only copy"
  Write-Host "on H:. Put the id-named file in place first."
  exit 1
}

Write-Host "KEEP  ($($kept.Count))"
foreach ($k in $kept) { Write-Host "    $k" }

Write-Host ""
Write-Host "ARCHIVE  ($($move.Count))"
foreach ($m in $move) { Write-Host ("    {0,-34} {1:N0} bytes" -f $m.Name, $m.Length) }
Write-Host ""

if (-not $Apply) {
  Write-Host "Dry run. Re-run with -Apply to move the archive list to H:."
  Write-Host ""
  exit 0
}

$BatchId = "legacyplates-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss")
Start-TrackedBatch -BatchId $BatchId -Description "Archive-LegacyPlates $Folder - $($move.Count) files"

$done = 0
foreach ($m in $move) {
  $rel = Join-Path $Folder $m.Name
  & powershell -ExecutionPolicy Bypass -File $archiver $rel
  if ($LASTEXITCODE -eq 0) { $done++ } else { Write-Host "  FAILED  $($m.Name)" }
}

End-TrackedBatch -BatchId $BatchId -Description "moved $done of $($move.Count)"

Write-Host ""
Write-Host "  moved $done of $($move.Count) to H:. Nothing was deleted."
Write-Host "  $($kept.Count) plates remain in $Folder."
Write-Host ""
