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

type Place = {
  name: string;
  address: string;
  eloc: string;
  lat: number | null;
  lng: number | null;
  source: 'mappls';
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function num(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : NaN;
  return Number.isFinite(n) ? n : null;
}

function pickLatLng(row: Record<string, unknown>): { lat: number | null; lng: number | null } {
  const data = asRecord(row.data) ?? {};
  const location = asRecord(row.location) ?? {};
  const lat = num(row.latitude) ?? num(row.lat) ?? num(data.latitude) ?? num(location.latitude);
  const lng = num(row.longitude) ?? num(row.lng) ?? num(data.longitude) ?? num(location.longitude);
  return { lat, lng };
}

async function mapplsEntity(
  key: string,
  eloc: string,
): Promise<{ lat: number | null; lng: number | null }> {
  const encodedKey = encodeURIComponent(key);
  const encodedEloc = encodeURIComponent(eloc);
  const urls = [
    `https://explore.mappls.com/apis/O2O/entity/${encodedEloc}?access_token=${encodedKey}`,
    `https://explore.mappls.com/api/places/details?mapplsPin=${encodedEloc}&access_token=${encodedKey}`,
  ];
  for (const url of urls) {
    const res = await fetch(url);
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const { lat, lng } = pickLatLng(payload);
    if (lat != null && lng != null) return { lat, lng };
  }
  return { lat: null, lng: null };
}

async function mapplsAutosuggest(
  key: string,
  query: string,
  lat: number,
  lng: number,
): Promise<Place[]> {
  const url =
    `https://search.mappls.com/search/places/autosuggest/json?query=${encodeURIComponent(query)}` +
    `&location=${encodeURIComponent(`${lat},${lng}`)}&region=IND&hyperLocal=` +
    `&access_token=${encodeURIComponent(key)}`;
  const res = await fetch(url);
  const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const rows = Array.isArray(payload.suggestedLocations) ? payload.suggestedLocations : [];
  const places: Place[] = [];
  for (const raw of rows.slice(0, 8)) {
    const row = asRecord(raw);
    if (!row) continue;
    const name = String(row.placeName ?? row.poi ?? '').trim();
    const eloc = String(row.eLoc ?? row.eloc ?? '').trim();
    if (!name) continue;
    const { lat: rowLat, lng: rowLng } = pickLatLng(row);
    places.push({
      name,
      address: String(row.placeAddress ?? '').trim(),
      eloc,
      lat: rowLat,
      lng: rowLng,
      source: 'mappls',
    });
  }
  return places;
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
    const rawQuery = String(body.query ?? '').trim();
    if (rawQuery.length < 2) return jsonResponse({ places: [] });
    const query = /\b(hospital|clinic|nursing|medical)\b/i.test(rawQuery)
      ? rawQuery
      : `${rawQuery} hospital`;

    const lat = Number(body.lat);
    const lng = Number(body.lng);
    const biasLat = Number.isFinite(lat) ? lat : 17.4470625;
    const biasLng = Number.isFinite(lng) ? lng : 78.4465625;

    const mapplsKey = Deno.env.get('MAPPLS_REST_KEY') ?? '';
    if (!mapplsKey) {
      return jsonResponse({ error: 'Set MAPPLS_REST_KEY as a Supabase Edge Function secret.' }, 501);
    }

    const places = await mapplsAutosuggest(mapplsKey, query, biasLat, biasLng);
    await Promise.all(
      places.map(async (place, index) => {
        if (place.lat != null && place.lng != null) return;
        if (!place.eloc) return;
        const pin = await mapplsEntity(mapplsKey, place.eloc);
        places[index] = { ...place, lat: pin.lat, lng: pin.lng };
      }),
    );

    return jsonResponse({ places });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Search failed';
    return jsonResponse({ error: message }, 500);
  }
});
