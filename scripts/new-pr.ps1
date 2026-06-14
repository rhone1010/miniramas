# new-pr.ps1 — create a GitHub PR from the current branch
param(
    [Parameter(Mandatory = $true)]
    [string]$Title,

    [string]$Base = "main",

    [string]$Body = ""
)

$ErrorActionPreference = "Stop"

# Refresh PATH for this session in case gh was installed after the terminal opened
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
            [System.Environment]::GetEnvironmentVariable("Path", "User")

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "gh CLI not found. Install from https://cli.github.com then re-run." -ForegroundColor Red
    exit 1
}

$branch = git rev-parse --abbrev-ref HEAD
if (-not $branch) {
    Write-Host "Not inside a git repository." -ForegroundColor Red
    exit 1
}

if ($branch -eq $Base) {
    Write-Host "You are on '$Base'. Create a feature branch first:" -ForegroundColor Red
    Write-Host "  git checkout -b feature/my-change" -ForegroundColor Yellow
    exit 1
}

Write-Host "Pushing branch '$branch' to origin..." -ForegroundColor Cyan
git push -u origin $branch

Write-Host "Creating PR: $branch -> $Base" -ForegroundColor Cyan
if ($Body) {
    gh pr create --base $Base --head $branch --title $Title --body $Body
} else {
    gh pr create --base $Base --head $branch --title $Title --fill
}

Write-Host "Done." -ForegroundColor Green