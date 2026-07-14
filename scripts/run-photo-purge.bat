@echo off
cd /d D:\malcon-nexus
"C:\Program Files\nodejs\node.exe" scripts\purge-old-photos.mjs >> D:\MalconNexus\Photos\_purge-task.log 2>&1
