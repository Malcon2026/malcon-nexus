@echo off
REM Daily 9:30 AM — punched-in report to WhatsApp group + boss (same run)
cd /d D:\malcon-nexus
"C:\Program Files\nodejs\node.exe" scripts\daily-attendance-whatsapp.mjs >> D:\MalconNexus\AttendanceReports\_whatsapp-task.log 2>&1
