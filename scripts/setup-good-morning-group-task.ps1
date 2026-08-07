# Registers "MalconNexus Good Morning Group" — daily 9:00 AM post of GM.png to WhatsApp group.
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-good-morning-group-task.ps1
# Custom time:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-good-morning-group-task.ps1 -At "9:00AM"

param(
    [string]$At = '9:00AM'
)

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Good Morning Group'
$batchPath = 'D:\malcon-nexus\scripts\run-good-morning-group.bat'
$workDir = 'D:\malcon-nexus'

if (-not (Test-Path $batchPath)) {
    throw "Missing batch file: $batchPath"
}

if (-not (Test-Path (Join-Path $workDir 'GM.png'))) {
    throw "Missing GM.png in repo root: $workDir\GM.png"
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
    -Description "Post GM.png good-morning image to Malcon Nexus WhatsApp group daily at $At."

Write-Host ""
Write-Host "Registered scheduled task: $taskName at $At" -ForegroundColor Green
Write-Host "Image: D:\malcon-nexus\GM.png"
Write-Host "Log file: D:\MalconNexus\AttendanceReports\_good-morning-group.log"
Write-Host ""
Write-Host "Required in .env:"
Write-Host "  ATTENDANCE_WHATSAPP_GROUP_NAME=Your Exact WhatsApp Group Name"
Write-Host "Optional:"
Write-Host "  ATTENDANCE_WHATSAPP_GROUP_ID=120363012345678901@g.us"
Write-Host "  ATTENDANCE_WHATSAPP_GOOD_MORNING_TEXT=Good morning!"
Write-Host ""
Write-Host "Test now:"
Write-Host "  node scripts\daily-attendance-whatsapp.mjs --good-morning-group"
