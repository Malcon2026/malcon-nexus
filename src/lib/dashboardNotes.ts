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

export interface NoteColorStyle {
  id: DashboardNoteColor;
  label: string;
  background: string;
  borderColor: string;
  dotColor: string;
}

export const NOTE_COLOR_STYLES: NoteColorStyle[] = [
  { id: 'default', label: 'Default', background: 'var(--mn-surface)', borderColor: '#5c667a', dotColor: '#5c667a' },
  { id: 'yellow', label: 'Yellow', background: 'rgba(251, 191, 36, 0.14)', borderColor: '#fbbf24', dotColor: '#fbbf24' },
  { id: 'green', label: 'Green', background: 'rgba(52, 211, 153, 0.14)', borderColor: '#34d399', dotColor: '#34d399' },
  { id: 'blue', label: 'Blue', background: 'rgba(96, 165, 250, 0.14)', borderColor: '#60a5fa', dotColor: '#60a5fa' },
  { id: 'pink', label: 'Pink', background: 'rgba(244, 114, 182, 0.14)', borderColor: '#f472b6', dotColor: '#f472b6' },
  { id: 'purple', label: 'Purple', background: 'rgba(167, 139, 250, 0.14)', borderColor: '#a78bfa', dotColor: '#a78bfa' },
  { id: 'orange', label: 'Orange', background: 'rgba(251, 146, 60, 0.14)', borderColor: '#fb923c', dotColor: '#fb923c' },
  { id: 'gray', label: 'Gray', background: 'rgba(148, 163, 184, 0.12)', borderColor: '#94a3b8', dotColor: '#94a3b8' },
];

/** @deprecated use getNoteColorStyle */
export const DASHBOARD_NOTE_COLORS = NOTE_COLOR_STYLES.map((s) => ({
  id: s.id,
  card: '',
  border: '',
  dot: '',
}));

export const getNoteColorStyle = (color: DashboardNoteColor): NoteColorStyle =>
  NOTE_COLOR_STYLES.find((s) => s.id === color) ?? NOTE_COLOR_STYLES[0];

export const getNoteColorClasses = (color: DashboardNoteColor) => getNoteColorStyle(color);

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
  typeof value === 'string' && NOTE_COLOR_STYLES.some((c) => c.id === value);

export const sortDashboardNotes = (notes: DashboardNote[]): DashboardNote[] =>
  [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });

export const formatNoteDate = (ts: number): string => {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export const noteMatchesSearch = (note: DashboardNote, query: string): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const bodyText = note.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').toLowerCase();
  return note.title.toLowerCase().includes(q) || bodyText.includes(q);
};
