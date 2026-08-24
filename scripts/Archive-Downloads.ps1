# Archive-Downloads.ps1
#
# Moves LOOSE PROJECT FILES out of Downloads and into the archive on H:,
# tracked, deleting nothing.
#
# -- THIS IS AN ALLOWLIST, NOT A SWEEP ------------------------------------
# Downloads holds medical records, legal filings and family material
# alongside project work. Nothing moves unless its NAME IS ON THE LIST
# BELOW. A sweep with exclusions is one rename away from moving a court
# document; a list of exact names is not.
#
# FOLDERS ARE NEVER TOUCHED. Rich's instruction, 23 August: files only.
# The script does not enumerate directories at all.
#
# -- WHERE THINGS GO ------------------------------------------------------
#   H:\NO_DELETE_ARCHIVE\Downloads\2026-08-23\<name>
#
# One folder per run date. If a name is already in there - the same file
# archived twice - the second gets _001, _002, the way Install-File.ps1
# numbers. Nothing is overwritten and nothing is deleted.
#
# -- LOGGING --------------------------------------------------------------
#   H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv
#
# Via FileOps-Tracker.ps1, the same log every other move today wrote to.
# NOT _ledger.csv - that file is dead and has been since 19 August.
#
# -- USAGE ----------------------------------------------------------------
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-Downloads.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\Archive-Downloads.ps1 -Apply
#
# Dry run by default. It prints what it would move AND what it is leaving
# behind, so the decision is visible rather than silent.

[CmdletBinding()]
param(
    [string]$Source      = "$env:USERPROFILE\Downloads",
    [string]$ArchiveRoot = 'H:\NO_DELETE_ARCHIVE\Downloads',
    [switch]$Apply
)

# ---- tracking ---------------------------------------------------------------
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) {
    . $TrackerPath
} else {
    Write-Host "FileOps-Tracker.ps1 not found - operations will be UNTRACKED." -ForegroundColor Red
}

$ErrorActionPreference = 'Stop'

# ---- THE LIST ---------------------------------------------------------------
# Every name read off the Downloads listing of 23 August 2026 and judged
# one at a time. If it is not here, it stays where it is.
#
# Deliberately absent, and why:
#   the four Hone/Probation PDFs      legal
#   Medical, Case, henny penny        folders, and not project work
#   USN_Image_Deletion_Record.xlsx    not this project
#   recovery-codes.txt                security material - Rich moves this
#                                     himself, and not to an archive
#   the two .mp4 files, 80MB          unidentified; ask before moving
#   the two Screenshot .jpg           unidentified
#   5480d8ac-...png                   unidentified
#   panel.php, HennyPenny*            a different site

# GROUPED. One folder per kind under the dated folder, so the archive is
# readable a month from now instead of being fifty files in a heap.
#
#   H:\NO_DELETE_ARCHIVE\Downloads\2026-08-23\governance\
#                                              patches\
#                                              engine\
#                                              drafts\
#                                              assets\
$Groups = [ordered]@{

    'governance' = @(
        'CARRYOVER-CUI-V31-2026-08-21.md',
        'CENG-CARRYOVER-2026-08-21.md',
        'SHARE-SPEC-2026-08-21.md',
        'REQUEST-CENG-POSTS-MINE-2026-08-23.md',
        'CHATGPT-file-handling.md'
    )

    # Already installed into the repo. These are the copies Downloads kept.
    'patches' = @(
        'patch-bodies-2026-08-22.py',
        'patch-groups-likeness-2026-08-22.py',
        'patch-groups-cut-skin-keylight (1).py',
        'patch-mobile-r1_STALE_9128.py.bak'
    )

    'engine' = @(
        '021_community_public_images.sql',
        'batch-groups-candidates.ts',
        'emit-likeness-drafts.ts'
    )

    'drafts' = @(
        'CURATOR-GROUPS-FAILURE-DRAFT.md',
        'nine-drafts.txt',
        'victorian-likeness-test.txt',
        'litenco-screen-tree.html'
    )

    'assets' = @(
        'Liten_C0_mobile_screens.pptx',
        'pets-effect-inventory2.xlsx',
        'litenco-ad-assets.zip',
        'litenco_collection_mockup.zip',
        'litenco_texture_pack_v1.zip',
        'hennypenny-admin-plugin.zip'
    )
}

# Flattened once, for the "left in place" report at the foot.
$Names = @()
foreach ($k in $Groups.Keys) { $Names += $Groups[$k] }


Write-Host ""
Write-Host "Archive-Downloads"
Write-Host "  source   $Source"
Write-Host "  archive  $ArchiveRoot"
Write-Host "  on list  $($Names.Count) names in $($Groups.Count) groups"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will be moved" -ForegroundColor Yellow }
Write-Host ""

if (-not (Test-Path -LiteralPath $Source)) {
    Write-Host "FAIL: source not found - $Source" -ForegroundColor Red
    exit 1
}

# REFUSED: running without the archive drive. Install-File.ps1 takes the
# same position - a move with nowhere safe to put the file is a delete
# wearing a different name.
$hRoot = Split-Path $ArchiveRoot -Qualifier
if (-not (Test-Path -LiteralPath "$hRoot\")) {
    Write-Host "REFUSED: $hRoot is not mounted. Nothing moved." -ForegroundColor Red
    exit 1
}

$stamp = Get-Date -Format 'yyyy-MM-dd'
$dest  = Join-Path $ArchiveRoot $stamp

if ($Apply -and -not (Test-Path -LiteralPath $dest)) {
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
}

$BatchId = "downloads-{0}" -f (Get-Date -Format 'yyyyMMdd-HHmmss')
if ($Apply) {
    Start-TrackedBatch -BatchId $BatchId -Description "Archive-Downloads $Source -> $dest"
}

$moved   = 0
$missing = 0
$bytes   = 0L

foreach ($group in $Groups.Keys) {

    $groupDir = Join-Path $dest $group
    $any = $false

    foreach ($name in $Groups[$group]) {

        $src = Join-Path $Source $name

        # FILES ONLY. -PathType Leaf is what keeps a folder that happens to
        # share a name out of this. Rich's instruction, 23 August.
        if (-not (Test-Path -LiteralPath $src -PathType Leaf)) {
            $missing++
            continue
        }

        if (-not $any) {
            Write-Host ("  {0}" -f $group) -ForegroundColor Cyan
            $any = $true
            if ($Apply -and -not (Test-Path -LiteralPath $groupDir)) {
                New-Item -ItemType Directory -Path $groupDir -Force | Out-Null
            }
        }

        $item = Get-Item -LiteralPath $src

        # A name already in today's folder gets a number rather than
        # overwriting. Same posture as Install-File.ps1.
        $base = [System.IO.Path]::GetFileNameWithoutExtension($name)
        $ext  = [System.IO.Path]::GetExtension($name)
        $out  = Join-Path $groupDir $name
        $n    = 0
        while (Test-Path -LiteralPath $out) {
            $n++
            $out = Join-Path $groupDir ("{0}_{1:D3}{2}" -f $base, $n, $ext)
        }

        if ($Apply) {
            Move-Item -LiteralPath $src -Destination $out
            Register-GeneratedFile -Path $out -BatchId $BatchId `
                -Note "Archive-Downloads: $group/$name"
            Write-Host ("    moved      {0}" -f $name) -ForegroundColor Green
        } else {
            Write-Host ("    would move {0}" -f $name)
        }

        $moved++
        $bytes += $item.Length
    }
}

# ---- what is being left, and it is deliberate -------------------------------
# Printed rather than passed over in silence. A script that quietly skips
# things is one you stop reading, and this one is skipping legal and
# medical material on purpose.
Write-Host ""
Write-Host "  LEFT IN PLACE" -ForegroundColor Cyan
$left = Get-ChildItem -LiteralPath $Source -File |
        Where-Object { $Names -notcontains $_.Name } |
        Sort-Object Name
foreach ($f in $left) {
    Write-Host ("    {0}" -f $f.Name) -ForegroundColor DarkGray
}
Write-Host "    (folders are never touched)" -ForegroundColor DarkGray

if ($Apply) { End-TrackedBatch -BatchId $BatchId -Description "$moved files archived to $dest" }

Write-Host ""
Write-Host ("  {0} on the list, {1} found, {2} absent, {3} left in place" -f `
    $Names.Count, $moved, $missing, $left.Count)
Write-Host ("  {0:N1} MB" -f ($bytes / 1MB))
if ($Apply) {
    Write-Host ""
    Write-Host "  Moved to $dest - nothing was deleted."
} else {
    Write-Host ""
    Write-Host "  Dry run. Re-run with -Apply to move." -ForegroundColor Yellow
}
Write-Host ""
