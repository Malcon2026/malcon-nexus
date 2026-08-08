@echo off
REM Daily 12:00 PM — punched-in + absent + unclosed (forgot punch out) to group + boss
cd /d D:\malcon-nexus
set ATTENDANCE_REPORT_FILTERS=in,absent,unclosed
"C:\Program Files\nodejs\node.exe" scripts\daily-attendance-whatsapp.mjs >> D:\MalconNexus\AttendanceReports\_whatsapp-noon-task.log 2>&1
