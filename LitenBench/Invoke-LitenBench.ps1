<#
.SYNOPSIS
  Liten before/after batch renderer. Normalizes a source photo to 16:9, then
  applies every effect in a job file to it (NB2 via Replicate), one named JPG each.
  Reads the API token automatically from .env.local.
.EXAMPLE
  .\Invoke-LitenBench.ps1 -SourceImage .\sources\portrait_1.jpg -JobFile .\jobs\portraits.json -OutDir .\out
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$SourceImage,
  [Parameter(Mandatory=$true)][string]$JobFile,
  [string]$OutDir   = ".\liten-out",
  [string]$Ratio    = "9:16",
  [string]$Model    = "google/nano-banana-2",
  [int]$WaitSeconds = 60,
  [ValidateSet("Pad","Crop")][string]$Fit = "Pad",
  [string[]]$Only,
  [switch]$SkipSource,
  [int]$MaxEdge = 0,
  [switch]$ShowBody,
  [string]$Token
)
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Get-TokenFromEnv {
  param([string]$Explicit)
  if ($Explicit) { return $Explicit }
  if ($env:REPLICATE_API_TOKEN) { return $env:REPLICATE_API_TOKEN }
  $candidates = @('.\.env.local','..\.env.local','..\..\.env.local','D:\minramas\.env.local')
  $keys = @('REPLICATE_API_TOKEN','REPLICATE_API_KEY','REPLICATE_TOKEN','REPLICATE_KEY','NB2_API_TOKEN','NB2_TOKEN','NANOBANANA_TOKEN')
  foreach ($p in $candidates) {
    if (Test-Path $p) {
      foreach ($line in Get-Content $p) {
        if ($line -match '^\s*#') { continue }
        if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.+?)\s*$') {
          $k = $Matches[1]; $v = $Matches[2].Trim().Trim('"').Trim("'")
          if ($keys -contains $k -and $v) { Write-Host "Using $k from $p" -ForegroundColor DarkGray; return $v }
        }
      }
    }
  }
  throw "No Replicate token found. Add REPLICATE_API_TOKEN to .env.local (in D:\minramas), or pass -Token."
}

$token = Get-TokenFromEnv -Explicit $Token
if (-not (Test-Path $SourceImage)) { throw "Source image not found: $SourceImage" }
if (-not (Test-Path $JobFile))     { throw "Job file not found: $JobFile" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Drawing

function ConvertTo-16x9 {
  param([string]$InPath, [string]$OutPath, [string]$Fit, [string]$Ratio, [int]$MaxEdge)
  $img = [System.Drawing.Image]::FromFile((Resolve-Path $InPath).Path)
  try {
    $rp = $Ratio.Split(":"); $target = [double]$rp[0] / [double]$rp[1]
    $w = $img.Width; $h = $img.Height; $ar = $w/$h
    if ($Fit -eq "Crop") {
      if ($ar -gt $target) { $ch=$h; $cw=[int][math]::Round($h*$target); $cx=[int](($w-$cw)/2); $cy=0 }
      else                 { $cw=$w; $ch=[int][math]::Round($w/$target); $cx=0; $cy=[int](($h-$ch)/2) }
      $bmp = New-Object System.Drawing.Bitmap $cw,$ch
      $g   = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0,0,$cw,$ch), (New-Object System.Drawing.Rectangle $cx,$cy,$cw,$ch), [System.Drawing.GraphicsUnit]::Pixel)
    } else {
      if ($ar -gt $target) { $cw=$w; $ch=[int][math]::Round($w/$target) }
      else                 { $ch=$h; $cw=[int][math]::Round($h*$target) }
      $bmp = New-Object System.Drawing.Bitmap $cw,$ch
      $g   = [System.Drawing.Graphics]::FromImage($bmp)
      $g.Clear([System.Drawing.Color]::FromArgb(243,237,225))
      $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $ox = [int](($cw-$w)/2); $oy = [int](($ch-$h)/2)
      $g.DrawImage($img, $ox, $oy, $w, $h)
    }
    $g.Dispose()
    $maxE = [math]::Max($bmp.Width, $bmp.Height)
    if ($MaxEdge -gt 0 -and $maxE -gt $MaxEdge) {
      $scale = $MaxEdge / $maxE
      $nw = [int]($bmp.Width * $scale); $nh = [int]($bmp.Height * $scale)
      $tmp = New-Object System.Drawing.Bitmap $nw,$nh
      $g2  = [System.Drawing.Graphics]::FromImage($tmp)
      $g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g2.DrawImage($bmp, 0, 0, $nw, $nh)
      $g2.Dispose(); $bmp.Dispose(); $bmp = $tmp
    }
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $ep  = New-Object System.Drawing.Imaging.EncoderParameters 1
    $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality, [long]85)
    $bmp.Save((Join-Path (Get-Location) $OutPath), $enc, $ep)
    $bmp.Dispose()
  } finally { $img.Dispose() }
}

$srcOut = Join-Path $OutDir "00_source.jpg"
if (-not ($SkipSource -and (Test-Path $srcOut))) {
  Write-Host "Building $Ratio source ($Fit) -> $srcOut"
  ConvertTo-16x9 -InPath $SourceImage -OutPath $srcOut -Fit $Fit -Ratio $Ratio -MaxEdge $MaxEdge
}
$bytes   = [System.IO.File]::ReadAllBytes((Resolve-Path $srcOut).Path)
$dataUri = "data:image/jpeg;base64," + [System.Convert]::ToBase64String($bytes)

$jobs = Get-Content $JobFile -Raw | ConvertFrom-Json
if ($Only) { $jobs = $jobs | Where-Object { $Only -contains $_.id -or $Only -contains $_.name } }
if (-not $jobs) { throw "No matching effects in $JobFile" }

$url     = "https://api.replicate.com/v1/models/$Model/predictions"
$headers = @{ Authorization = "Token $token"; Prefer = "wait=$WaitSeconds" }
$total = @($jobs).Count; $i = 0; $ok = 0; $fail = 0

foreach ($job in $jobs) {
  $i++
  $safe    = ($job.name -replace '[^\w\-]+','_').Trim('_')
  $outFile = Join-Path $OutDir ("{0:D2}_{1}.jpg" -f $i, $safe)
  Write-Host ("[{0}/{1}] {2} ..." -f $i, $total, $job.name) -NoNewline
  $p = $job.prompt
  $p = $p.Replace('\','\\')
  $p = $p.Replace('"','\"')
  $p = $p.Replace("`r`n",'\n')
  $p = $p.Replace("`n",'\n')
  $p = $p.Replace("`r",'\r')
  $p = $p.Replace("`t",'\t')
  $body = '{"input":{"prompt":"' + $p + '","image_input":["' + $dataUri + '"],"aspect_ratio":"' + $Ratio + '","output_format":"jpg"}}'
  if ($ShowBody) {
    $prev = $body.Replace($dataUri, '<BASE64_' + $dataUri.Length + '_chars>')
    Write-Host "---- REQUEST BODY (masked) ----" -ForegroundColor Cyan
    Write-Host $prev
    Write-Host ("---- prompt length: {0} ; body length: {1} ----" -f $p.Length, $body.Length) -ForegroundColor Cyan
  }
  try {
    $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($body)
    $pred  = Invoke-RestMethod -Uri $url -Method Post -Headers $headers -Body $bodyBytes -ContentType 'application/json; charset=utf-8' 
    $tries = 0
    while ($pred.status -in @('starting','processing') -and $tries -lt 150) {
      Start-Sleep -Seconds 2; $tries++
      $pred = Invoke-RestMethod -Uri $pred.urls.get -Headers @{ Authorization = "Token $token" }
    }
    if ($pred.status -ne 'succeeded') { throw "status=$($pred.status) $($pred.error)" }
    $out = $pred.output; if ($out -is [System.Array]) { $out = $out[0] }
    Invoke-WebRequest -Uri $out -OutFile $outFile | Out-Null
    Write-Host (" OK -> {0}" -f (Split-Path $outFile -Leaf)) -ForegroundColor Green; $ok++
  } catch {
    $detail = $_.Exception.Message
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $detail = $_.ErrorDetails.Message }
    else { try { $resp = $_.Exception.Response; if ($resp) { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $b = $sr.ReadToEnd(); if ($b) { $detail = $b } } } catch {} }
    Write-Host (" FAILED: {0}" -f $detail) -ForegroundColor Red; $fail++
  }
}
Write-Host ""
Write-Host ("Done. {0} succeeded, {1} failed. Output: {2}" -f $ok, $fail, (Resolve-Path $OutDir).Path)
