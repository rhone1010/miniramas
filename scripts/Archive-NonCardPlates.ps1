# Archive-NonCardPlates.ps1
#
# Keeps the 4:5 card plates in a preview folder and archives everything else.
#
# WHY
#   public\previews\groups holds two generations of plates: 1:1 shot in
#   August, and 4:5 shot on the 24th for the silo cards. Several effects have
#   both, and nothing in the filename says which is which - .jpg and .jpeg
#   correlate with the two runs by accident, not by rule.
#
#   So this reads the PIXEL DIMENSIONS of every file and decides on those.
#   Extension and date are never used to judge aspect. A 4:5 file named .jpg
#   is kept; a 1:1 file named .jpeg is archived.
#
# WHAT COUNTS AS 4:5
#   width / height between 0.78 and 0.82. 4:5 is 0.800, and a plate resized
#   or re-encoded can land a pixel or two either side. Anything outside the
#   band - square, landscape, 9:16 - is archived.
#
# NOTHING IS DELETED
#   Every archived file goes through Archive-File.ps1, which moves it to
#   H:\NO_DELETE_ARCHIVE and writes a row to
#   H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv. There is no
#   Remove-Item in this script and there must never be one.
#
# DRY RUN BY DEFAULT
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-NonCardPlates.ps1 `
#     -Source "D:\minramas\public\previews\groups"
#
#   ...then the same command with -Apply.

param(
  [Parameter(Mandatory = $true)]
  [string] $Source,

  # Repo-relative root for Archive-File's -Target. The file's path under
  # -Source is appended to this.
  [string] $RepoRelative = 'public\previews\groups',

  [double] $MinRatio = 0.78,
  [double] $MaxRatio = 0.82,

  [switch] $Apply
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$ArchiveFile = Join-Path $PSScriptRoot 'Archive-File.ps1'
if (-not (Test-Path -LiteralPath $ArchiveFile)) {
  Write-Host "REFUSED: Archive-File.ps1 not found beside this script." -ForegroundColor Red
  exit 1
}

if (-not (Test-Path -LiteralPath $Source)) {
  Write-Host "REFUSED: source folder not found - $Source" -ForegroundColor Red
  exit 1
}

$files = Get-ChildItem -LiteralPath $Source -File |
         Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' } |
         Sort-Object Name

Write-Host ""
Write-Host "Archive-NonCardPlates"
Write-Host "  source   $Source"
Write-Host "  keeping  ratio $MinRatio to $MaxRatio  (4:5 = 0.800)"
Write-Host "  files    $($files.Count)"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will move" }
Write-Host ""

if ($files.Count -eq 0) { Write-Host "Nothing to do."; exit 0 }

# ---- measure first, move second ---------------------------------------------
# Every file is read and classified BEFORE anything is touched. A dimension
# read that fails halfway through a move loop leaves the folder in a state
# nobody planned.
$keep    = @()
$archive = @()
$unread  = @()

foreach ($f in $files) {
  $img = $null
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    $w = $img.Width
    $h = $img.Height
  } catch {
    $unread += $f
    continue
  } finally {
    if ($img) { $img.Dispose() }
  }

  $ratio = [math]::Round($w / $h, 3)
  $row = [pscustomobject]@{
    File  = $f
    W     = $w
    H     = $h
    Ratio = $ratio
  }

  if ($ratio -ge $MinRatio -and $ratio -le $MaxRatio) { $keep += $row }
  else { $archive += $row }
}

# ---- report ------------------------------------------------------------------
Write-Host "KEEP  ($($keep.Count))" -ForegroundColor Green
foreach ($r in $keep) {
  Write-Host ("    {0,-42} {1}x{2}  {3}" -f $r.File.Name, $r.W, $r.H, $r.Ratio)
}
Write-Host ""
Write-Host "ARCHIVE  ($($archive.Count))" -ForegroundColor Yellow
foreach ($r in $archive) {
  Write-Host ("    {0,-42} {1}x{2}  {3}" -f $r.File.Name, $r.W, $r.H, $r.Ratio)
}

if ($unread.Count -gt 0) {
  Write-Host ""
  Write-Host "COULD NOT READ  ($($unread.Count)) - left alone" -ForegroundColor Red
  foreach ($f in $unread) { Write-Host "    $($f.Name)" }
}

# ---- the one thing worth stopping for ---------------------------------------
# An effect whose ONLY plate is being archived ends up with no plate at all.
# That is usually the point - a retired effect - but it is also what a wrong
# ratio band looks like, so it is said out loud either way.
$keepStems = $keep | ForEach-Object { [IO.Path]::GetFileNameWithoutExtension($_.File.Name) }
$orphans = $archive | Where-Object {
  $keepStems -notcontains [IO.Path]::GetFileNameWithoutExtension($_.File.Name)
}
if ($orphans.Count -gt 0) {
  Write-Host ""
  Write-Host "NO 4:5 REPLACEMENT EXISTS for these - they will leave nothing behind:" -ForegroundColor Yellow
  foreach ($r in $orphans) { Write-Host "    $($r.File.Name)" }
}

Write-Host ""

if (-not $Apply) {
  Write-Host "  Dry run. Re-run with -Apply to archive $($archive.Count) file(s)."
  Write-Host ""
  exit 0
}

if ($archive.Count -eq 0) { Write-Host "  Nothing to archive."; exit 0 }

# ---- archive -----------------------------------------------------------------
$n = 0
foreach ($r in $archive) {
  $target = Join-Path $RepoRelative $r.File.Name
  & powershell -ExecutionPolicy Bypass -File $ArchiveFile -Target $target

  if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "STOPPED: Archive-File refused $($r.File.Name) (exit $LASTEXITCODE)." -ForegroundColor Red
    Write-Host "$n file(s) archived before this. Nothing was deleted." -ForegroundColor Red
    exit 1
  }
  $n++
}

Write-Host ""
Write-Host "  $n archived, $($keep.Count) kept."
Write-Host "  Archived files are under H:\NO_DELETE_ARCHIVE. Nothing was deleted."
Write-Host ""
