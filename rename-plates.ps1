# rename-plates.ps1
# Liten and Co - tag the 11 already-correct plate pairs with _man / _woman
# Runs against BOTH trees: style-refs and public previews.
#
# DRY RUN BY DEFAULT. Nothing is renamed until you add -Apply.
#
#   Preview:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-plates.ps1
#   Execute:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-plates.ps1 -Apply
#
# Gender calls verified against a labelled contact sheet, 2026-08-03.

param([switch]$Apply)

$ErrorActionPreference = 'Stop'

$trees = @(
    'D:\minramas\lib\v1\portraits\style-refs',
    'D:\minramas\public\previews\effects'
)

# effect -> gender for 1.* and 2.*
$map = @{
    'clockwork'    = @('man',   'woman')
    'crystallized' = @('man',   'woman')
    'iron'         = @('woman', 'man')
    'jade'         = @('woman', 'man')
    'neon'         = @('woman', 'man')
    'oil_impasto'  = @('man',   'woman')
    'origami'      = @('woman', 'man')
    'porcelain'    = @('woman', 'man')
    'quilted'      = @('woman', 'man')
    'sand_form'    = @('man',   'woman')
    'starfield'    = @('man',   'woman')
}

$planned = @()
$skipped = @()

foreach ($tree in $trees) {

    if (-not (Test-Path $tree)) {
        $skipped += "TREE MISSING : $tree"
        continue
    }

    $treeTag = Split-Path $tree -Leaf

    foreach ($effect in ($map.Keys | Sort-Object)) {

        $dir = Join-Path $tree $effect

        if (-not (Test-Path $dir)) {
            $skipped += "$treeTag / $effect : folder missing"
            continue
        }

        $genders = $map[$effect]

        for ($i = 0; $i -lt $genders.Count; $i++) {

            $num = $i + 1

            $src = @(Get-ChildItem $dir -File | Where-Object {
                [System.IO.Path]::GetFileNameWithoutExtension($_.Name) -eq "$num"
            })

            if ($src.Count -eq 0) {
                $skipped += "$treeTag / $effect : no file named $num.*"
                continue
            }
            if ($src.Count -gt 1) {
                $skipped += "$treeTag / $effect : multiple files named $num.*"
                continue
            }

            $file    = $src[0]
            $newName = "{0}_{1}{2}" -f $num, $genders[$i], $file.Extension

            if (Test-Path (Join-Path $dir $newName)) {
                $skipped += "$treeTag / $effect : $newName already exists"
                continue
            }

            $planned += [pscustomobject]@{
                Tree   = $treeTag
                Effect = $effect
                From   = $file.Name
                To     = $newName
                Path   = $file.FullName
            }
        }
    }
}

Write-Host ""
Write-Host "=== PLANNED : $($planned.Count) renames ===" -ForegroundColor Cyan
if ($planned.Count -gt 0) {
    $planned | Format-Table Tree, Effect, From, To -AutoSize
}

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

if ($skipped.Count -gt 0) {
    Write-Host "Refusing to apply while any file is skipped." -ForegroundColor Red
    Write-Host "Resolve the list above, then re-run." -ForegroundColor Red
    Write-Host ""
    return
}

if ($planned.Count -ne 44) {
    Write-Host "Expected 44 renames (11 effects x 2 files x 2 trees), got $($planned.Count)." -ForegroundColor Red
    Write-Host "Refusing to apply. Check the SKIPPED list." -ForegroundColor Red
    Write-Host ""
    return
}

$done = 0
foreach ($p in $planned) {
    Rename-Item -LiteralPath $p.Path -NewName $p.To
    $done++
}

Write-Host "Renamed $done file(s) across both trees." -ForegroundColor Green
Write-Host ""
