import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const IST = 'Asia/Kolkata';
const DEFAULT_DAYS = 30;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function istDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: IST });
}

function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

function recentDateKeys(days: number): string[] {
  const keys: string[] = [];
  const today = todayIST();
  const [y, m, d] = today.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d - i, 12, 0, 0));
    keys.push(dt.toLocaleDateString('en-CA', { timeZone: IST }));
  }
  return keys;
}

function isImageUrl(url: string): boolean {
  return /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(url) || url.includes('/storage/v1/object/public/');
}

function isImageDoc(doc: { type?: string; url?: string; name?: string }): boolean {
  if (!doc.url) return false;
  if (doc.type?.startsWith('image/')) return true;
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.name ?? '')) return true;
  return isImageUrl(doc.url);
}

type AttendancePhoto = {
  id: string;
  url: string;
  cap: string;
  sub: string;
  at: string;
};

type CasePhoto = {
  id: string;
  url: string;
  cap: string;
  sub: string;
  at: string;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token') ?? '';
    const expected = Deno.env.get('GALLERY_TOKEN') ?? '';

    if (!expected) {
      return jsonResponse({ error: 'Gallery not configured' }, 503);
    }
    if (!token || !safeEqual(token, expected)) {
      return jsonResponse({ error: 'Invalid or missing token' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const days = Math.min(60, Math.max(1, Number(url.searchParams.get('days') ?? DEFAULT_DAYS) || DEFAULT_DAYS));
    const dateKey = url.searchParams.get('dateKey') ?? '';
    const type = url.searchParams.get('type') ?? '';

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const since = new Date();
    since.setDate(since.getDate() - (days + 1));

    const [{ data: records, error: recErr }, { data: approvals, error: apprErr }, { data: cases, error: caseErr }] =
      await Promise.all([
        admin
          .from('attendance_records')
          .select('id, employee_id, employee_name, selfie_url, punched_at')
          .eq('punch_type', 'in')
          .not('selfie_url', 'is', null)
          .gte('punched_at', since.toISOString())
          .order('punched_at', { ascending: false }),
        admin
          .from('attendance_approval_requests')
          .select('id, employee_id, employee_name, selfie_url, requested_at, punch_type')
          .eq('punch_type', 'in')
          .not('selfie_url', 'is', null)
          .gte('requested_at', since.toISOString())
          .order('requested_at', { ascending: false }),
        admin
          .from('cases')
          .select('id, case_number, stages, hospital_snapshot')
          .order('updated_at', { ascending: false })
          .limit(500),
      ]);

    if (recErr) console.error('[gallery-feed] attendance_records', recErr.message);
    if (apprErr) console.error('[gallery-feed] approval_requests', apprErr.message);
    if (caseErr) console.error('[gallery-feed] cases', caseErr.message);

    const employeeIds = new Set<string>();
    for (const r of records ?? []) employeeIds.add(r.employee_id as string);
    for (const a of approvals ?? []) employeeIds.add(a.employee_id as string);

    const codeByEmployee = new Map<string, string>();
    if (employeeIds.size > 0) {
      const { data: emps } = await admin
        .from('employees')
        .select('id, employee_code')
        .in('id', [...employeeIds]);
      for (const e of emps ?? []) {
        if (e.employee_code) codeByEmployee.set(e.id as string, e.employee_code as string);
      }
    }

    const attByDate = new Map<string, AttendancePhoto[]>();

    function pushAtt(date: string, photo: AttendancePhoto) {
      const list = attByDate.get(date) ?? [];
      list.push(photo);
      attByDate.set(date, list);
    }

    for (const row of records ?? []) {
      const at = row.punched_at as string;
      const dk = istDateKey(at);
      const code = codeByEmployee.get(row.employee_id as string);
      pushAtt(dk, {
        id: row.id as string,
        url: row.selfie_url as string,
        cap: (row.employee_name as string) || 'Staff',
        sub: code ? `${code} · punch in` : 'punch in',
        at,
      });
    }

    for (const row of approvals ?? []) {
      const at = row.requested_at as string;
      const dk = istDateKey(at);
      const code = codeByEmployee.get(row.employee_id as string);
      pushAtt(dk, {
        id: row.id as string,
        url: row.selfie_url as string,
        cap: (row.employee_name as string) || 'Staff',
        sub: code ? `${code} · off-site punch in` : 'off-site punch in',
        at,
      });
    }

    const caseByDate = new Map<string, CasePhoto[]>();

    function pushCase(date: string, photo: CasePhoto) {
      const list = caseByDate.get(date) ?? [];
      list.push(photo);
      caseByDate.set(date, list);
    }

    const validDates = new Set(recentDateKeys(days));

    for (const c of cases ?? []) {
      const caseNumber = (c.case_number as string) || 'Case';
      const snapshot = (c.hospital_snapshot as { name?: string } | null) ?? {};
      const hospital = snapshot.name ?? '';
      const stages = (c.stages as Array<{ stage?: string; documents?: Array<Record<string, unknown>> }>) ?? [];
      for (const stage of stages) {
        const stageName = stage.stage ?? 'Stage';
        for (const doc of stage.documents ?? []) {
          if (!isImageDoc(doc as { type?: string; url?: string; name?: string })) continue;
          const uploadedAt = String(doc.uploadedAt ?? doc.uploaded_at ?? '');
          if (!uploadedAt) continue;
          const dk = istDateKey(uploadedAt);
          if (!validDates.has(dk)) continue;
          pushCase(dk, {
            id: String(doc.id ?? `${c.id}-${stageName}`),
            url: String(doc.url),
            cap: caseNumber,
            sub: `${stageName}${hospital ? ` · ${hospital}` : ''}`,
            at: uploadedAt,
          });
        }
      }
    }

    for (const [, list] of attByDate) {
      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }
    for (const [, list] of caseByDate) {
      list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    }

    if (dateKey && (type === 'att' || type === 'case')) {
      const photos = type === 'att' ? (attByDate.get(dateKey) ?? []) : (caseByDate.get(dateKey) ?? []);
      return jsonResponse({ ok: true, dateKey, type, photos });
    }

    const dateKeys = recentDateKeys(days);
    const albums = dateKeys.map((dk) => {
      const att = attByDate.get(dk) ?? [];
      const cas = caseByDate.get(dk) ?? [];
      return {
        dateKey: dk,
        attCount: att.length,
        caseCount: cas.length,
        attThumbs: att.slice(0, 3).map((p) => p.url),
        caseThumbs: cas.slice(0, 3).map((p) => p.url),
      };
    });

    const attTotal = albums.reduce((s, a) => s + a.attCount, 0);
    const caseTotal = albums.reduce((s, a) => s + a.caseCount, 0);

    return jsonResponse({
      ok: true,
      todayKey: todayIST(),
      albums,
      attTotal,
      caseTotal,
    });
  } catch (err) {
    console.error('[gallery-feed]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
