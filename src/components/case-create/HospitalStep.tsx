import React, { useMemo, useState } from 'react';
import { Building2, Check, Search } from 'lucide-react';
import type { Hospital, ImplantCase } from '../../types';
import { cn } from '../../utils/cn';
import { formatHospitalLabel } from '../HospitalSearchSelect';
import { hospitalSubtitle, rankHospitals } from './caseCreateHelpers';

interface HospitalStepProps {
  hospitals: Hospital[];
  cases: ImplantCase[];
  value: string;
  onSelect: (hospitalId: string) => void;
  error?: string | null;
}

const INITIAL_ALL_LIMIT = 8;
const MAX_RESULTS = 40;

export const HospitalStep: React.FC<HospitalStepProps> = ({ hospitals, cases, value, onSelect, error }) => {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const active = useMemo(
    () => hospitals.filter((h) => h.status === 'Active').sort((a, b) => a.name.localeCompare(b.name)),
    [hospitals],
  );
  const { recent, frequent } = useMemo(() => rankHospitals(cases, hospitals), [cases, hospitals]);

  const q = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!q) return [];
    return active
      .filter(
        (h) =>
          h.name.toLowerCase().includes(q) ||
          (h.branch ?? '').toLowerCase().includes(q) ||
          (h.city ?? '').toLowerCase().includes(q) ||
          (h.address ?? '').toLowerCase().includes(q),
      )
      .slice(0, MAX_RESULTS);
  }, [active, q]);

  const shownIds = new Set([...recent, ...frequent].map((h) => h.id));
  const rest = active.filter((h) => !shownIds.has(h.id));
  const restVisible = showAll || shownIds.size === 0 ? rest : rest.slice(0, INITIAL_ALL_LIMIT);

  const card = (h: Hospital) => {
    const selected = h.id === value;
    const sub = hospitalSubtitle(h);
    return (
      <li key={h.id}>
        <button
          type="button"
          onClick={() => onSelect(h.id)}
          aria-pressed={selected}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border px-4 min-h-[64px] py-2.5 text-left transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
            selected
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50',
          )}
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              selected ? 'bg-[var(--color-accent)] text-white' : 'bg-gray-100 text-gray-500',
            )}
          >
            <Building2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-gray-900">{formatHospitalLabel(h)}</span>
            {sub ? <span className="block truncate text-xs text-gray-500">{sub}</span> : null}
          </span>
          {selected ? <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-label="Selected" /> : null}
        </button>
      </li>
    );
  };

  const section = (label: string, list: Hospital[]) =>
    list.length === 0 ? null : (
      <section aria-label={label} className="space-y-2">
        <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
        <ul className="space-y-2">{list.map(card)}</ul>
      </section>
    );

  return (
    <div className="space-y-5">
      <div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search hospital, branch or city"
            aria-label="Search hospitals"
            aria-invalid={error ? true : undefined}
            className="nexus-field-input !min-h-[52px] !text-base !rounded-2xl"
          />
        </div>
        {error ? (
          <p role="alert" className="mt-2 px-1 text-sm font-medium text-red-600">
            {error}
          </p>
        ) : null}
      </div>

      {active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
          No active hospitals yet. Add hospitals in Settings, then come back.
        </p>
      ) : q ? (
        results.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white px-4 py-8 text-center text-sm text-gray-500">
            No hospital matches “{query.trim()}”.
          </p>
        ) : (
          section(`${results.length} result${results.length === 1 ? '' : 's'}`, results)
        )
      ) : (
        <>
          {section('Recent', recent)}
          {section('Frequently used', frequent)}
          {section(shownIds.size > 0 ? 'All hospitals' : 'Hospitals', restVisible)}
          {!showAll && rest.length > restVisible.length ? (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="w-full min-h-[48px] rounded-2xl border border-gray-200 bg-white text-sm font-semibold text-[var(--color-accent)] hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              Show all {rest.length} hospitals
            </button>
          ) : null}
        </>
      )}
    </div>
  );
};
