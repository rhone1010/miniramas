# archive-moves.ps1 — SUGGESTED. Read it before running it.
#
# Moves, never deletes. Set $ARCHIVE to the backup drive first.
# Everything remains in git history regardless.
#
# Generated 2026-08-06

$ARCHIVE = "E:\liten-archive"    # <-- set this
$STAMP   = Get-Date -Format "yyyy-MM-dd"
$DEST    = Join-Path $ARCHIVE $STAMP

if (-not (Test-Path $ARCHIVE)) { Write-Error "Archive drive not found: $ARCHIVE"; exit 1 }
New-Item -ItemType Directory -Force -Path "$DEST\public" | Out-Null

# ── superseded stage revisions ──────────────────────────────────────────
Move-Item "public\litenco-stage-2026-07-30-s72.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s73.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s74.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s75.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s76.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s77.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s78.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s79.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-07-31-s80.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s81.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s82.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s83.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s84.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s85.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s86.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s87.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s88.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s89.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s90.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-01-s91.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s92.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s93.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s94.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s95.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s96.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s97.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-02-s99.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s100.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s101.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s102.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s103.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s104.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s106.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s107.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s108.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s109.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s110.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s111.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s112.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s113.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s114 - Copy.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s114.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s115.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-03-s116.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s117.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s118.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s119.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s120.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s121.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s122.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s123.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-04-s124.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-05-s126.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-05-s127.html" "$DEST\public\" -Force
Move-Item "public\litenco-stage-2026-08-05-s128.html" "$DEST\public\" -Force

# ── series not in scope ─────────────────────────────────────────────────
# COMMENTED OUT. Groups returns one day and these are the folders it wants.
# Uncomment only what you are sure of, and run the audit again afterwards.
# Move-Item "lib\v1\houses" "$DEST\" -Force
# Move-Item "app\api\v1\houses" "$DEST\" -Force
# Move-Item "lib\v1\landscapes" "$DEST\" -Force
# Move-Item "app\api\v1\landscapes" "$DEST\" -Force
# Move-Item "lib\v1\sportsmem" "$DEST\" -Force
# Move-Item "app\api\v1\sportsmem" "$DEST\" -Force
# Move-Item "lib\v1\moments" "$DEST\" -Force
# Move-Item "app\api\v1\moments" "$DEST\" -Force

Write-Host "Moved to $DEST"
