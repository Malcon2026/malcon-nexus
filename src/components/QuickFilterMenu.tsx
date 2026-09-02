import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface QuickFilterOption<T extends string = string> {
  value: T;
  label: string;
  /** Optional chip / button styling when selected or in the list. */
  activeClass?: string;
  idleClass?: string;
}

interface QuickFilterMenuProps<T extends string = string> {
  title: string;
  value: T | '';
  options: QuickFilterOption<T>[];
  allLabel?: string;
  onChange: (value: T | '') => void;
}

export function QuickFilterMenu<T extends string>({
  title,
  value,
  options,
  allLabel = 'All',
  onChange,
}: QuickFilterMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);
  const triggerLabel = selected ? selected.label : allLabel;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const pick = (next: T | '') => {
    onChange(next);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg transition-colors min-h-[40px] ${
          value
            ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
            : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
        }`}
      >
        <span className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold">{title}</span>
        <span className="truncate max-w-[140px]">{triggerLabel}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-[240px] max-w-[min(320px,calc(100vw-2rem))] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">{title}</p>
          </div>
          <div className="p-2 space-y-1 max-h-[320px] overflow-y-auto">
            <button
              type="button"
              onClick={() => pick('')}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                !value ? 'bg-gray-900 text-white font-medium' : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span>{allLabel}</span>
              {!value && <Check className="h-4 w-4 shrink-0" />}
            </button>
            {options.map((opt) => {
              const isActive = value === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt.value)}
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-colors ${
                    isActive
                      ? opt.activeClass ?? 'bg-gray-900 text-white font-medium'
                      : opt.idleClass ?? 'hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <span>{opt.label}</span>
                  {isActive && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
