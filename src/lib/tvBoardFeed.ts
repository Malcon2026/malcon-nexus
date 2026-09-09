import type { Employee, ImplantCase } from '../types';
import {
  caseRowToImplantCase,
  employeeRowToEmployee,
} from './database/repositories/supabaseRepositories';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export type TvBoardFeedResponse = {
  ok: true;
  cases: ImplantCase[];
  employees: Employee[];
  tvNotice: string;
};

function tvFeedUrl(token: string): string {
  const q = new URLSearchParams({ token });
  return `${SUPABASE_URL}/functions/v1/tv-board-feed?${q.toString()}`;
}

export async function fetchTvBoardFeed(token: string): Promise<TvBoardFeedResponse> {
  const res = await fetch(tvFeedUrl(token), {
    headers: ANON_KEY ? { apikey: ANON_KEY } : {},
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body.error === 'string' ? body.error : `Request failed (${res.status})`;
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
