import React, { useEffect, useState } from 'react';
import { Loader2, Save, Trash2, Tv } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { TvNoticeTicker } from './TvNoticeTicker';
import { useStore } from '../store/useStore';

const MAX_TEXT = 400;

/** Admin editor for the TV board scrolling notice ticker. */
export const TvNoticeBoardEditor: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const getTvNotice = useStore((s) => s.getTvNotice);
  const setTvNotice = useStore((s) => s.setTvNotice);

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
        setDraft(getTvNotice());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings, getTvNotice]);

  const textLen = draft.trim().length;
  const hasContent = textLen > 0;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (textLen > MAX_TEXT) {
        setError(`Notice is too long (${textLen}/${MAX_TEXT} characters).`);
        return;
      }
      const result = await setTvNotice(draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(getTvNotice());
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
      const result = await setTvNotice('');
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-violet-700" />
          <h3 className="text-sm font-semibold text-gray-900">TV Notice Board</h3>
        </div>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs text-gray-500">
          Shown on the TV board between the title and the clock. Text scrolls in large type like a news ticker.
          Leave empty to hide it. This is separate from the employee dashboard notice.
        </p>

        {loading ? (
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </p>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">Scrolling message</label>
                <span className={`text-[10px] ${textLen > MAX_TEXT ? 'text-red-600' : 'text-gray-400'}`}>
                  {textLen}/{MAX_TEXT}
                </span>
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                disabled={saving}
                rows={3}
                placeholder="e.g. All staff meeting today at 4 PM in the conference room."
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white resize-y min-h-[80px]"
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Preview
              </p>
              {hasContent ? (
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="flex items-center px-4 py-3">
                    <TvNoticeTicker text={draft.trim()} />
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic py-3 px-3 border border-dashed border-gray-200 bg-gray-50">
                  No message — the TV board will not show a scrolling notice.
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
            )}
            {saved && (
              <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
                TV notice updated.
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => void handleClear()}
                disabled={saving || (!hasContent && !getTvNotice())}
              >
                Clear
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                onClick={() => void handleSave()}
                disabled={saving || textLen > MAX_TEXT}
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
