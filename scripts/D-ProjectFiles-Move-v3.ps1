# D-ProjectFiles-Move-v3.ps1
#
# Executes the MOVE decisions in a D-ProjectFiles-v3-*.csv manifest.
# Pairs with D-ProjectFiles-Audit-v3.ps1 -- same generation number, so the
# audit that produced a manifest and the script that acts on it are named
# together.
#
# NOTHING IS EVER DELETED. Files are moved to
# H:\LITENCO-ARCHIVE\02-SUPERSEDED-BUILDS, and anything already sitting at a
# destination is archived to a numbered slot beside it first.
#
# DRY RUN IS THE DEFAULT. -Confirm is required to touch the disk.
#
# LANE AWARENESS
#   D:\minramas and the five D:\lanes worktrees mirror each other, so the same
#   relative path shows up six times in the manifest. Each MOVE decision is
#   resolved ONCE against the content, then applied to every copy in a single
#   pass -- not six independent decisions.
#
#   "Same name" is not taken as "same file". Every copy in a mirror group is
#   SHA256'd and the hashes must all match before the group is treated as
#   mirrored. If one lane's copy differs, the whole group is held back and
#   written to the manual-review report instead. A divergent lane copy means
#   the audit's premise does not hold there, and guessing which one is right
#   is exactly what this script must not do.
#
# UNRESOLVED rows are never touched. They are written to a separate report
# for a human decision.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File D-ProjectFiles-Move-v3.ps1
#   powershell -ExecutionPolicy Bypass -File D-ProjectFiles-Move-v3.ps1 -Confirm
#   powershell -ExecutionPolicy Bypass -File D-ProjectFiles-Move-v3.ps1 -ManifestPath H:\...\D-ProjectFiles-v3-20260902-1646.csv

[CmdletBinding()]
param(
    [string]$ManifestPath = "",

    [string]$ArchiveRoot = 'H:\LITENCO-ARCHIVE\02-SUPERSEDED-BUILDS',

    [string]$ReportDir = 'H:\LITENCO-ARCHIVE\_MANIFEST',

    [string]$TrackerPath = "",

    # Dry run is the default. This switch is the only way to move a file.
    [switch]$Confirm
)

$ErrorActionPreference = 'Stop'

function Fail([string]$msg) {
    Write-Host "FAIL: $msg" -ForegroundColor Red
    exit 1
}

# ---- tracking ---------------------------------------------------------------
# Every move is recorded to H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv by
# the shared tracker, the same way Archive-File.ps1 and Install-File.ps1 record
# theirs. If H: is absent the tracker says so and proceeds untracked -- but see
# the archive-drive check below, which stops this script outright in that case.
if (-not $TrackerPath) {
    $candidates = @(
        (Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'),
        'D:\minramas\scripts\FileOps-Tracker.ps1'
    )
    foreach ($c in $candidates) {
        if (Test-Path -LiteralPath $c) { $TrackerPath = $c; break }
    }
}
if ($TrackerPath -and (Test-Path -LiteralPath $TrackerPath)) {
    . $TrackerPath
} else {
    Fail "FileOps-Tracker.ps1 not found - refusing to move files untracked"
}

# ---- preconditions ----------------------------------------------------------

# If H: is not mounted, STOP. Moving a file to a path that does not exist is a
# delete wearing a different word. (Same rule as Archive-File.ps1.)
$archiveDrive = Split-Path $ArchiveRoot -Qualifier
if (-not (Test-Path -LiteralPath "$archiveDrive\")) {
    Fail "archive drive $archiveDrive is not available - nothing moved"
}

if (-not $ManifestPath) {
    $latest = Get-ChildItem -LiteralPath $ReportDir -Filter 'D-ProjectFiles-v3-*.csv' -File -ErrorAction SilentlyContinue |
              Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if (-not $latest) { Fail "no D-ProjectFiles-v3-*.csv found in $ReportDir - run the audit first" }
    $ManifestPath = $latest.FullName
}
if (-not (Test-Path -LiteralPath $ManifestPath -PathType Leaf)) {
    Fail "manifest not found: $ManifestPath"
}

# The archive must not live inside a scanned repo, or this script would be
# moving files into its own search path.
foreach ($r in @('D:\minramas', 'D:\lanes')) {
    if ($ArchiveRoot.ToLower().StartsWith($r.ToLower())) {
        Fail "archive root $ArchiveRoot is inside a scanned root $r"
    }
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$batchId = "SUPERSEDED-$timestamp"
$planPath   = Join-Path $ReportDir "Move-Plan-v3-$timestamp.csv"
$reviewPath = Join-Path $ReportDir "Manual-Review-v3-$timestamp.csv"

$mode = if ($Confirm) { "EXECUTE" } else { "DRY RUN" }

Write-Host ""
Write-Host "D-ProjectFiles-Move-v3   [$mode]" -ForegroundColor Cyan
Write-Host "  manifest   $ManifestPath"
Write-Host "  archive    $ArchiveRoot"
Write-Host "  reports    $ReportDir"
Write-Host ""

$rows = @(Import-Csv -LiteralPath $ManifestPath)
$moveRows = @($rows | Where-Object { $_.IsSuperseded -eq 'True' })
$unresolvedRows = @($rows | Where-Object { $_.IsUnresolved -eq 'True' })

Write-Host "  manifest rows      $($rows.Count)"
Write-Host "  MOVE-flagged       $($moveRows.Count)"
Write-Host "  UNRESOLVED         $($unresolvedRows.Count)  (never touched by this script)"
Write-Host ""

# ---- repo roots -------------------------------------------------------------
# Derived from the manifest itself rather than hardcoded, so a lane added or
# dropped between audit and move does not silently fall through.
$repoRoots = @()
if (Test-Path 'D:\minramas') { $repoRoots += 'D:\minramas' }
Get-ChildItem -LiteralPath 'D:\lanes' -Directory -ErrorAction SilentlyContinue | ForEach-Object {
    $repoRoots += $_.FullName
}
# longest first, so D:\lanes\ceng46 is matched before D:\lanes\ceng
$repoRoots = @($repoRoots | Sort-Object -Property Length -Descending)

function Get-RepoRoot([string]$FullPath) {
    foreach ($r in $repoRoots) {
        if ($FullPath.ToLower().StartsWith(($r.ToLower() + '\'))) { return $r }
    }
    return $null
}

# ---- group the MOVE rows by repo-relative path ------------------------------
# This is the lane collapse: one entry per logical file, however many repos
# carry a copy of it.
$groups = @{}
$ungrouped = @()
foreach ($row in $moveRows) {
    $root = Get-RepoRoot $row.FullPath
    if (-not $root) {
        $ungrouped += $row
        continue
    }
    $rel = $row.FullPath.Substring($root.Length).TrimStart('\')
    $key = $rel.ToLower()
    if (-not $groups.ContainsKey($key)) {
        $groups[$key] = [PSCustomObject]@{
            RelPath      = $rel
            SupersededBy = $row.SupersededBy
            Copies       = @()
        }
    }
    $groups[$key].Copies += [PSCustomObject]@{
        Row      = $row
        RepoRoot = $root
        RepoName = Split-Path $root -Leaf
        Source   = $row.FullPath
    }
}

Write-Host "  distinct files     $($groups.Count)   (from $($moveRows.Count) manifest rows across repos)"
if ($ungrouped.Count -gt 0) {
    Write-Host "  outside any repo   $($ungrouped.Count)  -> held for review" -ForegroundColor Yellow
}
Write-Host ""

# ---- next free numbered slot beside an occupied destination -----------------
# Ported from Archive-File.ps1: the number is READ OFF the directory, never
# counted, so it stays correct if something is ever removed by hand.
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

# ---- resolve each group, then act on it as a unit ---------------------------
$plan = New-Object System.Collections.ArrayList
$review = New-Object System.Collections.ArrayList

foreach ($row in $ungrouped) {
    [void]$review.Add([PSCustomObject]@{
        FullPath = $row.FullPath; Category = $row.Category; SizeKB = $row.SizeKB
        LastWriteTime = $row.LastWriteTime
        Reason = "MOVE-flagged but outside every known repo root; not moved"
    })
}
foreach ($row in $unresolvedRows) {
    [void]$review.Add([PSCustomObject]@{
        FullPath = $row.FullPath; Category = $row.Category; SizeKB = $row.SizeKB
        LastWriteTime = $row.LastWriteTime
        Reason = $row.UnresolvedReason
    })
}

$decidedMove = 0
$decidedHold = 0

# One batch marker per execution, so the day's FileActions log can be sliced
# back to exactly this run. Dry runs write no batch, because they write nothing.
if ($Confirm) {
    Start-TrackedBatch -BatchId $batchId -Description "D-ProjectFiles-Move-v3 from $ManifestPath"
}

foreach ($key in ($groups.Keys | Sort-Object)) {
    $g = $groups[$key]
    $copies = @($g.Copies)

    # -- verify every copy is present and readable, and hash it
    $hold = $null
    foreach ($c in $copies) {
        if (-not (Test-Path -LiteralPath $c.Source -PathType Leaf)) {
            $hold = "source listed in manifest is no longer on disk: $($c.Source)"
            break
        }
        $c | Add-Member -NotePropertyName Hash -NotePropertyValue (Get-SafeHash $c.Source) -Force
        if (-not (Test-RealHash $c.Hash)) {
            $hold = "could not hash $($c.Source) (got $($c.Hash))"
            break
        }
    }

    # -- SAME NAME IS NOT SAME FILE. Hashes must agree before these are treated
    #    as mirrors of one another.
    if (-not $hold -and $copies.Count -gt 1) {
        $distinct = @($copies | Select-Object -ExpandProperty Hash -Unique)
        if ($distinct.Count -gt 1) {
            $byHash = ($copies | Group-Object Hash | ForEach-Object {
                "$($_.Name.Substring(0,12)) = " + (($_.Group | ForEach-Object { $_.RepoName }) -join ', ')
            }) -join ' | '
            $hold = "copies sharing this path are NOT byte-identical across repos ($($distinct.Count) distinct hashes: $byHash)"
        }
    }

    if ($hold) {
        $decidedHold++
        Write-Host "  HOLD  $($g.RelPath)" -ForegroundColor Yellow
        Write-Host "        $hold" -ForegroundColor Yellow
        foreach ($c in $copies) {
            [void]$review.Add([PSCustomObject]@{
                FullPath = $c.Source; Category = $c.Row.Category; SizeKB = $c.Row.SizeKB
                LastWriteTime = $c.Row.LastWriteTime
                Reason = $hold
            })
        }
        continue
    }

    # -- one decision, taken once, against verified-identical content
    $decidedMove++
    $note = "superseded by $($g.SupersededBy); mirror group of $($copies.Count) verified-identical copies; batch $batchId"
    Write-Host "  MOVE  $($g.RelPath)" -ForegroundColor Green
    Write-Host "        superseded by $($g.SupersededBy) - $($copies.Count) identical copies, sha $($copies[0].Hash.Substring(0,12))"

    # -- and applied to every copy in this one pass
    foreach ($c in $copies) {
        $destPath = Join-Path (Join-Path $ArchiveRoot $c.RepoName) $g.RelPath
        $destDir = Split-Path $destPath -Parent

        [void]$plan.Add([PSCustomObject]@{
            RelPath      = $g.RelPath
            RepoName     = $c.RepoName
            Source       = $c.Source
            Destination  = $destPath
            SHA256       = $c.Hash
            SupersededBy = $g.SupersededBy
            MirrorCopies = $copies.Count
            Status       = "PLANNED"
            Note         = ""
        })
        $planRow = $plan[$plan.Count - 1]

        if (-not $Confirm) {
            Write-Host "          [dry] $($c.RepoName)  ->  $destPath"
            continue
        }

        try {
            if (-not (Test-Path -LiteralPath $destDir)) {
                New-Item -ItemType Directory -Path $destDir -Force | Out-Null
            }

            # ARCHIVE BEFORE OVERWRITE. Something already in the slot is moved
            # aside to a numbered name, never replaced and never removed.
            if (Test-Path -LiteralPath $destPath) {
                $slot = Get-NextArchiveSlot -Dir $destDir `
                    -Name ([System.IO.Path]::GetFileNameWithoutExtension($destPath)) `
                    -Ext ([System.IO.Path]::GetExtension($destPath))
                Write-Host "          occupied - existing archived to $(Split-Path $slot -Leaf)" -ForegroundColor DarkYellow
                Invoke-TrackedMove -Source $destPath -Destination $slot `
                    -Note "prior archived version moved aside before $($c.Source) landed; batch $batchId"
            }

            Invoke-TrackedMove -Source $c.Source -Destination $destPath -Note $note

            # Read it back off the filesystem. A file believed to be somewhere
            # and not there has cost this project two deployments.
            if (-not (Test-Path -LiteralPath $destPath -PathType Leaf)) {
                throw "move reported success but nothing is at $destPath"
            }
            $destHash = Get-SafeHash $destPath
            if ($destHash -ne $c.Hash) {
                throw "destination hash $destHash does not match source hash $($c.Hash)"
            }

            $planRow.Status = "MOVED"
            Write-Host "          moved $($c.RepoName)  ->  $destPath" -ForegroundColor Green
        }
        catch {
            $planRow.Status = "ERROR"
            $planRow.Note = $_.Exception.Message
            Write-Host "          ERROR $($c.Source): $($_.Exception.Message)" -ForegroundColor Red
        }
    }
}

if ($Confirm) {
    End-TrackedBatch -BatchId $batchId -Description "moved $(($plan | Where-Object Status -eq 'MOVED').Count) of $($plan.Count) planned copies"
}

# ---- reports ----------------------------------------------------------------
New-Item -ItemType Directory -Path $ReportDir -Force | Out-Null
$plan   | Export-Csv -LiteralPath $planPath   -NoTypeInformation -Encoding UTF8
$review | Export-Csv -LiteralPath $reviewPath -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "-------------------------------------------------------------"
Write-Host "  mode                 $mode"
Write-Host "  files decided MOVE   $decidedMove   ($($plan.Count) copies across repos)"
Write-Host "  files held           $decidedHold"
Write-Host "  manual-review rows   $($review.Count)"
if ($Confirm) {
    Write-Host "  moved                $(($plan | Where-Object Status -eq 'MOVED').Count)" -ForegroundColor Green
    Write-Host "  errors               $(($plan | Where-Object Status -eq 'ERROR').Count)"
}
Write-Host ""
Write-Host "  move plan      $planPath"
Write-Host "  manual review  $reviewPath"
Write-Host ""
if (-not $Confirm) {
    Write-Host "DRY RUN. Nothing moved. Re-run with -Confirm to execute." -ForegroundColor Yellow
} else {
    Write-Host "Done. Nothing was deleted." -ForegroundColor Green
}
