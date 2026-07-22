import React, { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from 'recharts';
import { ShieldAlert } from 'lucide-react';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import { AnalyticsOverviewSection } from '../components/analytics/AnalyticsOverviewSection';
import { ANALYTICS_SECTIONS, type AnalyticsSection } from '../components/analytics/types';
import { buildEmployeeAttendanceReport, getISTDateKey } from '../lib/attendance';

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#f97316', '#22c55e'];

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3 text-xs">
        <p className="font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-800">{p.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const AdminGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const viewMode = useStore((s) => s.viewMode);
  if (viewMode !== 'admin') {
    return (
      <div className="p-6 max-w-lg mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldAlert className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-900">Admin Access Required</h1>
          <p className="text-sm text-gray-500 mt-2">Analytics are only available to administrators.</p>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
};

export const Analytics: React.FC = () => {
  const {
    cases,
    employees,
    attendanceRecords,
    getMonthlyData,
    getDepartmentPerformance,
  } = useStore();

  const [activeSection, setActiveSection] = useState<AnalyticsSection>('overview');
  const monthlyData = getMonthlyData();
  const departmentPerformance = getDepartmentPerformance();
  const todayAttendance = useMemo(
    () => buildEmployeeAttendanceReport(employees, attendanceRecords, getISTDateKey()),
    [employees, attendanceRecords],
  );

  const overviewStats = useMemo(() => {
    const staff = employees.filter((e) => e.role === 'employee' && e.status === 'Active');

    return {
      totalCases: cases.length,
      activeCases: cases.filter((c) => c.status === 'Active').length,
      completedCases: cases.filter((c) => c.status === 'Completed').length,
      pendingApprovals: cases.filter((c) => c.status === 'Waiting For Approval').length,
      totalEmployees: staff.length,
      punchedInToday: todayAttendance.filter((r) => r.status === 'in').length,
    };
  }, [cases, employees, todayAttendance]);

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

  return (
    <AdminGate>
      <div className="p-4 sm:p-6 max-w-[1400px] mx-auto w-full min-w-0">
        <div className="mb-6">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">Charts and performance insights across the business</p>
        </div>

        <div className="flex items-center gap-1 border-b border-gray-100 mb-6 overflow-x-auto -mx-1 px-1 pb-px">
          {ANALYTICS_SECTIONS.map((tab) => (
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
          <AnalyticsOverviewSection stats={overviewStats} onNavigate={setActiveSection} />
        )}

        {activeSection === 'cases' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Total Cases', value: cases.length, sub: 'All time', textColor: 'text-indigo-600' },
                { label: 'Completed', value: cases.filter(c => c.status === 'Completed').length, sub: 'Closed', textColor: 'text-emerald-600' },
                { label: 'Active', value: cases.filter(c => c.status === 'Active').length, sub: 'In progress', textColor: 'text-amber-600' },
                { label: 'Pending Approval', value: cases.filter(c => c.status === 'Waiting For Approval').length, sub: 'Awaiting review', textColor: 'text-red-600' },
              ].map(({ label, value, sub, textColor }) => (
                <Card key={label} className="p-5">
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
                          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (dept.casesHandled / 45) * 100)}%`, background: COLORS[idx % COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardBody>
              </Card>
            </div>
          </div>
        )}

        {activeSection === 'employees' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="p-4"><p className="text-2xl font-bold">{employees.filter(e => e.role === 'employee').length}</p><p className="text-xs text-gray-500 mt-0.5">Total Staff</p></Card>
              <Card className="p-4"><p className="text-2xl font-bold text-emerald-600">{employees.filter(e => e.role === 'employee' && e.status === 'Active').length}</p><p className="text-xs text-gray-500 mt-0.5">Active</p></Card>
              <Card className="p-4"><p className="text-2xl font-bold text-indigo-600">{employees.filter(e => e.role === 'admin').length}</p><p className="text-xs text-gray-500 mt-0.5">Admins</p></Card>
              <Card className="p-4"><p className="text-2xl font-bold text-amber-600">{employees.filter(e => e.role === 'employee' && e.casesActive > 0).length}</p><p className="text-xs text-gray-500 mt-0.5">With Active Cases</p></Card>
            </div>

            <Card>
              <CardHeader><h3 className="text-sm font-semibold text-gray-900">Performance Leaderboard</h3></CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['Rank', 'Employee', 'Department', 'Completed', 'Active'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[...employees].filter(e => e.role === 'employee').sort((a, b) => b.casesCompleted - a.casesCompleted).map((emp, idx) => (
                      <tr key={emp.id}>
                        <td className="px-5 py-3 text-sm font-bold text-gray-500">#{idx + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <Avatar name={emp.name} size="sm" />
                            <span className="text-sm font-semibold">{emp.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3"><Badge className="text-xs">{emp.department}</Badge></td>
                        <td className="px-5 py-3 font-bold">{emp.casesCompleted}</td>
                        <td className="px-5 py-3">{emp.casesActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </AdminGate>
  );
};
