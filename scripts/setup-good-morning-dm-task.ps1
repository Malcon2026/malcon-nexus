# Registers "MalconNexus Good Morning DM" — daily morning test PM with image.
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-good-morning-dm-task.ps1
# Custom time (default 8:00 AM local / IST if PC clock is set):
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-good-morning-dm-task.ps1 -At "8:00AM"

param(
    [string]$At = '8:00AM'
)

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Good Morning DM'
$batchPath = 'D:\malcon-nexus\scripts\run-good-morning-dm.bat'
$workDir = 'D:\malcon-nexus'

if (-not (Test-Path $batchPath)) {
    throw "Missing batch file: $batchPath"
}

$reportsDir = 'D:\MalconNexus\AttendanceReports'
if (-not (Test-Path $reportsDir)) {
    New-Item -ItemType Directory -Path $reportsDir -Force | Out-Null
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $batchPath -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Daily -At $At
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "Send Malcon Nexus good-morning test image via WhatsApp DM daily at $At."

Write-Host ""
Write-Host "Registered scheduled task: $taskName at $At" -ForegroundColor Green
Write-Host "Log file: D:\MalconNexus\AttendanceReports\_good-morning-dm.log"
Write-Host ""
Write-Host "Required in .env:"
Write-Host "  ATTENDANCE_WHATSAPP_DM_PHONE=919876543210   (country code, no +)"
Write-Host "Optional:"
Write-Host "  ATTENDANCE_WHATSAPP_GOOD_MORNING_TEXT=Good morning!"
Write-Host ""
Write-Host "Test now:"
Write-Host "  node scripts\daily-attendance-whatsapp.mjs --good-morning-dm"
Write-Host ""
Write-Host "List DM chats to pick a phone:"
Write-Host "  node scripts\daily-attendance-whatsapp.mjs --list-dms"
