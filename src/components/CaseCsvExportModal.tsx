import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import type { ImplantCase } from '../types';
import {
  CASE_EXPORT_RANGE_LABELS,
  exportCasesCsv,
  filterCasesForExport,
  type CaseDateField,
  type CaseExportRange,
} from '../utils/caseExport';

interface CaseCsvExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  cases: ImplantCase[];
  title?: string;
}

const RANGE_OPTIONS: CaseExportRange[] = [
  'all',
  'today',
  'yesterday',
  'last_7_days',
  'last_30_days',
  'this_month',
  'last_month',
  'custom',
];

export const CaseCsvExportModal: React.FC<CaseCsvExportModalProps> = ({
  isOpen,
  onClose,
  cases,
  title = 'Export Cases to CSV',
}) => {
  const [range, setRange] = useState<CaseExportRange>('all');
  const [dateField, setDateField] = useState<CaseDateField>('createdAt');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const previewCount = useMemo(() => {
    try {
      return filterCasesForExport(cases, { range, dateField, customFrom, customTo }).length;
    } catch {
      return 0;
    }
  }, [cases, range, dateField, customFrom, customTo]);

  const handleExport = () => {
    setError(null);
    try {
      const result = exportCasesCsv(cases, { range, dateField, customFrom, customTo });
      alert(`Exported ${result.count} case(s) to ${result.filename}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle="Choose a date range — file opens correctly in Excel with UTF-8"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            onClick={handleExport}
            disabled={previewCount === 0}
          >
            Download CSV ({previewCount})
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-5">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">Date range</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setRange(option);
                  setError(null);
                }}
                className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                  range === option
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {CASE_EXPORT_RANGE_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Filter by</label>
          <select
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
            value={dateField}
            onChange={(e) => setDateField(e.target.value as CaseDateField)}
          >
            <option value="createdAt">Case created date</option>
            <option value="updatedAt">Case last updated</option>
            <option value="surgeryDate">Surgery date</option>
          </select>
        </div>

        {range === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">From</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">To</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-600">
          <strong className="text-gray-900">{previewCount}</strong> case{previewCount === 1 ? '' : 's'} will be exported
          {range !== 'all' && (
            <> — {CASE_EXPORT_RANGE_LABELS[range].toLowerCase()} by {dateField === 'createdAt' ? 'created date' : dateField === 'updatedAt' ? 'last update' : 'surgery date'}</>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}
      </div>
    </Modal>
  );
};
