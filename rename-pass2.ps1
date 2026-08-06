# rename-pass2.ps1
# Liten and Co - tag the untagged originals left behind after the shoot.
#
# The shoot added 2_woman.jpg / 1_man.jpg to folders that still hold an
# untagged 1.jpg from before. This tags those originals.
#
# DRY RUN BY DEFAULT.
#   Preview:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-pass2.ps1
#   Execute:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-pass2.ps1 -Apply
#
# Excludes linocut, oil_impasto and pencil_sketch - those are being
# reshot as fresh pairs and their old files are deleted, not renamed.
# Excludes plushy and petrified_wood - both need a ruling first.

param([switch]$Apply)

$ErrorActionPreference = 'Stop'

$trees = @(
    'D:\minramas\lib\v1\portraits\style-refs',
    'D:\minramas\public\previews\effects'
)

# effect -> gender of the existing 1.* file
$map = @{
    'art_deco'        = 'man'
    'art_nouveau'     = 'woman'
    'bronze'          = 'woman'
    'cast_glass'      = 'woman'
    'charcoal_chalk'  = 'woman'
    'chocolate'       = 'woman'
    'cubism'          = 'man'
    'daguerreotype'   = 'man'
    'driftwood_resin' = 'man'
    'ebony'           = 'man'
    'folded_book'     = 'woman'
    'impressionist'   = 'woman'
    'lichen_granite'  = 'man'
    'mercury'         = 'woman'
    'polished_gold'   = 'woman'
    'sheet_music'     = 'woman'
    'stained_glass'   = 'man'
    'ukiyo_e'         = 'woman'
    'watercolour'     = 'man'
}

$planned = @()
$skipped = @()

foreach ($tree in $trees) {

    if (-not (Test-Path $tree)) { $skipped += "TREE MISSING : $tree"; continue }
    $treeTag = Split-Path $tree -Leaf

    foreach ($effect in ($map.Keys | Sort-Object)) {

        $dir = Join-Path $tree $effect
        if (-not (Test-Path $dir)) { $skipped += "$treeTag / $effect : folder missing"; continue }

        $gender = $map[$effect]
        $num    = if ($gender -eq 'man') { 1 } else { 2 }

        $src = @(Get-ChildItem $dir -File | Where-Object {
            [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq '1'
        })

        if ($src.Count -eq 0) { $skipped += "$treeTag / $effect : no untagged 1.* left"; continue }
        if ($src.Count -gt 1) { $skipped += "$treeTag / $effect : multiple 1.* files";   continue }

        $file    = $src[0]
        $newName = "{0}_{1}{2}" -f $num, $gender, $file.Extension

        if (Test-Path (Join-Path $dir $newName)) {
            $skipped += "$treeTag / $effect : $newName already exists"
            continue
        }

        $planned += [pscustomobject]@{
            Tree = $treeTag; Effect = $effect; From = $file.Name; To = $newName; Path = $file.FullName
        }
    }
}

Write-Host ""
Write-Host "=== PLANNED : $($planned.Count) renames ===" -ForegroundColor Cyan
if ($planned.Count -gt 0) { $planned | Format-Table Tree, Effect, From, To -AutoSize }

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
