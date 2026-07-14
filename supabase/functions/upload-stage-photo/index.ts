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

    if (!supabaseUrl || !serviceRoleKey) {
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
    const file = form.get('photo');

    if (!caseId || !stage || !(file instanceof File)) {
      return jsonResponse({ error: 'caseId, stage, and photo are required' }, 400);
    }

    const fileName = file.name || 'stage-photo.jpg';
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(fileName);

    if (!isImage) {
      return jsonResponse({ error: 'Photo must be an image' }, 400);
    }

    if (file.size > 5 * 1024 * 1024) {
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
      .select('assigned_employee_id')
      .eq('id', caseId)
      .single();

    if (!caseRow) return jsonResponse({ error: 'Case not found' }, 404);

    const isAdmin = caller.role === 'admin';
    const isAssignee = caseRow.assigned_employee_id === caller.id;
    if (!isAdmin && !isAssignee) {
      return jsonResponse({ error: 'You are not assigned to this case' }, 403);
    }

    const photoId = crypto.randomUUID();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg';
    const path = `${caseId}/${sanitizeStage(stage)}/${Date.now()}-${photoId.slice(0, 8)}.${safeExt}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from('stage-photos')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });

    if (uploadError) {
      console.error('[upload-stage-photo]', uploadError.message);
      return jsonResponse({ error: uploadError.message }, 400);
    }

    const { data: urlData } = admin.storage.from('stage-photos').getPublicUrl(path);

    return jsonResponse({
      ok: true,
      document: {
        id: photoId,
        name: `${stage} photo`,
        type: file.type || 'image/jpeg',
        size: file.size,
        uploadedBy: uploadedBy || 'Employee',
        uploadedAt: new Date().toISOString(),
        url: urlData.publicUrl,
      },
    });
  } catch (err) {
    console.error('[upload-stage-photo]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
