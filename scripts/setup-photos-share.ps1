# Shares D:\MalconNexus\Photos over SMB for read access from your personal PC.
# Run once on the office server as Administrator:
#   powershell -ExecutionPolicy Bypass -File D:\malcon-nexus\scripts\setup-photos-share.ps1
#
# Optional: pass a server username to grant read access (e.g. -ShareUser "anji")
param(
    [string]$ShareUser = ''
)

$ErrorActionPreference = 'Stop'

$shareName = 'MalconNexusPhotos'
$photosPath = 'D:\MalconNexus\Photos'

if (-not (Test-Path $photosPath)) {
    New-Item -ItemType Directory -Path $photosPath -Force | Out-Null
}

# Enable File and Printer Sharing firewall rules (Private + Domain profiles).
Get-NetFirewallRule -DisplayGroup 'File and Printer Sharing' -ErrorAction SilentlyContinue |
    Where-Object { $_.Enabled -ne 'True' } |
    Enable-NetFirewallRule | Out-Null

$existing = Get-SmbShare -Name $shareName -ErrorAction SilentlyContinue
if ($existing) {
    Remove-SmbShare -Name $shareName -Force
}

New-SmbShare -Name $shareName -Path $photosPath `
    -Description 'Malcon Nexus synced stage photos (read-only)' `
    -FullAccess 'Administrators' | Out-Null

if ($ShareUser) {
    Grant-SmbShareAccess -Name $shareName -AccountName $ShareUser -AccessRight Read -Force | Out-Null
    Write-Host "Share access: $ShareUser (Read)"
} else {
    Grant-SmbShareAccess -Name $shareName -AccountName 'Authenticated Users' -AccessRight Read -Force | Out-Null
    Write-Host 'Share access: Authenticated Users (Read) — use any enabled server account from your PC'
}

# NTFS: allow read for the same account(s) connecting over SMB.
if ($ShareUser) {
    icacls $photosPath /grant "${env:COMPUTERNAME}\${ShareUser}:(OI)(CI)R" /T | Out-Null
} else {
    icacls $photosPath /grant 'Authenticated Users:(OI)(CI)R' /T | Out-Null
}

$hostname = $env:COMPUTERNAME
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -ExpandProperty IPAddress

Write-Host ''
Write-Host "Share created: \\$hostname\$shareName"
Write-Host "Folder: $photosPath"
if ($ips) {
    Write-Host 'IPs:'
    $ips | ForEach-Object { Write-Host "  \\$_\$shareName" }
}
Write-Host ''
Write-Host 'On your personal PC: File Explorer → This PC → Map network drive'
Write-Host "  Folder: \\$hostname\$shareName"
Write-Host '  Use an enabled server username/password when prompted.'
