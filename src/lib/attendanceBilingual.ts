import { simplifyAttendanceError } from './attendanceSimpleEnglish';

/** Telugu for store / GPS error messages (original English keys) */
const ATTENDANCE_ERROR_TE: Record<string, string> = {
  'Please provide a reason for punch out (at least 10 characters).':
    'Punch out కారణం తప్పనిసరి (కనీసం 10 అక్షరాలు).',
  'Please provide a reason (at least 10 characters).':
    'కారణం తప్పనిసరి (కనీసం 10 అక్షరాలు).',
  'You are not punched in yet. Punch in first.':
    'మీరు ఇంకా Punch In చేయలేదు. ముందు Punch In చేయండి.',
  'You are already punched in. Punch out first.':
    'మీరు ఇప్పటికే Punch In అయ్యారు. ముందు Punch Out చేయండి.',
  'You already have a pending off-site punch-in request awaiting admin approval.':
    'మీ Punch In admin approval కోసం వేచి ఉంది.',
  'You are at the office. Use regular punch in instead.':
    'మీరు office లో ఉన్నారు. సాధారణ Punch In ఉపయోగించండి.',
  'Location required to punch.':
    'Punch చేయడానికి GPS / location అవసరం.',
  'Location permission denied. Please allow location access to punch attendance.':
    'Location permission ఇవ్వలేదు. Settings లో GPS allow చేసి మళ్లీ try చేయండి.',
  'Unable to detect your location. Please try again outdoors or enable GPS.':
    'Location detect avvaledu. Bayata try cheyandi leka GPS on cheyandi.',
  'Location request timed out. Please try again.':
    'Location time out ayyindi. Malli try cheyandi.',
  'Location is not supported on this device.':
    'Ee phone lo location support ledu.',
  'Failed to get location.':
    'Location teesukolekapoyamu. Malli try cheyandi.',
};

/** Telugu for simplified English shown in the UI */
const SIMPLE_ERROR_TE: Record<string, string> = {
  'Write why you are leaving (at least 10 letters).':
    'ఎందుకు వెళ్తున్నారో రాయండి (కనీసం 10 అక్షరాలు).',
  'Write a reason (at least 10 letters).':
    'కారణం రాయండి (కనీసం 10 అక్షరాలు).',
  'You are not IN yet. Punch In first.':
    'మీరు ఇంకా IN కాలేదు. ముందు Punch In చేయండి.',
  'You are already IN. Punch Out first.':
    'మీరు ఇప్పటికే IN అయ్యారు. ముందు Punch Out చేయండి.',
  'Your punch in is waiting for admin approval.':
    'మీ Punch In admin approval కోసం వేచి ఉంది.',
  'You are at office. Use Punch In button.':
    'మీరు office లో ఉన్నారు. Punch In button ఉపయోగించండి.',
  'Turn on GPS / location to punch.':
    'Punch చేయడానికి GPS / location on చేయండి.',
  'Allow location in phone settings, then try again.':
    'Phone settings లో location allow చేసి మళ్లీ try చేయండి.',
  'Cannot find your location. Go outside or turn on GPS.':
    'Location kanapadatledu. Bayata try cheyandi leka GPS on cheyandi.',
  'Location took too long. Try again.':
    'Location time out ayyindi. Malli try cheyandi.',
  'This phone does not support location.':
    'Ee phone lo location support ledu.',
  'Could not get location. Try again.':
    'Location teesukolekapoyamu. Malli try cheyandi.',
};

export function attendanceErrorTe(message: string): string | null {
  const simplified = simplifyAttendanceError(message);
  return SIMPLE_ERROR_TE[simplified] ?? ATTENDANCE_ERROR_TE[message] ?? null;
}

export function formatAttendanceError(message: string): { en: string; te: string | null } {
  const en = simplifyAttendanceError(message);
  return { en, te: attendanceErrorTe(message) };
}
