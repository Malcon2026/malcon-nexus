@echo off
cd /d D:\malcon-nexus
"C:\Program Files\nodejs\node.exe" scripts\daily-attendance-whatsapp.mjs --good-morning-dm >> D:\MalconNexus\AttendanceReports\_good-morning-dm.log 2>&1
