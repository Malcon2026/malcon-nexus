const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** GitHub Pages — browsers render HTML correctly (Supabase /functions/ URLs show raw source in Chrome). */
const GALLERY_PAGES_URL = 'https://malcon2026.github.io/malcon-nexus/';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';
  const expected = Deno.env.get('GALLERY_TOKEN') ?? '';

  if (!expected) {
    return new Response('Gallery not configured', { status: 503, headers: corsHeaders });
  }
  if (!token || !safeEqual(token, expected)) {
    return new Response('Invalid or missing token. Use ?token=YOUR_SECRET', {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  const dest = `${GALLERY_PAGES_URL}?token=${encodeURIComponent(token)}`;
  return Response.redirect(dest, 302);
});
