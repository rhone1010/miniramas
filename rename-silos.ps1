# rename-silos.ps1
# Liten and Co - tag the 8 existing silo cards with their gender.
#
# The cards currently sit at public\previews\silos\<silo>.jpg with no gender
# in the name. Genders below are read from the live card art.
#
# DRY RUN BY DEFAULT.
#   Preview:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-silos.ps1
#   Execute:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-silos.ps1 -Apply
#
# Run this BEFORE shoot-silos.js so the new files do not collide.

param([switch]$Apply)

$ErrorActionPreference = 'Stop'

$dir = 'D:\minramas\public\previews\silos'

# silo -> gender of the existing card
$map = [ordered]@{
    'another_age'     = 'woman'   # victorian, green dress and flowered hat
    'earth_ore'       = 'woman'   # verdigris bronze in a garden
    'light_glass'     = 'woman'   # mercury, chrome splash
    'living_world'    = 'woman'   # petal sculpture, pink and magenta
    'made_by_hand'    = 'man'     # quilted, patchwork face
    'artists_gallery' = 'man'     # oil impasto, turban
    'ink_paper'       = 'man'     # folded book
    'fantasy_future'  = 'man'     # retro robot
}

if (-not (Test-Path $dir)) {
    Write-Host "Folder not found: $dir" -ForegroundColor Red
    return
}

$planned = @()
$skipped = @()

foreach ($silo in $map.Keys) {

    $gender = $map[$silo]

    $src = @(Get-ChildItem $dir -File | Where-Object {
        [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq $silo
    })

    if ($src.Count -eq 0) { $skipped += "$silo : no untagged file"; continue }
    if ($src.Count -gt 1) { $skipped += "$silo : multiple matches";  continue }

    $file    = $src[0]
    $newName = "{0}_{1}{2}" -f $silo, $gender, $file.Extension

    if (Test-Path (Join-Path $dir $newName)) {
        $skipped += "$silo : $newName already exists"
        continue
    }

    $planned += [pscustomobject]@{
        Silo = $silo; From = $file.Name; To = $newName; Path = $file.FullName
    }
}

Write-Host ""
Write-Host "=== PLANNED : $($planned.Count) renames ===" -ForegroundColor Cyan
if ($planned.Count -gt 0) { $planned | Format-Table Silo, From, To -AutoSize }

if ($skipped.Count -gt 0) {
    Write-Host "=== SKIPPED : $($skipped.Count) ===" -ForegroundColor Yellow
    $skipped | ForEach-Object { Write-Host "  $_" }
    Write-Host ""
}

if (-not $Apply) {
    Write-Host "DRY RUN. Nothing was changed." -ForegroundColor Green
    Write-Host "Re-run with -Apply to execute." -ForegroundColor Green
    Write-Host ""
    return
}

$done = 0
foreach ($p in $planned) { Rename-Item -LiteralPath $p.Path -NewName $p.To; $done++ }

Write-Host "Renamed $done file(s)." -ForegroundColor Green
Write-Host ""
