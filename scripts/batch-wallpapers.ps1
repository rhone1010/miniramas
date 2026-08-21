<#
.SYNOPSIS
  Batch wallpaper generation for the Liten & Co Studio rooms.

.DESCRIPTION
  Builds Studio prompts from studio-vocab.json using the SAME assembly order
  as studio-round.ts, calls flux-schnell directly on Replicate, and uploads
  TWO files per image to Supabase Storage.

  This bypasses the app entirely. No dev server, no Vercel, no route. It also
  bypasses every guard the route provides -- credits, caps, the keep/pay flow.
  That is deliberate for an internal catalogue shoot and is the reason this
  script must never be pointed at a customer-facing path.

  -- THE MODEL STRING IS HARDCODED ------------------------------------------------------------
  flux-schnell is Apache-2.0 and sellable. flux-dev is NON-COMMERCIAL and one
  word away in the same namespace. Do not parameterise it, do not read it from
  env, do not add a -Model argument "for testing". See studio-generator.ts.

  -- ASSEMBLY ORDER MIRRORS studio-round.ts -------------------------------
  General   BASE, COMPOSITION, world, mood, energy, palette
  Halloween HW_BASE, COMPOSITION, world, mood, energy, palette, twist
  Composition sits near the front because a four-step model weights early
  tokens and the wallpaper-ness has to survive. Twist goes last.

  -- TWO FILES, AND THE REASON ------------------------------------------------------------

    clean/    full size, unmarked. The object being sold. PRIVATE.
    preview/  downscaled and watermarked. The only thing a browser sees.

  The preview is protected twice, because either protection alone fails:

  1. BURNED IN, NOT CSS. A CSS overlay draws over the file and does not
     change it -- the image URL is in the network tab and one click returns
     the clean original. studio-generator.ts already ruled this and the same
     ruling applies here.

  2. DOWNSCALED. The stronger of the two. A wallpaper has exactly one use,
     and a 480px-wide file upscaled onto a modern phone is mush. Somebody who
     defeats the mark still has nothing worth putting on a lock screen.

  The mark is faint on purpose. Somebody screenshots a preview and uses it
  anyway, and a watermarked wallpaper on a phone is an advertisement. This is
  not trying to make the preview useless -- the downscale does that. It is
  trying to make the clean one worth paying for.

  -- THE BUCKET MUST BE PRIVATE ------------------------------------------------------------
  Nothing here sets bucket policy. If `clean/` is readable without a signed
  URL then the watermark, the downscale and the credit spend are all theatre.
  Serve clean only through a signed URL with a spend behind it.

.EXAMPLE
  # See what would run and what it would cost. Nothing is called.
  .\batch-wallpapers.ps1 -Season general

.EXAMPLE
  # Actually run it.
  .\batch-wallpapers.ps1 -Season general -Write

.EXAMPLE
  # Three windows side by side, one third each.
  .\batch-wallpapers.ps1 -Season halloween -Write -Start 0   -End 213
  .\batch-wallpapers.ps1 -Season halloween -Write -Start 213 -End 426
  .\batch-wallpapers.ps1 -Season halloween -Write -Start 426 -End 640
#>

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('general', 'halloween')]
  [string] $Season,

  # DRY RUN BY DEFAULT. Nothing is generated, nothing is uploaded, nothing is
  # spent until -Write is passed. The plan and the cost print either way.
  [switch] $Write,

  # Images per World x Palette cell. Every cell is filled -- this is what makes
  # the catalogue evenly browsable rather than randomly clumped.
  #   general   8 worlds x 12 palettes x 6 = 576
  #   halloween 8 worlds x 10 palettes x 8 = 640
  [int] $PerCell = 0,

  # Index window into the built plan, for running several windows in parallel.
  [int] $Start = 0,
  [int] $End   = -1,

  # Changes every seed and therefore every image. Same value reproduces the
  # exact same run, which is how a single good frame gets regenerated.
  [int] $RunSeed = 20260818,

  [string] $EnvFile   = '.\.env.local',
  [string] $VocabFile = '.\scripts\studio-vocab.json',
  [string] $MarkFile  = '.\scripts\liten-mark-white.png',
  [string] $OutDir    = '.\wallpaper-batch',

  # Supabase destination. TWO buckets, because a bucket is public or private
  # as a whole and these two files need opposite answers.
  #
  #   PreviewBucket  PUBLIC read. Watermarked, downscaled, browsable.
  #   CleanBucket    PRIVATE. The object being sold. Signed URL only, with a
  #                  credit spend behind it. `previews` is reused because it
  #                  already holds exactly this shape of thing -- a finished
  #                  file paid for by nobody yet -- and its policies are
  #                  already right. A second private bucket is a second set
  #                  of policies to get wrong.
  #
  # If these two are ever pointed at the same bucket the script refuses to
  # run, because whichever answer that bucket gives, one of the two files is
  # wrong: either the product is public or the catalogue is invisible.
  [string] $PreviewBucket = 'wallpapers',
  [string] $CleanBucket   = 'previews',
  [string] $Prefix = '',

  # Preview width in pixels. The clean file is whatever flux returned
  # (768 wide at 1 megapixel), so 480 is a shade under two thirds.
  [int] $PreviewWidth = 480,

  # Internal shoots only. Uploads the preview unmarked.
  [switch] $NoWatermark,

  # Skip the upload and keep local files only.
  [switch] $LocalOnly,

  # Pause between predictions. Replicate has not needed it at this rate, but
  # it is here if a 429 ever appears.
  [int] $DelayMs = 0
)

# ---- tracking ---------------------------------------------------------------
# Every image this batch writes is registered to
# H:\NO_DELETE_ARCHIVE\Logs\FileActions_<date>.csv, wrapped in batch markers
# so a run of six hundred plates reads as one job.
#
# If H: is absent the tracker says so once and the shoot goes ahead
# untracked - an audit gap is preferable to losing a batch.
$TrackerPath = Join-Path $PSScriptRoot 'FileOps-Tracker.ps1'
if (Test-Path -LiteralPath $TrackerPath) {
  . $TrackerPath
} else {
  Write-Host "FileOps-Tracker.ps1 not found - this shoot will be UNTRACKED." -ForegroundColor Red
}

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# -- HARDCODED. SEE THE HEADER. --
$FLUX_URL = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'

$SYNC_WAIT_SECONDS = 60
$POLL_MAX_ATTEMPTS = 20
$POLL_DELAY_MS     = 1000
$COST_PER_IMAGE    = 0.003

# Geometry copied from studio-generator.ts so the two never drift.
$WATERMARK_OPACITY = 0.22
$WATERMARK_ANGLE   = -30
$WATERMARK_WIDTH   = 0.55
$PREVIEW_QUALITY   = 88

if ($PerCell -le 0) { $PerCell = if ($Season -eq 'halloween') { 8 } else { 6 } }
if ($Prefix -eq '') { $Prefix  = "studio/$Season" }

if (-not $LocalOnly -and $PreviewBucket -eq $CleanBucket) {
  throw "PreviewBucket and CleanBucket must differ. The preview needs public read; the clean file must never have it. One bucket cannot be both."
}

try {
  Add-Type -AssemblyName System.Drawing -ErrorAction Stop
}
catch {
  throw 'System.Drawing unavailable. Run this in Windows PowerShell 5.1, or PowerShell 7 on Windows.'
}

# ------------------------------------------------------------
#  ENV
# ------------------------------------------------------------
#
# Parsed rather than sourced. CRLF-aware, tolerant of `export`, quotes and
# inline comments, and it does NOT evaluate anything -- a .env.local is a data
# file and running it as code is how a stray backtick becomes a bad evening.

function Read-DotEnv {
  param([string] $Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "env file not found: $Path"
  }

  $map = @{}
  $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8

  foreach ($line in ($raw -split "`r?`n")) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    if ($t.StartsWith('export ')) { $t = $t.Substring(7).Trim() }

    $eq = $t.IndexOf('=')
    if ($eq -lt 1) { continue }

    $key = $t.Substring(0, $eq).Trim()
    $val = $t.Substring($eq + 1).Trim()

    if ($val.Length -ge 2 -and
       (($val.StartsWith('"') -and $val.EndsWith('"')) -or
        ($val.StartsWith("'") -and $val.EndsWith("'")))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $map[$key] = $val
  }
  return $map
}

function Get-EnvValue {
  param([hashtable] $Map, [string[]] $Names, [switch] $Required)
  foreach ($n in $Names) {
    if ($Map.ContainsKey($n) -and $Map[$n] -ne '') { return $Map[$n] }
  }
  if ($Required) {
    throw "missing from $EnvFile -- expected one of: $($Names -join ', ')"
  }
  return $null
}

$envMap = Read-DotEnv -Path $EnvFile

$replicateToken = Get-EnvValue -Map $envMap -Required -Names @(
  'REPLICATE_API_TOKEN')

$supabaseUrl = $null
$supabaseKey = $null
if (-not $LocalOnly) {
  $supabaseUrl = Get-EnvValue -Map $envMap -Required -Names @(
    'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
  $supabaseKey = Get-EnvValue -Map $envMap -Required -Names @(
    'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
  $supabaseUrl = $supabaseUrl.TrimEnd('/')
}

# ------------------------------------------------------------
#  VOCABULARY
# ------------------------------------------------------------

if (-not (Test-Path -LiteralPath $VocabFile)) {
  throw "vocabulary file not found: $VocabFile"
}

$vocab = Get-Content -LiteralPath $VocabFile -Raw -Encoding UTF8 | ConvertFrom-Json

$COMPOSITION = $vocab.composition
$ENERGIES    = $vocab.energies
$room        = $vocab.$Season

$BASE     = $room.base
$WORLDS   = $room.worlds
$MOODS    = $room.moods
$PALETTES = $room.palettes
$TWISTS   = $room.twists

$hasTwist = ($Season -eq 'halloween')

# ------------------------------------------------------------
#  THE PLAN
# ------------------------------------------------------------
#
# Every World x Palette cell is filled $PerCell times. Those are the two axes
# a customer reads from a thumbnail -- what it is made of and what colour it is
# -- so leaving cells empty is what makes a catalogue feel thin even when the
# count is high.
#
# Inside a cell, Mood / Energy / Twist advance on DIFFERENT strides, each
# offset by the world and palette indices. That is what stops Cosmos always
# pairing Dream with Stillness in every palette, which is the failure a naive
# nested loop produces and which no amount of extra volume fixes.

function Build-Plan {
  $plan  = New-Object System.Collections.ArrayList
  $index = 0

  for ($wi = 0; $wi -lt $WORLDS.Count; $wi++) {
    for ($pi = 0; $pi -lt $PALETTES.Count; $pi++) {
      for ($k = 0; $k -lt $PerCell; $k++) {

        $mi = ($k + $wi + $pi) % $MOODS.Count
        $ei = ($k + $pi)       % $ENERGIES.Count
        $ti = if ($hasTwist) { ($k + ($wi * 5) + ($pi * 7)) % $TWISTS.Count } else { -1 }

        # Deterministic per index, so -RunSeed reproduces the run exactly and
        # a single frame can be regenerated by its index alone.
        $seed = [int]((([long]$RunSeed + ([long]$index * 2654435761)) % 2147483647))
        if ($seed -lt 0) { $seed = $seed + 2147483647 }

        $null = $plan.Add([pscustomobject]@{
          index   = $index
          world   = $WORLDS[$wi]
          mood    = $MOODS[$mi]
          energy  = $ENERGIES[$ei]
          palette = $PALETTES[$pi]
          twist   = if ($ti -ge 0) { $TWISTS[$ti] } else { $null }
          seed    = $seed
        })
        $index++
      }
    }
  }
  return $plan
}

function Build-StudioPrompt {
  param([pscustomobject] $Item)

  $parts = @(
    $BASE,
    $COMPOSITION,
    $Item.world.body,
    $Item.mood.body,
    $Item.energy.body,
    $Item.palette.body
  )
  if ($null -ne $Item.twist) { $parts += $Item.twist.body }

  return (($parts -join ' ') -replace '\s+', ' ').Trim()
}

function Get-PlateName {
  param([pscustomobject] $Item)

  $n = '{0:d4}_{1}_{2}_{3}_{4}' -f `
        $Item.index, $Item.world.id, $Item.mood.id, $Item.energy.id, $Item.palette.id
  if ($null -ne $Item.twist) { $n = $n + '_' + $Item.twist.id }
  return "$n.jpg"
}

# ------------------------------------------------------------
#  REPLICATE
# ------------------------------------------------------------
#
# Params match studio-generator.ts callFlux exactly. Safety checker left on --
# there is no free text here, but four dropdowns are not a reason to turn a
# guard off.

function Get-HttpErrorDetail {
  param($ErrorRecord)

  # Invoke-RestMethod throws on non-2xx and drops the response body, which is
  # exactly where Replicate and Supabase put the reason. Read it off the
  # exception before it is lost.
  $resp = $ErrorRecord.Exception.Response
  if ($null -eq $resp) { return $ErrorRecord.Exception.Message }

  try {
    $stream = $resp.GetResponseStream()
    $stream.Position = 0
    $reader = New-Object System.IO.StreamReader($stream)
    $text   = $reader.ReadToEnd()
    $reader.Close()
    if ($text) {
      return "$([int]$resp.StatusCode) $(($text -replace '[\r\n]+', ' ').Trim())"
    }
  }
  catch { }

  return "$([int]$resp.StatusCode) $($ErrorRecord.Exception.Message)"
}

function Invoke-Flux {
  param([string] $Prompt, [int] $Seed)

  $body = @{
    input = @{
      prompt         = $Prompt
      aspect_ratio   = '9:16'
      output_format  = 'jpg'
      output_quality = 95
      num_outputs    = 1
      megapixels     = '1'
      seed           = $Seed
      go_fast        = $true
    }
  } | ConvertTo-Json -Depth 8 -Compress

  # UTF-8 bytes, not a string. The composition block carries an em dash and
  # PowerShell will otherwise send it as the wrong codepoint.
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

  $headers = @{
    'Authorization' = "Token $replicateToken"
    'Prefer'        = "wait=$SYNC_WAIT_SECONDS"
  }

  try {
    $pred = Invoke-RestMethod -Method Post -Uri $FLUX_URL `
              -Headers $headers -Body $bytes `
              -ContentType 'application/json; charset=utf-8'
  }
  catch {
    throw "flux POST failed: $(Get-HttpErrorDetail $_)"
  }

  if ($pred.status -eq 'succeeded' -and $pred.output) {
    return (Select-OutputUrl $pred.output)
  }

  if ($pred.urls -and $pred.urls.get) {
    for ($i = 0; $i -lt $POLL_MAX_ATTEMPTS; $i++) {
      Start-Sleep -Milliseconds $POLL_DELAY_MS
      $polled = Invoke-RestMethod -Method Get -Uri $pred.urls.get `
                  -Headers @{ 'Authorization' = "Token $replicateToken" }
      if ($polled.status -eq 'succeeded' -and $polled.output) {
        return (Select-OutputUrl $polled.output)
      }
      if ($polled.status -eq 'failed' -or $polled.status -eq 'canceled') {
        throw "prediction $($polled.status): $($polled.error)"
      }
    }
  }

  throw "flux timed out -- status=$($pred.status)"
}

function Select-OutputUrl {
  param($Output)
  if ($Output -is [string]) { return $Output }
  if ($Output -is [array] -and $Output.Count -gt 0) { return $Output[0] }
  throw 'flux output URL not found'
}

function Get-RemoteBytes {
  param([string] $Url)
  $r = Invoke-WebRequest -Uri $Url -UseBasicParsing
  return $r.Content
}

# ------------------------------------------------------------
#  PREVIEW -- downscale, then mark
# ------------------------------------------------------------
#
# Order matters. Downscaling AFTER marking would shrink the mark along with
# everything else and soften it into the image; marking after the resize keeps
# it at a fixed 55% of the frame regardless of preview width.
#
# The mark is a pre-rasterized white PNG rather than SVG path data, because
# PowerShell has no rasterizer. It is rendered from public/liten-and-co.svg
# and carries the wordmark as shape, so no font has to be present.

function ConvertTo-PreviewBytes {
  param(
    [byte[]] $CleanBytes,
    [System.Drawing.Image] $Mark,
    [int] $TargetWidth
  )

  $inStream = New-Object System.IO.MemoryStream(, $CleanBytes)
  $src      = [System.Drawing.Image]::FromStream($inStream)
  $bmp      = $null
  $g        = $null

  try {
    $w = $TargetWidth
    $h = [int][math]::Round($src.Height * ($TargetWidth / $src.Width))

    $bmp = New-Object System.Drawing.Bitmap($w, $h)
    $g   = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.DrawImage($src, 0, 0, $w, $h)

    if (-not $NoWatermark -and $null -ne $Mark) {
      $mw = $w * $WATERMARK_WIDTH
      $mh = $mw * ($Mark.Height / $Mark.Width)

      # Matrix33 is the alpha scale. Identity elsewhere, so colour is untouched.
      $cm = New-Object System.Drawing.Imaging.ColorMatrix
      $cm.Matrix33 = $WATERMARK_OPACITY
      $ia = New-Object System.Drawing.Imaging.ImageAttributes
      $ia.SetColorMatrix($cm)

      # Rotate about the frame centre, then draw the mark centred on the
      # origin -- same geometry as watermarkSvg() in studio-generator.ts.
      $g.TranslateTransform([single]($w / 2), [single]($h / 2))
      $g.RotateTransform([single]$WATERMARK_ANGLE)

      $dest = New-Object System.Drawing.Rectangle(
        [int](-$mw / 2), [int](-$mh / 2), [int]$mw, [int]$mh)

      $g.DrawImage($Mark, $dest, 0, 0, $Mark.Width, $Mark.Height,
                   [System.Drawing.GraphicsUnit]::Pixel, $ia)

      $g.ResetTransform()
      $ia.Dispose()
    }

    $g.Flush()

    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
             Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep  = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality, [int64]$PREVIEW_QUALITY)

    $outStream = New-Object System.IO.MemoryStream
    $bmp.Save($outStream, $enc, $ep)
    $ep.Dispose()

    return $outStream.ToArray()
  }
  finally {
    if ($null -ne $g)   { $g.Dispose() }
    if ($null -ne $bmp) { $bmp.Dispose() }
    $src.Dispose()
    $inStream.Dispose()
  }
}

# ------------------------------------------------------------
#  SUPABASE STORAGE
# ------------------------------------------------------------
#
# Plain REST against the storage API with the service-role key. x-upsert is on
# so a re-run over the same index replaces rather than 409s.

function Send-ToSupabase {
  param([byte[]] $Bytes, [string] $BucketName, [string] $ObjectPath)

  $uri = "$supabaseUrl/storage/v1/object/$BucketName/$ObjectPath"

  $headers = @{
    'Authorization' = "Bearer $supabaseKey"
    'x-upsert'      = 'true'
    'cache-control' = '3600'
  }

  try {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers `
      -Body $Bytes -ContentType 'image/jpeg' | Out-Null
  }
  catch {
    throw "supabase upload failed ($BucketName/$ObjectPath): $(Get-HttpErrorDetail $_)"
  }
}

# ------------------------------------------------------------
#  RUN
# ------------------------------------------------------------

$plan = Build-Plan
if ($End -lt 0 -or $End -gt $plan.Count) { $End = $plan.Count }
if ($Start -lt 0) { $Start = 0 }
$slice = $plan[$Start..($End - 1)]

$cleanDir   = Join-Path (Join-Path $OutDir $Season) 'clean'
$previewDir = Join-Path (Join-Path $OutDir $Season) 'preview'
$manifest   = Join-Path $OutDir "manifest-$Season.csv"

Write-Host ''
Write-Host "  season      $Season"
Write-Host "  grid        $($WORLDS.Count) worlds x $($PALETTES.Count) palettes x $PerCell per cell"
Write-Host "  planned     $($plan.Count) images"
Write-Host "  this run    $($slice.Count) (index $Start..$($End - 1))"
Write-Host "  cost        `$$([math]::Round($slice.Count * $COST_PER_IMAGE, 2))"
Write-Host "  preview     $PreviewWidth px wide$(if ($NoWatermark) { ', UNMARKED' } else { ', marked' })"
Write-Host "  local       $cleanDir"
Write-Host "              $previewDir"
if ($LocalOnly) {
  Write-Host "  supabase    skipped (-LocalOnly)"
} else {
  Write-Host "  clean       $CleanBucket/$Prefix/   (must be PRIVATE)"
  Write-Host "  preview     $PreviewBucket/$Prefix/   (public read)"
}
Write-Host "  run seed    $RunSeed"
Write-Host ''

if (-not $Write) {
  Write-Host '  DRY RUN -- nothing generated, nothing uploaded, nothing spent.'
  Write-Host '  Pass -Write to run it.'
  Write-Host ''
  Write-Host '  First plate:'
  Write-Host "  $(Get-PlateName $slice[0])"
  Write-Host ''
  Write-Host '  First prompt:'
  Write-Host "  $(Build-StudioPrompt $slice[0])"
  Write-Host ''
  return
}

$mark = $null
if (-not $NoWatermark) {
  if (-not (Test-Path -LiteralPath $MarkFile)) {
    throw "watermark not found: $MarkFile -- pass -NoWatermark only for internal shoots."
  }
  $mark = [System.Drawing.Image]::FromFile((Resolve-Path -LiteralPath $MarkFile).Path)
}

New-Item -ItemType Directory -Force -Path $cleanDir   | Out-Null
New-Item -ItemType Directory -Force -Path $previewDir | Out-Null

$BatchId = "wallpapers-{0}" -f (Get-Date -Format "yyyyMMdd-HHmmss")
Start-TrackedBatch -BatchId $BatchId -Description "batch-wallpapers season=$Season clean=$cleanDir preview=$previewDir"

if (-not (Test-Path -LiteralPath $manifest)) {
  'index,plate,season,world,mood,energy,palette,twist,seed,clean_path,preview_path,duration_ms,status,prompt' |
    Set-Content -LiteralPath $manifest -Encoding UTF8
}

# DONE MEANS UPLOADED, NOT GENERATED.
#
# Keying resume on the local file was wrong: an image that generated but
# failed to upload looked finished forever and never reached Supabase. Only
# an ok row -- written after both uploads returned -- counts as done.
$done = @{}
foreach ($row in (Import-Csv -LiteralPath $manifest)) {
  if ($row.status -eq 'ok') { $done[$row.plate] = $true }
}
if ($done.Count -gt 0) {
  Write-Host "  manifest shows $($done.Count) already complete"
  Write-Host ''
}

$cleanRoot   = (Resolve-Path -LiteralPath $cleanDir).Path
$previewRoot = (Resolve-Path -LiteralPath $previewDir).Path

$ok      = 0
$failed  = 0
$skipped = 0
$t0all   = Get-Date

try {
  foreach ($item in $slice) {

    $plate       = Get-PlateName $item
    $cleanLocal  = Join-Path $cleanRoot   $plate
    $prevLocal   = Join-Path $previewRoot $plate
    $cleanObj    = "$Prefix/$plate"
    $prevObj     = "$Prefix/$plate"

    # Resume-safe. A run that died at 400 picks up where it stopped rather
    # than spending the first 400 again.
    if ($done.ContainsKey($plate)) {
      $skipped++
      Write-Host ("  skip  {0}" -f $plate)
      continue
    }

    $prompt = Build-StudioPrompt $item
    $t0     = Get-Date

    try {
      $url        = Invoke-Flux -Prompt $prompt -Seed $item.seed
      $cleanBytes = Get-RemoteBytes -Url $url
      $prevBytes  = ConvertTo-PreviewBytes -CleanBytes $cleanBytes -Mark $mark `
                      -TargetWidth $PreviewWidth

      [System.IO.File]::WriteAllBytes($cleanLocal, $cleanBytes)
      [System.IO.File]::WriteAllBytes($prevLocal,  $prevBytes)

      # Registered here rather than after the upload: these two files exist
      # on disk now, and whether Supabase accepted them is a different fact
      # recorded in the manifest row below.
      Register-GeneratedFile -Path $cleanLocal -BatchId $BatchId -Note "clean plate $plate"
      Register-GeneratedFile -Path $prevLocal  -BatchId $BatchId -Note "preview plate $plate"

      if (-not $LocalOnly) {
        Send-ToSupabase -Bytes $cleanBytes -BucketName $CleanBucket   -ObjectPath $cleanObj
        Send-ToSupabase -Bytes $prevBytes  -BucketName $PreviewBucket -ObjectPath $prevObj
      }

      $ms = [int]((Get-Date) - $t0).TotalMilliseconds
      $ok++

      $twistId = if ($null -ne $item.twist) { $item.twist.id } else { '' }
      $row = '{0},{1},{2},{3},{4},{5},{6},{7},{8},{9},{10},{11},{12},"{13}"' -f `
        $item.index, $plate, $Season, $item.world.id, $item.mood.id,
        $item.energy.id, $item.palette.id, $twistId, $item.seed,
        $(if ($LocalOnly) { '' } else { "$CleanBucket/$cleanObj" }),
        $(if ($LocalOnly) { '' } else { "$PreviewBucket/$prevObj" }),
        $ms, 'ok', ($prompt -replace '"', '""')
      Add-Content -LiteralPath $manifest -Value $row -Encoding UTF8

      Write-Host ("  ok    {0}  {1}ms" -f $plate, $ms)
    }
    catch {
      $failed++
      $msg     = $_.Exception.Message -replace '[\r\n]+', ' '
      $twistId = if ($null -ne $item.twist) { $item.twist.id } else { '' }
      $row = '{0},{1},{2},{3},{4},{5},{6},{7},{8},,,,{9},"{10}"' -f `
        $item.index, $plate, $Season, $item.world.id, $item.mood.id,
        $item.energy.id, $item.palette.id, $twistId, $item.seed,
        'failed', ($msg -replace '"', '""')
      Add-Content -LiteralPath $manifest -Value $row -Encoding UTF8

      Write-Warning ("  FAIL  {0} -- {1}" -f $plate, $msg)
    }

    if ($DelayMs -gt 0) { Start-Sleep -Milliseconds $DelayMs }
  }
}
finally {
  if ($null -ne $mark) { $mark.Dispose() }
  # In the finally, so a run that is interrupted still closes its batch
  # rather than leaving a BATCH_START with no end a month later.
  End-TrackedBatch -BatchId $BatchId -Description "ok=$ok failed=$failed skipped=$skipped"
}

$elapsed = [int]((Get-Date) - $t0all).TotalSeconds
Write-Host ''
Write-Host ("  done -- ok={0} failed={1} skipped={2} in {3}s" -f $ok, $failed, $skipped, $elapsed)
Write-Host ("  spent ~`${0}" -f [math]::Round($ok * $COST_PER_IMAGE, 2))
Write-Host ("  manifest {0}" -f $manifest)
Write-Host ''
