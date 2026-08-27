import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Loader2,
  Pin,
  PinOff,
  Plus,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useStore } from '../store/useStore';
import { isNoticeEmpty, sanitizeNoticeHtml } from '../lib/noticeHtml';
import {
  createDashboardNote,
  formatNoteDate,
  getNoteColorStyle,
  isDashboardNoteEmpty,
  normalizeNoteBody,
  NOTE_COLOR_STYLES,
  noteMatchesSearch,
  parseDashboardNotes,
  serializeDashboardNotes,
  sortDashboardNotes,
  type DashboardNote,
  type DashboardNoteColor,
} from '../lib/dashboardNotes';

const NoteColorPicker: React.FC<{
  value: DashboardNoteColor;
  onChange: (color: DashboardNoteColor) => void;
}> = ({ value, onChange }) => (
  <div className="flex flex-wrap items-center gap-2">
    {NOTE_COLOR_STYLES.map((color) => (
      <button
        key={color.id}
        type="button"
        aria-label={color.label}
        title={color.label}
        onClick={() => onChange(color.id)}
        className={`note-color-dot ${value === color.id ? 'is-selected' : ''}`}
        style={{ background: color.dotColor, color: color.borderColor }}
      />
    ))}
  </div>
);

const notePanelStyle = (color: DashboardNoteColor): React.CSSProperties => {
  const style = getNoteColorStyle(color);
  return {
    background: style.background,
    borderColor: style.borderColor,
  };
};

const NoteEditor: React.FC<{
  note: DashboardNote;
  expanded?: boolean;
  onChange: (note: DashboardNote) => void;
  onClose: () => void;
  onDelete?: () => void;
  onSave?: () => void;
  saveLabel?: string;
}> = ({ note, expanded = false, onChange, onClose, onDelete, onSave, saveLabel }) => {
  const updateBody = (html: string) => {
    onChange({
      ...note,
      body: normalizeNoteBody(html),
      updatedAt: Date.now(),
    });
  };

  return (
    <div
      className={`note-editor-panel ${expanded ? 'p-4 sm:p-5' : 'p-3'}`}
      style={notePanelStyle(note.color)}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <input
          value={note.title}
          onChange={(e) => onChange({ ...note, title: e.target.value, updatedAt: Date.now() })}
          placeholder="Title"
          className="w-full bg-transparent text-base font-semibold text-[var(--mn-text)] placeholder:text-[var(--mn-dim)] outline-none"
        />
        {expanded && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-[var(--mn-dim)] hover:text-[var(--mn-text)] hover:bg-white/5 transition-colors"
            aria-label="Close note"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <RichTextEditor
        embedded
        dark
        showLink={false}
        showColors={false}
        value={note.body}
        onChange={updateBody}
        placeholder="Take a note…"
        minHeight={expanded ? '140px' : '80px'}
      />

      {expanded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4 pt-4 border-t border-white/8">
          <NoteColorPicker
            value={note.color}
            onChange={(next) => onChange({ ...note, color: next, updatedAt: Date.now() })}
          />
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onChange({ ...note, pinned: !note.pinned, updatedAt: Date.now() })}
              className="p-2 rounded-lg text-[var(--mn-muted)] hover:bg-white/5 hover:text-[var(--mn-text)] transition-colors"
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
              title={note.pinned ? 'Unpin' : 'Pin'}
            >
              {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-lg text-[var(--mn-muted)] hover:bg-red-500/10 hover:text-red-300 transition-colors"
                aria-label="Delete note"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {onSave && saveLabel && (
              <button
                type="button"
                onClick={onSave}
                className="ml-2 px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--mn-accent)] text-white hover:bg-[var(--mn-accent-hover)] transition-colors"
              >
                {saveLabel}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const NoteCard: React.FC<{
  note: DashboardNote;
  onOpen: () => void;
  onPin: () => void;
  onDelete: () => void;
}> = ({ note, onOpen, onPin, onDelete }) => {
  const safeBody = sanitizeNoticeHtml(note.body);
  const hasBody = !isNoticeEmpty(note.body);

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="note-card group cursor-pointer"
      style={notePanelStyle(note.color)}
      onClick={onOpen}
    >
      <div className="p-4 pb-2">
        <div className="flex items-start justify-between gap-2 mb-2">
          {note.title ? (
            <h3 className="text-sm font-semibold text-[var(--mn-text)] line-clamp-2 leading-snug">
              {note.title}
            </h3>
          ) : (
            <h3 className="text-sm text-[var(--mn-dim)] italic">Untitled</h3>
          )}
          {note.pinned && (
            <Pin className="h-3.5 w-3.5 text-[var(--mn-muted)] shrink-0 fill-current rotate-45" />
          )}
        </div>
        {hasBody && (
          <div
            className="notice-html text-sm text-[var(--mn-muted)] line-clamp-[8] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        )}
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="text-[10px] text-[var(--mn-dim)] tabular-nums">
          {formatNoteDate(note.updatedAt)}
        </span>
        <div className="note-card-actions flex items-center gap-0.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            className="p-1.5 rounded-md text-[var(--mn-dim)] hover:text-[var(--mn-text)] hover:bg-white/5"
            title={note.pinned ? 'Unpin' : 'Pin'}
          >
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 rounded-md text-[var(--mn-dim)] hover:text-red-300 hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </motion.article>
  );
};

export const DashboardStickyNotes: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const savedNotes = useStore((s) => s.appSettings.admin_dashboard_notes);
  const setAdminDashboardNoteCards = useStore((s) => s.setAdminDashboardNoteCards);

  const [notes, setNotes] = useState<DashboardNote[]>([]);
  const [ready, setReady] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] = useState(createDashboardNote());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');
  const composerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAppSettings();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings]);

  useEffect(() => {
    if (!ready) return;
    setNotes(sortDashboardNotes(parseDashboardNotes(savedNotes)));
    lastSaved.current = savedNotes ?? '';
  }, [ready, savedNotes]);

  const persist = async (nextNotes: DashboardNote[]) => {
    const payload = serializeDashboardNotes(nextNotes);
    if (payload === lastSaved.current) return;
    setSaving(true);
    setError(null);
    const result = await setAdminDashboardNoteCards(nextNotes);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    lastSaved.current = payload;
  };

  const scheduleSave = (nextNotes: DashboardNote[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(nextNotes);
    }, 500);
  };

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const updateNotes = (nextNotes: DashboardNote[]) => {
    const sorted = sortDashboardNotes(nextNotes);
    setNotes(sorted);
    scheduleSave(sorted);
  };

  const filteredNotes = useMemo(
    () => notes.filter((note) => noteMatchesSearch(note, search)),
    [notes, search]
  );

  const pinnedNotes = filteredNotes.filter((n) => n.pinned);
  const otherNotes = filteredNotes.filter((n) => !n.pinned);

  const handleAddNote = () => {
    const trimmed = createDashboardNote({ ...composerDraft, updatedAt: Date.now() });
    if (isDashboardNoteEmpty(trimmed)) return;
    updateNotes([trimmed, ...notes]);
    setComposerDraft(createDashboardNote());
    setComposerOpen(false);
  };

  const handleUpdateNote = (updated: DashboardNote) => {
    updateNotes(notes.map((note) => (note.id === updated.id ? updated : note)));
  };

  const handleDeleteNote = (id: string) => {
    updateNotes(notes.filter((note) => note.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const editingNote = editingId ? notes.find((note) => note.id === editingId) : null;

  const renderSection = (title: string, items: DashboardNote[]) => {
    if (items.length === 0) return null;
    return (
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--mn-dim)] px-0.5">
          {title}
        </h2>
        <div className="notes-masonry">
          <AnimatePresence>
            {items.map((note) => (
              <div key={note.id} className="notes-masonry-item">
                <NoteCard
                  note={note}
                  onOpen={() => setEditingId(note.id)}
                  onPin={() => handleUpdateNote({ ...note, pinned: !note.pinned, updatedAt: Date.now() })}
                  onDelete={() => handleDeleteNote(note.id)}
                />
              </div>
            ))}
          </AnimatePresence>
        </div>
      </section>
    );
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center py-24 text-[var(--mn-dim)]">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm">Loading notes…</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="h-8 w-8 rounded-lg bg-[var(--mn-accent-soft)] flex items-center justify-center">
              <StickyNote className="h-4 w-4 text-[var(--mn-accent-hover)]" />
            </div>
            <h1 className="text-xl font-bold text-[var(--mn-text)]">Notes</h1>
          </div>
          <p className="text-sm text-[var(--mn-muted)] mt-1">
            {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            {saving ? ' · Saving…' : ' · Auto-saved'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center w-full lg:w-auto lg:min-w-[320px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--mn-dim)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-[var(--mn-border-strong)] bg-[var(--mn-surface)] text-[var(--mn-text)] placeholder:text-[var(--mn-dim)] outline-none focus:border-[var(--mn-accent)] focus:ring-1 focus:ring-[var(--mn-accent-soft)]"
            />
          </div>
          {!composerOpen && (
            <button
              type="button"
              onClick={() => {
                setComposerOpen(true);
                setTimeout(() => composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[var(--mn-accent)] text-white hover:bg-[var(--mn-accent-hover)] transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              New note
            </button>
          )}
        </div>
      </div>

      {/* Composer */}
      <div ref={composerRef} className="max-w-2xl mx-auto w-full">
        {!composerOpen ? (
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            className="notes-composer-trigger w-full text-left px-5 py-4 flex items-center gap-3"
          >
            <Plus className="h-4 w-4 shrink-0 opacity-60" />
            <span className="text-sm">Take a note…</span>
          </button>
        ) : (
          <div className="notes-composer-shell p-1 sm:p-1.5">
            <NoteEditor
              note={composerDraft}
              expanded
              onChange={setComposerDraft}
              onClose={() => {
                setComposerOpen(false);
                setComposerDraft(createDashboardNote());
              }}
              onSave={handleAddNote}
              saveLabel="Add note"
            />
          </div>
        )}
      </div>

      {/* Notes */}
      {filteredNotes.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-2xl border border-dashed border-[var(--mn-border-strong)] bg-[var(--mn-surface)]/50">
          <StickyNote className="h-10 w-10 text-[var(--mn-dim)] mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium text-[var(--mn-muted)]">
            {search ? 'No notes match your search' : 'No notes yet'}
          </p>
          <p className="text-xs text-[var(--mn-dim)] mt-1 max-w-sm mx-auto">
            {search
              ? 'Try a different keyword or clear the search.'
              : 'Tap “New note” or the composer above to jot down reminders, follow-ups, or anything important.'}
          </p>
          {!search && !composerOpen && (
            <button
              type="button"
              onClick={() => setComposerOpen(true)}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-[var(--mn-accent-soft)] text-[var(--mn-accent-hover)] hover:bg-[var(--mn-accent)]/20 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Create your first note
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {renderSection('Pinned', pinnedNotes)}
          {renderSection(pinnedNotes.length > 0 ? 'Others' : 'All notes', otherNotes)}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-300 text-center py-2 px-4 rounded-lg bg-red-500/10 border border-red-500/20">
          {error}
        </p>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            className="note-modal-backdrop fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 overflow-y-auto"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              void persist(notes);
              setEditingId(null);
            }}
          >
            <motion.div
              className="w-full max-w-xl my-8 sm:my-12"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(e) => e.stopPropagation()}
            >
              <NoteEditor
                note={editingNote}
                expanded
                onChange={handleUpdateNote}
                onClose={() => {
                  void persist(notes);
                  setEditingId(null);
                }}
                onDelete={() => handleDeleteNote(editingNote.id)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
