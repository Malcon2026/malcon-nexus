import type { Priority, CaseStatus, WorkflowStage, Department } from '../types';

export const priorityColors: Record<Priority, string> = {
  Critical: 'bg-red-50 text-red-700 border-red-200 ring-red-600/20',
  High: 'bg-orange-50 text-orange-700 border-orange-200 ring-orange-600/20',
  Medium: 'bg-yellow-50 text-yellow-700 border-yellow-200 ring-yellow-600/20',
  Low: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20',
};

export const priorityDot: Record<Priority, string> = {
  Critical: 'bg-red-500',
  High: 'bg-orange-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-blue-500',
};

export const statusColors: Record<CaseStatus, string> = {
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Active: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Waiting For Approval': 'bg-amber-50 text-amber-700 border-amber-200',
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
  'Changes Requested': 'bg-purple-50 text-purple-700 border-purple-200',
  Completed: 'bg-green-50 text-green-700 border-green-200',
  Cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

export const stageColors: Record<WorkflowStage, { bg: string; text: string; border: string; dot: string }> = {
  'Kit Preparation': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'Surgery': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Cleaning': { bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200', dot: 'bg-cyan-500' },
  'Audit': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Billing': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Collection': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Completed': { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', dot: 'bg-green-500' },
};

export const departmentColors: Record<Department, string> = {
  Stores: 'bg-violet-100 text-violet-800',
  'Scrub Person': 'bg-blue-100 text-blue-800',
  'Cleaning Department': 'bg-cyan-100 text-cyan-800',
  'Stores Audit': 'bg-amber-100 text-amber-800',
  Accounts: 'bg-emerald-100 text-emerald-800',
  'Collection Executive': 'bg-orange-100 text-orange-800',
  Admin: 'bg-gray-100 text-gray-800',
};

export const avatarColors = [
  'bg-violet-100 text-violet-700',
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-orange-100 text-orange-700',
  'bg-pink-100 text-pink-700',
  'bg-cyan-100 text-cyan-700',
  'bg-amber-100 text-amber-700',
  'bg-indigo-100 text-indigo-700',
];

export const getAvatarColor = (name: string) => {
  const idx = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[idx];
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (dateStr: string) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const timeAgo = (dateStr: string) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

export const getStageIndex = (stage: WorkflowStage): number => {
  const stages: WorkflowStage[] = [
    'Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Collection', 'Completed'
  ];
  return stages.indexOf(stage);
};

export const isOverdue = (dueDate: string): boolean => {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
};

/** Derive the next IMP-YYYY-NNN case number from existing cases. */
export function nextCaseNumberFromCases(cases: { caseNumber: string }[]): string {
  const year = new Date().getFullYear();
  const prefix = `IMP-${year}-`;
  let max = 0;
  for (const c of cases) {
    if (c.caseNumber.startsWith(prefix)) {
      const num = parseInt(c.caseNumber.slice(prefix.length), 10);
      if (!isNaN(num)) max = Math.max(max, num);
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}
