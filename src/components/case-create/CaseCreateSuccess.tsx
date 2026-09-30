import React, { useEffect, useRef } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

export interface CreatedCaseInfo {
  id: string;
  caseNumber: string;
  hospitalName: string;
  doctorName: string;
  dateLabel: string;
}

interface CaseCreateSuccessProps {
  info: CreatedCaseInfo;
  onView: () => void;
  onCreateAnother: () => void;
  onDone: () => void;
}

export const CaseCreateSuccess: React.FC<CaseCreateSuccessProps> = ({ info, onView, onCreateAnother, onDone }) => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-10 text-center sm:py-16" role="status">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <CheckCircle2 className="h-9 w-9" aria-hidden />
      </span>
      <h2 ref={headingRef} tabIndex={-1} className="mt-5 text-2xl font-semibold text-gray-900 focus:outline-none">
        Case created
      </h2>
      <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-accent)]">{info.caseNumber}</p>

      <dl className="mt-6 w-full divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white text-left shadow-sm">
        {[
          ['Hospital', info.hospitalName],
          ['Doctor', info.doctorName],
          ['Surgery date', info.dateLabel],
        ].map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-4 px-4 py-3">
            <dt className="text-sm text-gray-500">{label}</dt>
            <dd className="min-w-0 break-words text-right text-sm font-medium text-gray-900">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-8 flex w-full flex-col gap-3">
        <Button type="button" variant="primary" className="min-h-[52px] w-full justify-center text-base font-semibold" onClick={onView}>
          View case
        </Button>
        <Button type="button" variant="outline" className="min-h-[52px] w-full justify-center text-base" onClick={onCreateAnother}>
          Create another case
        </Button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-[44px] rounded-xl text-sm font-medium text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          Done
        </button>
      </div>
    </div>
  );
};
