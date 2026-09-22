# Register Malcon Nexus photo maintenance on the office PC (Task Scheduler).
# Run once in PowerShell as Administrator from D:\malcon-nexus:
#   Set-ExecutionPolicy -Scope Process Bypass; .\scripts\install-windows-photo-tasks.ps1

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path (Join-Path $RepoRoot 'package.json'))) {
  $RepoRoot = (Get-Location).Path
}
$Npm = (Get-Command npm -ErrorAction SilentlyContinue)?.Source
if (-not $Npm) {
  Write-Error 'npm not found on PATH. Install Node.js first.'
}

$NodeDir = Split-Path (Get-Command node).Source -Parent
$TaskPrefix = 'MalconNexus'

function Register-MalconTask {
  param(
    [string]$Name,
    [string]$Schedule,
    [string]$Script
  )
  $taskName = "$TaskPrefix-$Name"
  $action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c cd /d `"$RepoRoot`" && npm run $Script" -WorkingDirectory $RepoRoot
  $trigger = switch ($Schedule) {
    '5min' { New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration ([TimeSpan]::MaxValue) }
    '15min' { New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 15) -RepetitionDuration ([TimeSpan]::MaxValue) }
    'daily' { New-ScheduledTaskTrigger -Daily -At '2:00AM' }
    default { throw "Unknown schedule: $Schedule" }
  }
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
  $principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Highest
  Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
  Write-Host "Registered: $taskName -> npm run $Script ($Schedule)"
}

Register-MalconTask -Name 'PhotoSync' -Schedule '5min' -Script 'photos:sync'
Register-MalconTask -Name 'SelfieArchive' -Schedule '15min' -Script 'selfies:archive'
Register-MalconTask -Name 'PhotoPurge' -Schedule 'daily' -Script 'photos:purge'

Write-Host "`nDone. Ensure D:\malcon-nexus\.env uses the NEW Supabase URL and service_role key."
Write-Host "Recommended retention: SELFIE_CLOUD_RETENTION_HOURS=24 and PHOTOS_CLEANUP_RETENTION_DAYS=7"
