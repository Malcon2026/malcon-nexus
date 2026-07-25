import React, { useEffect, useState } from 'react';
import { Megaphone, Save, Loader2, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';

const MAX_LEN = 500;

/** Admin editor for the employee dashboard notice board. */
export const NoticeBoardEditor: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const getEmployeeNotice = useStore((s) => s.getEmployeeNotice);
  const setEmployeeNotice = useStore((s) => s.setEmployeeNotice);

  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAppSettings();
      if (!cancelled) {
        setDraft(getEmployeeNotice());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings, getEmployeeNotice]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await setEmployeeNotice(draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(getEmployeeNotice());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setDraft('');
    setSaving(true);
    setError(null);
    try {
      const result = await setEmployeeNotice('');
      if (result.error) {
        setError(result.error);
        return;
      }
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const preview = draft.trim();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-amber-700" />
          <h3 className="text-sm font-semibold text-gray-900">Employee Notice Board</h3>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-gray-500">
          Shown at the top of every employee dashboard. Leave empty to hide the notice.
        </p>

        {loading ? (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">Notice message</label>
                <span className={`text-[10px] ${draft.length > MAX_LEN ? 'text-red-600' : 'text-gray-400'}`}>
                  {draft.length}/{MAX_LEN}
                </span>
              </div>
              <textarea
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-100 bg-white min-h-[100px] resize-y"
                placeholder="e.g. Office closed Friday for inventory. Report Monday 9 AM."
                value={draft}
                maxLength={MAX_LEN}
                onChange={(e) => setDraft(e.target.value)}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Preview
              </p>
              {preview ? (
                <aside className="notice-board">
                  <div className="notice-board-spin" aria-hidden />
                  <div className="notice-board-inner">
                    <div className="shrink-0 h-9 w-9 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-sm">
                      <Megaphone className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-700 mb-1">
                        Notice Board
                      </p>
                      <p className="text-sm text-stone-800 leading-snug whitespace-pre-wrap break-words font-medium">
                        {preview}
                      </p>
                    </div>
                  </div>
                </aside>
              ) : (
                <p className="text-xs text-gray-400 italic py-3 px-3 rounded-xl border border-dashed border-gray-200 bg-gray-50">
                  No notice — employees will not see the notice board.
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            {saved && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                Notice board updated.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => void handleClear()}
                disabled={saving || (!draft && !getEmployeeNotice())}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                onClick={() => void handleSave()}
                disabled={saving}
              >
                Save Notice
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
};
