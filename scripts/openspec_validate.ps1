# OpenSpec validation script for endstate-gui
# Called by lefthook pre-push hook
# Bypass: set OPENSPEC_BYPASS=1 for emergency non-behavior changes

$ErrorActionPreference = "Stop"

# Change to repo root (script is in scripts/)
$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $repoRoot) {
    $repoRoot = (Get-Location).Path
}
Set-Location $repoRoot

# Check for bypass
if ($env:OPENSPEC_BYPASS -eq "1") {
    Write-Host "[WARN] OPENSPEC_BYPASS=1 detected. Skipping OpenSpec validation." -ForegroundColor Yellow
    Write-Host "[WARN] This bypass should only be used for non-behavior changes." -ForegroundColor Yellow
    exit 0
}

Write-Host "Running OpenSpec validation..." -ForegroundColor Cyan

# Run validation using npm (resolves repo-local binary)
try {
    npm run -s openspec:validate
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] OpenSpec validation failed." -ForegroundColor Red
        exit 1
    }
    Write-Host "[OK] OpenSpec validation passed." -ForegroundColor Green
    exit 0
} catch {
    Write-Host "[ERROR] OpenSpec validation failed: $_" -ForegroundColor Red
    exit 1
}
