import React, { useEffect, useMemo, useState } from 'react';
import {
  Download, ShieldAlert, FolderOpen, LogIn, Users, Receipt, ScrollText,
  CheckCircle2, Building2, MapPin, Fuel, List,
} from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { ReportDateFilterControls } from '../components/reports/ReportDateFilterControls';
import { EXPORT_REPORT_TYPES, type ExportReportType } from '../components/reports/types';
import type { ReportDateFilter } from '../utils/reportFilters';
import { REPORT_DATE_RANGE_LABELS, isTimestampInRange } from '../utils/reportFilters';
import type { CaseDateField } from '../utils/caseExport';
import {
  filterCasesForExport,
  exportCasesCsv,
} from '../utils/caseExport';
import {
  buildAttendanceSummaryRows,
  buildExpenseSummaryRows,
  exportActivityCsv,
  exportAttendanceApprovalsCsv,
  exportAttendanceSummaryCsv,
  exportBillingCsv,
  exportEmployeesCsv,
  exportExpenseDetailCsv,
  exportExpenseSummaryCsv,
  exportHospitalsCsv,
  exportStageApprovalsCsv,
  filterActivityForExport,
  filterAttendanceApprovalsForExport,
  filterEmployeesForExport,
  filterExpensesForExport,
} from '../utils/reportsExport';

const REPORT_ICONS: Record<ExportReportType, React.ReactNode> = {
  cases: <FolderOpen className="h-5 w-5 text-indigo-600" />,
  attendance: <LogIn className="h-5 w-5 text-emerald-600" />,
  employees: <Users className="h-5 w-5 text-purple-600" />,
  billing: <Receipt className="h-5 w-5 text-blue-600" />,
  activity: <ScrollText className="h-5 w-5 text-gray-600" />,
  'attendance-approvals': <MapPin className="h-5 w-5 text-amber-600" />,
  'stage-approvals': <CheckCircle2 className="h-5 w-5 text-orange-600" />,
  hospitals: <Building2 className="h-5 w-5 text-cyan-600" />,
  'expenses-summary': <Fuel className="h-5 w-5 text-orange-600" />,
  'expenses-detail': <List className="h-5 w-5 text-orange-500" />,
};

const defaultFilter: ReportDateFilter = { range: 'this_month' };

export const Reports: React.FC = () => {
  const viewMode = useStore((s) => s.viewMode);
  const cases = useStore((s) => s.cases);
  const employees = useStore((s) => s.employees);
  const hospitals = useStore((s) => s.hospitals);
  const activityLog = useStore((s) => s.activityLog);
  const attendanceRecords = useStore((s) => s.attendanceRecords);
  const attendanceApprovalRequests = useStore((s) => s.attendanceApprovalRequests);
  const dailyExpenses = useStore((s) => s.dailyExpenses);
  const dailyExpensesLoaded = useStore((s) => s.dailyExpensesLoaded);
  const loadDailyExpenses = useStore((s) => s.loadDailyExpenses);
  const appSettingsLoaded = useStore((s) => s.appSettingsLoaded);
  const loadAppSettings = useStore((s) => s.loadAppSettings);
  const incentiveRatePerKm = useStore((s) => s.getIncentiveRatePerKm());

  useEffect(() => {
    if (!dailyExpensesLoaded) {
      void loadDailyExpenses();
    }
  }, [dailyExpensesLoaded, loadDailyExpenses]);

  useEffect(() => {
    if (!appSettingsLoaded) {
      void loadAppSettings();
    }
  }, [appSettingsLoaded, loadAppSettings]);

  const [selectedReport, setSelectedReport] = useState<ExportReportType>('cases');
  const [dateFilter, setDateFilter] = useState<ReportDateFilter>(defaultFilter);
  const [caseDateField, setCaseDateField] = useState<CaseDateField>('createdAt');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const previewCount = useMemo(() => {
    try {
      switch (selectedReport) {
        case 'cases':
          return filterCasesForExport(cases, { ...dateFilter, dateField: caseDateField }).length;
        case 'attendance':
          return buildAttendanceSummaryRows(employees, attendanceRecords, dateFilter).length;
        case 'employees':
          return filterEmployeesForExport(employees.filter((e) => e.role === 'employee'), dateFilter).length;
        case 'billing':
          return filterCasesForExport(cases, { ...dateFilter, dateField: 'updatedAt' }).filter((c) => c.invoiceAmount).length;
        case 'activity':
          return filterActivityForExport(activityLog, dateFilter).length;
        case 'attendance-approvals':
          return filterAttendanceApprovalsForExport(attendanceApprovalRequests, dateFilter).length;
        case 'stage-approvals':
          return cases.filter(
            (c) => c.status === 'Waiting For Approval' && isTimestampInRange(c.updatedAt, dateFilter),
          ).length;
        case 'hospitals':
          return hospitals.length;
        case 'expenses-summary':
          return buildExpenseSummaryRows(employees, dailyExpenses, dateFilter, incentiveRatePerKm).length;
        case 'expenses-detail':
          return filterExpensesForExport(dailyExpenses, dateFilter).length;
        default:
          return 0;
      }
    } catch {
      return 0;
    }
  }, [
    selectedReport,
    dateFilter,
    caseDateField,
    cases,
    employees,
    hospitals,
    activityLog,
    attendanceRecords,
    attendanceApprovalRequests,
    dailyExpenses,
    incentiveRatePerKm,
  ]);

  const activeMeta = EXPORT_REPORT_TYPES.find((r) => r.id === selectedReport)!;

  const handleDownload = async () => {
    setError(null);
    setSuccess(null);
    setDownloading(true);
    try {
      let result: { count: number; filename: string };
      switch (selectedReport) {
        case 'cases':
          result = exportCasesCsv(cases, { ...dateFilter, dateField: caseDateField });
          break;
        case 'attendance':
          result = exportAttendanceSummaryCsv(employees, attendanceRecords, dateFilter);
          break;
        case 'employees':
          result = exportEmployeesCsv(employees, dateFilter);
          break;
        case 'billing':
          result = exportBillingCsv(cases, dateFilter, { ...dateFilter, dateField: 'updatedAt' });
          break;
        case 'activity':
          result = exportActivityCsv(activityLog, dateFilter);
          break;
        case 'attendance-approvals':
          result = exportAttendanceApprovalsCsv(attendanceApprovalRequests, dateFilter);
          break;
        case 'stage-approvals':
          result = exportStageApprovalsCsv(cases, dateFilter);
          break;
        case 'hospitals':
          result = exportHospitalsCsv(hospitals, cases, dateFilter, { ...dateFilter, dateField: caseDateField });
          break;
        case 'expenses-summary':
          result = exportExpenseSummaryCsv(employees, dailyExpenses, dateFilter, incentiveRatePerKm);
          break;
        case 'expenses-detail':
          result = exportExpenseDetailCsv(dailyExpenses, dateFilter, incentiveRatePerKm);
          break;
        default:
          throw new Error('Unknown report type.');
      }
      setSuccess(`Downloaded ${result.count} row(s) → ${result.filename}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setDownloading(false);
    }
  };

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Reports are only available to administrators.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Download filtered data exports — cases, attendance, employees, billing, and more
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-2">
          {EXPORT_REPORT_TYPES.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => {
                setSelectedReport(report.id);
                setError(null);
                setSuccess(null);
              }}
              className={`w-full text-left rounded-xl border p-4 transition-all ${
                selectedReport === report.id
                  ? 'border-gray-900 bg-gray-900 text-white shadow-md'
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${
                  selectedReport === report.id ? 'bg-white/15' : 'bg-gray-50'
                }`}>
                  {REPORT_ICONS[report.id]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{report.label}</p>
                  <p className={`text-xs mt-0.5 line-clamp-2 ${
                    selectedReport === report.id ? 'text-white/80' : 'text-gray-500'
                  }`}>
                    {report.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center">
                {REPORT_ICONS[selectedReport]}
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">{activeMeta.label}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeMeta.description}</p>
              </div>
            </div>
          </div>

          <CardBody className="p-5 sm:p-6 space-y-6">
            <ReportDateFilterControls
              value={dateFilter}
              onChange={(next) => {
                setDateFilter(next);
                setError(null);
                setSuccess(null);
              }}
            />

            {(selectedReport === 'cases' || selectedReport === 'hospitals') && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Filter cases by</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
                  value={caseDateField}
                  onChange={(e) => setCaseDateField(e.target.value as CaseDateField)}
                >
                  <option value="createdAt">Case created date</option>
                  <option value="updatedAt">Case last updated</option>
                  <option value="surgeryDate">Surgery date</option>
                </select>
              </div>
            )}

            <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm text-gray-700">
                  <strong className="text-gray-900">{previewCount}</strong> row{previewCount === 1 ? '' : 's'} ready to export
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Range: {REPORT_DATE_RANGE_LABELS[dateFilter.range]}
                  {dateFilter.range === 'custom' && dateFilter.customFrom && dateFilter.customTo
                    ? ` (${dateFilter.customFrom} → ${dateFilter.customTo})`
                    : ''}
                </p>
              </div>
              <Button
                variant="primary"
                size="md"
                icon={<Download className="h-4 w-4" />}
                onClick={() => void handleDownload()}
                disabled={downloading || previewCount === 0}
              >
                {downloading ? 'Exporting…' : `Download CSV (${previewCount})`}
              </Button>
            </div>

            {selectedReport === 'attendance' && (
              <p className="text-xs text-gray-500">
                Exports one row per employee per day in the selected range (punch in, punch out, hours, status).
              </p>
            )}

            {(selectedReport === 'expenses-summary' || selectedReport === 'expenses-detail') && (
              <p className="text-xs text-gray-500">
                Km incentive is calculated at ₹{incentiveRatePerKm}/km (change the rate from the Expenses page).
              </p>
            )}

            {success && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-800">
                {success}
              </div>
            )}
            {error && (
              <div className="rounded-lg bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="border-t border-gray-100 pt-4">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">All available exports</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPORT_REPORT_TYPES.map((r) => (
                  <Badge
                    key={r.id}
                    className={`text-[10px] cursor-pointer ${
                      selectedReport === r.id
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {r.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
};
