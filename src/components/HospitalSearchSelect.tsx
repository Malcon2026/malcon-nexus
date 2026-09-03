import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, ChevronDown, Search, X } from 'lucide-react';
import type { Hospital } from '../types';

export function formatHospitalLabel(hospital: Hospital): string {
  return hospital.branch ? `${hospital.name} — ${hospital.branch}` : hospital.name;
}

function matchesHospital(hospital: Hospital, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = `${hospital.name} ${hospital.branch} ${hospital.city} ${hospital.address}`.toLowerCase();
  return hay.includes(q);
}

interface HospitalSearchSelectProps {
  hospitals: Hospital[];
  value: string;
  onChange: (hospitalId: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const HospitalSearchSelect: React.FC<HospitalSearchSelectProps> = ({
  hospitals,
  value,
  onChange,
  placeholder = 'Search hospital...',
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const activeHospitals = useMemo(
    () =>
      hospitals
        .filter((h) => h.status === 'Active')
        .sort((a, b) => formatHospitalLabel(a).localeCompare(formatHospitalLabel(b))),
    [hospitals],
  );

  const filteredHospitals = useMemo(
    () => activeHospitals.filter((h) => matchesHospital(h, query)),
    [activeHospitals, query],
  );

  const selectedHospital = value ? activeHospitals.find((h) => h.id === value) ?? null : null;

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => searchRef.current?.focus());
    } else {
      setQuery('');
    }
  }, [open]);

  const pick = (next: string) => {
    onChange(next);
    setOpen(false);
    setQuery('');
  };

  const fieldClass =
    'w-full flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-left transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300';

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={`${fieldClass} ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:border-gray-300 cursor-pointer'}`}
      >
        {selectedHospital ? (
          <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
        ) : null}
        <span className={`flex-1 min-w-0 truncate ${selectedHospital ? 'text-gray-900' : 'text-gray-400'}`}>
          {selectedHospital ? formatHospitalLabel(selectedHospital) : placeholder}
        </span>
        {value ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              pick('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                pick('');
              }
            }}
            className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </span>
        ) : (
          <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[280px] rounded-xl border border-gray-200 bg-white shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, branch, city..."
                className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-white"
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setOpen(false);
                    setQuery('');
                  }
                }}
              />
            </div>
          </div>

          <div className="max-h-[220px] overflow-y-auto p-1">
            {!query && (
              <button
                type="button"
                onClick={() => pick('')}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  !value ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                {placeholder}
              </button>
            )}

            {filteredHospitals.map((hospital) => (
              <button
                key={hospital.id}
                type="button"
                onClick={() => pick(hospital.id)}
                className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  value === hospital.id ? 'bg-gray-100' : 'hover:bg-gray-50'
                }`}
              >
                <Building2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{formatHospitalLabel(hospital)}</p>
                  {(hospital.city || hospital.address) && (
                    <p className="text-[11px] text-gray-400 truncate">
                      {[hospital.address, hospital.city].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </button>
            ))}

            {filteredHospitals.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4 px-2">
                {query ? `No hospitals match "${query}"` : 'No active hospitals'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
