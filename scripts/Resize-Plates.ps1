# Resize-Plates.ps1
#
# Downsizes the Groups preview plates. Uses System.Drawing, which ships with
# Windows - nothing is installed and no build runs.
#
# WHAT IT DOES NOT DO
#   It does not overwrite, move or delete anything. Every resized file is
#   written to a NEW folder beside the source. The originals are untouched
#   and stay exactly where they are.
#
# WHY THE NAMES MATTER
#   groups-registry.js carries the whole filename for every effect, copied
#   from the directory listing - _01 suffixes, mixed .jpg and .jpeg, and one
#   capital U in groups_Ukiyo-e_01.jpg. Vercel is case-sensitive and Windows
#   is not, so a name that drifts here works locally and 404s in production.
#
#   So the output keeps the source name byte for byte, extension included. A
#   .jpeg stays .jpeg even though the bytes inside are JPEG either way - the
#   extension is a name, not a format, and the registry is naming it.
#
# DRY RUN BY DEFAULT. Nothing is written until -Apply is passed.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\Resize-Plates.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\Resize-Plates.ps1 -Apply
#
# Then look at the output folder, and only when it reads right, install the
# resized files over the originals with Install-File.ps1 - which archives
# each one to H: first, so even that step deletes nothing.

param(
  [string] $Source  = "D:\minramas\public\previews\groups",
  [string] $Dest    = "D:\minramas\public\previews\groups-small",
  [int]    $MaxEdge = 800,
  [int]    $Quality = 62,
  [switch] $Apply
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Write-Host ""
Write-Host "Resize-Plates"
Write-Host "  source   $Source"
Write-Host "  dest     $Dest"
Write-Host "  max edge $MaxEdge px"
Write-Host "  quality  $Quality"
if (-not $Apply) { Write-Host "  MODE     dry run - nothing will be written" }
Write-Host ""

if (-not (Test-Path $Source)) { Write-Host "MISSING  $Source"; exit 1 }

# The JPEG encoder, found by mime type rather than by index - the order of
# the encoder list is not guaranteed across Windows versions.
$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
         Where-Object { $_.MimeType -eq 'image/jpeg' }
if (-not $codec) { Write-Host "no JPEG encoder available"; exit 1 }

$params = New-Object System.Drawing.Imaging.EncoderParameters(1)
$params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int64]$Quality)

if ($Apply -and -not (Test-Path $Dest)) {
  New-Item -ItemType Directory -Path $Dest -Force | Out-Null
}

$files = Get-ChildItem -Path $Source -File |
         Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' } |
         Sort-Object Name

$before = 0L
$after  = 0L
$n      = 0

foreach ($f in $files) {

  $img = $null; $bmp = $null; $g = $null
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)

    $w = $img.Width; $h = $img.Height
    $scale = [Math]::Min(1.0, $MaxEdge / [double][Math]::Max($w, $h))
    $nw = [int][Math]::Round($w * $scale)
    $nh = [int][Math]::Round($h * $scale)

    $out = Join-Path $Dest $f.Name    # byte for byte, extension included

    if ($Apply) {
      $bmp = New-Object System.Drawing.Bitmap($nw, $nh)
      $g   = [System.Drawing.Graphics]::FromImage($bmp)
      $g.InterpolationMode  = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $g.PixelOffsetMode    = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $g.SmoothingMode      = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
      $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $g.DrawImage($img, 0, 0, $nw, $nh)

      $img.Dispose(); $img = $null      # released before the write
      $bmp.Save($out, $codec, $params)
      $bmp.Dispose(); $bmp = $null

      $newLen = (Get-Item $out).Length
    } else {
      if ($img) { $img.Dispose(); $img = $null }
      $newLen = 0
    }

    $before += $f.Length
    $after  += $newLen
    $n++

    if ($Apply) {
      Write-Host ("  {0,-32} {1}x{2} -> {3}x{4}   {5:N0} -> {6:N0} bytes" -f `
        $f.Name, $w, $h, $nw, $nh, $f.Length, $newLen)
    } else {
      Write-Host ("  {0,-32} {1}x{2} -> {3}x{4}   {5:N0} bytes" -f `
        $f.Name, $w, $h, $nw, $nh, $f.Length)
    }
  }
  catch {
    Write-Host ("  {0,-32} FAILED - {1}" -f $f.Name, $_.Exception.Message)
  }
  finally {
    if ($g)   { $g.Dispose() }
    if ($bmp) { $bmp.Dispose() }
    if ($img) { $img.Dispose() }
  }
}

Write-Host ""
Write-Host ("  {0} files" -f $n)
Write-Host ("  before   {0:N1} MB" -f ($before / 1MB))
if ($Apply) {
  Write-Host ("  after    {0:N1} MB" -f ($after / 1MB))
  if ($before -gt 0) {
    Write-Host ("  saved    {0:N0}%" -f ((1 - ($after / [double]$before)) * 100))
  }
  Write-Host ""
  Write-Host "Written to $Dest. The originals are untouched."
  Write-Host "Look at them before installing anything."
} else {
  Write-Host ""
  Write-Host "Dry run. Re-run with -Apply to write."
}
Write-Host ""
