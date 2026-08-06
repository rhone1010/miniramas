# plate-audit.ps1
# Liten and Co - style-ref + preview plate audit
# Lists every effect missing a man plate or a woman plate, in both trees.
# READ ONLY. Changes nothing.
#
# Run:  powershell -ExecutionPolicy Bypass -File D:\minramas\plate-audit.ps1

$ErrorActionPreference = 'Stop'

$repo    = 'D:\minramas'
$srcRoot = Join-Path $repo 'lib\v1\portraits\style-refs'
$pvwRoot = Join-Path $repo 'public\previews\effects'
$outCsv  = Join-Path $repo 'plate-audit.csv'

$imageExt = @('.jpg', '.jpeg', '.png', '.webp')

# Matches the live loader exactly: filename contains "_man" / "_woman",
# lowercased. "_woman" never cross-matches "_man".
function Get-PlateCounts {
    param([string]$Dir)

    if (-not (Test-Path $Dir)) {
        return [pscustomobject]@{
            Exists = $false; Total = 0; Man = 0; Woman = 0; Misnamed = ''; Untagged = ''
        }
    }

    $files = Get-ChildItem $Dir -File |
             Where-Object { $imageExt -contains $_.Extension.ToLower() }

    $man   = @($files | Where-Object { $_.Name.ToLower() -like '*_man*'   })
    $woman = @($files | Where-Object { $_.Name.ToLower() -like '*_woman*' })

    # Tokens the loader cannot see. These files are dead weight until renamed.
    $badTokens = '_male', '_female', '_girl', '_boy', '_neutral', '_lady', '_guy'
    $misnamed  = @($files | Where-Object {
        $n = $_.Name.ToLower()
        $hit = $false
        foreach ($t in $badTokens) { if ($n -like "*$t*") { $hit = $true } }
        $hit
    })

    $misnamedNames = @($misnamed | ForEach-Object { $_.Name })

    # Neither tag, and not misnamed - served to everyone regardless of gender.
    $untagged = @($files | Where-Object {
        $n = $_.Name.ToLower()
        ($n -notlike '*_man*') -and ($n -notlike '*_woman*') -and
        ($misnamedNames -notcontains $_.Name)
    })

    [pscustomobject]@{
        Exists   = $true
        Total    = $files.Count
        Man      = $man.Count
        Woman    = $woman.Count
        Misnamed = (@($misnamed | ForEach-Object { $_.Name }) -join ' ')
        Untagged = (@($untagged | ForEach-Object { $_.Name }) -join ' ')
    }
}

# Union of effect ids across both trees.
$ids = @()
foreach ($root in @($srcRoot, $pvwRoot)) {
    if (Test-Path $root) {
        $ids += (Get-ChildItem $root -Directory | ForEach-Object { $_.Name })
    }
}
$ids = @($ids | Sort-Object -Unique)

if ($ids.Count -eq 0) {
    Write-Host "No effect folders found. Checked:" -ForegroundColor Red
    Write-Host "  $srcRoot"
    Write-Host "  $pvwRoot"
    return
}

$rows = foreach ($id in $ids) {
    $s = Get-PlateCounts (Join-Path $srcRoot $id)
    $p = Get-PlateCounts (Join-Path $pvwRoot $id)

    $needs = @()
    if (-not $s.Exists) { $needs += 'src:NO-FOLDER' }
    else {
        if ($s.Man   -eq 0) { $needs += 'src:man' }
        if ($s.Woman -eq 0) { $needs += 'src:woman' }
    }
    if (-not $p.Exists) { $needs += 'pvw:NO-FOLDER' }
    else {
        if ($p.Man   -eq 0) { $needs += 'pvw:man' }
        if ($p.Woman -eq 0) { $needs += 'pvw:woman' }
    }

    $mis = @($s.Misnamed, $p.Misnamed) | Where-Object { $_ }
    $unt = @($s.Untagged, $p.Untagged) | Where-Object { $_ }

    [pscustomobject]@{
        Effect   = $id
        SrcMan   = $s.Man
        SrcWoman = $s.Woman
        SrcTotal = $s.Total
        PvwMan   = $p.Man
        PvwWoman = $p.Woman
        PvwTotal = $p.Total
        Needs    = ($needs -join ' ')
        Misnamed = ($mis -join ' / ')
        Untagged = ($unt -join ' / ')
    }
}

$rows = @($rows)
$rows | Export-Csv -Path $outCsv -NoTypeInformation -Encoding UTF8

$incomplete = @($rows | Where-Object { $_.Needs })
$complete   = @($rows | Where-Object { -not $_.Needs })
$misnamed   = @($rows | Where-Object { $_.Misnamed })
$untagged   = @($rows | Where-Object { $_.Untagged })

Write-Host ""
Write-Host "=== INCOMPLETE : $($incomplete.Count) of $($rows.Count) effects ===" -ForegroundColor Yellow
if ($incomplete.Count -gt 0) {
    $incomplete | Format-Table Effect, SrcMan, SrcWoman, PvwMan, PvwWoman, Needs -AutoSize
}

Write-Host "=== MISNAMED : loader cannot see these files ===" -ForegroundColor Magenta
if ($misnamed.Count -gt 0) {
    $misnamed | Format-Table Effect, Misnamed -AutoSize -Wrap
} else {
    Write-Host "  none"
}

Write-Host "=== UNTAGGED : no _man/_woman, served to everyone ===" -ForegroundColor DarkCyan
if ($untagged.Count -gt 0) {
    $untagged | Format-Table Effect, Untagged -AutoSize -Wrap
} else {
    Write-Host "  none"
}

Write-Host ""
Write-Host "complete   : $($complete.Count)"
Write-Host "incomplete : $($incomplete.Count)"
Write-Host "csv        : $outCsv"
Write-Host ""
