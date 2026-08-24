# Sweep-Repo-Liten.ps1
# CUI 41A - 24 August 2026
#
# Archives dead work product out of the repo root and public\ into H:,
# via Invoke-TrackedMove so every move lands in the FileActions log.
# NOTHING is deleted. Everything can be put back by reversing the path.
#
# TWO TIERS:
#   Tier 1  provably dead. Old builds, test shots, logs, stale zips,
#           carryovers, scripts whose job finished weeks ago, and public
#           pages referenced by nothing. Moved by -Apply.
#   Tier 2  probably dead but another lane may disagree: batch inputs,
#           bench folders, future-Series pages (houses, landscapes...),
#           CUI 42's wallpaper surfaces, stripe.exe. Moved ONLY by
#           -Apply -IncludeTier2, after the lanes have seen the list.
#
# Usage:
#   ...\Sweep-Repo-Liten.ps1                      dry run, both tiers listed
#   ...\Sweep-Repo-Liten.ps1 -Apply               moves Tier 1 only
#   ...\Sweep-Repo-Liten.ps1 -Apply -IncludeTier2 moves both

param(
  [switch]$Apply,
  [switch]$IncludeTier2
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\FileOps-Tracker.ps1"

$repo = Split-Path $PSScriptRoot -Parent
$dest = 'H:\NO_DELETE_ARCHIVE\Repo-Sweep-2026-08-24'

if (-not (Test-Path 'H:\')) {
  Write-Host 'REFUSED: H: is not mounted. Nothing moved.' -ForegroundColor Red
  exit 1
}

# ---- TIER 1 : PROVABLY DEAD -----------------------------------------
# Root: test shots, render dumps, logs, finished one-shot scripts,
# stale zips and working copies, old carryovers, root html orphans.
# public\: pages referenced by nothing (checked against the live rooms:
# portraits.css / .ui.js / .wizard.js have no referrers; the -b2 and
# _recover2 builds and the accordion mockups are superseded).
$tier1 = @(
  'test-ebony.jpg','test-ebony-2.jpg','test-folded_book.jpg',
  'test-impressionist.jpg','test-victorian.jpg','test-victorian-woman.jpg',
  'test.html',
  'render-out.json','render-out2.json','render-vic.json','render-vicw.json',
  'deploy-error.log','redeploy.log',
  'plates.zip','_petmash.zip','studio-pair.zip',
  'portraits-bodies.WORKING.ts','_bodies-v24.ts',
  'CENG-CARRYOVER-2026-08-01-ADDENDUM-B.md',
  'CENG-CARRYOVER-2026-08-01-V23.md',
  'CENG-CARRYOVER-2026-08-02-ADDENDUM-C.md',
  'bodies-changed.md','BOOT-REPORT.md',
  'litenco-asset-manifest-2026-07-07.md',
  'homepage-light.html','printshop_august.html',
  'littenco_gate_standalone.html','gallery.html',
  'rename-pass2.ps1','rename-plates.ps1','rename-poses.ps1','rename-silos.ps1',
  'detect-gender.csv','detect-gender.js','make-ladders.js',
  'shoot-jobs.json','shoot-plates.js','shoot-review.js','shoot-silos.js',
  'silo-jobs.json','review-jobs.json','review-jobs.PROPOSED.json',
  'plate-audit.csv','plate-audit.ps1',
  'plates-for-subject-style-refs.csv','plates-for-subject.js',
  'locked-2026-08-01.json','pets-silos-2026-08-02.json','silos-2026-08-02.json',
  'repo-tree.txt','preview-files.txt','_preview-names.txt',
  'build_printshop_r17.py','portraits-multiface-test.ps1',
  'public\portraits-b2.html','public\portraits_recover2.html',
  'public\portraits.css','public\portraits.ui.js','public\portraits.wizard.js',
  'public\studio-accordion-mockup.html',
  'public\studio-accordion-mockup - Copy.html',
  'public\liten-prompt-bench-v3.html','public\groups-testbench.html',
  'public\print-config.html'
)

# ---- TIER 2 : ANOTHER LANE MAY OBJECT -------------------------------
# Folders that look like batch inputs or bench harnesses a lane may
# still read, future-Series pages that are out of scope but are the
# only copies of that work in the repo, and CUI 42's wallpaper surfaces.
# Also stripe.exe, which may be doing webhook forwarding.
$tier2 = @(
  '_verify-DELETE-ME','_plates-tmp','_scratch','_testpool',
  '_test_source_aug3','_petmash','_calibration','_review',
  '_route-collection','_route_upload',
  'multiface-pilot-out','portrait-batch','preview-matrix',
  'preview-sources','source-pool','source-pool-multiface',
  'LitenBench','bench-configs','bench-reports',
  'Prototype Files','payload',
  'stripe.exe','style-refs-index.json','run-gate.js','FILE-DOCS.ps1',
  'public\houses.html','public\landscapes.html','public\actionmini.html',
  'public\sportsmem.html','public\interiors.html',
  'public\pet-wallpaper.html','public\portrait-wallpaper.html',
  'public\wallpaper-studio.html','public\wallpaper-studio-V001.html',
  'public\New folder'
)
# NOT LISTED ON PURPOSE: every *-registry.js (live), concierge.js and
# track.js (live), general-filenames.txt and halloween-filenames.txt
# (written today, CUI 42's), wallpaper-batch (CUI 42), wallpaper-studio-V002
# and wallpaper-store.html (CUI 42, modified today), archive\ and _archive\
# and _recovery\ (already archives), middleware.ts and every config file.

function Move-Set([string[]]$names, [string]$label) {
  $moved = 0; $absent = 0
  Write-Host ''
  Write-Host ("-- $label --") -ForegroundColor Cyan
  foreach ($name in $names) {
    $src = Join-Path $repo $name
    if (-not (Test-Path $src)) { $absent++; continue }
    $to = Join-Path $dest $name
    if ($Apply) {
      $parent = Split-Path $to -Parent
      if (-not (Test-Path $parent)) { New-Item -ItemType Directory -Path $parent -Force | Out-Null }
      Invoke-TrackedMove -Source $src -Destination $to -Note ("Repo sweep " + $label)
      Write-Host ("  moved      " + $name) -ForegroundColor Green
    } else {
      Write-Host ("  would move " + $name)
    }
    $moved++
  }
  Write-Host ("  {0} item(s), {1} already absent." -f $moved, $absent)
  return $moved
}

Write-Host ''
Write-Host ("mode  " + ($(if ($Apply) { 'APPLY' } else { 'DRY RUN' })) + ($(if ($IncludeTier2) { ' + TIER 2' } else { '' }))) -ForegroundColor Cyan
Write-Host ("repo  $repo")
Write-Host ("to    $dest")

$n1 = Move-Set $tier1 'Tier 1: provably dead'
if ($IncludeTier2) {
  $n2 = Move-Set $tier2 'Tier 2: needs lane sign-off'
} else {
  Write-Host ''
  Write-Host '-- Tier 2 (NOT moved; -IncludeTier2 after the lanes have seen it) --' -ForegroundColor Yellow
  $tier2 | ForEach-Object { Write-Host ("  held       " + $_) -ForegroundColor DarkGray }
}

Write-Host ''
if (-not $Apply) { Write-Host 'Dry run. Re-run with -Apply to move Tier 1.' -ForegroundColor Yellow }
