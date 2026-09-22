import React from 'react';
import { Delete } from 'lucide-react';
import { cn } from '../utils/cn';

export type NumericKeypadProps = {
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
  className?: string;
  disabled?: boolean;
};

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;

export const NumericKeypad: React.FC<NumericKeypadProps> = ({
  value,
  onChange,
  maxLength,
  className,
  disabled = false,
}) => {
  const append = (digit: string) => {
    if (disabled || value.length >= maxLength) return;
    onChange(value + digit);
  };

  const backspace = () => {
    if (disabled || !value.length) return;
    onChange(value.slice(0, -1));
  };

  const keyClass =
    'flex items-center justify-center rounded-xl border border-gray-200 bg-white text-xl font-semibold text-gray-900 shadow-sm active:scale-[0.97] active:bg-gray-50 transition-transform min-h-[52px] touch-manipulation select-none disabled:opacity-40 disabled:pointer-events-none';

  return (
    <div
      className={cn('grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-[320px] mx-auto', className)}
      role="group"
      aria-label="Numeric keypad"
    >
      {DIGITS.map((d) => (
        <button
          key={d}
          type="button"
          disabled={disabled}
          className={keyClass}
          onClick={() => append(d)}
          aria-label={`Digit ${d}`}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled || value.length === 0}
        className={cn(keyClass, 'text-gray-600')}
        onClick={backspace}
        aria-label="Delete last digit"
      >
        <Delete className="h-5 w-5" aria-hidden />
      </button>
      <button
        type="button"
        disabled={disabled}
        className={keyClass}
        onClick={() => append('0')}
        aria-label="Digit 0"
      >
        0
      </button>
      <div className="min-h-[52px]" aria-hidden />
    </div>
  );
};

type NumericReadoutProps = {
  value: string;
  placeholder?: string;
  maxLength: number;
  icon?: React.ReactNode;
  centered?: boolean;
  id?: string;
  label?: string;
};

/** Display-only field — does not open the OS keyboard. */
export const NumericReadout: React.FC<NumericReadoutProps> = ({
  value,
  placeholder,
  maxLength,
  icon,
  centered = false,
  id,
  label,
}) => {
  const display = value || placeholder || '';
  const isEmpty = !value;

  return (
    <div className="min-w-0">
      {label ? (
        <label htmlFor={id} className="nexus-login-label block mb-1.5">
          {label}
        </label>
      ) : null}
      <div
        id={id}
        role="textbox"
        aria-readonly="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'nexus-login-input relative w-full min-w-0 max-w-full py-3 transition-all font-medium tabular-nums',
          icon ? 'pl-10 pr-4' : 'px-4',
          centered ? 'text-center tracking-[0.2em]' : 'text-left',
          isEmpty && placeholder ? 'text-gray-400 font-normal' : 'text-gray-900',
        )}
      >
        {icon ? (
          <span className="nexus-login-icon absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex">
            {icon}
          </span>
        ) : null}
        <span>
          {isEmpty ? placeholder : value}
          {!isEmpty && value.length < maxLength ? (
            <span className="inline-block w-[2px] h-[1em] ml-0.5 bg-[var(--color-accent)] animate-pulse align-middle" />
          ) : null}
        </span>
      </div>
    </div>
  );
};

export const OtpDigitBoxes: React.FC<{ value: string; length?: number }> = ({
  value,
  length = 6,
}) => {
  const cells = Array.from({ length }, (_, i) => value[i] ?? '');
  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" aria-hidden>
      {cells.map((ch, i) => (
        <div
          key={i}
          className={cn(
            'h-12 w-10 sm:h-14 sm:w-11 rounded-xl border-2 flex items-center justify-center text-lg font-semibold tabular-nums transition-colors',
            ch
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)]/40 text-gray-900'
              : i === value.length
                ? 'border-[var(--color-accent)]/50 bg-white'
                : 'border-gray-200 bg-white text-gray-300',
          )}
        >
          {ch || (i === value.length ? '·' : '')}
        </div>
      ))}
    </div>
  );
};
