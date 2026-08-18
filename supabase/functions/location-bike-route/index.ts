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

function minutesFromSeconds(seconds: number): number {
  return Math.max(1, Math.round(seconds / 60));
}

function googleDurationSeconds(duration: unknown): number | null {
  if (typeof duration === 'number' && Number.isFinite(duration)) return duration;
  if (typeof duration === 'string') {
    const match = duration.match(/^(\d+(?:\.\d+)?)s$/);
    if (match) return Number(match[1]);
  }
  return null;
}

type BikeRoute = {
  km: number;
  minutes: number | null;
  source: 'google' | 'mappls';
  mode: 'TWO_WHEELER';
};

async function googleTwoWheeler(
  key: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<BikeRoute | null> {
  const requestBody = {
    origin: { location: { latLng: { latitude: startLat, longitude: startLng } } },
    destination: { location: { latLng: { latitude: endLat, longitude: endLng } } },
    travelMode: 'TWO_WHEELER',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    languageCode: 'en-IN',
    units: 'METRIC',
  };

  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': 'routes.distanceMeters,routes.duration',
    },
    body: JSON.stringify(requestBody),
  });
  const payload = await res.json().catch(() => ({}));
  const route = payload?.routes?.[0];
  const meters = route?.distanceMeters;
  if (typeof meters !== 'number' || meters < 0) {
    console.warn('[location-bike-route] Google:', payload?.error?.message ?? res.status);
    return null;
  }
  const seconds = googleDurationSeconds(route?.duration);
  return {
    km: roundKm(meters),
    minutes: seconds != null ? minutesFromSeconds(seconds) : null,
    source: 'google',
    mode: 'TWO_WHEELER',
  };
}

async function mapplsBike(
  key: string,
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number,
): Promise<BikeRoute | null> {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url =
    `https://apis.mappls.com/advancedmaps/v1/${encodeURIComponent(key)}` +
    `/distance_matrix/biking/${coords}?region=ind`;
  const res = await fetch(url);
  const payload = await res.json().catch(() => ({}));
  const meters =
    payload?.results?.distances?.[0]?.[1] ??
    payload?.distances?.[0]?.[1];
  const seconds =
    payload?.results?.durations?.[0]?.[1] ??
    payload?.durations?.[0]?.[1];
  if (typeof meters !== 'number' || meters < 0) {
    console.warn('[location-bike-route] Mappls:', payload?.message ?? res.status);
    return null;
  }
  return {
    km: roundKm(meters),
    minutes: typeof seconds === 'number' && seconds >= 0 ? minutesFromSeconds(seconds) : null,
    source: 'mappls',
    mode: 'TWO_WHEELER',
  };
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
      const route = await googleTwoWheeler(googleKey, startLat, startLng, endLat, endLng);
      if (route) return jsonResponse(route);
    }

    if (mapplsKey) {
      const route = await mapplsBike(mapplsKey, startLat, startLng, endLat, endLng);
      if (route) return jsonResponse(route);
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
