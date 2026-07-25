import React, { useEffect, useState } from 'react';
import { Megaphone, Save, Loader2, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { RichTextEditor } from './RichTextEditor';
import { useStore } from '../store/useStore';
import {
  isNoticeEmpty,
  normalizeNoticeHtml,
  noticeTextLength,
  sanitizeNoticeHtml,
} from '../lib/noticeHtml';

const MAX_TEXT = 800;

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
        setDraft(normalizeNoticeHtml(getEmployeeNotice()));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings, getEmployeeNotice]);

  const textLen = noticeTextLength(draft);
  const hasContent = !isNoticeEmpty(draft);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      if (textLen > MAX_TEXT) {
        setError(`Notice is too long (${textLen}/${MAX_TEXT} characters).`);
        return;
      }
      const clean = hasContent ? sanitizeNoticeHtml(draft) : '';
      const result = await setEmployeeNotice(clean);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(normalizeNoticeHtml(getEmployeeNotice()));
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
          Shown at the top of every employee dashboard. Use the toolbar for bold, italic, lists, and more.
          Leave empty to hide the notice.
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
                <span className={`text-[10px] ${textLen > MAX_TEXT ? 'text-red-600' : 'text-gray-400'}`}>
                  {textLen}/{MAX_TEXT}
                </span>
              </div>
              <RichTextEditor
                value={draft}
                onChange={setDraft}
                placeholder="e.g. Office closed Friday for inventory. Report Monday 9 AM."
                minHeight="140px"
                disabled={saving}
              />
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Preview
              </p>
              {hasContent ? (
                <aside className="notice-board">
                  <div className="notice-board-dashes" aria-hidden />
                  <div className="relative flex gap-3 items-start px-3.5 py-3">
                    <div className="mt-0.5 shrink-0 h-8 w-8 rounded-lg bg-amber-50/80 border border-amber-200/60 flex items-center justify-center text-amber-800">
                      <Megaphone className="h-3.5 w-3.5" strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-500 mb-1">
                        Notice Board
                      </p>
                      <div
                        className="notice-html text-sm text-stone-800 leading-snug break-words"
                        dangerouslySetInnerHTML={{ __html: sanitizeNoticeHtml(draft) }}
                      />
                    </div>
                  </div>
                </aside>
              ) : (
                <p className="text-xs text-gray-400 italic py-3 px-3 border border-dashed border-gray-200 bg-gray-50">
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
                disabled={saving || (!hasContent && isNoticeEmpty(getEmployeeNotice()))}
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
