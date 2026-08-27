import { isNoticeEmpty, normalizeNoticeHtml } from './noticeHtml';

export type DashboardNoteColor =
  | 'default'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'gray';

export interface DashboardNote {
  id: string;
  title: string;
  body: string;
  color: DashboardNoteColor;
  pinned: boolean;
  updatedAt: number;
}

export const DASHBOARD_NOTE_COLORS: {
  id: DashboardNoteColor;
  card: string;
  border: string;
  dot: string;
}[] = [
  { id: 'default', card: 'bg-white', border: 'border-gray-300', dot: 'bg-white border border-gray-300' },
  { id: 'yellow', card: 'bg-amber-50', border: 'border-amber-400', dot: 'bg-amber-400' },
  { id: 'green', card: 'bg-emerald-50', border: 'border-emerald-400', dot: 'bg-emerald-400' },
  { id: 'blue', card: 'bg-sky-50', border: 'border-sky-400', dot: 'bg-sky-400' },
  { id: 'pink', card: 'bg-pink-50', border: 'border-pink-400', dot: 'bg-pink-400' },
  { id: 'purple', card: 'bg-violet-50', border: 'border-violet-400', dot: 'bg-violet-400' },
  { id: 'orange', card: 'bg-orange-50', border: 'border-orange-400', dot: 'bg-orange-400' },
  { id: 'gray', card: 'bg-gray-50', border: 'border-gray-400', dot: 'bg-gray-400' },
];

export const getNoteColorClasses = (color: DashboardNoteColor) =>
  DASHBOARD_NOTE_COLORS.find((c) => c.id === color) ?? DASHBOARD_NOTE_COLORS[0];

const MAX_TITLE = 120;

export const normalizeNoteBody = (raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return normalizeNoticeHtml(trimmed);
};

export const isDashboardNoteEmpty = (note: Pick<DashboardNote, 'title' | 'body'>): boolean =>
  !note.title.trim() && isNoticeEmpty(note.body);

export const createDashboardNote = (partial?: Partial<DashboardNote>): DashboardNote => ({
  id: partial?.id ?? crypto.randomUUID(),
  title: (partial?.title ?? '').slice(0, MAX_TITLE),
  body: normalizeNoteBody(partial?.body ?? ''),
  color: partial?.color ?? 'default',
  pinned: partial?.pinned ?? false,
  updatedAt: partial?.updatedAt ?? Date.now(),
});

export const parseDashboardNotes = (raw: string | undefined | null): DashboardNote[] => {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!Array.isArray(parsed)) {
      return [createDashboardNote({ body: trimmed, color: 'yellow' })];
    }
    return parsed
      .filter((item): item is Record<string, unknown> => item && typeof item === 'object')
      .map((item) =>
        createDashboardNote({
          id: typeof item.id === 'string' ? item.id : undefined,
          title: typeof item.title === 'string' ? item.title : '',
          body: typeof item.body === 'string' ? item.body : '',
          color: isNoteColor(item.color) ? item.color : 'default',
          pinned: Boolean(item.pinned),
          updatedAt: typeof item.updatedAt === 'number' ? item.updatedAt : Date.now(),
        })
      )
      .filter((note) => !isDashboardNoteEmpty(note));
  } catch {
    return [createDashboardNote({ body: trimmed, color: 'yellow' })];
  }
};

export const serializeDashboardNotes = (notes: DashboardNote[]): string =>
  JSON.stringify(
    notes
      .map((note) => createDashboardNote(note))
      .filter((note) => !isDashboardNoteEmpty(note))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt - a.updatedAt;
      })
  );

const isNoteColor = (value: unknown): value is DashboardNoteColor =>
  typeof value === 'string' && DASHBOARD_NOTE_COLORS.some((c) => c.id === value);

export const sortDashboardNotes = (notes: DashboardNote[]): DashboardNote[] =>
  [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
