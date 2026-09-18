import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type StageRow = { stage: string; count: number };

type AdminDashboardMetrics = {
  dateLabel: string;
  todaySurgeryDate: string;
  activeCases: number;
  totalCases: number;
  pendingApprovals: number;
  inSurgery: number;
  cleaningAudit: number;
  restockPending: number;
  completed: number;
  todayTasks: number;
  fcfsPool: number;
  todaySurgeriesCount: number;
  stageBreakdown: StageRow[];
  todayCasesCount: number;
  todayOngoingCount: number;
  todayCompletedCount: number;
  todayChargeableCount: number;
  todayPendingApprovals: number;
  staffTotal: number;
  staffPresentIn: number;
  staffPunchedOut: number;
  staffAbsent: number;
  staffOnLeave: number;
};

type EmployeeDashboardMetrics = {
  firstName: string;
  dateLabel: string;
  todayDateKey: string;
  yesterdayDateLabel: string;
  yesterdayWorkedLabel: string;
  yesterdayPunched: boolean;
  todayPunchedIn: boolean;
  todayPunchLabel: string | null;
  activeMyCases: number;
  waitingMyCases: number;
  casesNeedingSubmit: number;
  foodSubmittedToday: boolean;
  pendingLeaveCount: number;
  unreadAlerts: number;
  locationTripOpen: boolean;
  petrolPending: number;
};

function buildAdminPrompt(metrics: AdminDashboardMetrics): string {
  return [
    'You write a short human dashboard note for a Malcon Nexus admin.',
    'Use ONLY the JSON metrics below. Do not invent numbers, names, or hospitals.',
    'Do NOT mention totalCases or all-time case totals — only todayCasesCount / today* fields for cases.',
    'Include staff: staffPresentIn, staffAbsent, staffOnLeave, staffPunchedOut when staffTotal > 0.',
    'Output EXACTLY 2 lines, each starting with "• ".',
    'Line 1: One warm conversational English sentence (good morning/afternoon/evening): today\'s cases (ongoing, done, billing/chargeable if any) plus who is present vs absent.',
    'Line 2: Natural Telugu translation (Telugu script, not romanized). Same facts, same tone.',
    'No markdown, no extra lines, no headings.',
    '',
    JSON.stringify(metrics),
  ].join('\n');
}

function buildEmployeePrompt(metrics: EmployeeDashboardMetrics): string {
  return [
    'You write a friendly personal daily brief for one Malcon Nexus employee (field staff).',
    'Use ONLY the JSON metrics below. Do not invent data or mention other people.',
    'Cover yesterday\'s hours, today\'s punch status, their cases, food choice, leave, alerts, location trip, or petrol if relevant.',
    'Write 3–4 short bullet points in plain English, encouraging but factual. No markdown headings. Start each line with "• ".',
    '',
    JSON.stringify(metrics),
  ].join('\n');
}

function geminiAuthHeaders(apiKey: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,
  };
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    const err = (payload as { error?: { message?: string } }).error;
    if (typeof err?.message === 'string' && err.message.trim()) return err.message;
  }
  return fallback;
}

/** Legacy REST (AIza… traffic keys). */
async function callGeminiGenerateContent(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: geminiAuthHeaders(apiKey),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.25, maxOutputTokens: 512 },
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, res.statusText || `Gemini HTTP ${res.status}`));
  }

  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty Gemini response');
  }
  return text.trim();
}

/** Auth keys (AQ.…) — Interactions API per Google AI Studio docs. */
async function callGeminiInteractions(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: geminiAuthHeaders(apiKey),
    body: JSON.stringify({
      model,
      input: prompt,
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(extractErrorMessage(payload, res.statusText || `Gemini HTTP ${res.status}`));
  }

  const text =
    payload?.output_text ??
    payload?.outputText ??
    payload?.interaction?.output_text ??
    payload?.interaction?.outputText;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('Empty Gemini interactions response');
  }
  return text.trim();
}

/** Google-recommended current models (Interactions API + generateContent fallback). */
const DEFAULT_GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-2.5-flash'];

const RETIRED_MODEL_MARKERS = /no longer available|not found|not supported|deprecated|404/i;

const AI_SUMMARY_CACHE_KEY = 'admin_dashboard_ai_summary';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

type SummaryCache = {
  summary: string;
  generatedAt: string;
  expiresAt: string;
};

function isQuotaError(message: string): boolean {
  return /quota|rate limit|429|resource_exhausted|exceeded your current quota/i.test(message);
}

async function readSummaryCache(
  admin: ReturnType<typeof createClient>,
  cacheKey: string,
  { allowStale = false }: { allowStale?: boolean } = {},
): Promise<SummaryCache | null> {
  const { data } = await admin
    .from('app_settings')
    .select('value')
    .eq('key', cacheKey)
    .maybeSingle();
  if (!data?.value) return null;
  try {
    const parsed = JSON.parse(data.value) as SummaryCache;
    if (!parsed.summary) return null;
    if (!allowStale && parsed.expiresAt && Date.now() > new Date(parsed.expiresAt).getTime()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

async function writeSummaryCache(
  admin: ReturnType<typeof createClient>,
  cacheKey: string,
  summary: string,
): Promise<void> {
  const generatedAt = new Date().toISOString();
  const payload: SummaryCache = {
    summary,
    generatedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  };
  await admin.from('app_settings').upsert({
    key: cacheKey,
    value: JSON.stringify(payload),
    updated_by: 'dashboard-insights',
  });
}

function employeeCacheKey(employeeId: string, todayDateKey: string): string {
  return `employee_dashboard_ai_summary_${employeeId}_${todayDateKey}`;
}

function uniqueModels(configured: string | undefined): string[] {
  const list = configured ? [configured, ...DEFAULT_GEMINI_MODELS] : [...DEFAULT_GEMINI_MODELS];
  return [...new Set(list.map((m) => m.trim()).filter(Boolean))];
}

async function callGeminiWithFallback(apiKey: string, prompt: string): Promise<string> {
  const configured = Deno.env.get('GEMINI_MODEL')?.trim();
  const models = uniqueModels(configured).filter((m) => !/^gemini-2\.0-flash/i.test(m));

  let lastError: Error | null = null;
  for (const model of models) {
    // Interactions API first (required for AQ keys; recommended for all new models).
    const attempts = [
      () => callGeminiInteractions(apiKey, model, prompt),
      () => callGeminiGenerateContent(apiKey, model, prompt),
    ];

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        lastError = err instanceof Error ? err : new Error(message);
        if (!RETIRED_MODEL_MARKERS.test(message) && !/Empty Gemini/i.test(message)) {
          // Auth/quota errors — don't burn through every model/API.
          if (/quota|401|403|invalid.*key|api key/i.test(message)) break;
        }
      }
    }
  }
  throw lastError ?? new Error('Gemini request failed');
}

function isValidAdminMetrics(raw: unknown): raw is AdminDashboardMetrics {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.dateLabel === 'string' &&
    typeof m.todayCasesCount === 'number' &&
    typeof m.staffAbsent === 'number' &&
    Array.isArray(m.stageBreakdown)
  );
}

function isValidEmployeeMetrics(raw: unknown): raw is EmployeeDashboardMetrics {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.firstName === 'string' &&
    typeof m.todayDateKey === 'string' &&
    typeof m.yesterdayWorkedLabel === 'string' &&
    typeof m.activeMyCases === 'number' &&
    typeof m.foodSubmittedToday === 'boolean'
  );
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: caller, error: callerError } = await admin
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (callerError || !caller) {
      return jsonResponse({ error: 'Your employee profile was not found' }, 403);
    }
    const body = await req.json().catch(() => null);
    const scope = body?.scope === 'employee' ? 'employee' : 'admin';
    const metrics = body?.metrics;
    const refresh = body?.refresh === true;

    if (scope === 'admin') {
      if (caller.role !== 'admin') {
        return jsonResponse({ error: 'Admin access required' }, 403);
      }
      if (!isValidAdminMetrics(metrics)) {
        return jsonResponse({ error: 'Invalid metrics payload' }, 400);
      }
    } else {
      if (caller.role !== 'employee') {
        return jsonResponse({ error: 'Employee access required' }, 403);
      }
      if (!isValidEmployeeMetrics(metrics)) {
        return jsonResponse({ error: 'Invalid employee metrics payload' }, 400);
      }
    }

    const cacheKey =
      scope === 'employee'
        ? employeeCacheKey(caller.id, metrics.todayDateKey)
        : AI_SUMMARY_CACHE_KEY;
    const prompt =
      scope === 'employee'
        ? buildEmployeePrompt(metrics)
        : buildAdminPrompt(metrics);

    const cached = await readSummaryCache(admin, cacheKey);
    if (!refresh && cached) {
      return jsonResponse({
        summary: cached.summary,
        source: 'cached',
        generatedAt: cached.generatedAt,
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY is not configured', code: 'GEMINI_NOT_CONFIGURED' }, 503);
    }

    try {
      const summary = await callGeminiWithFallback(apiKey, prompt);
      await writeSummaryCache(admin, cacheKey, summary);
      return jsonResponse({
        summary,
        source: 'gemini',
        generatedAt: new Date().toISOString(),
      });
    } catch (geminiErr) {
      const message = geminiErr instanceof Error ? geminiErr.message : 'Insight generation failed';
      if (isQuotaError(message)) {
        const stale = await readSummaryCache(admin, cacheKey, { allowStale: true });
        if (stale) {
          return jsonResponse({
            summary: stale.summary,
            source: 'cached',
            generatedAt: stale.generatedAt,
            notice: 'Using saved summary — Gemini free tier limit. Try Refresh in a minute.',
          });
        }
        return jsonResponse(
          {
            error: 'Gemini free tier limit reached. Wait about a minute, then click Refresh.',
            code: 'QUOTA_EXCEEDED',
          },
          429,
        );
      }
      throw geminiErr;
    }
  } catch (err) {
    console.error('[dashboard-insights]', err);
    const message = err instanceof Error ? err.message : 'Insight generation failed';
    return jsonResponse({ error: message }, 502);
  }
});
