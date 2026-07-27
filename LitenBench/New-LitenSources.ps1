<#
.SYNOPSIS
  Generates "before" source photos from text prompts (NB2 via Replicate), 16:9,
  one named JPG per prompt. Reads the API token automatically from .env.local.
.EXAMPLE
  .\New-LitenSources.ps1 -JobFile .\jobs\sources.json -OutDir .\sources
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][string]$JobFile,
  [string]$OutDir   = ".\sources",
  [string]$Ratio    = "9:16",
  [string]$Model    = "google/nano-banana-2",
  [int]$WaitSeconds = 60,
  [string[]]$Category,
  [string[]]$Only,
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
if (-not (Test-Path $JobFile)) { throw "Job file not found: $JobFile" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$jobs = Get-Content $JobFile -Raw | ConvertFrom-Json
if ($Category) { $jobs = $jobs | Where-Object { $Category -contains $_.category } }
if ($Only)     { $jobs = $jobs | Where-Object { $Only -contains $_.id -or $Only -contains $_.name } }
if (-not $jobs) { throw "No matching prompts in $JobFile" }

$url     = "https://api.replicate.com/v1/models/$Model/predictions"
$headers = @{ Authorization = "Token $token"; Prefer = "wait=$WaitSeconds" }
$total = @($jobs).Count; $i = 0; $ok = 0; $fail = 0

foreach ($job in $jobs) {
  $i++
  $safe    = ("{0}_{1}" -f $job.id, ($job.name -replace '[^\w\-]+','_').Trim('_'))
  $outFile = Join-Path $OutDir ($safe + ".jpg")
  Write-Host ("[{0}/{1}] {2} / {3} ..." -f $i, $total, $job.category, $job.name) -NoNewline
  $body = @{ input = @{ prompt = $job.prompt; aspect_ratio = $Ratio; output_format = "jpg" } } | ConvertTo-Json -Depth 8 -Compress
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
    try { $resp = $_.Exception.Response; if ($resp) { $sr = New-Object System.IO.StreamReader($resp.GetResponseStream()); $b = $sr.ReadToEnd(); if ($b) { $detail = $b } } } catch {}
    Write-Host (" FAILED: {0}" -f $detail) -ForegroundColor Red; $fail++
  }
}
Write-Host ""
Write-Host ("Done. {0} succeeded, {1} failed. Sources in: {2}" -f $ok, $fail, (Resolve-Path $OutDir).Path)
