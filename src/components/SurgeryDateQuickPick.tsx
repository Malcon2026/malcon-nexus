import React from 'react';
import { getISTDateKey } from '../lib/attendance';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/helpers';

export type SurgeryDateMode = 'today' | 'tomorrow' | 'custom';

function addDaysToISTDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return getISTDateKey(dt);
}

export function getTodaySurgeryDateKey(): string {
  return getISTDateKey();
}

export function getTomorrowSurgeryDateKey(): string {
  return addDaysToISTDateKey(getISTDateKey(), 1);
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-gray-300 bg-white';

interface SurgeryDateQuickPickProps {
  value: string;
  mode: SurgeryDateMode;
  onChange: (value: string, mode: SurgeryDateMode) => void;
}

export const SurgeryDateQuickPick: React.FC<SurgeryDateQuickPickProps> = ({
  value,
  mode,
  onChange,
}) => {
  const todayKey = getTodaySurgeryDateKey();
  const tomorrowKey = getTomorrowSurgeryDateKey();

  const pickToday = () => onChange(todayKey, 'today');
  const pickTomorrow = () => onChange(tomorrowKey, 'tomorrow');
  const pickCustom = () => onChange(value || todayKey, 'custom');

  const btnClass = (active: boolean) =>
    cn(
      'flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors',
      active
        ? 'border-gray-900 bg-gray-900 text-white'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" className={btnClass(mode === 'today')} onClick={pickToday}>
          Today
        </button>
        <button type="button" className={btnClass(mode === 'tomorrow')} onClick={pickTomorrow}>
          Tomorrow
        </button>
        <button type="button" className={btnClass(mode === 'custom')} onClick={pickCustom}>
          Custom
        </button>
      </div>

      {mode === 'custom' ? (
        <input
          type="date"
          className={`${inputClass} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-0`}
          value={value}
          onChange={(e) => onChange(e.target.value, 'custom')}
        />
      ) : (
        <p className="text-xs text-gray-600 px-1">
          {mode === 'today' ? 'Today' : 'Tomorrow'}
          {' — '}
          <span className="font-medium text-gray-900">{formatDate(value)}</span>
        </p>
      )}
    </div>
  );
};
