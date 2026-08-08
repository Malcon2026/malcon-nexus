@echo off
cd /d D:\malcon-nexus
if not exist "D:\MalconNexus\PunchInSelfies" mkdir "D:\MalconNexus\PunchInSelfies"
"C:\Program Files\nodejs\node.exe" scripts\archive-punch-in-selfies.mjs >> D:\MalconNexus\PunchInSelfies\_selfie-archive-task.log 2>&1
