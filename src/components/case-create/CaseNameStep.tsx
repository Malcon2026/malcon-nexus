import React, { useMemo } from 'react';
import type { ImplantCase } from '../../types';
import { cn } from '../../utils/cn';
import { NEXUS_FORM_CONTROL } from '../../constants/formStyles';
import { normalizeTitleCaseWords } from '../../lib/textFormat';
import { commonProcedures } from './caseCreateHelpers';

interface CaseNameStepProps {
  /** The case name is saved in the implantRequired field. */
  form: { implantRequired: string };
  patch: (partial: { implantRequired: string }) => void;
  cases: ImplantCase[];
  error: string | null;
  procedureRef: React.RefObject<HTMLInputElement | null>;
  onSubmitFromKeyboard: () => void;
}

const fieldLabel = 'block text-sm font-semibold text-gray-900 mb-2';

export const CaseNameStep: React.FC<CaseNameStepProps> = ({
  form,
  patch,
  cases,
  error,
  procedureRef,
  onSubmitFromKeyboard,
}) => {
  const procedures = useMemo(() => commonProcedures(cases), [cases]);

  return (
    <section>
      <label htmlFor="cc-case-name" className={fieldLabel}>
        Case name
      </label>
      <input
        id="cc-case-name"
        ref={procedureRef}
        className={cn(NEXUS_FORM_CONTROL, '!text-base !min-h-[52px]', error && '!border-red-300')}
        value={form.implantRequired}
        onChange={(e) => patch({ implantRequired: e.target.value })}
        onBlur={(e) => patch({ implantRequired: normalizeTitleCaseWords(e.target.value) })}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmitFromKeyboard();
          }
        }}
        placeholder="e.g. Total knee replacement"
        enterKeyHint="next"
        autoComplete="off"
        aria-invalid={error ? true : undefined}
      />
      {error ? (
        <p role="alert" className="mt-2 text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}
      {!form.implantRequired.trim() && procedures.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Common case names">
          {procedures.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => patch({ implantRequired: p })}
              className="min-h-[44px] rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
};
