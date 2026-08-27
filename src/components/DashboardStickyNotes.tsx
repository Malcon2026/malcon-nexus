import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pin, PinOff, Trash2, X } from 'lucide-react';
import { RichTextEditor } from './RichTextEditor';
import { useStore } from '../store/useStore';
import { isNoticeEmpty, sanitizeNoticeHtml } from '../lib/noticeHtml';
import {
  createDashboardNote,
  DASHBOARD_NOTE_COLORS,
  getNoteColorClasses,
  isDashboardNoteEmpty,
  normalizeNoteBody,
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
  <div className="flex items-center gap-1.5">
    {DASHBOARD_NOTE_COLORS.map((color) => (
      <button
        key={color.id}
        type="button"
        aria-label={`${color.id} color`}
        onClick={() => onChange(color.id)}
        className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${color.dot} ${
          value === color.id ? 'ring-2 ring-offset-1 ring-gray-500' : ''
        }`}
      />
    ))}
  </div>
);

const NoteEditor: React.FC<{
  note: DashboardNote;
  expanded?: boolean;
  onChange: (note: DashboardNote) => void;
  onClose: () => void;
  onDelete?: () => void;
}> = ({ note, expanded = false, onChange, onClose, onDelete }) => {
  const color = getNoteColorClasses(note.color);

  const updateBody = (html: string) => {
    onChange({
      ...note,
      body: normalizeNoteBody(html),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className={`rounded-2xl border-2 shadow-sm ${color.border} ${color.card} ${expanded ? 'p-4' : 'p-3'}`}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <input
          value={note.title}
          onChange={(e) => onChange({ ...note, title: e.target.value, updatedAt: Date.now() })}
          placeholder="Title"
          className="w-full bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-400 outline-none"
        />
        {expanded && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-700 hover:bg-black/5"
            aria-label="Close note"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded ? (
        <RichTextEditor
          embedded
          showLink={false}
          showColors={false}
          value={note.body}
          onChange={updateBody}
          placeholder="Take a note…"
          minHeight="120px"
        />
      ) : (
        <RichTextEditor
          embedded
          showLink={false}
          showColors={false}
          value={note.body}
          onChange={updateBody}
          placeholder="Take a note…"
          minHeight="72px"
        />
      )}

      {expanded && (
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-black/5">
          <NoteColorPicker
            value={note.color}
            onChange={(next) => onChange({ ...note, color: next, updatedAt: Date.now() })}
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onChange({ ...note, pinned: !note.pinned, updatedAt: Date.now() })}
              className="p-2 rounded-full text-gray-500 hover:bg-black/5 hover:text-gray-800"
              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
            >
              {note.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
            </button>
            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-2 rounded-full text-gray-500 hover:bg-red-50 hover:text-red-600"
                aria-label="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef('');

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
    const parsed = sortDashboardNotes(parseDashboardNotes(savedNotes));
    setNotes(parsed);
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

  const handleAddNote = () => {
    const trimmed = createDashboardNote({
      ...composerDraft,
      updatedAt: Date.now(),
    });
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

  if (!ready) return null;

  const editingNote = editingId ? notes.find((note) => note.id === editingId) : null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Notes</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Quick reminders — bold, lists, and colors
            {saving ? ' · Saving…' : ''}
          </p>
        </div>
      </div>

      {/* Composer */}
      {!composerOpen ? (
        <button
          type="button"
          onClick={() => setComposerOpen(true)}
          className="w-full text-left rounded-2xl border-2 border-gray-300 bg-white shadow-sm p-3 hover:shadow-md transition-all"
        >
          <p className="text-sm text-gray-400 px-1">Take a note…</p>
        </button>
      ) : (
        <div className="space-y-3">
          <NoteEditor
            note={composerDraft}
            expanded
            onChange={setComposerDraft}
            onClose={() => {
              setComposerOpen(false);
              setComposerDraft(createDashboardNote());
            }}
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAddNote}
              className="px-4 py-1.5 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100"
            >
              Add note
            </button>
          </div>
        </div>
      )}

      {/* Notes grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence>
          {notes.map((note, idx) => {
            const color = getNoteColorClasses(note.color);
            const safeBody = sanitizeNoticeHtml(note.body);
            return (
              <motion.div
                key={note.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ delay: Math.min(idx * 0.03, 0.24) }}
                className={`group rounded-2xl border-2 shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer ${color.border} ${color.card}`}
                onClick={() => setEditingId(note.id)}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    {note.title ? (
                      <p className="text-sm font-bold text-gray-900 line-clamp-2">{note.title}</p>
                    ) : (
                      <p className="text-sm text-gray-400 italic">Untitled</p>
                    )}
                    {note.pinned && <Pin className="h-3.5 w-3.5 text-gray-500 shrink-0 fill-current" />}
                  </div>
                  {!isNoticeEmpty(note.body) && (
                    <div
                      className="notice-html text-sm text-gray-600 line-clamp-6 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: safeBody }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-1 px-4 pb-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpdateNote({ ...note, pinned: !note.pinned, updatedAt: Date.now() });
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-gray-500 hover:text-gray-800 px-2 py-1 rounded-md hover:bg-black/5"
                  >
                    {note.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                    {note.pinned ? 'Unpin' : 'Pin'}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    className="flex items-center gap-1 text-[11px] font-medium text-red-500 hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {/* Edit modal */}
      <AnimatePresence>
        {editingNote && (
          <motion.div
            className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              void persist(notes);
              setEditingId(null);
            }}
          >
            <motion.div
              className="w-full max-w-lg mt-8 sm:mt-16"
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
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
    </section>
  );
};
