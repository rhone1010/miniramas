<#
.SYNOPSIS
  Audits D:\lanes\* and D:\minramas for actual LitenCo project files --
  routes, prompt systems, commerce, admin, images -- and flags stale /
  superseded ones for later move. Read-only. Moves nothing.

.CHANGES IN v2
  1. Family key is stem + EXTENSION (+ folder + category). A .css and a .js
     with the same base name are no longer versions of each other; nor a
     .jpg and a .png, nor a .json and a .zip.
  2. A file is only "superseded" when an explicit version marker
     distinguishes it from a sibling. Recognised markers:
       derivative : .bak / .bak-<anything>       (file IS a backup of the base)
                    " - Copy" / " - Copy (n)"    (file IS a duplicate of the base)
       sequence   : -v2 / _V3 / -V001            (separator + v + digits)
                    (1) / (2)                    (trailing parenthesised number)
     Shared mtime or filename proximity alone is never grounds.
  3. mtime is NEVER used to pick a winner. Where the marker cannot order a
     family, the whole family is UNRESOLVED. Column SiblingMtimeIdentical
     records families whose members share a LastWriteTime (git-checkout
     artefact) so those can be filtered separately.
  4. Dotfiles and .env* are excluded from family grouping entirely --
     .env.local / .env.test / .env.vercel / .gitignore / .vercelignore are
     never version-relationships to one another.

.CHANGES IN v3
  5. Orphaned derivatives are no longer silently KEEP. A " - Copy" or .bak*
     file with no plain-name sibling in its folder is flagged
     UNRESOLVED - orphaned derivative, original not found alongside it.
     This includes single-member families, which v2 skipped before the
     derivative check ever ran.
  6. SiblingMtimeIdentical stays a visible column on MOVE rows and is still
     never used to demote a version-marker MOVE to UNRESOLVED. The marker
     wins. The column is there to be filtered on, not acted on.
  7. The family key's category component is computed from the .bak-stripped
     name, so foo.html.bak-123 lands in the same family as foo.html rather
     than splitting off into 'Other' and looking orphaned. The Category
     COLUMN still reports the original name's category, so the category
     counts stay comparable with v1 and v2.
  8. A .bak whose stem also carries a sequence marker (foo-v2.js.bak) now
     strips both, so it joins foo-v2.js instead of forming its own family.

.DIRECTION RULE
  Derivative markers (.bak, " - Copy") are unambiguous: the marked file is
  the redundant one, so it is flagged MOVE whenever an unmarked sibling
  exists in its family.
  Sequence markers (-v2, (1), V001) are NOT unambiguous against an unmarked
  sibling -- per directives/LIVE-FILE-LEDGER.md convention a plain filename
  may be the live file and the stamped one a proto. Any family mixing plain
  and sequence-marked members is therefore UNRESOLVED, never MOVE.

.EXCLUDES
  Folders: node_modules, .git, .next, dist, build, out, .turbo, .vercel,
           .cache, coverage, tmp, temp, .tmp
  Files:   lockfiles, .min.js, .map, .d.ts, tsbuildinfo, .DS_Store, Thumbs.db
  NOTE: hand-written source (.ts/.tsx routes, prompt files, etc.) is KEPT --
  only build output, node internals, and generated/compiler artifacts are cut.

.USAGE
  powershell -ExecutionPolicy Bypass -File D-ProjectFiles-Audit-v3.ps1

.OUTPUT
  H:\LITENCO-ARCHIVE\_MANIFEST\D-ProjectFiles-v3-<yyyyMMdd-HHmm>.csv
#>

# ---- ROOTS ----
$roots = @()
if (Test-Path "D:\minramas") { $roots += "D:\minramas" }
if (Test-Path "D:\lanes") {
    Get-ChildItem -Path "D:\lanes" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $roots += $_.FullName
    }
}

# ---- EXCLUDE: folders (pruned before descending) ----
$excludeDirPatterns = @(
    '^node_modules$', '^\.git$', '^\.next$', '^dist$', '^build$', '^out$',
    '^\.turbo$', '^\.vercel$', '^\.cache$', '^coverage$',
    '^tmp$', '^temp$', '^\.tmp$'
)

# ---- EXCLUDE: specific generated/compiler files (not hand-written source) ----
$excludeFileNamePatterns = @(
    '^package-lock\.json$', '^pnpm-lock\.yaml$', '^yarn\.lock$',
    '\.min\.js$', '\.map$', '\.d\.ts$', 'tsbuildinfo',
    '^\.DS_Store$', '^Thumbs\.db$', '^\.eslintcache$'
)

$staleDaysThreshold = 90

$outDir = "H:\LITENCO-ARCHIVE\_MANIFEST"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmm"
$outFile = Join-Path $outDir "D-ProjectFiles-v3-$timestamp.csv"

# ---- Category rules: path/filename patterns -> category label ----
function Get-Category {
    param([string]$pathLower, [string]$nameLower)

    if ($pathLower -match '\\api\\.*route\.(ts|js)$' -or $nameLower -eq 'route.ts' -or $nameLower -eq 'route.js') { return 'Route' }
    if ($nameLower -match 'middleware\.(ts|js)$') { return 'Route' }
    if ($nameLower -match '(bodies|refine|shared|catalog|prompt|registry|style-refs)') { return 'PromptSystem' }
    if ($nameLower -match '(stripe|sku|checkout|portfolio|price|commerce|payflow)') { return 'Commerce' }
    if ($nameLower -match '(admin|dashboard)') { return 'Admin' }
    if ($nameLower -match '\.(jpg|jpeg|png|webp|gif)$') { return 'Image' }
    if ($nameLower -match '(carryover|governance|failure-pattern|handoff|read-this-first)') { return 'Governance' }
    if ($nameLower -match '^(patch[-_]|migration-|install-|archive-)') { return 'PatchOrScript' }
    if ($nameLower -match '\.(html)$') { return 'HTML-Mockup' }
    return 'Other'
}

# ---- v2/v3 · Parse a filename into stem + normalised extension + version marker ----
# Returns: Stem, NormExt, NormName, MarkerKind ('' | 'bak' | 'copy' | 'v' | 'paren'),
#          MarkerRank (int), MarkerText, IsDerivative, IsGroupable
function Get-NameParts {
    param([string]$Name)

    $markerKind = ''
    $markerRank = 0
    $markerText = ''

    # RULE 4 -- dotfiles never take part in family grouping. Every .env* form
    # (.env, .env.local, .env.test, .env.vercel) is dot-leading and so is
    # covered here; matching a bare "env." prefix as well would wrongly
    # capture ordinary source files such as lib/env.ts
    if ($Name.StartsWith('.')) {
        return [PSCustomObject]@{
            Stem = $Name; NormExt = ''; NormName = $Name; MarkerKind = ''; MarkerRank = 0
            MarkerText = ''; IsDerivative = $false; IsGroupable = $false
        }
    }

    $work = $Name
    $isBak = $false
    $bakText = ''

    # Derivative marker 1 -- trailing .bak / .bak-<anything>. Stripped BEFORE
    # the extension is read, so effect-registry.ts.bak-1785689940120 normalises
    # to extension .ts and joins the family of effect-registry.ts
    if ($work -match '\.bak(-.*)?$') {
        $isBak = $true
        $bakText = $Matches[0]
        $work = $work -replace '\.bak(-.*)?$', ''
    }

    # v3 -- NormName is the name with any .bak suffix removed. The family key's
    # category is read off this, so foo.html.bak-123 categorises as HTML-Mockup
    # like foo.html instead of falling through to 'Other' and splitting the
    # family it belongs to.
    $normName = $work

    $normExt = [System.IO.Path]::GetExtension($work).ToLower()
    $stem = [System.IO.Path]::GetFileNameWithoutExtension($work)

    # v3 -- the stem marker is now stripped even on a .bak, so foo-v2.js.bak
    # joins foo-v2.js rather than forming a family of its own and reporting as
    # an orphan. The bak classification still wins for the MarkerKind, because
    # "this is a backup" is the stronger statement about the file.

    # Derivative marker 2 -- Windows duplicate suffix " - Copy" / " - Copy (2)".
    # A space is REQUIRED after the dash, which is how Windows writes it. Without
    # that, "-copy" at the end of an ordinary name matched and
    # patch-purchase-collection-copy.py -- a patch script about marketing copy,
    # the noun -- was read as a duplicate of a file that never existed.
    # Rejects: build_s95_curator_copy.py, patch-copy-pass-r2.py,
    #          patch-purchase-collection-copy.py
    # Accepts: "validate-prodigi-skus - Copy.js", "woman asdczv- Copy.jpg"
    if ($stem -match '(?i)\s*-\s+copy(\s*\((\d+)\))?$') {
        $markerKind = 'copy'
        $markerText = $Matches[0]
        $markerRank = if ($Matches[2]) { [int]$Matches[2] } else { 1 }
        $stem = $stem -replace '(?i)\s*-\s+copy(\s*\((\d+)\))?$', ''
    }
    # Sequence marker 1 -- trailing parenthesised number: download (3)
    elseif ($stem -match '\s*\((\d+)\)$') {
        $markerKind = 'paren'
        $markerText = $Matches[0]
        $markerRank = [int]$Matches[1]
        $stem = $stem -replace '\s*\((\d+)\)$', ''
    }
    # Sequence marker 2 -- separator + v + digits: -v2, _V3, -V001
    elseif ($stem -match '(?i)[-_. ]v(\d+)$') {
        $markerKind = 'v'
        $markerText = $Matches[0]
        $markerRank = [int]$Matches[1]
        $stem = $stem -replace '(?i)[-_. ]v(\d+)$', ''
    }

    if ($isBak) {
        $markerText = $markerText + $bakText
        $markerKind = 'bak'
        $markerRank = 0
    }

    return [PSCustomObject]@{
        Stem         = $stem.ToLower()
        NormExt      = $normExt
        NormName     = $normName
        MarkerKind   = $markerKind
        MarkerRank   = $markerRank
        MarkerText   = $markerText
        IsDerivative = ($markerKind -eq 'bak' -or $markerKind -eq 'copy')
        IsGroupable  = $true
    }
}

# ---- Pruned recursive walker ----
function Get-FilesPruned {
    param(
        [string]$Path,
        [string[]]$ExcludeDirPatterns,
        [string[]]$ExcludeFileNamePatterns
    )

    $stack = New-Object System.Collections.Generic.Stack[string]
    $stack.Push($Path)

    while ($stack.Count -gt 0) {
        $current = $stack.Pop()

        $subDirs = $null
        $files = $null
        try { $subDirs = [System.IO.Directory]::GetDirectories($current) } catch { continue }
        try { $files = [System.IO.Directory]::GetFiles($current) } catch { }

        if ($files) {
            foreach ($f in $files) {
                $fname = Split-Path $f -Leaf
                $skipFile = $false
                foreach ($pat in $ExcludeFileNamePatterns) {
                    if ($fname -match $pat) { $skipFile = $true; break }
                }
                if ($skipFile) { continue }
                $item = Get-Item -LiteralPath $f -ErrorAction SilentlyContinue
                # hidden entries (worktree .git pointers, desktop.ini) come back
                # null without -Force; skip them quietly rather than erroring
                if ($null -ne $item) { Write-Output $item }
            }
        }

        foreach ($dir in $subDirs) {
            $dirName = Split-Path $dir -Leaf
            $skipDir = $false
            foreach ($pat in $ExcludeDirPatterns) {
                if ($dirName -match $pat) { $skipDir = $true; break }
            }
            if (-not $skipDir) { $stack.Push($dir) }
        }
    }
}

# ---- Scan ----
$allFiles = @()
foreach ($root in $roots) {
    # Confirm it's a real git repo before trusting it as project content
    $isRepo = $false
    if (Test-Path (Join-Path $root ".git")) { $isRepo = $true }
    if (-not $isRepo -and $root -ne "D:\minramas") {
        Write-Warning "Skipping (not a git repo): $root"
        continue
    }

    $found = Get-FilesPruned -Path $root -ExcludeDirPatterns $excludeDirPatterns -ExcludeFileNamePatterns $excludeFileNamePatterns
    foreach ($f in $found) { $allFiles += $f }
}

# ---- Build rows ----
$rows = New-Object System.Collections.ArrayList
$now = Get-Date
foreach ($file in $allFiles) {
    $nameLower = $file.Name.ToLower()
    $pathLower = $file.FullName.ToLower()
    $category = Get-Category -pathLower $pathLower -nameLower $nameLower

    $parts = Get-NameParts -Name $file.Name
    $folder = Split-Path $file.FullName -Parent

    # v3 -- the key's category comes off the .bak-stripped name; the Category
    # column above still reports the original name's category so the counts
    # stay comparable with v1 and v2
    $keyCategory = Get-Category -pathLower (Join-Path $folder $parts.NormName).ToLower() `
        -nameLower $parts.NormName.ToLower()

    # RULE 1 -- family key carries the extension. RULE 4 -- ungroupable files
    # get a key unique to themselves so they can never pair with anything.
    $familyKey = if ($parts.IsGroupable) {
        "$folder|$($parts.Stem)|$($parts.NormExt)|$keyCategory"
    } else {
        "UNGROUPED|$($file.FullName)"
    }

    [void]$rows.Add([PSCustomObject]@{
        FullPath              = $file.FullName
        FileName              = $file.Name
        Extension             = $file.Extension
        NormalizedExt         = $parts.NormExt
        SizeKB                = [math]::Round($file.Length / 1KB, 1)
        LastWriteTime         = $file.LastWriteTime
        DaysSinceUpdate       = [math]::Round(($now - $file.LastWriteTime).TotalDays, 0)
        Category              = $category
        FamilyGuess           = $parts.Stem
        FamilyKey             = $familyKey
        MarkerKind            = $parts.MarkerKind
        MarkerRank            = $parts.MarkerRank
        MarkerText            = $parts.MarkerText
        FolderPath            = $folder
        SiblingMtimeIdentical = $false
        IsStaleByAge          = $false
        IsSuperseded          = $false
        IsUnresolved          = $false
        UnresolvedReason      = ""
        SupersededBy          = ""
        ProposedAction        = ""
    })
}

# ---- Flag stale by age ----
$cutoff = $now.AddDays(-$staleDaysThreshold)
foreach ($row in $rows) {
    if ($row.LastWriteTime -lt $cutoff) { $row.IsStaleByAge = $true }
}

# ---- v2 · Resolve each family ----
function Set-Unresolved {
    param($Members, [string]$Reason)
    foreach ($m in $Members) {
        $m.IsUnresolved = $true
        $m.UnresolvedReason = $Reason
    }
}

$orphanReason = "orphaned derivative, original not found alongside it"

$groups = $rows | Where-Object { $_.FamilyKey -notlike 'UNGROUPED|*' } | Group-Object FamilyKey
foreach ($g in $groups) {
    $members = @($g.Group)

    $derivative = @($members | Where-Object { $_.MarkerKind -eq 'bak' -or $_.MarkerKind -eq 'copy' })
    $base       = @($members | Where-Object { $_.MarkerKind -ne 'bak' -and $_.MarkerKind -ne 'copy' })

    # v3 -- RULE 1 of this pass. A lone " - Copy" or .bak whose original is
    # gone is not "active", it is a loose end. v2 skipped single-member
    # families before this check ran and left them KEEP.
    if ($members.Count -eq 1) {
        if ($derivative.Count -eq 1) {
            Set-Unresolved -Members $derivative -Reason $orphanReason
        }
        continue
    }

    # record (do not act on) shared-timestamp families
    if (($members | Select-Object -ExpandProperty LastWriteTime -Unique).Count -eq 1) {
        foreach ($m in $members) { $m.SiblingMtimeIdentical = $true }
    }

    # -- derivative markers: the marked file is by definition the redundant one
    if ($derivative.Count -gt 0) {
        if ($base.Count -gt 0) {
            $baseName = ($base | Sort-Object FileName | Select-Object -First 1).FileName
            foreach ($d in $derivative) {
                $d.IsSuperseded = $true
                $d.SupersededBy = $baseName
            }
        } else {
            # every member is a backup or a copy -- the original is gone from
            # this folder, so there is nothing here to supersede them
            Set-Unresolved -Members $derivative -Reason $orphanReason
        }
    }

    # -- remaining (non-derivative) members ordered by sequence marker only
    if ($base.Count -le 1) { continue }

    $marked = @($base | Where-Object { $_.MarkerKind -ne '' })
    $plain  = @($base | Where-Object { $_.MarkerKind -eq '' })

    if ($marked.Count -eq 0) {
        # RULE 2 -- no explicit marker anywhere: never superseded
        continue
    }

    if ($plain.Count -gt 0) {
        # plain name vs stamped sibling -- direction is not decidable here
        Set-Unresolved -Members $base -Reason "plain filename alongside version-stamped sibling; direction ambiguous"
        continue
    }

    $kinds = @($marked | Select-Object -ExpandProperty MarkerKind -Unique)
    if ($kinds.Count -gt 1) {
        Set-Unresolved -Members $base -Reason "mixed marker kinds ($($kinds -join ', ')); not comparable"
        continue
    }

    $maxRank = ($marked | Measure-Object -Property MarkerRank -Maximum).Maximum
    $top = @($marked | Where-Object { $_.MarkerRank -eq $maxRank })
    if ($top.Count -gt 1) {
        # RULE 3 -- would require an mtime tiebreak; refuse to guess
        Set-Unresolved -Members $base -Reason "two or more members share the highest version marker"
        continue
    }

    foreach ($m in $marked) {
        if ($m.MarkerRank -lt $maxRank) {
            $m.IsSuperseded = $true
            $m.SupersededBy = $top[0].FileName
        }
    }
}

# ---- Set ProposedAction ----
foreach ($row in $rows) {
    if ($row.IsSuperseded) {
        $row.ProposedAction = "MOVE - superseded by $($row.SupersededBy)"
    } elseif ($row.IsUnresolved) {
        $row.ProposedAction = "UNRESOLVED - $($row.UnresolvedReason)"
    } elseif ($row.IsStaleByAge) {
        $row.ProposedAction = "REVIEW - stale ($($row.DaysSinceUpdate) days, no newer version found)"
    } else {
        $row.ProposedAction = "KEEP - active"
    }
}

$rows | Sort-Object Category, FolderPath, FamilyGuess, LastWriteTime -Descending |
    Select-Object FullPath, FileName, Extension, NormalizedExt, SizeKB, LastWriteTime, `
        DaysSinceUpdate, Category, FamilyGuess, FamilyKey, MarkerKind, MarkerRank, `
        MarkerText, SiblingMtimeIdentical, IsStaleByAge, IsSuperseded, IsUnresolved, `
        UnresolvedReason, SupersededBy, ProposedAction |
    Export-Csv -Path $outFile -NoTypeInformation -Encoding UTF8

Write-Host ""
Write-Host "Manifest written: $outFile"
Write-Host "Total project files: $($rows.Count)"
Write-Host "Flagged MOVE (superseded): $(($rows | Where-Object IsSuperseded).Count)"
Write-Host "Flagged UNRESOLVED: $(($rows | Where-Object IsUnresolved).Count)"
Write-Host "  of which orphaned derivatives (new in v3): $(($rows | Where-Object { $_.UnresolvedReason -eq $orphanReason }).Count)"
Write-Host "Flagged REVIEW (stale, no newer version): $(($rows | Where-Object { $_.IsStaleByAge -and -not $_.IsSuperseded -and -not $_.IsUnresolved }).Count)"
Write-Host ""
Write-Host "By category:"
$rows | Group-Object Category | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Name): $($_.Count)"
}

Write-Host ""
Write-Host "MOVE-flagged families:"
$rows | Where-Object IsSuperseded | Group-Object FamilyKey | ForEach-Object {
    $first = $_.Group[0]
    Write-Host "  $($first.FolderPath)  [$($first.FamilyGuess)$($first.NormalizedExt)]"
    foreach ($m in ($_.Group | Sort-Object FileName)) {
        $mt = if ($m.SiblingMtimeIdentical) { "  [same-mtime]" } else { "" }
        Write-Host "      MOVE $($m.FileName)  -> superseded by $($m.SupersededBy)$mt"
    }
}

Write-Host ""
Write-Host "Orphaned derivatives (UNRESOLVED, new in v3):"
$rows | Where-Object { $_.UnresolvedReason -eq $orphanReason } | Sort-Object FullPath | ForEach-Object {
    Write-Host "  $($_.FullPath)"
}

Write-Host ""
Write-Host "UNRESOLVED reasons:"
$rows | Where-Object IsUnresolved | Group-Object UnresolvedReason | Sort-Object Count -Descending | ForEach-Object {
    Write-Host "  $($_.Count) x $($_.Name)"
}
