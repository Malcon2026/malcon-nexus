# Install Chrome for Puppeteer (needed for WhatsApp + PNG on office server).
# Run once on the server:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-whatsapp-chrome.ps1

$ErrorActionPreference = 'Stop'
$workDir = 'D:\malcon-nexus'

Set-Location $workDir

Write-Host ''
Write-Host '=== Installing Chrome for Puppeteer ===' -ForegroundColor Cyan
Write-Host ''

$chromePaths = @(
    'C:\Program Files\Google\Chrome\Application\chrome.exe',
    'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe'
)

foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        Write-Host "System Chrome found: $path" -ForegroundColor Green
        Write-Host 'No download needed. Run: node scripts\daily-attendance-whatsapp.mjs --list-groups'
        exit 0
    }
}

Write-Host 'Downloading Chrome for Puppeteer (may take a few minutes)...'
& npx puppeteer browsers install chrome
if ($LASTEXITCODE -ne 0) { throw 'puppeteer browsers install chrome failed' }

Write-Host ''
Write-Host 'Done. Test with:' -ForegroundColor Green
Write-Host '  node scripts\daily-attendance-whatsapp.mjs --list-groups'
Write-Host ''
