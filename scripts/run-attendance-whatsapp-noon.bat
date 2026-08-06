@echo off
cd /d D:\malcon-nexus
set ATTENDANCE_REPORT_FILTERS=in,absent
"C:\Program Files\nodejs\node.exe" scripts\daily-attendance-whatsapp.mjs >> D:\MalconNexus\AttendanceReports\_whatsapp-noon-task.log 2>&1
