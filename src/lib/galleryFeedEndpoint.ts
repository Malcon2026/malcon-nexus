import { USE_CLOUDFLARE_BACKEND } from './cloudflareConfig';
import { WORKER_API_URL } from './workerReadConfig';

/** Base URL for gallery / TV token feeds (AWS API or legacy Supabase Edge). */
export function galleryFeedEndpoint(): string {
  if (USE_CLOUDFLARE_BACKEND) {
    return `${WORKER_API_URL}/api/gallery-feed`;
  }
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  return `${supabaseUrl}/functions/v1/gallery-feed`;
}

export function galleryFeedRequestHeaders(): Record<string, string> {
  if (USE_CLOUDFLARE_BACKEND) return {};
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  if (!anon) return {};
  return { apikey: anon, Authorization: `Bearer ${anon}` };
}
