# FILE-DOCS.ps1 - build the docs structure and sort what exists
# Liten and Co - 2026-07-27 - rev2
#
# rev2 fix: PowerShell hash keys are case-insensitive, so 'CARRYOVER-*.md' and
# 'carryover-*.md' collided; that parse failure cascaded into the brace errors.
# Now an array of pairs - key collisions are impossible.
#
# Safe: creates folders, MOVES files it finds, reports what it didn't.
# Nothing is deleted.
#
#   cd D:\minramas
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
#   Unblock-File .\FILE-DOCS.ps1
#   .\FILE-DOCS.ps1

$root  = (Get-Location).Path
$stamp = '2026-07-27'
$arch  = "archive\$stamp"

Write-Host ''
Write-Host '=== Liten and Co - docs restructure ===' -ForegroundColor Cyan
Write-Host "root: $root"
Write-Host ''

# ---- 1. Structure ---------------------------------------------
$folders = @(
  'docs\GOVERNANCE',
  'docs\SYSTEM',
  'docs\CONTENT',
  'docs\SURFACES\portraits',
  'docs\SURFACES\print-shop',
  'docs\SURFACES\account',
  'docs\SURFACES\masthead',
  'docs\SURFACES\entry-gate',
  'docs\SURFACES\wallpapers',
  $arch
)

foreach ($f in $folders) {
  if (Test-Path $f) {
    Write-Host "  exists   $f" -ForegroundColor DarkGray
  }
  else {
    New-Item -ItemType Directory -Path $f -Force | Out-Null
    Write-Host "  created  $f" -ForegroundColor Green
  }
}

# ---- 2. Placement map (array of pairs, not a hashtable) -------
$moves = @(
  @{ P = 'LOCKED-DECISIONS-2026-07-27.md';              D = 'docs\GOVERNANCE' },
  @{ P = 'PROCEDURES-AND-LANES-2026-07-27.md';          D = 'docs\GOVERNANCE' },
  @{ P = 'LIVE-FILE-LEDGER.md';                         D = 'docs\GOVERNANCE' },
  @{ P = 'CLAW-STATUS.md';                              D = 'docs\GOVERNANCE' },
  @{ P = '_PRODUCTION-BIBLE.md';                        D = 'docs\GOVERNANCE' },
  @{ P = 'MASTER-LOCKED-ELEMENTS*.md';                  D = 'docs\GOVERNANCE' },

  @{ P = 'CREDITS-AND-CODES-SPEC-v4.md';                D = 'docs\SYSTEM' },
  @{ P = 'PORTRAITS-ENGINE-INVENTORY-v3*.md';           D = 'docs\SYSTEM' },
  @{ P = 'PROJECT-KNOWLEDGE-TRIAGE*.md';                D = 'docs\SYSTEM' },
  @{ P = 'MIGRATION-NOTES.md';                          D = 'docs\SYSTEM' },
  @{ P = 'RESOLUTION-GATE-NOTES.md';                    D = 'docs\SYSTEM' },
  @{ P = 'liten-qa-log-wiring-v1.md';                   D = 'docs\SYSTEM' },
  @{ P = 'liten-test-bench-spec-v1.md';                 D = 'docs\SYSTEM' },
  @{ P = 'engine-sync-checkout-preview.md';             D = 'docs\SYSTEM' },

  @{ P = 'liten-action-prompt-system-v1.md';            D = 'docs\CONTENT' },
  @{ P = 'liten-action-v7-spec.md';                     D = 'docs\CONTENT' },
  @{ P = 'liten-face-swap-process-v1.md';               D = 'docs\CONTENT' },
  @{ P = 'Curator_Core_*.md';                           D = 'docs\CONTENT' },

  @{ P = 'PORTRAITS-HOOK-CONTRACT-v1.md';               D = 'docs\SURFACES\portraits' },
  @{ P = 'litenco-portraits-2026-07-24-r81.html';       D = 'docs\SURFACES\portraits' },
  @{ P = 'litenco-portraits-2026-07-24-r80d.html';      D = 'docs\SURFACES\portraits' },
  @{ P = 'PRINTSHOP-HOOK-CONTRACT-v3.md';               D = 'docs\SURFACES\print-shop' },
  @{ P = 'litenco-printshop-2026-07-24-r28.html';       D = 'docs\SURFACES\print-shop' },
  @{ P = 'CLAW-TICKET-PRINTSHOP-PRODUCTS*.md';          D = 'docs\SURFACES\print-shop' },
  @{ P = 'litenco-account-2026-07-24-r7.html';          D = 'docs\SURFACES\account' },
  @{ P = 'MASTHEAD-DIRECTIVE-v1.md';                    D = 'docs\SURFACES\masthead' },
  @{ P = 'litenco-masthead-2026-07-24-r2.html';         D = 'docs\SURFACES\masthead' },
  @{ P = 'litenco-entrygate-2026-07-24-r1.html';        D = 'docs\SURFACES\entry-gate' },

  @{ P = 'CREDITS-MODEL-v1*.md';                        D = $arch },
  @{ P = 'PHILOSOPHY-v2-AMENDMENT*.md';                 D = $arch },
  @{ P = 'PORTRAITS-TAXONOMY-v1*.md';                   D = $arch },
  @{ P = 'CURATOR-FLOW-v1*.md';                         D = $arch },
  @{ P = 'seam-tracker.md';                             D = $arch },
  @{ P = 'CREDITS-AND-CODES-SPEC-v3.md';                D = $arch },
  @{ P = 'PRINTSHOP-HOOK-CONTRACT-v1.md';               D = $arch },
  @{ P = 'PRINTSHOP-HOOK-CONTRACT-v2-ADDENDUM.md';      D = $arch },
  @{ P = 'DECISION-LIST-2026-07-27.md';                 D = $arch },
  @{ P = 'portraits.next.html';                         D = $arch },
  @{ P = 'portraits_old.html';                          D = $arch },
  @{ P = 'portraits_recover1.html';                     D = $arch },
  @{ P = 'litenco-portraits-2026-07-24-r82-BENCH.html'; D = $arch },
  @{ P = 'portraits-2026-07-16-r42.html';               D = $arch },
  @{ P = 'portraits-2026-07-16-r76.html';               D = $arch },
  @{ P = 'carryover*.md';                               D = $arch },
  @{ P = 'minirama-*.md';                               D = $arch },
  @{ P = 'liten-workshop-carryover*.md';                D = $arch },
  @{ P = 'ui-claude-carryover.md';                      D = $arch },
  @{ P = 'qa-claude-carryover.md';                      D = $arch },
  @{ P = 'portrait-engine-briefing*.md';                D = $arch }
)

# ---- 3. Move --------------------------------------------------
$moved   = 0
$skipped = 0
$missing = @()

foreach ($m in $moves) {
  $pattern  = $m.P
  $dest     = $m.D
  $destFull = Join-Path $root $dest

  $found = Get-ChildItem -Path $root -Recurse -File -Filter $pattern -ErrorAction SilentlyContinue
  $hits  = @()
  foreach ($item in $found) {
    if ($item.FullName -like '*\node_modules\*') { continue }
    if ($item.FullName -like '*\.git\*')         { continue }
    if ($item.FullName -like '*\archive\*')      { continue }
    if ($item.DirectoryName -eq $destFull)       { continue }
    $hits += $item
  }

  if ($hits.Count -eq 0) {
    $missing += $pattern
  }
  else {
    foreach ($h in $hits) {
      $target = Join-Path $dest $h.Name
      if (Test-Path $target) {
        Write-Host "  SKIP     $($h.Name) - already in $dest" -ForegroundColor Yellow
        $skipped = $skipped + 1
      }
      else {
        Move-Item -LiteralPath $h.FullName -Destination $target
        Write-Host "  moved    $($h.Name)  ->  $dest" -ForegroundColor Green
        $moved = $moved + 1
      }
    }
  }
}

# ---- 4. Report ------------------------------------------------
Write-Host ''
Write-Host "--- moved: $moved   skipped: $skipped ---" -ForegroundColor Cyan

if ($missing.Count -gt 0) {
  Write-Host ''
  Write-Host 'not found in repo (expected for anything still in chat or project knowledge):' -ForegroundColor DarkYellow
  foreach ($x in $missing) { Write-Host "  $x" -ForegroundColor DarkGray }
}

Write-Host ''
Write-Host '--- resulting structure ---' -ForegroundColor Cyan
$docFiles = Get-ChildItem docs -Recurse -File -ErrorAction SilentlyContinue
if ($docFiles) {
  $groups = $docFiles | Group-Object DirectoryName
  foreach ($g in $groups) {
    $rel = $g.Name.Replace("$root\", '')
    Write-Host ''
    Write-Host $rel -ForegroundColor White
    foreach ($file in $g.Group) { Write-Host "  $($file.Name)" -ForegroundColor Gray }
  }
}

$arcFiles = Get-ChildItem $arch -File -ErrorAction SilentlyContinue
$arcCount = 0
if ($arcFiles) { $arcCount = $arcFiles.Count }
Write-Host ''
Write-Host "$arch  ($arcCount files)" -ForegroundColor White

Write-Host ''
Write-Host 'Done. Nothing deleted. Review, then:' -ForegroundColor Cyan
Write-Host '  git add -A'
Write-Host '  git commit -m "docs: restructure + archive"'
Write-Host ''
