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

function roundKm(meters: number): number {
  return Math.round((meters / 1000) * 10) / 10;
}

async function googleTwoWheelerKm(
  key: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<number | null> {
  const body = {
    origin: { location: { latLng: { latitude: startLat, longitude: startLng } } },
    destination: { location: { latLng: { latitude: endLat, longitude: endLng } } },
    travelMode: 'TWO_WHEELER',
    computeAlternativeRoutes: false,
    languageCode: 'en-IN',
    units: 'METRIC',
  };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters',
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  const meters = payload?.routes?.[0]?.distanceMeters;
  if (typeof meters === 'number' && meters >= 0) return roundKm(meters);
  console.warn('[location-bike-route] Google:', payload?.error?.message ?? res.status);
  return null;
}

async function mapplsBikeKm(
  key: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<number | null> {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url =
    `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(key)}` +
    `/distance_matrix/biking/${coords}?region=ind`;
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  const meters =
    payload?.results?.distances?.[0]?.[1] ??
    payload?.distances?.[0]?.[1];
  if (typeof meters === 'number' && meters >= 0) return roundKm(meters);
  console.warn('[location-bike-route] Mappls:', payload?.message ?? res.status);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) {
      return jsonResponse({ error: 'Server credentials not configured' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const startLat = Number(body.startLat);
    const startLng = Number(body.startLng);
    const endLat = Number(body.endLat);
    const endLng = Number(body.endLng);
    if (![startLat, startLng, endLat, endLng].every(Number.isFinite)) {
      return jsonResponse({ error: 'Need start and end coordinates.' }, 400);
    }

    const googleKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? '';
    const mapplsKey = Deno.env.get('MAPPLS_REST_KEY') ?? '';

    if (googleKey) {
      const km = await googleTwoWheelerKm(googleKey, startLat, startLng, endLat, endLng);
      if (km != null) return jsonResponse({ km, source: 'google' });
    }

    if (mapplsKey) {
      const km = await mapplsBikeKm(mapplsKey, startLat, startLng, endLat, endLng);
      if (km != null) return jsonResponse({ km, source: 'mappls' });
    }

    if (!googleKey && !mapplsKey) {
      return jsonResponse({
        error: 'Set GOOGLE_MAPS_API_KEY or MAPPLS_REST_KEY as a Supabase Edge Function secret.',
      }, 501);
    }

    return jsonResponse({ error: 'Could not get a bike route for those two points.' }, 502);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Route failed';
    return jsonResponse({ error: message }, 500);
  }
});
