@echo off
cd /d D:\malcon-nexus
"C:\Program Files\nodejs\node.exe" scripts\windows-photo-sync.mjs >> D:\MalconNexus\Photos\_sync-task.log 2>&1
