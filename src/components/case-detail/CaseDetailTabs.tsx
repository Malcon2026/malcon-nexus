import { cn } from '../../utils/cn';

export interface CaseTab<T extends string> {
  id: T;
  label: string;
  count?: number;
}

/** Equal-width segmented tabs — fits on narrow phones without scrolling or wrapping. */
export function CaseDetailTabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: CaseTab<T>[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Case sections"
      className="mb-5 grid gap-1 rounded-xl bg-gray-100 p-1"
      style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
    >
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(tab.id)}
            className={cn(
              'min-h-[40px] truncate rounded-lg px-1 text-xs font-medium transition-colors sm:text-sm',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]',
              selected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800',
            )}
          >
            {tab.label}
            {tab.count ? <span className="ml-1 text-gray-400">{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
