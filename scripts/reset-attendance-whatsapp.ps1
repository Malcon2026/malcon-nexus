# Fresh start for WhatsApp attendance automation.
# Run on the office server (PowerShell):
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\reset-attendance-whatsapp.ps1
#
# Before running: on your phone go to WhatsApp → Linked devices → remove the old PC link.

$ErrorActionPreference = 'Stop'

$sessionPath = 'D:\MalconNexus\WhatsAppSession'
$envPath = 'D:\malcon-nexus\.env'

Write-Host ''
Write-Host '=== Malcon Nexus — WhatsApp fresh start ===' -ForegroundColor Cyan
Write-Host ''

if (Test-Path $sessionPath) {
    Remove-Item -Recurse -Force $sessionPath
    Write-Host "Deleted session folder: $sessionPath" -ForegroundColor Green
} else {
    Write-Host "No session folder found (already clean): $sessionPath" -ForegroundColor Yellow
}

if (Test-Path $envPath) {
    $envText = Get-Content $envPath -Raw
    if ($envText -match 'ATTENDANCE_WHATSAPP_GROUP_ID=') {
        $updated = ($envText -split "`n" | Where-Object { $_ -notmatch '^\s*ATTENDANCE_WHATSAPP_GROUP_ID=' }) -join "`n"
        Set-Content -Path $envPath -Value $updated.TrimEnd() -NoNewline
        Write-Host 'Removed ATTENDANCE_WHATSAPP_GROUP_ID from .env (will re-detect group by name)' -ForegroundColor Green
    }
} else {
    Write-Host "Warning: .env not found at $envPath" -ForegroundColor Yellow
}

Write-Host ''
Write-Host 'Next steps:' -ForegroundColor Cyan
Write-Host '  1. On your PHONE: WhatsApp → Linked devices → remove old PC if still listed'
Write-Host '  2. cd D:\malcon-nexus'
Write-Host '  3. git pull'
Write-Host '  4. powershell -ExecutionPolicy Bypass -File scripts\setup-whatsapp-chrome.ps1'
Write-Host '  5. node scripts\daily-attendance-whatsapp.mjs --list-groups'
Write-Host '     (scan QR with the phone that is IN the group "Malcon life sciences")'
Write-Host '  6. Copy the group ID into .env as ATTENDANCE_WHATSAPP_GROUP_ID=...'
Write-Host '  7. node scripts\daily-attendance-whatsapp.mjs'
Write-Host '  8. Check the group on your phone — image should appear'
Write-Host ''
