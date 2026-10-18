import { and, desc, gte, inArray, isNotNull, eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import {
  appSettings,
  attendanceApprovalRequests,
  attendanceRecords,
  cases,
  employees,
} from '../db/schema';
import {
  type GalleryFeedPhoto,
  istDateKey,
  isImageDoc,
  recentDateKeys,
  todayIST,
} from '../lib/galleryFeedHelpers';
import { CASE_DETAIL_COLUMNS, mapCaseDetail } from './cases';
import { listEmployees } from './employees';

const DEFAULT_DAYS = 30;
const GALLERY_CASE_LIMIT = 500;
const TV_CASE_LIMIT = 5000;

function parseJsonField(raw: string | null, fallback: unknown) {
  if (raw == null || raw === '') return fallback;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return fallback;
  }
}

export async function buildGalleryTvFeed(db: Db) {
  const [caseRows, employeeRows, settingRow] = await Promise.all([
    db
      .select(CASE_DETAIL_COLUMNS)
      .from(cases)
      .orderBy(desc(cases.updatedAt))
      .limit(TV_CASE_LIMIT),
    listEmployees(db, TV_CASE_LIMIT, true),
    db
      .select({ value: appSettings.value })
      .from(appSettings)
      .where(eq(appSettings.key, 'tv_notice'))
      .limit(1),
  ]);

  return {
    ok: true as const,
    cases: caseRows.map((r) => mapCaseDetail(r)),
    employees: employeeRows,
    tvNotice: (settingRow[0]?.value as string | undefined) ?? '',
  };
}

export async function buildGalleryAlbumFeed(db: Db, days: number) {
  const since = new Date();
  since.setDate(since.getDate() - (days + 1));
  const sinceIso = since.toISOString();
  const validDates = new Set(recentDateKeys(days));

  const [records, approvals, caseRows] = await Promise.all([
    db
      .select({
        id: attendanceRecords.id,
        employeeId: attendanceRecords.employeeId,
        employeeName: attendanceRecords.employeeName,
        selfieUrl: attendanceRecords.selfieUrl,
        punchedAt: attendanceRecords.punchedAt,
      })
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.punchType, 'in'),
          isNotNull(attendanceRecords.selfieUrl),
          gte(attendanceRecords.punchedAt, sinceIso),
        ),
      )
      .orderBy(desc(attendanceRecords.punchedAt)),
    db
      .select({
        id: attendanceApprovalRequests.id,
        employeeId: attendanceApprovalRequests.employeeId,
        employeeName: attendanceApprovalRequests.employeeName,
        selfieUrl: attendanceApprovalRequests.selfieUrl,
        requestedAt: attendanceApprovalRequests.requestedAt,
      })
      .from(attendanceApprovalRequests)
      .where(
        and(
          eq(attendanceApprovalRequests.punchType, 'in'),
          isNotNull(attendanceApprovalRequests.selfieUrl),
          gte(attendanceApprovalRequests.requestedAt, sinceIso),
        ),
      )
      .orderBy(desc(attendanceApprovalRequests.requestedAt)),
    db
      .select({
        id: cases.id,
        caseNumber: cases.caseNumber,
        stages: cases.stages,
        hospitalSnapshot: cases.hospitalSnapshot,
      })
      .from(cases)
      .orderBy(desc(cases.updatedAt))
      .limit(GALLERY_CASE_LIMIT),
  ]);

  const employeeIds = new Set<string>();
  for (const r of records) employeeIds.add(r.employeeId);
  for (const a of approvals) employeeIds.add(a.employeeId);

  const codeByEmployee = new Map<string, string>();
  if (employeeIds.size > 0) {
    const emps = await db
      .select({ id: employees.id, employeeCode: employees.employeeCode })
      .from(employees)
      .where(inArray(employees.id, [...employeeIds]));
    for (const e of emps) {
      if (e.employeeCode) codeByEmployee.set(e.id, e.employeeCode);
    }
  }

  const attByDate = new Map<string, GalleryFeedPhoto[]>();
  const caseByDate = new Map<string, GalleryFeedPhoto[]>();

  function pushAtt(date: string, photo: GalleryFeedPhoto) {
    const list = attByDate.get(date) ?? [];
    list.push(photo);
    attByDate.set(date, list);
  }

  function pushCase(date: string, photo: GalleryFeedPhoto) {
    const list = caseByDate.get(date) ?? [];
    list.push(photo);
    caseByDate.set(date, list);
  }

  for (const row of records) {
    const url = row.selfieUrl?.trim();
    if (!url) continue;
    const at = row.punchedAt;
    const dk = istDateKey(at);
    const code = codeByEmployee.get(row.employeeId);
    pushAtt(dk, {
      id: row.id,
      url,
      cap: row.employeeName || 'Staff',
      sub: code ? `${code} · punch in` : 'punch in',
      at,
    });
  }

  for (const row of approvals) {
    const url = row.selfieUrl?.trim();
    if (!url) continue;
    const at = row.requestedAt;
    const dk = istDateKey(at);
    const code = codeByEmployee.get(row.employeeId);
    pushAtt(dk, {
      id: row.id,
      url,
      cap: row.employeeName || 'Staff',
      sub: code ? `${code} · off-site punch in` : 'off-site punch in',
      at,
    });
  }

  for (const c of caseRows) {
    const caseNumber = c.caseNumber || 'Case';
    const snapshot = parseJsonField(c.hospitalSnapshot, {}) as { name?: string };
    const hospital = snapshot.name ?? '';
    const stages = parseJsonField(c.stages, []) as Array<{
      stage?: string;
      documents?: Array<Record<string, unknown>>;
    }>;
    for (const stage of stages) {
      const stageName = stage.stage ?? 'Stage';
      for (const doc of stage.documents ?? []) {
        if (!isImageDoc(doc as { type?: string; url?: string; name?: string })) continue;
        const uploadedAt = String(doc.uploadedAt ?? doc.uploaded_at ?? '');
        if (!uploadedAt) continue;
        const dk = istDateKey(uploadedAt);
        if (!validDates.has(dk)) continue;
        pushCase(dk, {
          id: String(doc.id ?? `${c.id}-${stageName}`),
          url: String(doc.url),
          cap: caseNumber,
          sub: `${stageName}${hospital ? ` · ${hospital}` : ''}`,
          at: uploadedAt,
        });
      }
    }
  }

  for (const [, list] of attByDate) {
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }
  for (const [, list] of caseByDate) {
    list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }

  const dateKeys = recentDateKeys(days);
  const albums = dateKeys.map((dk) => {
    const att = attByDate.get(dk) ?? [];
    const cas = caseByDate.get(dk) ?? [];
    return {
      dateKey: dk,
      attCount: att.length,
      caseCount: cas.length,
      attThumbs: att.slice(0, 3).map((p) => p.url),
      caseThumbs: cas.slice(0, 3).map((p) => p.url),
    };
  });

  const attTotal = albums.reduce((s, a) => s + a.attCount, 0);
  const caseTotal = albums.reduce((s, a) => s + a.caseCount, 0);

  return {
    ok: true as const,
    todayKey: todayIST(),
    albums,
    attTotal,
    caseTotal,
    attByDate,
    caseByDate,
  };
}

export function galleryPhotosForDay(
  feed: Awaited<ReturnType<typeof buildGalleryAlbumFeed>>,
  dateKey: string,
  type: 'att' | 'case',
) {
  const photos =
    type === 'att' ? (feed.attByDate.get(dateKey) ?? []) : (feed.caseByDate.get(dateKey) ?? []);
  return { ok: true as const, dateKey, type, photos };
}

export { DEFAULT_DAYS, GALLERY_CASE_LIMIT };
