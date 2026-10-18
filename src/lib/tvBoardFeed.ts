import type { Employee, ImplantCase } from '../types';
import {
  caseRowToImplantCase,
  employeeRowToEmployee,
} from './database/repositories/supabaseRepositories';
import { galleryFeedEndpoint, galleryFeedRequestHeaders } from './galleryFeedEndpoint';

export type TvBoardFeedResponse = {
  ok: true;
  cases: ImplantCase[];
  employees: Employee[];
  tvNotice: string;
};

function tvFeedUrl(token: string): string {
  const q = new URLSearchParams({ token, mode: 'tv' });
  return `${galleryFeedEndpoint()}?${q.toString()}`;
}

export async function fetchTvBoardFeed(token: string): Promise<TvBoardFeedResponse> {
  const res = await fetch(tvFeedUrl(token), {
    headers: galleryFeedRequestHeaders(),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof body.error === 'string'
        ? body.error
        : typeof body.message === 'string'
          ? body.message
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  const raw = body as {
    ok: true;
    cases: Record<string, unknown>[];
    employees: Record<string, unknown>[];
    tvNotice: string;
  };

  return {
    ok: true,
    cases: (raw.cases ?? []).map((row) => caseRowToImplantCase(row)),
    employees: (raw.employees ?? []).map((row) => employeeRowToEmployee(row)),
    tvNotice: raw.tvNotice ?? '',
  };
}
