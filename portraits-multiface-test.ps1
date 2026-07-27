<#
  portraits-multiface-test.ps1
  Validate 2-3 person Portraits across every effect BEFORE committing engine work.

  What it does:
    Phase 1 - NB2 (via your raw-pipeline route) renders 20 source photos from a seed image + prompts.
    Phase 2 - runs each source through every Portraits preset (effect) via your local /generate route.
    Output  - saves renders + a results.csv you can read to see which age/face combos survive which effects.

  Prereqs:
    - Dev server running:  npm run dev   (BASE_URL below points at it)
    - $env:REPLICATE_API_TOKEN set (your engine calls NB2)
    - a seed image at $SEED_IMAGE (NB2 is image-conditioned)
  Run a PILOT first (few sources, few presets) before the full 340-render sweep -- see CONFIG.
#>

# ============================ CONFIG ============================
$SEED_IMAGE   = "D:\minramas\test\seed.png"   # NB2 is image-conditioned; it needs a starter image + the prompt
$BASE_URL     = "http://localhost:3000"
$OUT          = "D:\minramas\test\multiface"
$SRC_DIR      = Join-Path $OUT "sources"
$REN_DIR      = Join-Path $OUT "renders"
$RESULTS_CSV  = Join-Path $OUT "results.csv"
$SCALE        = "close_up"          # portraits default
$ASPECT       = "3:4"            # portraits bust frame (raw-pipeline default)

# PILOT controls -- run small first. 0 = no limit (full sweep).
$MAX_SOURCES  = 3                   # e.g. 3 for a pilot; set 0 for all 20
$PRESET_SUBSET = @("bronze","walnut","impressionist","charcoal_chalk")   # @() = all presets

# >>> VERIFY THIS against portraits-presets.ts / STYLE_PIPELINE before a full run <<<
# Each effect must be sent with its correct style_id (realistic | people_resolving | artists_gallery).
# NOTE: "people_resolving" may be exactly the multi-face path -- if so, that's the important one to watch.
$PRESET_STYLE = @{
  bronze="realistic"; iron="realistic"; alabaster="realistic"; stone="realistic";
  ebony="realistic"; walnut="realistic"; plushy="realistic"; pewter="realistic";
  chocolate="realistic"; driftwood_resin="realistic";
  impressionist="artists_gallery"; torn_paper="artists_gallery"; folded_book="artists_gallery";
  charcoal_chalk="artists_gallery"; pencil_sketch="artists_gallery"; sheet_music="artists_gallery";
  stained_glass="artists_gallery"
}
# ===============================================================

# ---- 20 source prompts: 2-3 people, varied ages, half professional / half candid ----
# Wholesome, clothed, ordinary family-and-friends photography. Clear faces (the effects need them).
$SOURCES = @(
  @{ id="01_3adults_pro";        demo="3 adults";                style="professional"; prompt="Professional studio portrait of three adults standing together, warm smiles, clean neutral backdrop, soft studio lighting, upper body, sharp focus on all faces, realistic photography, fully clothed" },
  @{ id="02_3adults_candid";     demo="3 adults";                style="candid";       prompt="Candid outdoor photo of three adult friends laughing together in a park, natural daylight, upper body, faces clearly visible, realistic snapshot, fully clothed" },
  @{ id="03_3teens_candid";      demo="3 teens";                 style="candid";       prompt="Candid photo of three teenagers hanging out on a sunny street, natural light, upper body, clear faces, realistic snapshot, fully clothed, wholesome" },
  @{ id="04_3teens_pro";         demo="3 teens";                 style="professional"; prompt="Professional group portrait of three teenagers, neutral studio backdrop, soft lighting, upper body, all faces sharp, realistic photography, fully clothed" },
  @{ id="05_child_2adults_candid"; demo="1 child + 2 adults";    style="candid";       prompt="Candid family photo of two parents and their young child (about 6) at the kitchen table, warm natural light, faces clearly visible, realistic snapshot, fully clothed, wholesome" },
  @{ id="06_child_2adults_pro";  demo="1 child + 2 adults";      style="professional"; prompt="Professional family portrait of two parents and a child (about 8), neutral backdrop, soft studio lighting, upper body, all faces sharp, realistic photography, fully clothed" },
  @{ id="07_2kids_1adult_candid"; demo="2 children + 1 adult";   style="candid";       prompt="Candid photo of one parent with two children (about 5 and 9) in a backyard, natural daylight, faces clearly visible, realistic family snapshot, fully clothed, wholesome" },
  @{ id="08_2kids_1adult_pro";   demo="2 children + 1 adult";    style="professional"; prompt="Professional portrait of one parent and two young children (a toddler and a child about 7), neutral studio backdrop, soft lighting, all faces sharp, realistic photography, fully clothed" },
  @{ id="09_couple_pro";         demo="2 adults";                style="professional"; prompt="Professional studio portrait of an adult couple side by side, warm smiles, neutral backdrop, soft lighting, upper body, both faces sharp, realistic photography, fully clothed" },
  @{ id="10_2adults_candid";     demo="2 adults";                style="candid";       prompt="Candid photo of two adult friends on a cafe patio, natural light, upper body, clear faces, realistic snapshot, fully clothed" },
  @{ id="11_2teens_candid";      demo="2 teens";                 style="candid";       prompt="Candid photo of two teenage friends smiling outdoors, natural daylight, upper body, faces clearly visible, realistic snapshot, fully clothed, wholesome" },
  @{ id="12_adult_teen_candid";  demo="1 adult + 1 teen";        style="candid";       prompt="Candid photo of a parent and their teenager together outdoors, natural light, upper body, both faces clear, realistic family snapshot, fully clothed" },
  @{ id="13_adult_child_pro";    demo="1 adult + 1 child";       style="professional"; prompt="Professional portrait of a parent holding a young child (about 4), neutral studio backdrop, soft lighting, both faces sharp, realistic photography, fully clothed, wholesome" },
  @{ id="14_adult_toddler_candid"; demo="1 adult + 1 toddler";   style="candid";       prompt="Candid photo of a parent and a toddler at home by a window, warm natural light, both faces clearly visible, realistic family snapshot, fully clothed, wholesome" },
  @{ id="15_3adults_mixedage_pro"; demo="3 adults mixed ages";   style="professional"; prompt="Professional portrait of three adults of different ages (young, middle-aged, senior), neutral backdrop, soft studio lighting, all faces sharp, realistic photography, fully clothed" },
  @{ id="16_2adults_senior_candid"; demo="2 adults + 1 senior";  style="candid";       prompt="Candid multigenerational photo of two adults with an elderly parent in a living room, warm natural light, faces clearly visible, realistic family snapshot, fully clothed" },
  @{ id="17_teen_2adults_candid"; demo="1 teen + 2 adults";      style="candid";       prompt="Candid family photo of two parents and their teenager outdoors, natural daylight, upper body, all faces clear, realistic snapshot, fully clothed" },
  @{ id="18_2seniors_pro";       demo="2 seniors";               style="professional"; prompt="Professional studio portrait of an elderly couple side by side, warm smiles, neutral backdrop, soft lighting, both faces sharp, realistic photography, fully clothed" },
  @{ id="19_3gen_candid";        demo="senior + adult + child";  style="candid";       prompt="Candid three-generation family photo of a grandparent, a parent, and a young child together at home, warm natural light, all faces clearly visible, realistic snapshot, fully clothed, wholesome" },
  @{ id="20_2adults_baby_pro";   demo="2 adults + baby";         style="professional"; prompt="Professional family portrait of two parents holding a baby, neutral studio backdrop, soft lighting, faces clearly visible, realistic photography, fully clothed, wholesome" }
)

# ---- setup ----
if (-not (Test-Path $SEED_IMAGE)) { Write-Host "SEED_IMAGE not found: $SEED_IMAGE  (NB2 needs a starter image)" -ForegroundColor Red; exit 1 }
$SEED_B64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($SEED_IMAGE))
New-Item -ItemType Directory -Force $SRC_DIR | Out-Null
New-Item -ItemType Directory -Force $REN_DIR | Out-Null
if (-not (Test-Path $RESULTS_CSV)) {
  "timestamp,source_id,demographic,src_style,preset,style_id,http_status,fidelity_score,fidelity_reason,output" | Set-Content $RESULTS_CSV
}

$srcList = if ($MAX_SOURCES -gt 0) { $SOURCES | Select-Object -First $MAX_SOURCES } else { $SOURCES }
$presets = if ($PRESET_SUBSET.Count -gt 0) { $PRESET_SUBSET } else { $PRESET_STYLE.Keys }

# ---------------- PHASE 1: source photos ----------------
Write-Host "`n=== PHASE 1: NB2 rendering $($srcList.Count) source photos (seed + prompt) ===" -ForegroundColor Cyan
foreach ($s in $srcList) {
  $path = Join-Path $SRC_DIR "$($s.id).png"
  if (Test-Path $path) { Write-Host "  $($s.id): exists, skip"; continue }
  try {
    $body = @{ source_image_b64=$SEED_B64; prompt=$s.prompt; aspect_ratio=$ASPECT } | ConvertTo-Json -Depth 4
    $resp = Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/v1/portraits/raw-pipeline" `
      -Headers @{ "Content-Type"="application/json" } -Body $body -TimeoutSec 180
    $b64 = $resp.image_b64
    if ($b64 -match ",") { $b64 = $b64.Split(",")[-1] }
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($b64))
    Write-Host "  $($s.id): OK ($($s.demo), $($s.style))" -ForegroundColor Green
  } catch {
    Write-Host "  $($s.id): SOURCE FAILED - $($_.Exception.Message)" -ForegroundColor Red
  }
}

# ---------------- PHASE 2: run every effect ----------------
Write-Host "`n=== PHASE 2: $($srcList.Count) sources x $($presets.Count) presets = $($srcList.Count * $presets.Count) renders ===" -ForegroundColor Cyan
foreach ($s in $srcList) {
  $srcPath = Join-Path $SRC_DIR "$($s.id).png"
  if (-not (Test-Path $srcPath)) { Write-Host "  skip $($s.id): no source"; continue }
  $srcB64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes($srcPath))
  $outDir = Join-Path $REN_DIR $s.id
  New-Item -ItemType Directory -Force $outDir | Out-Null

  foreach ($preset in $presets) {
    $style = $PRESET_STYLE[$preset]
    if (-not $style) { Write-Host "  ! no style mapped for '$preset' -- fix PRESET_STYLE" -ForegroundColor Yellow; continue }
    $status=""; $score=""; $reason=""; $outFile=""
    try {
      $payload = @{
        source_image_b64 = $srcB64        # raw base64; if your route wants a data URI, prefix "data:image/png;base64,"
        style_id         = $style
        preset_id        = $preset
        scale            = $SCALE
      } | ConvertTo-Json -Depth 4
      $r = Invoke-RestMethod -Method Post -Uri "$BASE_URL/api/v1/portraits/generate" `
        -Headers @{ "Content-Type"="application/json" } -Body $payload -TimeoutSec 300
      $status = "200"
      $score  = "$($r.fidelityScore)$($r.fidelity_score)"
      $reason = ("$($r.fidelityReason)$($r.fidelity_reason)" -replace '[\r\n,]',' ')
      # save whatever image field the route returns (adjust to your response shape)
      $imgB64 = $r.image_b64; $imgUrl = $r.image_url; if (-not $imgUrl) { $imgUrl = $r.imageUrl }
      $outFile = Join-Path $outDir "$preset.png"
      if ($imgB64) {
        if ($imgB64 -match ",") { $imgB64 = $imgB64.Split(",")[-1] }
        [IO.File]::WriteAllBytes($outFile, [Convert]::FromBase64String($imgB64))
      } elseif ($imgUrl) {
        Invoke-WebRequest -Uri $imgUrl -OutFile $outFile -TimeoutSec 120
      } else { $outFile = "(no image field in response)" }
      Write-Host "  $($s.id) x $preset : OK  fidelity=$score" -ForegroundColor Green
    } catch {
      $status = "ERR"; $reason = ($_.Exception.Message -replace '[\r\n,]',' ')
      Write-Host "  $($s.id) x $preset : FAIL - $reason" -ForegroundColor Red
    }
    "$(Get-Date -Format o),$($s.id),$($s.demo),$($s.style),$preset,$style,$status,$score,`"$reason`",`"$outFile`"" |
      Add-Content $RESULTS_CSV
  }
}

Write-Host "`nDone. Results: $RESULTS_CSV" -ForegroundColor Cyan
Write-Host "Read it to see which age/face combos pass which effects (fidelity_score) -- that's your 2-3 person go/no-go data." -ForegroundColor Cyan
