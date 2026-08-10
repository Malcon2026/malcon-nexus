import { formatTimeIST, getISTDateKey } from './attendance';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

function galleryUrl(params: Record<string, string>): string {
  const q = new URLSearchParams(params);
  return `${SUPABASE_URL}/functions/v1/gallery-feed?${q.toString()}`;
}

async function galleryFetch<T>(params: Record<string, string>): Promise<T> {
  const res = await fetch(galleryUrl(params), {
    headers: ANON_KEY ? { apikey: ANON_KEY } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body.error === 'string' ? body.error : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return body as T;
}

export type GalleryPhoto = {
  id: string;
  url: string;
  cap: string;
  sub: string;
  at: string;
};

export type GalleryAlbumSummary = {
  dateKey: string;
  attCount: number;
  caseCount: number;
  attThumbs: string[];
  caseThumbs: string[];
};

export type GalleryAlbumsResponse = {
  ok: true;
  todayKey: string;
  albums: GalleryAlbumSummary[];
  attTotal: number;
  caseTotal: number;
};

export type GalleryPhotosResponse = {
  ok: true;
  dateKey: string;
  type: 'att' | 'case';
  photos: GalleryPhoto[];
};

export function fetchGalleryAlbums(token: string, days = 30): Promise<GalleryAlbumsResponse> {
  return galleryFetch({ token, days: String(days) });
}

export function fetchGalleryPhotos(
  token: string,
  dateKey: string,
  type: 'att' | 'case',
): Promise<GalleryPhotosResponse> {
  return galleryFetch({ token, dateKey, type });
}

export function formatGalleryDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function formatGalleryDateTitle(dateKey: string, todayKey: string): string {
  const yesterdayKey = shiftDateKey(todayKey, -1);
  if (dateKey === todayKey) return 'Today';
  if (dateKey === yesterdayKey) return 'Yesterday';
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function shiftDateKey(dateKey: string, deltaDays: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatPhotoTime(iso: string): string {
  return formatTimeIST(iso);
}

export function getTodayKey(): string {
  return getISTDateKey();
}
