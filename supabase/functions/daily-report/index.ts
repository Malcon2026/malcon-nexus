import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * End-of-day CSV: every case created on the given India-time date, with its team.
 * Called every night at 23:59 IST by a pg_cron job ("daily-report", 18:29 UTC) that sends the x-report-token header.
 * Pass {"date":"2026-10-26"} in the body to rebuild a past day.
 */

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Today's date in India time, as YYYY-MM-DD. */
function istDateKey(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Start and end of an India-time day, as UTC ISO strings. */
function dayRange(dateKey: string): { start: string; end: string } {
  const start = new Date(`${dateKey}T00:00:00+05:30`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86_400_000).toISOString() };
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

Deno.serve(async (req) => {
  try {
    const reportToken = Deno.env.get('REPORT_TOKEN');
    if (!reportToken || req.headers.get('x-report-token') !== reportToken) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL');
    const appsScriptToken = Deno.env.get('APPS_SCRIPT_TOKEN');
    if (!supabaseUrl || !serviceRoleKey || !appsScriptUrl || !appsScriptToken) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const dateKey: string = body.date ?? istDateKey(new Date());
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return jsonResponse({ error: 'date must be YYYY-MM-DD' }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { start, end } = dayRange(dateKey);
    const { data: cases, error } = await admin
      .from('cases')
      .select(
        'case_number, implant_required, hospital_snapshot, doctor_snapshot, surgery_date, status, current_stage, assigned_employee_snapshot, created_by, activity_logs',
      )
      .gte('created_at', start)
      .lt('created_at', end)
      .order('case_number');
    if (error) {
      console.error('[daily-report]', error.message);
      return jsonResponse({ error: 'Could not read cases' }, 500);
    }

    const header = [
      'Case number',
      'Case name',
      'Hospital',
      'Doctor',
      'Surgery date',
      'Status',
      'Current stage',
      'Assigned employee',
      'Stages submitted by',
      'Created by',
    ];
    const lines = [header.map(csvCell).join(',')];

    for (const c of cases ?? []) {
      const logs: { action?: string; performedBy?: string }[] = Array.isArray(c.activity_logs) ? c.activity_logs : [];
      const submitters = [
        ...new Set(logs.filter((l) => (l.action ?? '').startsWith('Submitted')).map((l) => l.performedBy ?? '')),
      ].filter(Boolean);
      lines.push(
        [
          c.case_number,
          c.implant_required,
          c.hospital_snapshot?.name,
          c.doctor_snapshot?.name,
          c.surgery_date,
          c.status,
          c.current_stage,
          c.assigned_employee_snapshot?.name,
          submitters.join('; '),
          c.created_by,
        ]
          .map(csvCell)
          .join(','),
      );
    }
    lines.push(['Total cases', cases?.length ?? 0].map(csvCell).join(','));
    const csv = lines.join('\r\n') + '\r\n';

    const driveRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: appsScriptToken, action: 'report', date: dateKey, csv }),
    });
    const drive = await driveRes.json().catch(() => null);
    if (!driveRes.ok || !drive?.fileId) {
      console.error('[daily-report] drive', drive?.error ?? driveRes.status);
      return jsonResponse({ error: 'Could not save report to Drive' }, 502);
    }

    return jsonResponse({ ok: true, date: dateKey, cases: cases?.length ?? 0, fileId: drive.fileId });
  } catch (err) {
    console.error('[daily-report]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
