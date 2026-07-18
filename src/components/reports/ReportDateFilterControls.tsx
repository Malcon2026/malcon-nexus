import React from 'react';
import type { ReportDateFilter, ReportDateRange } from '../../utils/reportFilters';
import { REPORT_DATE_RANGE_LABELS, REPORT_DATE_RANGE_OPTIONS } from '../../utils/reportFilters';

interface ReportDateFilterProps {
  value: ReportDateFilter;
  onChange: (next: ReportDateFilter) => void;
}

export const ReportDateFilterControls: React.FC<ReportDateFilterProps> = ({ value, onChange }) => {
  const setRange = (range: ReportDateRange) => onChange({ ...value, range });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-2">Date range</label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {REPORT_DATE_RANGE_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRange(option)}
              className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                value.range === option
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {REPORT_DATE_RANGE_LABELS[option]}
            </button>
          ))}
        </div>
      </div>

      {value.range === 'custom' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">From</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              value={value.customFrom ?? ''}
              onChange={(e) => onChange({ ...value, customFrom: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">To</label>
            <input
              type="date"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
              value={value.customTo ?? ''}
              onChange={(e) => onChange({ ...value, customTo: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
};
