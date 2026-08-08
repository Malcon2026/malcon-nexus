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
    const requestId = String(form.get('requestId') ?? '');
    const recordId = String(form.get('recordId') ?? '');
    const file = form.get('photo');

    if (!(file instanceof File) || (!requestId && !recordId) || (requestId && recordId)) {
      return jsonResponse({ error: 'Provide requestId or recordId (not both) and photo' }, 400);
    }

    const fileName = file.name || 'selfie.jpg';
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

    let employeeId: string;
    let storageKey: string;
    let updateTable: 'attendance_approval_requests' | 'attendance_records';
    let updateId: string;

    if (requestId) {
      const { data: approvalRow } = await admin
        .from('attendance_approval_requests')
        .select('id, employee_id, punch_type, status')
        .eq('id', requestId)
        .maybeSingle();

      if (!approvalRow) return jsonResponse({ error: 'Approval request not found' }, 404);

      const isAdmin = caller.role === 'admin';
      const isOwner = approvalRow.employee_id === caller.id;
      if (!isAdmin && !isOwner) {
        return jsonResponse({ error: 'Not allowed to upload for this request' }, 403);
      }

      employeeId = approvalRow.employee_id as string;
      storageKey = requestId;
      updateTable = 'attendance_approval_requests';
      updateId = requestId;
    } else {
      const { data: recordRow } = await admin
        .from('attendance_records')
        .select('id, employee_id, punch_type')
        .eq('id', recordId)
        .maybeSingle();

      if (!recordRow) return jsonResponse({ error: 'Attendance record not found' }, 404);
      if (recordRow.punch_type !== 'in') {
        return jsonResponse({ error: 'Selfie is only for punch in' }, 400);
      }

      const isAdmin = caller.role === 'admin';
      const isOwner = recordRow.employee_id === caller.id;
      if (!isAdmin && !isOwner) {
        return jsonResponse({ error: 'Not allowed to upload for this record' }, 403);
      }

      employeeId = recordRow.employee_id as string;
      storageKey = recordId;
      updateTable = 'attendance_records';
      updateId = recordId;
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif'].includes(ext) ? ext : 'jpg';
    const path = `${employeeId}/${storageKey}.${safeExt}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await admin.storage
      .from('attendance-selfies')
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('[upload-attendance-selfie]', uploadError.message);
      return jsonResponse({ error: uploadError.message }, 400);
    }

    const { data: urlData } = admin.storage.from('attendance-selfies').getPublicUrl(path);
    const selfieUrl = urlData.publicUrl;

    const { error: updateError } = await admin
      .from(updateTable)
      .update({ selfie_url: selfieUrl })
      .eq('id', updateId);

    if (updateError) {
      console.error('[upload-attendance-selfie] db update', updateError.message);
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse({ ok: true, url: selfieUrl });
  } catch (err) {
    console.error('[upload-attendance-selfie]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
