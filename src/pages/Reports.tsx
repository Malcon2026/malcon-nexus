import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts';
import { Download, ArrowUpRight, ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { formatCurrency } from '../utils/helpers';
import { CaseCsvExportModal } from '../components/CaseCsvExportModal';
import { ReportsOverviewSection } from '../components/reports/ReportsOverviewSection';
import { ReportsAttendanceSection } from '../components/reports/ReportsAttendanceSection';
import { ReportsApprovalsSection } from '../components/reports/ReportsApprovalsSection';
import { ReportsActivitySection } from '../components/reports/ReportsActivitySection';
import { ReportsHospitalsSection } from '../components/reports/ReportsHospitalsSection';
import { REPORT_SECTIONS, type ReportSection } from '../components/reports/types';
import { buildEmployeeAttendanceReport, getISTDateKey } from '../lib/attendance';
import { exportBillingCsv, exportEmployeesCsv } from '../utils/reportsExport';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#22c55e'];

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-800">
              {p.name === 'Revenue' ? formatCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export type { ReportSection };

export const Reports: React.FC = () => {
  const {
    viewMode,
    cases,
    employees,
    hospitals,
    activityLog,
    attendanceRecords,
    attendanceApprovalRequests,
    getMonthlyData,
    getDepartmentPerformance,
  } = useStore();

  const [activeSection, setActiveSection] = useState<ReportSection>('overview');
  const [showExport, setShowExport] = useState(false);

  const monthlyData = getMonthlyData();
  const departmentPerformance = getDepartmentPerformance();
  const todayKey = getISTDateKey();
  const todayAttendance = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, todayKey),
    [employees, attendanceRecords, todayKey],
  );

  const overviewStats = useMemo(() => {
    const staff = employees.filter((e) => e.role === 'employee' && e.status === 'Active');
    const totalRevenue = cases.reduce((s, c) => s + (c.invoiceAmount || 0), 0);
    const collectedRevenue = cases
      .filter((c) => c.paymentStatus === 'Collected')
      .reduce((s, c) => s + (c.collectedAmount || c.invoiceAmount || 0), 0);

    return {
      totalCases: cases.length,
      activeCases: cases.filter((c) => c.status === 'Active').length,
      completedCases: cases.filter((c) => c.status === 'Completed').length,
      pendingApprovals: cases.filter((c) => c.status === 'Waiting For Approval').length,
      totalEmployees: staff.length,
      punchedInToday: todayAttendance.filter((r) => r.status === 'in').length,
      absentToday: todayAttendance.filter((r) => r.status === 'absent').length,
      pendingOffsiteApprovals: attendanceApprovalRequests.filter((r) => r.status === 'pending').length,
      totalRevenue,
      collectedRevenue,
      hospitalCount: hospitals.length,
      activityCount: activityLog.length,
    };
  }, [cases, employees, hospitals, activityLog, attendanceApprovalRequests, todayAttendance]);

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">
            Reports are only available to administrators. Contact your admin if you need access.
          </p>
        </Card>
      </div>
    );
  }

  const totalRevenue = cases.reduce((s, c) => s + (c.invoiceAmount || 0), 0);
  const collectedRevenue = cases.filter(c => c.paymentStatus === 'Collected').reduce((s, c) => s + (c.collectedAmount || c.invoiceAmount || 0), 0);
  const pendingRevenue = totalRevenue - collectedRevenue;

  const byStage = [
    { name: 'Kit Preparation', value: cases.filter(c => c.currentStage === 'Kit Preparation').length },
    { name: 'Delivery', value: cases.filter(c => c.currentStage === 'Delivery').length },
    { name: 'Surgery', value: cases.filter(c => c.currentStage === 'Surgery').length },
    { name: 'Cleaning', value: cases.filter(c => c.currentStage === 'Cleaning').length },
    { name: 'Audit', value: cases.filter(c => c.currentStage === 'Audit').length },
    { name: 'Billing', value: cases.filter(c => c.currentStage === 'Billing').length },
    { name: 'Bill Submission', value: cases.filter(c => c.currentStage === 'Bill Submission').length },
    { name: 'Completed', value: cases.filter(c => c.currentStage === 'Completed').length },
  ];

  const billingData = [
    { name: 'Pending', value: cases.filter(c => c.paymentStatus === 'Pending').length, color: '#f59e0b' },
    { name: 'Partial', value: cases.filter(c => c.paymentStatus === 'Partial').length, color: '#6366f1' },
    { name: 'Collected', value: cases.filter(c => c.paymentStatus === 'Collected').length, color: '#10b981' },
  ];

  const revenueMonthly = monthlyData.map(m => ({ ...m, Revenue: m.revenue }));

  const sectionExport = () => {
    if (activeSection === 'cases') setShowExport(true);
    else if (activeSection === 'employees') exportEmployeesCsv(employees.filter((e) => e.role === 'employee'));
    else if (activeSection === 'billing') exportBillingCsv(cases);
  };

  const showExportButton = ['cases', 'employees', 'billing'].includes(activeSection);

  return (
    <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
      <CaseCsvExportModal
        isOpen={showExport}
        onClose={() => setShowExport(false)}
        cases={cases}
        title="Export Cases CSV"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Admin-only hub for cases, attendance, employees, billing, approvals, activity, and hospitals
          </p>
        </div>
        {showExportButton && (
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={sectionExport}>
            Export {activeSection === 'cases' ? 'Cases' : activeSection === 'employees' ? 'Employees' : 'Billing'} CSV
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-gray-100 mb-6 overflow-x-auto -mx-1 px-1 pb-px">
        {REPORT_SECTIONS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveSection(tab.id)}
            className={`px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0 ${
              activeSection === tab.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSection === 'overview' && (
        <ReportsOverviewSection stats={overviewStats} onNavigate={setActiveSection} />
      )}

      {activeSection === 'attendance' && <ReportsAttendanceSection />}
      {activeSection === 'approvals' && <ReportsApprovalsSection />}
      {activeSection === 'activity' && <ReportsActivitySection />}
      {activeSection === 'hospitals' && <ReportsHospitalsSection />}

      {activeSection === 'cases' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            {[
              { label: 'Total Cases', value: cases.length, sub: 'All time', color: 'bg-indigo-50', textColor: 'text-indigo-600' },
              { label: 'Completed', value: cases.filter(c => c.status === 'Completed').length, sub: 'Successfully closed', color: 'bg-emerald-50', textColor: 'text-emerald-600' },
              { label: 'Active Cases', value: cases.filter(c => c.status === 'Active').length, sub: 'In progress', color: 'bg-amber-50', textColor: 'text-amber-600' },
              { label: 'Pending Approval', value: cases.filter(c => c.status === 'Waiting For Approval').length, sub: 'Awaiting review', color: 'bg-red-50', textColor: 'text-red-600' },
            ].map(({ label, value, sub, color, textColor }) => (
              <Card key={label} className="p-5">
                <div className={`h-2 w-8 rounded-full ${color.replace('50', '400')} mb-3`} />
                <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
                <p className="text-sm font-medium text-gray-900 mt-1">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Monthly Cases Trend</h3></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line type="monotone" dataKey="cases" name="Cases" stroke="#111827" strokeWidth={2.5} dot={{ fill: '#111827', r: 4 }} />
                    <Line type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2.5} dot={{ fill: '#10b981', r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Cases by Stage</h3></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byStage}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Cases" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {byStage.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Department On-Time Rate</h3></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={departmentPerformance} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} domain={[75, 100]} />
                    <YAxis dataKey="department" type="category" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="onTime" name="On Time %" fill="#111827" radius={[0, 4, 4, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Cases Handled per Department</h3></CardHeader>
              <CardBody>
                <div className="space-y-4">
                  {departmentPerformance.map((dept, idx) => (
                    <div key={dept.department}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700">{dept.department}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-500">Avg {dept.avgTime}d</span>
                          <span className="text-sm font-bold text-gray-900">{dept.casesHandled}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, (dept.casesHandled / 45) * 100)}%`, background: COLORS[idx % COLORS.length] }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {activeSection === 'billing' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Total Pipeline', value: totalRevenue, color: 'text-gray-900' },
              { label: 'Collected', value: collectedRevenue, color: 'text-emerald-600' },
              { label: 'Pending', value: pendingRevenue, color: 'text-amber-600' },
            ].map(({ label, value, color }) => (
              <Card key={label} className="p-5">
                <p className="text-xs text-gray-500">{label}</p>
                <p className={`text-2xl font-bold ${color} mt-1`}>{formatCurrency(value)}</p>
                <div className="flex items-center gap-1 text-xs text-emerald-600 mt-1">
                  <ArrowUpRight className="h-3 w-3" />
                  <span>Revenue tracking</span>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Monthly Revenue</h3></CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={revenueMonthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/100000).toFixed(1)}L`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="Revenue" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>

            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Payment Status Distribution</h3></CardHeader>
              <CardBody>
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={billingData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={3}>
                        {billingData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {billingData.map(item => (
                      <div key={item.name}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <div className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                            <span className="text-sm text-gray-600">{item.name}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-900">{item.value}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full">
                          <div className="h-full rounded-full" style={{ width: `${cases.length ? (item.value / cases.length) * 100 : 0}%`, background: item.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-900">Case-wise Billing</h3></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Case ID', 'Hospital', 'Invoice Amount', 'Collected', 'Payment Status', 'Stage'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cases.filter(c => c.invoiceAmount).map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 text-sm font-semibold text-indigo-600">{c.caseNumber}</td>
                      <td className="px-5 py-3 text-sm text-gray-700">{c.hospital.name}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-gray-900">{formatCurrency(c.invoiceAmount || 0)}</td>
                      <td className="px-5 py-3 text-sm text-gray-700">{formatCurrency(c.collectedAmount || 0)}</td>
                      <td className="px-5 py-3">
                        <Badge className={`text-xs ${c.paymentStatus === 'Collected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : c.paymentStatus === 'Partial' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                          {c.paymentStatus || 'Pending'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600">{c.currentStage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSection === 'employees' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="p-4">
              <p className="text-2xl font-bold text-gray-900">{employees.filter(e => e.role === 'employee').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Staff</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-emerald-600">{employees.filter(e => e.role === 'employee' && e.status === 'Active').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Active</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-indigo-600">{employees.filter(e => e.role === 'admin').length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Admins</p>
            </Card>
            <Card className="p-4">
              <p className="text-2xl font-bold text-amber-600">{employees.filter(e => e.role === 'employee' && e.casesActive > 0).length}</p>
              <p className="text-xs text-gray-500 mt-0.5">With Active Cases</p>
            </Card>
          </div>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-gray-900">Employee Performance Leaderboard</h3></CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Rank', 'Employee', 'Department', 'Cases Completed', 'Active Cases', 'Performance'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[...employees]
                    .filter(e => e.role === 'employee')
                    .sort((a, b) => b.casesCompleted - a.casesCompleted)
                    .map((emp, idx) => (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <span className={`text-sm font-bold ${idx === 0 ? 'text-amber-500' : idx === 1 ? 'text-gray-400' : idx === 2 ? 'text-orange-600' : 'text-gray-500'}`}>
                            #{idx + 1}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={emp.name} size="sm" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">{emp.name}</p>
                              <p className="text-xs text-gray-400">{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge className="text-xs bg-gray-100 text-gray-700 border-gray-200">{emp.department}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm font-bold text-gray-900">{emp.casesCompleted}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="text-sm text-gray-700">{emp.casesActive}</span>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-24 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${Math.min(100, (emp.casesCompleted / 320) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-600">{Math.round((emp.casesCompleted / 320) * 100)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
