import React, { useRef, useState } from 'react';
import { Download, Upload, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useStore } from '../store/useStore';
import { EMPLOYEE_CSV_TEMPLATE, parseEmployeeCsv } from '../utils/employeeCsvImport';
import { downloadCsv } from '../utils/csv';

interface EmployeeCsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EmployeeCsvImportModal: React.FC<EmployeeCsvImportModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { importEmployeesFromCsv, employees } = useStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [previewCount, setPreviewCount] = useState(0);
  const [parsedRows, setParsedRows] = useState<ReturnType<typeof parseEmployeeCsv> | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; failed: number; errors: string[] } | null>(null);

  const reset = () => {
    setFileName('');
    setPreviewCount(0);
    setParsedRows(null);
    setParseError(null);
    setImporting(false);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleClose = () => {
    if (importing) return;
    reset();
    onClose();
  };

  const handleDownloadTemplate = () => {
    downloadCsv(
      'malconnexus_employees_template.csv',
      ['name', 'email', 'password', 'department', 'role', 'phone'],
      [
        ['Bindhu', 'bindhu@malconnexus.com', 'Test@0011', 'Stores', 'employee', '8019971125'],
        ['Ramakanth', 'ramakanth@malconnexus.com', 'Test@0011', 'Stores Audit', 'employee', '8019971125'],
      ],
    );
  };

  const handleExportEmployees = () => {
    if (employees.length === 0) {
      alert('No employees to export.');
      return;
    }
    downloadCsv(
      `malconnexus_employees_${new Date().toISOString().slice(0, 10)}.csv`,
      ['name', 'email', 'department', 'role', 'phone', 'status', 'cases_completed', 'cases_active'],
      employees.map((e) => [
        e.name,
        e.email,
        e.department,
        e.role,
        e.phone,
        e.status,
        e.casesCompleted,
        e.casesActive,
      ]),
    );
  };

  const handleFile = async (file: File | undefined) => {
    reset();
    if (!file) return;

    setFileName(file.name);
    try {
      const text = await file.text();
      const rows = parseEmployeeCsv(text);
      setParsedRows(rows);
      setPreviewCount(rows.length);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse CSV.');
    }
  };

  const handleImport = async () => {
    if (!parsedRows?.length) return;
    setImporting(true);
    setParseError(null);
    try {
      const summary = await importEmployeesFromCsv(parsedRows);
      setResult(summary);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import / Export Employees (CSV)"
      subtitle="Excel-compatible CSV with proper quoting and UTF-8 BOM"
      size="md"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={handleClose} disabled={importing}>Close</Button>
          <Button
            variant="primary"
            size="sm"
            icon={importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            onClick={handleImport}
            disabled={!parsedRows?.length || importing || !!result}
          >
            {importing ? 'Importing…' : `Import ${previewCount} employee(s)`}
          </Button>
        </div>
      }
    >
      <div className="p-6 space-y-5">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={handleDownloadTemplate}>
            Download template
          </Button>
          <Button variant="outline" size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={handleExportEmployees}>
            Export current employees
          </Button>
        </div>

        <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-800 space-y-1">
          <p className="font-semibold">Required columns</p>
          <p>name, email, password, department, role, phone (optional)</p>
          <p className="text-blue-700">Departments: Stores, Delivery, Scrub Person, Cleaning Department, Stores Audit, Accounts, Bill Submission, Admin</p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />

        {!fileName ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 px-4 py-8 text-indigo-700 hover:bg-indigo-50"
          >
            <Upload className="h-8 w-8" />
            <span className="text-sm font-semibold">Choose CSV file</span>
            <span className="text-xs text-indigo-500">Save from Excel as CSV UTF-8</span>
          </button>
        ) : (
          <div className="p-3 border border-gray-200 rounded-lg text-sm">
            <p className="font-medium text-gray-900">{fileName}</p>
            {previewCount > 0 && !parseError && (
              <p className="text-xs text-emerald-700 mt-1">{previewCount} valid row(s) ready to import</p>
            )}
            <button
              type="button"
              className="text-xs text-indigo-600 mt-2 hover:underline"
              onClick={() => inputRef.current?.click()}
              disabled={importing}
            >
              Choose a different file
            </button>
          </div>
        )}

        {parseError && (
          <div className="flex gap-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{parseError}</span>
          </div>
        )}

        {result && (
          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Done — created {result.created}, updated {result.updated}, failed {result.failed}
              </span>
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-32 overflow-y-auto p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 space-y-1">
                {result.errors.map((msg) => (
                  <p key={msg}>{msg}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <details className="text-xs text-gray-500">
          <summary className="cursor-pointer font-medium text-gray-700">Example CSV</summary>
          <pre className="mt-2 p-3 bg-gray-50 rounded-lg overflow-x-auto whitespace-pre-wrap">{EMPLOYEE_CSV_TEMPLATE}</pre>
        </details>
      </div>
    </Modal>
  );
};
