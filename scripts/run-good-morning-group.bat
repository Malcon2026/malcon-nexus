@echo off
cd /d D:\malcon-nexus
"C:\Program Files\nodejs\node.exe" scripts\daily-attendance-whatsapp.mjs --good-morning-group >> D:\MalconNexus\AttendanceReports\_good-morning-group.log 2>&1
