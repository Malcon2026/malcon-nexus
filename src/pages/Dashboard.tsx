import React from 'react';
import { motion } from 'framer-motion';
import {
  FolderOpen, Clock, Stethoscope, Sparkles, Receipt, Wallet,
  CheckCircle2, Calendar, TrendingUp, ArrowUpRight, ArrowRight,
  AlertTriangle, Activity
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { Card, CardHeader, CardBody } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useStore } from '../store/useStore';
import { priorityColors, stageColors, formatCurrency, formatDate, timeAgo } from '../utils/helpers';

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.07 } },
};

interface KPICardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  trend?: string;
  trendUp?: boolean;
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({ label, value, icon, iconBg, subtitle }) => (
  <motion.div variants={fadeUp} className="h-full">
    <div className="bg-white rounded-2xl border border-gray-100 p-4 h-full flex flex-col gap-3 hover:shadow-md hover:border-gray-200/80 transition-all duration-200 cursor-default group">
      <div className="flex items-center gap-2.5">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${iconBg} transition-transform duration-200 group-hover:scale-110`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 leading-tight">{label}</span>
      </div>
      <div className="flex-1 flex flex-col justify-end">
        <span className="text-2xl font-bold text-gray-900 tracking-tight">{value}</span>
        {subtitle && <span className="text-[11px] text-gray-400 mt-0.5">{subtitle}</span>}
      </div>
    </div>
  </motion.div>
);

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
      <div className="bg-white border border-gray-100 rounded-xl shadow-lg p-3">
        <p className="text-xs font-semibold text-gray-700 mb-1">{label}</p>
        {payload.map((p) => (
          <div key={p.name} className="flex items-center gap-2 text-xs">
            <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-gray-500">{p.name}:</span>
            <span className="font-semibold text-gray-800">
              {p.name === 'revenue' ? formatCurrency(p.value) : p.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const Dashboard: React.FC = () => {
  const { cases, employees, hospitals, activityLog, setActiveTab, setSelectedCase, getMonthlyData, getDepartmentPerformance, getStageDistribution } = useStore();

  const monthlyData = getMonthlyData();
  const departmentPerformance = getDepartmentPerformance();
  const stageDistribution = getStageDistribution();

  const activeCases = cases.filter(c => c.status === 'Active' || c.status === 'Waiting For Approval');
  const pendingApprovals = cases.filter(c => c.status === 'Waiting For Approval');
  const surgeryCases = cases.filter(c => c.currentStage === 'Surgery');
  const cleaningQueue = cases.filter(c => c.currentStage === 'Cleaning');
  const billingPending = cases.filter(c => c.currentStage === 'Billing');
  const billSubmissionPending = cases.filter(c => c.currentStage === 'Bill Submission');
  const completedCases = cases.filter(c => c.status === 'Completed');
  const todayAssignments = cases.filter(c => c.currentDepartment !== null && c.status === 'Active');

  const allLogs = activityLog.slice(0, 8);

  const upcomingCases = cases
    .filter(c => c.status !== 'Completed' && c.status !== 'Cancelled')
    .sort((a, b) => new Date(a.surgeryDate).getTime() - new Date(b.surgeryDate).getTime())
    .slice(0, 4);

  const totalRevenue = cases.filter(c => c.invoiceAmount).reduce((sum, c) => sum + (c.invoiceAmount || 0), 0);

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1600px] mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Overview</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
          </p>
        </div>
        <Button
          variant="primary"
          size="sm"
          icon={<FolderOpen className="h-4 w-4" />}
          onClick={() => setActiveTab('cases')}
          className="w-full sm:w-auto"
        >
          View All Cases
        </Button>
      </div>

      {/* KPI Grid */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 items-stretch"
      >
        <KPICard label="Active Cases" value={activeCases.length} icon={<FolderOpen className="h-4 w-4 text-indigo-600" />} iconBg="bg-indigo-50" subtitle={`${cases.length} total`} />
        <KPICard label="Pending Approvals" value={pendingApprovals.length} icon={<Clock className="h-4 w-4 text-amber-600" />} iconBg="bg-amber-50" subtitle="Awaiting review" />
        <KPICard label="In Surgery" value={surgeryCases.length} icon={<Stethoscope className="h-4 w-4 text-blue-600" />} iconBg="bg-blue-50" subtitle="Active surgeries" />
        <KPICard label="Cleaning Queue" value={cleaningQueue.length} icon={<Sparkles className="h-4 w-4 text-cyan-600" />} iconBg="bg-cyan-50" subtitle="Pending sterilize" />
        <KPICard label="Billing Pending" value={billingPending.length} icon={<Receipt className="h-4 w-4 text-emerald-600" />} iconBg="bg-emerald-50" subtitle="Invoice generation" />
        <KPICard label="Bill Submission" value={billSubmissionPending.length} icon={<Wallet className="h-4 w-4 text-orange-600" />} iconBg="bg-orange-50" subtitle="Pending bill submission" />
        <KPICard label="Completed" value={completedCases.length} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} iconBg="bg-green-50" subtitle={`${employees.filter(e => e.role === 'employee').length} employees`} />
        <KPICard label="Today's Tasks" value={todayAssignments.length} icon={<Calendar className="h-4 w-4 text-purple-600" />} iconBg="bg-purple-50" subtitle="Active assignments" />
      </motion.div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Monthly Cases Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Monthly Performance</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Cases and revenue over the last 6 months</p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-gray-900" /><span>Cases</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500" /><span>Completed</span></div>
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#111827" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#111827" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="cases" name="Cases" stroke="#111827" strokeWidth={2} fill="url(#colorCases)" dot={false} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" strokeWidth={2} fill="url(#colorCompleted)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </motion.div>

        {/* Stage Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <Card>
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-900">Cases by Stage</h3>
              <p className="text-xs text-gray-500 mt-0.5">Current distribution</p>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={stageDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2} dataKey="count">
                    {stageDistribution.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Cases']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {stageDistribution.map((item) => (
                  <div key={item.stage} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                      <span className="text-xs text-gray-600">{item.stage}</span>
                    </div>
                    <span className="text-xs font-semibold text-gray-900">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Department Performance & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Department Performance Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Department Performance</h3>
                  <p className="text-xs text-gray-500 mt-0.5">On-time completion rate by department</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  Avg 93.3%
                </div>
              </div>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={departmentPerformance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                  <XAxis dataKey="department" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} domain={[80, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="onTime" name="On Time %" fill="#111827" radius={[4, 4, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </motion.div>

        {/* Revenue Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <Card className="h-full">
            <CardHeader>
              <h3 className="text-sm font-semibold text-gray-900">Revenue Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">Billing & collection status</p>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="text-3xl font-bold text-gray-900">{formatCurrency(totalRevenue)}</div>
              <div className="text-xs text-gray-500">Total pipeline value</div>
              {[
                { label: 'Collected', value: cases.filter(c => c.paymentStatus === 'Collected').reduce((s, c) => s + (c.collectedAmount || c.invoiceAmount || 0), 0), color: 'bg-emerald-500' },
                { label: 'Pending Billing', value: cases.filter(c => c.currentStage === 'Billing' || c.currentStage === 'Bill Submission').reduce((s, c) => s + (c.invoiceAmount || 0), 0), color: 'bg-amber-500' },
                { label: 'In Progress', value: cases.filter(c => !['Billing','Bill Submission','Completed'].includes(c.currentStage)).reduce((s, c) => s + (c.invoiceAmount || 0), 0), color: 'bg-gray-200' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{item.label}</span>
                    <span className="text-xs font-semibold text-gray-900">{formatCurrency(item.value)}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${Math.min(100, (item.value / totalRevenue) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 min-w-0">
        {/* Recent Activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Latest workflow events</p>
                </div>
                <button onClick={() => setActiveTab('activity')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                  View all <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-50">
                {allLogs.map((log) => {
                  return (
                    <div key={log.id} className="flex items-start gap-3 px-6 py-3 hover:bg-gray-50/50 transition-colors">
                      <div className="relative mt-0.5">
                        <Avatar name={log.performedBy} size="sm" />
                        <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-white flex items-center justify-center ${log.performedByRole === 'admin' ? 'bg-gray-900' : 'bg-indigo-500'}`}>
                          <Activity className="h-1.5 w-1.5 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-gray-900">{log.performedBy}</span>
                          <span className="text-xs text-gray-500">{log.action}</span>
                          {log.entityType === 'case' && (
                            <button
                              onClick={() => { setSelectedCase(log.entityId); setActiveTab('cases'); }}
                              className="text-xs text-indigo-600 hover:underline font-medium"
                            >
                              {log.entityLabel}
                            </button>
                          )}
                          {log.entityType !== 'case' && (
                            <span className="text-xs text-gray-500 font-medium">{log.entityLabel}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 truncate">{log.details}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">{timeAgo(log.timestamp)}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>

        {/* Upcoming Surgeries */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Upcoming Surgeries</h3>
                <button onClick={() => setActiveTab('cases')} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                  All <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </CardHeader>
            <CardBody className="p-0">
              <div className="divide-y divide-gray-50">
                {upcomingCases.map((c) => {
                  const sc = stageColors[c.currentStage];
                  const pc = priorityColors[c.priority];
                  return (
                    <div
                      key={c.id}
                      className="px-5 py-3.5 hover:bg-gray-50/50 cursor-pointer transition-colors"
                      onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-xs font-semibold text-gray-900">{c.caseNumber}</p>
                          <p className="text-xs text-gray-500 truncate">{c.hospital.name}</p>
                        </div>
                        <Badge className={`${pc} text-[10px]`}>{c.priority}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge className={`${sc.bg} ${sc.text} ${sc.border} text-[10px]`}>
                          <div className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                          {c.currentStage}
                        </Badge>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {formatDate(c.surgeryDate)}
                        </div>
                      </div>
                      {new Date(c.surgeryDate) < new Date() && c.status !== 'Completed' && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-red-600">
                          <AlertTriangle className="h-3 w-3" />
                          Surgery date passed
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};
