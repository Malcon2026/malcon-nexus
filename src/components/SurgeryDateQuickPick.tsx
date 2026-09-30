import React from 'react';
import { getISTDateKey } from '../lib/attendance';
import { cn } from '../utils/cn';
import { formatDate } from '../utils/helpers';
import { NEXUS_FORM_CONTROL } from '../constants/formStyles';

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

interface SurgeryDateQuickPickProps {
  value: string;
  mode: SurgeryDateMode;
  onChange: (value: string, mode: SurgeryDateMode) => void;
  /** `lg` = bigger touch targets (case entry). Default keeps existing look. */
  size?: 'sm' | 'lg';
  customLabel?: string;
}

export const SurgeryDateQuickPick: React.FC<SurgeryDateQuickPickProps> = ({
  value,
  mode,
  onChange,
  size = 'sm',
  customLabel = 'Custom',
}) => {
  const todayKey = getTodaySurgeryDateKey();
  const tomorrowKey = getTomorrowSurgeryDateKey();

  const pickToday = () => onChange(todayKey, 'today');
  const pickTomorrow = () => onChange(tomorrowKey, 'tomorrow');
  const pickCustom = () => onChange(value || todayKey, 'custom');

  const btnClass = (active: boolean) =>
    cn(
      'flex-1 px-3 font-semibold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
      size === 'lg' ? 'min-h-[48px] text-sm rounded-xl' : 'py-2 text-xs rounded-lg',
      active
        ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-white'
        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
    );

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button type="button" aria-pressed={mode === 'today'} className={btnClass(mode === 'today')} onClick={pickToday}>
          Today
        </button>
        <button type="button" aria-pressed={mode === 'tomorrow'} className={btnClass(mode === 'tomorrow')} onClick={pickTomorrow}>
          Tomorrow
        </button>
        <button type="button" aria-pressed={mode === 'custom'} className={btnClass(mode === 'custom')} onClick={pickCustom}>
          {customLabel}
        </button>
      </div>

      {mode === 'custom' ? (
        <input
          type="date"
          className={`${NEXUS_FORM_CONTROL} [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:w-0`}
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
