# Rename-GroupPlates.ps1
#
# Brings every plate in public\previews\groups into line with its effect id.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\Rename-GroupPlates.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\Rename-GroupPlates.ps1 -Apply
#
# ---- WHY -------------------------------------------------------------------
#
# groups-registry.js derives every plate path from the effect id:
#
#     /previews/groups/groups_<id>.jpg
#
# There is no lookup table and there must never be one. That contract keeps
# plateFor() honest, and it means a filename that drifts from its id is a
# card that paints empty.
#
# Two kinds of drift on disk right now:
#
#   EXTENSION   most of the 24 August shoot saved as .jpeg. The registry
#               derives .jpg. Same picture, wrong name.
#
#   NAME        five plates were shot under working names rather than the
#               catalogue id:
#                 groups_gold           -> groups_polished_gold
#                 groups_granite_lichen -> groups_lichen_granite
#                 groups_watercolor     -> groups_watercolour
#                 groups_driftwood      -> groups_driftwood_resin
#                 groups_mosaic         -> groups_family_mosaic
#
# ---- CASE ------------------------------------------------------------------
#
# Vercel is case-sensitive and Windows is not, so a plate named Groups_Wax.jpg
# works locally and 404s in production. Every target below is lowercase and
# the script refuses any source whose stem is not already lowercase rather
# than guessing at the intended casing.
#
# ---- NOT A DELETE ----------------------------------------------------------
#
# Rename-Item only. No file is removed and no file is overwritten: if the
# target name already exists the script refuses that one and reports it,
# because two files claiming the same id means somebody has to decide which
# picture is the real one.

param(
  [string] $Source = 'public\previews\groups',
  [switch] $Apply
)

$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
Set-Location $repo

if (-not (Test-Path -LiteralPath $Source)) {
  Write-Host "REFUSED: folder not found - $Source" -ForegroundColor Red
  exit 1
}

# Working name -> catalogue id. Stems only, no extension.
$STEM_MAP = @{
  'groups_gold'           = 'groups_polished_gold'
  'groups_granite_lichen' = 'groups_lichen_granite'
  'groups_watercolor'     = 'groups_watercolour'
  'groups_driftwood'      = 'groups_driftwood_resin'
  'groups_mosaic'         = 'groups_family_mosaic'
}

$files = Get-ChildItem -LiteralPath $Source -File |
         Where-Object { $_.Extension -match '^\.(jpg|jpeg)$' } |
         Sort-Object Name

Write-Host ""
Write-Host "Rename-GroupPlates"
Write-Host "  folder   $Source"
Write-Host "  files    $($files.Count)"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will be renamed" }
Write-Host ""

if ($files.Count -eq 0) { Write-Host "Nothing to do."; exit 0 }

# ---- plan first, rename second ---------------------------------------------
# Every rename is decided before any of them happens. A collision found
# halfway through leaves the folder in a state nobody planned.
$plan      = @()
$unchanged = @()
$refused   = @()

foreach ($f in $files) {
  $stem = [IO.Path]::GetFileNameWithoutExtension($f.Name)

  if ($stem -cne $stem.ToLower()) {
    $refused += "$($f.Name)  - stem is not lowercase, rename it by hand"
    continue
  }

  $newStem = if ($STEM_MAP.ContainsKey($stem)) { $STEM_MAP[$stem] } else { $stem }
  $newName = "$newStem.jpg"

  if ($newName -ceq $f.Name) { $unchanged += $f.Name; continue }

  $targetPath = Join-Path $f.DirectoryName $newName
  # A case-only or extension-only change is not a collision with itself.
  if ((Test-Path -LiteralPath $targetPath) -and ($targetPath -ne $f.FullName)) {
    $refused += "$($f.Name) -> $newName  - target already exists"
    continue
  }
  if ($plan | Where-Object { $_.To -eq $newName }) {
    $refused += "$($f.Name) -> $newName  - two files want this name"
    continue
  }

  $plan += [pscustomobject]@{ File = $f; To = $newName }
}

if ($unchanged.Count -gt 0) {
  Write-Host "ALREADY CORRECT ($($unchanged.Count))" -ForegroundColor DarkGray
}

if ($plan.Count -gt 0) {
  Write-Host "RENAME ($($plan.Count))" -ForegroundColor Green
  foreach ($p in $plan) {
    Write-Host ("    {0,-38} -> {1}" -f $p.File.Name, $p.To)
  }
}

if ($refused.Count -gt 0) {
  Write-Host ""
  Write-Host "REFUSED ($($refused.Count)) - left alone" -ForegroundColor Yellow
  foreach ($r in $refused) { Write-Host "    $r" }
}

Write-Host ""

if ($plan.Count -eq 0) {
  Write-Host "  Nothing to rename."
  Write-Host ""
  exit 0
}

if (-not $Apply) {
  Write-Host "  Dry run. Re-run with -Apply."
  Write-Host ""
  exit 0
}

$n = 0
foreach ($p in $plan) {
  # Windows treats a case-only rename as a no-op, so it goes via a temporary
  # name. Extension changes do not need it but it costs nothing to be uniform.
  $tmp = "$($p.File.Name).renaming"
  Rename-Item -LiteralPath $p.File.FullName -NewName $tmp
  Rename-Item -LiteralPath (Join-Path $p.File.DirectoryName $tmp) -NewName $p.To
  $n++
}

Write-Host "  $n renamed."
Write-Host "  Verify: node scripts\emit-groups-registry.js"
Write-Host ""
