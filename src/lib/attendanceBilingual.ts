/** English + Telugu copy for employee attendance UI */

export const ATTENDANCE_ERROR_TE: Record<string, string> = {
  'Please provide a reason for punch out (at least 10 characters).':
    'Punch out కారణం తప్పనిసరి (కనీసం 10 అక్షరాలు).',
  'Please provide a reason (at least 10 characters).':
    'కారణం తప్పనిసరి (కనీసం 10 అక్షరాలు).',
  'You are not punched in yet. Punch in first.':
    'మీరు ఇంకా punch in చేయలేదు. ముందు punch in చేయండి.',
  'You are already punched in. Punch out first.':
    'మీరు ఇప్పటికే punch in అయ్యారు. ముందు punch out చేయండి.',
  'You already have a pending off-site punch-in request awaiting admin approval.':
    'మీ off-site punch in request admin approval కోసం వేచి ఉంది.',
  'You are at the office. Use regular punch in instead.':
    'మీరు office లో ఉన్నారు. సాధారణ punch in ఉపయోగించండి.',
  'Location required to punch.':
    'Punch చేయడానికి location (GPS) అవసరం.',
  'Location permission denied. Please allow location access to punch attendance.':
    'Location permission ఇవ్వలేదు. GPS allow చేసి మళ్లీ ప్రయత్నించండి.',
  'Unable to detect your location. Please try again outdoors or enable GPS.':
    'Location detect avvaledu. Bayata try cheyandi leka GPS on cheyandi.',
  'Location request timed out. Please try again.':
    'Location time out ayyindi. Malli try cheyandi.',
  'Location is not supported on this device.':
    'Ee device lo location support ledu.',
  'Failed to get location.':
    'Location teesukolekapoyamu.',
};

export function attendanceErrorTe(message: string): string | null {
  return ATTENDANCE_ERROR_TE[message] ?? null;
}
