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
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://malcon-nexus.vercel.app';

    if (!resendKey) {
      return jsonResponse({ error: 'RESEND_API_KEY is not configured' }, 500);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: 'Supabase service credentials are not configured' }, 500);
    }

    const { caseId, employeeId } = await req.json();
    if (!caseId || !employeeId) {
      return jsonResponse({ error: 'caseId and employeeId are required' }, 400);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [{ data: caseRow, error: caseError }, { data: employee, error: employeeError }] =
      await Promise.all([
        supabase
          .from('cases')
          .select('case_number, current_stage, hospital_snapshot, surgery_date, priority')
          .eq('id', caseId)
          .single(),
        supabase.from('employees').select('name, email, department').eq('id', employeeId).single(),
      ]);

    if (caseError || !caseRow) {
      return jsonResponse({ error: 'Case not found' }, 404);
    }
    if (employeeError || !employee?.email) {
      return jsonResponse({ error: 'Employee email not found' }, 404);
    }

    const hospitalSnapshot = caseRow.hospital_snapshot as { name?: string } | null;
    const hospitalName = hospitalSnapshot?.name ?? 'Hospital';

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [employee.email],
        subject: `New case assigned: ${caseRow.case_number}`,
        html: `
          <div style="font-family: Inter, Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
            <h2 style="margin-bottom: 8px;">Malcon Nexus</h2>
            <p>Hi ${employee.name},</p>
            <p>You have been assigned a new implant case.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr><td style="padding: 8px 0; color: #6b7280;">Case</td><td style="padding: 8px 0;"><strong>${caseRow.case_number}</strong></td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Hospital</td><td style="padding: 8px 0;">${hospitalName}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Stage</td><td style="padding: 8px 0;">${caseRow.current_stage}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Department</td><td style="padding: 8px 0;">${employee.department}</td></tr>
              <tr><td style="padding: 8px 0; color: #6b7280;">Priority</td><td style="padding: 8px 0;">${caseRow.priority}</td></tr>
            </table>
            <p>
              <a href="${appUrl}" style="display: inline-block; background: #111827; color: #fff; text-decoration: none; padding: 10px 16px; border-radius: 8px;">
                Open Malcon Nexus
              </a>
            </p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">Malcon Nexus by Malcon Life Sciences</p>
          </div>
        `,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('[send-assignment-email] Resend error:', errText);
      return jsonResponse({ error: 'Failed to send email', details: errText }, 502);
    }

    const resendData = await resendRes.json();
    return jsonResponse({ ok: true, id: resendData.id });
  } catch (err) {
    console.error('[send-assignment-email]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
