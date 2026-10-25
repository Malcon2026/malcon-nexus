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

function sanitizeStage(stage: string): string {
  return stage.toLowerCase().replace(/\s+/g, '-');
}

/** Drive folder names must not contain '/'. */
function folderName(stage: string): string {
  return stage.replace(/[/\\]/g, '-').trim();
}

/** "MLS-10-26-004 Total knee replacement" — the number keeps names unique. */
function caseFolderName(caseNumber: string, caseName: string | null): string {
  return folderName(`${caseNumber} ${caseName ?? ''}`.trim());
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const appsScriptUrl = Deno.env.get('APPS_SCRIPT_URL');
    const appsScriptToken = Deno.env.get('APPS_SCRIPT_TOKEN');

    if (!supabaseUrl || !serviceRoleKey || !appsScriptUrl || !appsScriptToken) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey ?? serviceRoleKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const form = await req.formData();
    const caseId = String(form.get('caseId') ?? '');
    const stage = String(form.get('stage') ?? '');
    const uploadedBy = String(form.get('uploadedBy') ?? '');
    const photo = form.get('photo');

    if (!caseId || !stage || !(photo instanceof File)) {
      return jsonResponse({ error: 'caseId, stage and photo are required' }, 400);
    }

    const isImage =
      photo.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(photo.name);
    if (!isImage) {
      return jsonResponse({ error: 'Photo must be an image' }, 400);
    }

    if (photo.size > 5 * 1024 * 1024) {
      return jsonResponse({ error: 'Photo must be under 5 MB' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: caller } = await admin
      .from('employees')
      .select('id, role')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (!caller) return jsonResponse({ error: 'Employee profile not found' }, 403);

    const { data: caseRow } = await admin
      .from('cases')
      .select('assigned_employee_id, case_number, implant_required')
      .eq('id', caseId)
      .single();

    if (!caseRow) return jsonResponse({ error: 'Case not found' }, 404);

    const stageKey = sanitizeStage(stage);
    const isSetPrep = stageKey === 'set-preparation' || stageKey === 'kit-preparation';
    const isAdmin = caller.role === 'admin';
    const isStoreSetPrep =
      caller.role === 'store_manager' && isSetPrep;
    if (caller.role === 'store_manager' && !isSetPrep) {
      return jsonResponse(
        { error: 'Store managers can upload Set Preparation photos only.' },
        403,
      );
    }
    const isAssignee = caseRow.assigned_employee_id === caller.id;
    if (!isAdmin && !isStoreSetPrep && !isAssignee) {
      return jsonResponse({ error: 'You are not assigned to this case' }, 403);
    }

    const photoId = crypto.randomUUID();
    const name = `${Date.now()}-${photoId.slice(0, 8)}.jpg`;

    const driveRes = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        token: appsScriptToken,
        caseFolder: caseFolderName(caseRow.case_number, caseRow.implant_required),
        stageFolder: folderName(stage),
        name,
        mimeType: photo.type || 'image/jpeg',
        base64: toBase64(await photo.arrayBuffer()),
      }),
    });
    const drive = await driveRes.json().catch(() => null);

    if (!driveRes.ok || !drive?.fileId) {
      console.error('[upload-stage-photo] drive', drive?.error ?? driveRes.status);
      return jsonResponse({ error: 'Photo storage is unavailable. Try again.' }, 502);
    }

    return jsonResponse({
      ok: true,
      document: {
        id: photoId,
        name: `${stage} photo`,
        type: photo.type || 'image/jpeg',
        size: photo.size,
        uploadedBy: uploadedBy || 'Employee',
        uploadedAt: new Date().toISOString(),
        url: `https://drive.google.com/thumbnail?id=${drive.fileId}&sz=w400`,
        driveFileId: drive.fileId,
      },
    });
  } catch (err) {
    console.error('[upload-stage-photo]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
