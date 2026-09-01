import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Palette, Save, Smile, Trash2, Tv } from 'lucide-react';
import { Card, CardBody, CardHeader } from './ui/Card';
import { Button } from './ui/Button';
import { TvNoticeTicker } from './TvNoticeTicker';
import { useStore } from '../store/useStore';
import {
  TV_NOTICE_SEP_COLORS,
  TV_NOTICE_TEXT_COLORS,
  type TvNoticeConfig,
} from '../lib/tvNotice';

const MAX_TEXT = 400;

const QUICK_EMOJIS = [
  '🚀', '📢', '⚠️', '✅', '❗', '🎉', '👋', '🏥',
  '💼', '📅', '⏰', '🔴', '🟢', '🟡', '✨', '💡',
  '🙏', '☕', '🎯', '⭐', '🔔', '📝', '🤝', '💪',
];

function insertAtCursor(textarea: HTMLTextAreaElement, snippet: string): string {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  return textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
}

function ColorSwatches({
  label,
  colors,
  value,
  onChange,
  disabled,
}: {
  label: string;
  colors: readonly { label: string; value: string }[];
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {colors.map((c) => {
          const active = value === c.value;
          return (
            <button
              key={c.value}
              type="button"
              title={c.label}
              disabled={disabled}
              onClick={() => onChange(c.value)}
              className={`h-7 w-7 rounded-full border-2 transition-transform shrink-0 ${
                active ? 'border-gray-900 scale-110' : 'border-gray-200 hover:scale-105'
              }`}
              style={{ backgroundColor: c.value }}
              aria-label={`${c.label} color`}
              aria-pressed={active}
            />
          );
        })}
      </div>
    </div>
  );
}

/** Admin editor for the TV board scrolling notice ticker. */
export const TvNoticeBoardEditor: React.FC = () => {
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const getTvNoticeConfig = useStore((s) => s.getTvNoticeConfig);
  const setTvNoticeConfig = useStore((s) => s.setTvNoticeConfig);

  const [draft, setDraft] = useState<TvNoticeConfig>({ text: '', color: '#fbbf24', sepColor: '#9a8cff' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadAppSettings();
      if (!cancelled) {
        setDraft(getTvNoticeConfig());
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAppSettings, getTvNoticeConfig]);

  useEffect(() => {
    if (!emojiOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [emojiOpen]);

  const textLen = draft.text.trim().length;
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
      const result = await setTvNoticeConfig(draft);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft(getTvNoticeConfig());
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setDraft({ text: '', color: draft.color, sepColor: draft.sepColor });
    setSaving(true);
    setError(null);
    try {
      const result = await setTvNoticeConfig({ text: '', color: draft.color, sepColor: draft.sepColor });
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

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setDraft((d) => ({ ...d, text: (d.text + emoji).slice(0, MAX_TEXT) }));
      return;
    }
    const next = insertAtCursor(textarea, emoji).slice(0, MAX_TEXT);
    setDraft((d) => ({ ...d, text: next }));
    setEmojiOpen(false);
    window.requestAnimationFrame(() => {
      textarea.focus();
      const pos = Math.min(next.length, MAX_TEXT);
      textarea.setSelectionRange(pos, pos);
    });
  };

  const savedConfig = getTvNoticeConfig();

  return (
    <Card className="max-w-full overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Tv className="h-4 w-4 text-violet-700" />
          <h3 className="text-sm font-semibold text-gray-900">TV Notice Board</h3>
        </div>
      </CardHeader>
      <CardBody className="space-y-4 max-w-full overflow-hidden">
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
            <div className="max-w-full min-w-0">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-medium text-gray-700">Scrolling message</label>
                <span className={`text-[10px] ${textLen > MAX_TEXT ? 'text-red-600' : 'text-gray-400'}`}>
                  {textLen}/{MAX_TEXT}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <div className="relative" ref={emojiRef}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setEmojiOpen((o) => !o)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  >
                    <Smile className="h-3.5 w-3.5" />
                    Emoji
                  </button>
                  {emojiOpen ? (
                    <div className="absolute left-0 top-full z-20 mt-1 p-2 rounded-lg border border-gray-200 bg-white shadow-lg grid grid-cols-8 gap-0.5 w-[min(100vw-2rem,16rem)]">
                      {QUICK_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          className="h-8 w-8 rounded hover:bg-gray-100 text-lg leading-none"
                          onClick={() => insertEmoji(emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Palette className="h-3 w-3" /> Colors below
                </span>
              </div>

              <textarea
                ref={textareaRef}
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value.slice(0, MAX_TEXT) }))}
                disabled={saving}
                rows={3}
                placeholder="e.g. All staff meeting today at 4 PM in the conference room."
                className="w-full max-w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white resize-y min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-full">
              <ColorSwatches
                label="Text color"
                colors={TV_NOTICE_TEXT_COLORS}
                value={draft.color}
                disabled={saving}
                onChange={(color) => setDraft((d) => ({ ...d, color }))}
              />
              <ColorSwatches
                label="Separator color"
                colors={TV_NOTICE_SEP_COLORS}
                value={draft.sepColor}
                disabled={saving}
                onChange={(sepColor) => setDraft((d) => ({ ...d, sepColor }))}
              />
            </div>

            <div className="max-w-full min-w-0 overflow-hidden">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400 mb-2">
                Preview
              </p>
              {hasContent ? (
                <div
                  className="w-full max-w-full min-w-0 h-14 rounded-lg overflow-hidden relative"
                  style={{ background: '#0a0d14', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <div className="absolute inset-0 flex items-center px-3 min-w-0">
                    <TvNoticeTicker
                      text={draft.text.trim()}
                      color={draft.color}
                      sepColor={draft.sepColor}
                      contained
                    />
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
                disabled={saving || (!hasContent && !savedConfig.text)}
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
