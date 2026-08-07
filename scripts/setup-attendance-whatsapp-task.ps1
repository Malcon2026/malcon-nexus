# Registers "MalconNexus Attendance WhatsApp AM" — daily 9:30 AM (local PC time; set PC to IST).
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-attendance-whatsapp-task.ps1

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Attendance WhatsApp AM'
$batchPath = 'D:\malcon-nexus\scripts\run-attendance-whatsapp-morning.bat'
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
$trigger = New-ScheduledTaskTrigger -Daily -At '9:30AM'
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
    -Description 'Post Malcon Nexus punched-in attendance PNG to WhatsApp group + boss daily at 9:30 AM.'

Write-Host "Registered scheduled task: $taskName"
Write-Host 'Log file: D:\MalconNexus\AttendanceReports\_whatsapp-task.log'
Write-Host 'Ensure .env has ATTENDANCE_WHATSAPP_GROUP_NAME and ATTENDANCE_WHATSAPP_BOSS_PHONE (boss gets same report at same time).'
