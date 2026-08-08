# Registers "MalconNexus Attendance WhatsApp Noon" — daily 12:00 PM (local PC time; set PC to IST).
# Sends punched-in + absent + unclosed (forgot punch out) images to the WhatsApp group.
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-attendance-whatsapp-noon-task.ps1

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Attendance WhatsApp Noon'
$batchPath = 'D:\malcon-nexus\scripts\run-attendance-whatsapp-noon.bat'
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
$trigger = New-ScheduledTaskTrigger -Daily -At '12:00PM'
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
    -Description 'Post Malcon Nexus punched-in, absent, and unclosed-shift attendance PNGs to WhatsApp group + boss daily at 12:00 PM.'

Write-Host "Registered scheduled task: $taskName"
Write-Host 'Sends: Punched In + Absent + Unclosed Shift (forgot Punch Out) — group and boss'
Write-Host 'Log file: D:\MalconNexus\AttendanceReports\_whatsapp-noon-task.log'
Write-Host 'Ensure .env has ATTENDANCE_WHATSAPP_BOSS_PHONE for boss copy'
Write-Host ''
Write-Host 'Test now (manual — use quotes in PowerShell):'
Write-Host '  node scripts\daily-attendance-whatsapp.mjs "--filters=in,absent,unclosed"'
