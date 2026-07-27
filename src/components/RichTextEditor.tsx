import React, { useCallback, useEffect, useRef } from 'react';
import {
  Bold, Italic, Underline, Strikethrough,
  List, ListOrdered, Link2, RemoveFormatting,
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
}

type Cmd =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikeThrough'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'removeFormat';

const COLORS = [
  { label: 'Default', value: '' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'Red', value: '#f87171' },
  { label: 'Green', value: '#34d399' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Violet', value: '#9a8cff' },
];

function runCommand(cmd: Cmd) {
  document.execCommand(cmd, false);
}

/**
 * Lightweight rich-text field (bold / italic / lists / link / color).
 * Uses contentEditable — no extra package weight.
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Write a notice…',
  minHeight = '120px',
  disabled = false,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(value);
  const seeded = useRef(false);

  // Seed once on mount, then sync when parent resets value (load / clear).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!seeded.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value;
      seeded.current = true;
      return;
    }
    if (value !== lastEmitted.current) {
      el.innerHTML = value || '';
      lastEmitted.current = value;
    }
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  }, [onChange]);

  const withFocus = (fn: () => void) => {
    ref.current?.focus();
    fn();
    emit();
  };

  const addLink = () => {
    withFocus(() => {
      const url = window.prompt('Link URL (https://…)', 'https://');
      if (!url) return;
      document.execCommand('createLink', false, url);
      // Ensure safe target on new links
      const sel = window.getSelection();
      if (sel?.anchorNode) {
        const a = (sel.anchorNode as HTMLElement).parentElement?.closest('a');
        if (a) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      }
    });
  };

  const setColor = (color: string) => {
    withFocus(() => {
      if (!color) {
        document.execCommand('removeFormat', false);
        return;
      }
      document.execCommand('foreColor', false, color);
    });
  };

  const tools: { cmd?: Cmd; label: string; icon: React.ReactNode; onClick?: () => void }[] = [
    { cmd: 'bold', label: 'Bold', icon: <Bold className="h-3.5 w-3.5" /> },
    { cmd: 'italic', label: 'Italic', icon: <Italic className="h-3.5 w-3.5" /> },
    { cmd: 'underline', label: 'Underline', icon: <Underline className="h-3.5 w-3.5" /> },
    { cmd: 'strikeThrough', label: 'Strike', icon: <Strikethrough className="h-3.5 w-3.5" /> },
    { cmd: 'insertUnorderedList', label: 'Bullets', icon: <List className="h-3.5 w-3.5" /> },
    { cmd: 'insertOrderedList', label: 'Numbered', icon: <ListOrdered className="h-3.5 w-3.5" /> },
    { label: 'Link', icon: <Link2 className="h-3.5 w-3.5" />, onClick: addLink },
    { cmd: 'removeFormat', label: 'Clear format', icon: <RemoveFormatting className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={`rounded-xl border border-gray-200 bg-white overflow-hidden ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 bg-gray-50">
        {tools.map((t) => (
          <button
            key={t.label}
            type="button"
            title={t.label}
            className="p-1.5 rounded-md text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm transition-colors"
            onMouseDown={(e) => {
              e.preventDefault();
              if (t.onClick) t.onClick();
              else if (t.cmd) withFocus(() => runCommand(t.cmd!));
            }}
          >
            {t.icon}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-gray-200" />
        {COLORS.map((c) => (
          <button
            key={c.label}
            type="button"
            title={c.label}
            className="h-5 w-5 rounded-full border border-gray-200 mx-0.5 hover:scale-110 transition-transform"
            style={{ background: c.value || '#e6ebf5' }}
            onMouseDown={(e) => {
              e.preventDefault();
              setColor(c.value);
            }}
          />
        ))}
      </div>

      <div
        ref={ref}
        role="textbox"
        aria-multiline
        aria-label="Notice message"
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="notice-rich-editor px-3 py-2.5 text-sm text-stone-800 leading-relaxed outline-none focus:ring-0 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400"
        style={{ minHeight }}
        onInput={emit}
        onBlur={emit}
      />
    </div>
  );
};
