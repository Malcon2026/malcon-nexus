/** Short, plain English for employee attendance messages */

export function simplifyAttendanceError(message: string): string {
  const map: Record<string, string> = {
    'Please provide a reason for punch out (at least 10 characters).':
      'Write why you are leaving (at least 10 letters).',
    'Please provide a reason (at least 10 characters).':
      'Write a reason (at least 10 letters).',
    'You are not punched in yet. Punch in first.':
      'You are not IN yet. Punch In first.',
    'You are already punched in. Punch out first.':
      'You are already IN. Punch Out first.',
    'You already have a pending off-site punch-in request awaiting admin approval.':
      'Your punch in is waiting for admin approval.',
    'You are at the office. Use regular punch in instead.':
      'You are at office. Use Punch In button.',
    'Location required to punch.':
      'Turn on GPS / location to punch.',
    'Location permission denied. Please allow location access to punch attendance.':
      'Allow location in phone settings, then try again.',
    'Unable to detect your location. Please try again outdoors or enable GPS.':
      'Cannot find your location. Go outside or turn on GPS.',
    'Location request timed out. Please try again.':
      'Location took too long. Try again.',
    'Location is not supported on this device.':
      'This phone does not support location.',
    'Failed to get location.':
      'Could not get location. Try again.',
  };
  return map[message] ?? message;
}
