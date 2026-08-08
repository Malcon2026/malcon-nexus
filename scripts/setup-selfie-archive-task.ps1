# Registers "MalconNexus Punch-in Selfie Archive" in Windows Task Scheduler (every 15 minutes).
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-selfie-archive-task.ps1
#
# Required in D:\malcon-nexus\.env:
#   VITE_SUPABASE_URL=...
#   SUPABASE_SERVICE_ROLE_KEY=...
#   SELFIE_ARCHIVE_ROOT=D:\MalconNexus\PunchInSelfies

$ErrorActionPreference = 'Stop'

$taskName = 'MalconNexus Punch-in Selfie Archive'
$batchPath = 'D:\malcon-nexus\scripts\run-archive-punch-in-selfies.bat'
$workDir = 'D:\malcon-nexus'
$archiveRoot = 'D:\MalconNexus\PunchInSelfies'

if (-not (Test-Path $batchPath)) {
    throw "Missing batch file: $batchPath"
}

if (-not (Test-Path $archiveRoot)) {
    New-Item -ItemType Directory -Path $archiveRoot -Force | Out-Null
}

$existing = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existing) {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

$action = New-ScheduledTaskAction -Execute $batchPath -WorkingDirectory $workDir
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).Date `
    -RepetitionInterval (New-TimeSpan -Minutes 15) `
    -RepetitionDuration (New-TimeSpan -Days 3650)
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
    -Description 'Download punch-in selfies from Supabase to D:\MalconNexus\PunchInSelfies, then delete cloud copies older than 24 hours (only after local copy exists).'

Write-Host "Registered scheduled task: $taskName"
Write-Host 'Runs every 15 minutes.'
Write-Host "Archive folder: $archiveRoot"
Write-Host 'Task log: D:\MalconNexus\PunchInSelfies\_selfie-archive-task.log'
Write-Host ''
Write-Host 'Manual test:'
Write-Host '  cd D:\malcon-nexus'
Write-Host '  node scripts\archive-punch-in-selfies.mjs'
Write-Host ''
Write-Host 'Ensure .env has:'
Write-Host '  SELFIE_ARCHIVE_ROOT=D:\MalconNexus\PunchInSelfies'
