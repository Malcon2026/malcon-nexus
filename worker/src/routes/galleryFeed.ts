import type { Env } from '../env';
import { createDb } from '../db/client';
import { jsonResponse } from '../lib/http';
import { safeEqual } from '../lib/galleryFeedHelpers';
import {
  buildGalleryAlbumFeed,
  buildGalleryTvFeed,
  DEFAULT_DAYS,
  galleryPhotosForDay,
} from '../services/galleryFeedData';

function tokenMatchesTvBoard(env: Env, token: string): boolean {
  const tvToken = env.TV_BOARD_TOKEN ?? '';
  const galleryToken = env.GALLERY_TOKEN ?? '';
  if (tvToken && safeEqual(token, tvToken)) return true;
  if (galleryToken && safeEqual(token, galleryToken)) return true;
  return false;
}

/** Public token feed — same contract as Supabase `gallery-feed` Edge Function. */
export async function handleGalleryFeed(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? '';
  const mode = url.searchParams.get('mode') ?? '';

  try {
    const db = createDb(env);

    if (mode === 'tv') {
      if (!token || !tokenMatchesTvBoard(env, token)) {
        return jsonResponse({ error: 'Invalid or missing token' }, 401);
      }
      const body = await buildGalleryTvFeed(db);
      return jsonResponse(body);
    }

    const expected = env.GALLERY_TOKEN ?? '';
    if (!expected) {
      return jsonResponse({ error: 'Gallery not configured' }, 503);
    }
    if (!token || !safeEqual(token, expected)) {
      return jsonResponse({ error: 'Invalid or missing token' }, 401);
    }

    const days = Math.min(
      60,
      Math.max(1, Number(url.searchParams.get('days') ?? DEFAULT_DAYS) || DEFAULT_DAYS),
    );
    const dateKey = url.searchParams.get('dateKey') ?? '';
    const type = url.searchParams.get('type') ?? '';

    const feed = await buildGalleryAlbumFeed(db, days);

    if (dateKey && (type === 'att' || type === 'case')) {
      return jsonResponse(galleryPhotosForDay(feed, dateKey, type));
    }

    const { attByDate: _a, caseByDate: _c, ...publicFeed } = feed;
    return jsonResponse(publicFeed);
  } catch (err) {
    console.error('[gallery-feed]', err);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
}
