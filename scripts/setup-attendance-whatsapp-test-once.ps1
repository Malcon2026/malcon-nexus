# One-time WhatsApp attendance test (punched-in + absent).
# Run as Administrator on the office server:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-attendance-whatsapp-test-once.ps1
# Optional custom time:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-attendance-whatsapp-test-once.ps1 -At "9:45PM"

param(
    [string]$At = '9:45PM'
)

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Attendance WhatsApp Test Once'
$batchPath = 'D:\malcon-nexus\scripts\run-attendance-whatsapp-noon.bat'
$workDir = 'D:\malcon-nexus'

if (-not (Test-Path $batchPath)) {
    throw "Missing batch file: $batchPath"
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $batchPath -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Once -At $At
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Settings $settings `
    -Principal $principal `
    -Description "One-time WhatsApp attendance test at $At (in + absent images)."

Write-Host ""
Write-Host "Scheduled ONE-TIME test: $At" -ForegroundColor Green
Write-Host "Task name: $taskName"
Write-Host "Sends: Punched In + Absent to WhatsApp group"
Write-Host "Log: D:\MalconNexus\AttendanceReports\_whatsapp-noon-task.log"
Write-Host ""
Write-Host "PC must stay ON. Check the group after $At."
Write-Host ""
Write-Host "To cancel before it runs:"
Write-Host "  Unregister-ScheduledTask -TaskName '$taskName' -Confirm:`$false"
