<#
  One prediction, full error body printed.

  Invoke-RestMethod throws on any non-2xx and discards the response body, so a
  Replicate 400 arrives as "Bad Request" with the reason -- which is always in
  that body -- thrown away. This reads the stream off the exception.

  Run:  .\scripts\diag-flux.ps1
#>

$ErrorActionPreference = 'Stop'

$envPath = '.\.env.local'
$token = $null
foreach ($line in (Get-Content -LiteralPath $envPath -Encoding UTF8)) {
  $t = $line.Trim()
  if ($t -like 'REPLICATE_API_TOKEN=*') {
    $token = $t.Substring($t.IndexOf('=') + 1).Trim().Trim('"').Trim("'")
  }
}
if (-not $token) { throw 'REPLICATE_API_TOKEN not found in .env.local' }
Write-Host "  token loaded, length $($token.Length), prefix $($token.Substring(0,3))..."

$url = 'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions'

$body = @{
  input = @{
    prompt         = 'A single striking abstract artwork made as a mobile phone wallpaper.'
    aspect_ratio   = '9:16'
    output_format  = 'jpg'
    output_quality = 95
    num_outputs    = 1
    megapixels     = '1'
    seed           = 12345
    go_fast        = $true
  }
} | ConvertTo-Json -Depth 8 -Compress

Write-Host ''
Write-Host '  BODY SENT:'
Write-Host "  $body"
Write-Host ''

try {
  $r = Invoke-RestMethod -Method Post -Uri $url `
        -Headers @{ 'Authorization' = "Token $token"; 'Prefer' = 'wait=60' } `
        -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
        -ContentType 'application/json; charset=utf-8'
  Write-Host "  OK  status=$($r.status)"
  Write-Host "  output=$($r.output)"
}
catch {
  Write-Host '  FAILED' -ForegroundColor Red
  $resp = $_.Exception.Response
  if ($resp) {
    Write-Host "  http status: $([int]$resp.StatusCode) $($resp.StatusCode)"
    $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
    $text = $reader.ReadToEnd()
    $reader.Close()
    Write-Host ''
    Write-Host '  RESPONSE BODY:' -ForegroundColor Yellow
    Write-Host "  $text"
  }
  else {
    Write-Host "  $($_.Exception.Message)"
  }
}
