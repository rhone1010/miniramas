# scripts/Archive-DeadSeries.ps1
#
# Archives the confirmed-dead Series code out of all six repos.
# NOTHING IS EVER DELETED. Files are moved to
# H:\LITENCO-ARCHIVE\02-SUPERSEDED-BUILDS\<repo>\<repo-relative path>,
# and anything already at a destination is moved aside to a numbered slot
# first. Every operation goes through Invoke-TrackedMove.
#
# DRY RUN IS THE DEFAULT. -Confirm is required to touch the disk.
#
# WHAT IS ARCHIVED
#   Sportsmem, Interiors, Stadium, Moments, Action, and lib/v1/generators.
#   All six were confirmed dead by the reference audit of 2026-09-03: no
#   middleware PAGES entry, no deployed page linking them, and no importer
#   outside the archive set itself.
#
# WHAT IS HELD BACK -- see $DENY below
#   Houses and Landscapes, their routes, their HTML, and
#   lib/shared/subject-redirect.ts stay in place on Rich's explicit hold.
#   $DENY is enforced: if any resolved file matches it the script aborts
#   before moving anything, so a typo in $PATHS cannot take out held code.
#
# LANE AWARENESS
#   Same shape as D-ProjectFiles-Move-v3: one decision per repo-relative
#   path, applied to every repo's copy in a single pass, with every copy
#   SHA256'd first.
#
#   It differs from that script in one deliberate way. There, a hash
#   mismatch between lanes HELD the group, because the decision rested on
#   the copies being redundant duplicates. Here each repo's copy goes to
#   its OWN destination subtree, so nothing is deduplicated and nothing can
#   be lost to divergence -- and the decision ("this Series is dead") was
#   verified independently in all six repos, so a lane holding different
#   bytes does not undermine it. Divergence is therefore REPORTED LOUDLY
#   and archived, not held. Read the DIVERGENT section before confirming.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File Archive-DeadSeries.ps1
#   powershell -ExecutionPolicy Bypass -File Archive-DeadSeries.ps1 -Confirm

[CmdletBinding()]
param(
    [string]$ArchiveRoot = 'H:\LITENCO-ARCHIVE\02-SUPERSEDED-BUILDS',
    [string]$ReportDir   = 'H:\LITENCO-ARCHIVE\_MANIFEST',
    [string]$TrackerPath = "",
    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'

function Fail([string]$msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    exit 1
}

$REPOS = @(
    'D:\minramas',
    'D:\lanes\ceng',
    'D:\lanes\ceng46',
    'D:\lanes\cui41a',
    'D:\lanes\cui41b',
    'D:\lanes\cui42'
)

# Repo-relative paths to archive. Directories are expanded to their files.
$PATHS = @(
    'lib\v1\sportsmem',
    'lib\v1\interior',
    'lib\v1\stadium',
    'lib\v1\action',
    'lib\v1\generators',
    'app\api\v1\sportsmem',
    'app\api\v1\interior',
    'app\api\v1\stadium',
    'app\api\v1\moments',
    'app\api\v1\actionmini',
    'public\sportsmem.html',
    'public\interiors.html',
    'public\actionmini.html',
    '_route_upload\sportsmem-generate-route.ts',
    '_route_upload\sportsmem-analyze-route.ts',
    '_route_upload\interior-generate-route.ts',
    '_route_upload\stadium-generate-route.ts',
    '_route_upload\moments-analyze-route.ts',
    '_route_upload\actionmini-analyze-route.ts',
    '_route_upload\actionmini-generate-route.ts'
)

# HELD BACK. Nothing matching these may be moved. Checked against every
# resolved file before a single move happens.
$DENY = @(
    '\\lib\\v1\\houses\\',
    '\\lib\\v1\\landscapes\\',
    '\\app\\api\\v1\\houses\\',
    '\\app\\api\\v1\\landscapes\\',
    '\\public\\houses\.html$',
    '\\public\\landscapes\.html$',
    '\\lib\\shared\\subject-redirect\.ts$',
    '\\_route_upload\\houses-',
    '\\_route_upload\\landscapes-',
    '\\_route_upload\\structures-'
)

# ---- tracking ---------------------------------------------------------------
if (-not $TrackerPath) {
    foreach ($c in @((Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'),
                     'D:\minramas\scripts\FileOps-Tracker.ps1')) {
        if (Test-Path -LiteralPath $c) { $TrackerPath = $c; break }
    }
}
if (-not ($TrackerPath -and (Test-Path -LiteralPath $TrackerPath))) {
    Fail "FileOps-Tracker.ps1 not found - refusing to move files untracked"
}
. $TrackerPath

# If H: is not mounted, STOP. Moving a file to a path that does not exist
# is a delete wearing a different word. (Same rule as Archive-File.ps1.)
$archiveDrive = Split-Path $ArchiveRoot -Qualifier
if (-not (Test-Path -LiteralPath "$archiveDrive\")) {
    Fail "archive drive $archiveDrive is not available - nothing moved"
}
foreach ($r in @('D:\minramas', 'D:\lanes')) {
    if ($ArchiveRoot.ToLower().StartsWith($r.ToLower())) {
        Fail "archive root $ArchiveRoot is inside a scanned root $r"
    }
}

$timestamp  = Get-Date -Format "yyyyMMdd-HHmm"
$batchId    = "DEADSERIES-$timestamp"
$planPath   = Join-Path $ReportDir "DeadSeries-Plan-$timestamp.csv"
$mode = if ($Confirm) { "EXECUTE" } else { "DRY RUN" }

Write-Host ""
Write-Host "Archive-DeadSeries   [$mode]" -ForegroundColor Cyan
Write-Host "  archive    $ArchiveRoot"
Write-Host "  reports    $ReportDir"
Write-Host ""

# ---- resolve every path to files, per repo ----------------------------------
$groups = [ordered]@{}
$absent = New-Object System.Collections.ArrayList

foreach ($repo in $REPOS) {
    $repoName = Split-Path $repo -Leaf
    foreach ($p in $PATHS) {
        $full = Join-Path $repo $p
        if (-not (Test-Path -LiteralPath $full)) {
            [void]$absent.Add([PSCustomObject]@{ Repo = $repoName; RelPath = $p })
            continue
        }
        $files = if (Test-Path -LiteralPath $full -PathType Container) {
            Get-ChildItem -LiteralPath $full -Recurse -File
        } else {
            Get-Item -LiteralPath $full
        }
        foreach ($f in $files) {
            $rel = $f.FullName.Substring($repo.Length).TrimStart('\')
            $key = $rel.ToLower()
            if (-not $groups.Contains($key)) {
                $groups[$key] = [PSCustomObject]@{ RelPath = $rel; Copies = @() }
            }
            $groups[$key].Copies += [PSCustomObject]@{
                RepoName = $repoName
                Source   = $f.FullName
                Bytes    = $f.Length
            }
        }
    }
}

# ---- DENY enforcement, before anything moves --------------------------------
$violations = @()
foreach ($key in $groups.Keys) {
    foreach ($c in $groups[$key].Copies) {
        foreach ($d in $DENY) {
            if ($c.Source -match $d) { $violations += $c.Source }
        }
    }
}
if ($violations.Count -gt 0) {
    Write-Host "HELD-BACK PATHS RESOLVED INTO THE ARCHIVE SET:" -ForegroundColor Red
    $violations | Select-Object -Unique | ForEach-Object { Write-Host "   $_" -ForegroundColor Red }
    Fail "refusing to run - $($violations.Count) file(s) match the hold list"
}
Write-Host "  hold list      clean - no houses/landscapes/subject-redirect file resolved" -ForegroundColor Green
Write-Host "  distinct files $($groups.Count)"
Write-Host "  total copies   $(($groups.Values | ForEach-Object { $_.Copies.Count } | Measure-Object -Sum).Sum)"
Write-Host ""

# ---- hash every copy --------------------------------------------------------
foreach ($key in $groups.Keys) {
    foreach ($c in $groups[$key].Copies) {
        $c | Add-Member -NotePropertyName Hash -NotePropertyValue (Get-SafeHash $c.Source) -Force
    }
}

function Get-NextArchiveSlot {
    param([string]$Dir, [string]$Name, [string]$Ext)
    $n = 1
    if (Test-Path -LiteralPath $Dir) {
        $used = @(
            Get-ChildItem -LiteralPath $Dir -Filter "$Name`_*$Ext" -File -ErrorAction SilentlyContinue |
            ForEach-Object {
                if ($_.BaseName -match "^$([regex]::Escape($Name))_(\d+)$") { [int]$matches[1] }
            }
        )
        if ($used.Count -gt 0) { $n = [int]($used | Measure-Object -Maximum).Maximum + 1 }
    }
    return (Join-Path $Dir ("{0}_{1:D3}{2}" -f $Name, $n, $Ext))
}

if ($Confirm) {
    Start-TrackedBatch -BatchId $batchId -Description "Archive-DeadSeries: dead Series out of 6 repos"
}

$plan      = New-Object System.Collections.ArrayList
$divergent = New-Object System.Collections.ArrayList
$held      = New-Object System.Collections.ArrayList

foreach ($key in $groups.Keys) {
    $g = $groups[$key]
    $copies = @($g.Copies)

    $bad = @($copies | Where-Object { -not (Test-RealHash $_.Hash) })
    if ($bad.Count -gt 0) {
        [void]$held.Add([PSCustomObject]@{
            RelPath = $g.RelPath
            Reason  = "unreadable: " + (($bad | ForEach-Object { $_.RepoName }) -join ', ')
        })
        continue
    }

    $distinct = @($copies | Select-Object -ExpandProperty Hash -Unique)
    if ($distinct.Count -gt 1) {
        $byHash = ($copies | Group-Object Hash | ForEach-Object {
            "$($_.Name.Substring(0,8))=" + (($_.Group | ForEach-Object { $_.RepoName }) -join '/')
        }) -join '  '
        [void]$divergent.Add([PSCustomObject]@{
            RelPath = $g.RelPath; Variants = $distinct.Count; Detail = $byHash
        })
    }

    foreach ($c in $copies) {
        $destPath = Join-Path (Join-Path $ArchiveRoot $c.RepoName) $g.RelPath
        $destDir  = Split-Path $destPath -Parent

        [void]$plan.Add([PSCustomObject]@{
            RelPath     = $g.RelPath
            RepoName    = $c.RepoName
            Source      = $c.Source
            Destination = $destPath
            Bytes       = $c.Bytes
            SHA256      = $c.Hash
            Copies      = $copies.Count
            Divergent   = ($distinct.Count -gt 1)
            Status      = "PLANNED"
            Note        = ""
        })
        $planRow = $plan[$plan.Count - 1]

        if (-not $Confirm) { continue }

        try {
            if (-not (Test-Path -LiteralPath $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }
            if (Test-Path -LiteralPath $destPath) {
                $slot = Get-NextArchiveSlot -Dir $destDir `
                    -Name ([System.IO.Path]::GetFileNameWithoutExtension($destPath)) `
                    -Ext  ([System.IO.Path]::GetExtension($destPath))
                Invoke-TrackedMove -Source $destPath -Destination $slot `
                    -Note "prior archived version moved aside; batch $batchId"
            }
            Invoke-TrackedMove -Source $c.Source -Destination $destPath `
                -Note "dead Series archival, $($c.RepoName); batch $batchId"

            if (-not (Test-Path -LiteralPath $destPath -PathType Leaf)) {
                throw "move reported success but nothing is at $destPath"
            }
            $dh = Get-SafeHash $destPath
            if ($dh -ne $c.Hash) { throw "destination hash $dh does not match source $($c.Hash)" }
            $planRow.Status = "MOVED"
        }
        catch {
            $planRow.Status = "ERROR"
            $planRow.Note   = $_.Exception.Message
            Write-Host "   ERROR $($c.Source): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

if ($Confirm) {
    End-TrackedBatch -BatchId $batchId -Description "moved $(($plan | Where-Object Status -eq 'MOVED').Count) of $($plan.Count)"
}

New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
$plan | Export-Csv -LiteralPath $planPath -NoTypeInformation -Encoding UTF8

# ---- report -----------------------------------------------------------------
$byArea = $plan | Group-Object { ($_.RelPath -split '\\')[0..2] -join '\' }
Write-Host "PLAN BY AREA" -ForegroundColor Cyan
foreach ($a in ($byArea | Sort-Object Name)) {
    $files = ($a.Group | Select-Object -ExpandProperty RelPath -Unique).Count
    $kb = [math]::Round((($a.Group | Measure-Object Bytes -Sum).Sum / 1KB), 1)
    Write-Host ("   {0,-34} {1,3} files x {2} repos = {3,3} copies, {4} KB" -f `
        $a.Name, $files, [math]::Round($a.Group.Count / [math]::Max($files,1),0), $a.Group.Count, $kb)
}

if ($absent.Count -gt 0) {
    Write-Host ""
    Write-Host "ABSENT (nothing to move; not an error)" -ForegroundColor DarkYellow
    $absent | Group-Object RelPath | ForEach-Object {
        Write-Host "   $($_.Name)  -  missing in: $((($_.Group | ForEach-Object { $_.Repo }) -join ', '))"
    }
}

if ($divergent.Count -gt 0) {
    Write-Host ""
    Write-Host "DIVERGENT ACROSS LANES - archived anyway, each to its own subtree" -ForegroundColor Yellow
    Write-Host "READ THIS BEFORE CONFIRMING: these lanes hold different bytes." -ForegroundColor Yellow
    foreach ($d in ($divergent | Sort-Object RelPath)) {
        Write-Host ("   {0,-52} {1} variants  {2}" -f $d.RelPath, $d.Variants, $d.Detail)
    }
}

if ($held.Count -gt 0) {
    Write-Host ""
    Write-Host "HELD (unreadable)" -ForegroundColor Red
    $held | ForEach-Object { Write-Host "   $($_.RelPath)  -  $($_.Reason)" }
}

Write-Host ""
Write-Host "-------------------------------------------------------------"
Write-Host "  mode              $mode"
Write-Host "  distinct files    $($groups.Count)"
Write-Host "  copies planned    $($plan.Count)"
Write-Host "  divergent files   $($divergent.Count)"
Write-Host "  held              $($held.Count)"
if ($Confirm) {
    Write-Host "  moved             $(($plan | Where-Object Status -eq 'MOVED').Count)" -ForegroundColor Green
    Write-Host "  errors            $(($plan | Where-Object Status -eq 'ERROR').Count)"
}
Write-Host ""
Write-Host "  plan  $planPath"
Write-Host ""
if (-not $Confirm) {
    Write-Host "DRY RUN. Nothing moved. Re-run with -Confirm to execute." -ForegroundColor Yellow
} else {
    Write-Host "Done. Nothing was deleted." -ForegroundColor Green
}
