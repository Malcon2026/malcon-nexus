import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';
import { OFFICE_LOCATION } from './attendance';
import type { Hospital } from '../types';

export type HospitalPlace = {
  id: string;
  name: string;
  address: string;
  eloc: string;
  lat: number | null;
  lng: number | null;
  source: 'malcon' | 'mappls';
};

function malconMatches(hospital: Hospital, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;
  const hay = `${hospital.name} ${hospital.branch} ${hospital.city} ${hospital.address}`.toLowerCase();
  return hay.includes(q);
}

export function searchMalconHospitals(hospitals: Hospital[], query: string): HospitalPlace[] {
  return hospitals
    .filter((h) => h.status === 'Active' && malconMatches(h, query))
    .slice(0, 6)
    .map((h) => ({
      id: `malcon:${h.id}`,
      name: h.branch ? `${h.name} (${h.branch})` : h.name,
      address: [h.address, h.city].filter(Boolean).join(', '),
      eloc: '',
      lat: null,
      lng: null,
      source: 'malcon' as const,
    }));
}

export async function searchMapplsHospitals(
  query: string,
  lat?: number,
  lng?: number,
): Promise<HospitalPlace[]> {
  if (!USE_SUPABASE || query.trim().length < 2) return [];

  const { data, error } = await supabase.functions.invoke('location-hospital-search', {
    body: {
      query: query.trim(),
      lat: lat ?? OFFICE_LOCATION.latitude,
      lng: lng ?? OFFICE_LOCATION.longitude,
    },
  });

  if (error) {
    console.warn('[hospital-search]', error.message);
    return [];
  }

  const rows = Array.isArray((data as { places?: unknown })?.places)
    ? ((data as { places: Record<string, unknown>[] }).places)
    : [];

  return rows.map((row, index) => {
    const name = String(row.name ?? '').trim();
    const eloc = String(row.eloc ?? '').trim();
    const latN = Number(row.lat);
    const lngN = Number(row.lng);
    return {
      id: `mappls:${eloc || name}:${index}`,
      name,
      address: String(row.address ?? '').trim(),
      eloc,
      lat: Number.isFinite(latN) ? latN : null,
      lng: Number.isFinite(lngN) ? lngN : null,
      source: 'mappls' as const,
    };
  }).filter((p) => p.name);
}
