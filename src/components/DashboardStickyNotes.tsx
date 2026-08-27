import React, { useEffect, useRef, useState } from 'react';
import { StickyNote } from 'lucide-react';
import { useStore } from '../store/useStore';

const MAX_CHARS = 2000;

export const DashboardStickyNotes: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const savedNotes = useStore((s) => (s.appSettings.admin_dashboard_notes ?? '').trim());
  const setAdminDashboardNotes = useStore((s) => s.setAdminDashboardNotes);

  const [draft, setDraft] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
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
    setDraft(savedNotes);
    lastSaved.current = savedNotes;
  }, [ready, savedNotes]);

  const persist = async (value: string) => {
    const trimmed = value.trim();
    if (trimmed === lastSaved.current) return;
    setSaving(true);
    setError(null);
    const result = await setAdminDashboardNotes(trimmed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    lastSaved.current = trimmed;
    setSavedAt(Date.now());
  };

  const scheduleSave = (value: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void persist(value);
    }, 600);
  };

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const handleChange = (value: string) => {
    const next = value.slice(0, MAX_CHARS);
    setDraft(next);
    scheduleSave(next);
  };

  if (!ready) return null;

  return (
    <div className="dashboard-sticky-note">
      <div className="dashboard-sticky-note-fold" aria-hidden />
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-100/80 border border-amber-200/70 flex items-center justify-center text-amber-900">
          <StickyNote className="h-4 w-4" strokeWidth={2.1} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
              Sticky notes
            </p>
            <p className="text-[10px] text-amber-900/60 tabular-nums">
              {draft.length}/{MAX_CHARS}
              {saving ? ' · Saving…' : savedAt ? ' · Saved' : ''}
            </p>
          </div>
          <textarea
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => void persist(draft)}
            placeholder="Write important reminders here — follow-ups, calls, things not to forget…"
            rows={4}
            className="dashboard-sticky-note-input w-full resize-y min-h-[5.5rem] text-sm leading-relaxed"
          />
          {error && <p className="text-[11px] text-red-700 mt-1.5">{error}</p>}
        </div>
      </div>
    </div>
  );
};
