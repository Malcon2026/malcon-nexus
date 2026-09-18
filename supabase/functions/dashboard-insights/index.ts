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
};

function buildPrompt(metrics: AdminDashboardMetrics): string {
  return [
    'You summarize Malcon Nexus implant-case operations for an admin.',
    'Use ONLY the JSON metrics below. Do not invent numbers, names, or hospitals.',
    'Write 3–5 short bullet points in plain English. Mention urgent items (approvals, restock, cleaning) if counts > 0.',
    'No markdown headings. Start each line with "• ".',
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

const DEFAULT_GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-3.8-flash',
  'gemini-flash-latest',
];

function uniqueModels(configured: string | undefined): string[] {
  const list = configured ? [configured, ...DEFAULT_GEMINI_MODELS] : [...DEFAULT_GEMINI_MODELS];
  return [...new Set(list.map((m) => m.trim()).filter(Boolean))];
}

async function callGeminiWithFallback(apiKey: string, prompt: string): Promise<string> {
  const isAuthKey = apiKey.startsWith('AQ.');
  const models = uniqueModels(Deno.env.get('GEMINI_MODEL')?.trim());

  let lastError: Error | null = null;
  for (const model of models) {
    const attempts = isAuthKey
      ? [() => callGeminiInteractions(apiKey, model, prompt), () => callGeminiGenerateContent(apiKey, model, prompt)]
      : [() => callGeminiGenerateContent(apiKey, model, prompt), () => callGeminiInteractions(apiKey, model, prompt)];

    for (const attempt of attempts) {
      try {
        return await attempt();
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }
  throw lastError ?? new Error('Gemini request failed');
}

function isValidMetrics(raw: unknown): raw is AdminDashboardMetrics {
  if (!raw || typeof raw !== 'object') return false;
  const m = raw as Record<string, unknown>;
  return (
    typeof m.dateLabel === 'string' &&
    typeof m.activeCases === 'number' &&
    typeof m.totalCases === 'number' &&
    Array.isArray(m.stageBreakdown)
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
    if (caller.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = await req.json().catch(() => null);
    const metrics = body?.metrics;
    if (!isValidMetrics(metrics)) {
      return jsonResponse({ error: 'Invalid metrics payload' }, 400);
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY')?.trim() ?? '';
    if (!apiKey) {
      return jsonResponse({ error: 'GEMINI_API_KEY is not configured', code: 'GEMINI_NOT_CONFIGURED' }, 503);
    }

    const summary = await callGeminiWithFallback(apiKey, buildPrompt(metrics));

    return jsonResponse({
      summary,
      source: 'gemini',
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[dashboard-insights]', err);
    const message = err instanceof Error ? err.message : 'Insight generation failed';
    return jsonResponse({ error: message }, 502);
  }
});
