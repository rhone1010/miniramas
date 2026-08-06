# rename-poses.ps1
# Liten and Co - flip the pose cards to the house convention.
#
#   man_smiling.png    ->  smiling_man.png
#   woman_smiling.jpg  ->  smiling_woman.jpg
#
# One rule across all three trees: <id>_<gender>.<ext>
# Extensions are preserved - the men are .png and the women .jpg.
#
# DRY RUN BY DEFAULT.
#   Preview:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-poses.ps1
#   Execute:  powershell -ExecutionPolicy Bypass -File D:\minramas\rename-poses.ps1 -Apply

param([switch]$Apply)

$ErrorActionPreference = 'Stop'

$dir = 'D:\minramas\public\previews\pose'

if (-not (Test-Path $dir)) {
    Write-Host "Folder not found: $dir" -ForegroundColor Red
    return
}

$planned = @()
$skipped = @()

foreach ($file in (Get-ChildItem $dir -File | Sort-Object Name)) {

    $stem = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)

    # Only touch files that lead with the gender. Anything already in the
    # house shape, or with no gender at all, is left alone.
    if ($stem -notmatch '^(man|woman)_(.+)$') {
        $skipped += "$($file.Name) : not <gender>_<pose>"
        continue
    }

    $gender = $Matches[1]
    $pose   = $Matches[2]

    $newName = "{0}_{1}{2}" -f $pose, $gender, $file.Extension

    if ($newName -eq $file.Name) {
        $skipped += "$($file.Name) : already correct"
        continue
    }
    if (Test-Path (Join-Path $dir $newName)) {
        $skipped += "$($file.Name) : $newName already exists"
        continue
    }

    $planned += [pscustomobject]@{
        From = $file.Name; To = $newName; Path = $file.FullName
    }
}

Write-Host ""
Write-Host "=== PLANNED : $($planned.Count) renames ===" -ForegroundColor Cyan
if ($planned.Count -gt 0) { $planned | Format-Table From, To -AutoSize }

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
