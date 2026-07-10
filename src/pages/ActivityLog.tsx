import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Filter } from 'lucide-react';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { departmentColors, formatDateTime } from '../utils/helpers';
import type { Department } from '../types';

export const ActivityLog: React.FC = () => {
  const { activityLog, setSelectedCase, setActiveTab } = useStore();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'employee'>('all');
  const [filterType, setFilterType] = useState<string>('all');

  const filteredLogs = activityLog
    .filter(log => {
      if (filterRole !== 'all' && log.performedByRole !== filterRole) return false;
      if (filterType !== 'all' && log.entityType !== filterType) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.performedBy.toLowerCase().includes(q) ||
          log.entityLabel.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        );
      }
      return true;
    });

  const actionColors: Record<string, string> = {
    'Created': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Added': 'bg-indigo-50 text-indigo-700 border-indigo-200',
    'Assigned': 'bg-blue-50 text-blue-700 border-blue-200',
    'Submitted': 'bg-amber-50 text-amber-700 border-amber-200',
    'Approved': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'Rejected': 'bg-red-50 text-red-700 border-red-200',
    'Completed': 'bg-green-50 text-green-700 border-green-200',
    'Closed': 'bg-gray-100 text-gray-600 border-gray-200',
    'Deleted': 'bg-red-50 text-red-700 border-red-200',
    'Updated': 'bg-blue-50 text-blue-700 border-blue-200',
    'Removed': 'bg-red-50 text-red-700 border-red-200',
    'Changes': 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const getActionColor = (action: string) => {
    for (const [key, val] of Object.entries(actionColors)) {
      if (action.toLowerCase().includes(key.toLowerCase())) return val;
    }
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const entityTypeLabels: Record<string, string> = {
    case: 'Cases',
    employee: 'Employees',
    hospital: 'Hospitals',
    department: 'Departments',
    kit: 'Kits',
    system: 'System',
  };

  return (
    <div className="p-6 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-0.5">{filteredLogs.length} events recorded</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activities..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {(['all', 'admin', 'employee'] as const).map(role => (
            <button
              key={role}
              onClick={() => setFilterRole(role)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${filterRole === role ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {role === 'all' ? 'All Roles' : role === 'admin' ? 'Admin' : 'Employees'}
            </button>
          ))}
        </div>
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            All Types
          </button>
          {Object.entries(entityTypeLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilterType(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterType === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-[52px] top-4 bottom-4 w-px bg-gray-100" />
        <div className="space-y-1">
          {filteredLogs.map((log, idx) => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.5) }}
              className="flex items-start gap-4 group"
            >
              {/* Avatar with line */}
              <div className="relative z-10 mt-3">
                <Avatar name={log.performedBy} size="sm" />
              </div>

              {/* Content */}
              <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all p-4 group-hover:border-gray-200">
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-gray-900">{log.performedBy}</span>
                    <Badge className={`text-xs ${log.performedByRole === 'admin' ? 'bg-gray-900 text-white border-gray-900' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}`}>
                      {log.performedByRole}
                    </Badge>
                  </div>
                  <span className="text-xs text-gray-400">{formatDateTime(log.timestamp)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <Badge className={`text-xs ${getActionColor(log.action)}`}>{log.action}</Badge>
                  {log.entityType === 'case' && (
                    <button
                      onClick={() => { setSelectedCase(log.entityId); setActiveTab('cases'); }}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {log.entityLabel}
                    </button>
                  )}
                  {log.entityType !== 'case' && (
                    <span className="text-xs font-medium text-gray-600">{log.entityLabel}</span>
                  )}
                  <Badge className="text-[10px] bg-gray-50 text-gray-500 border-gray-200">
                    {log.entityType}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mt-1.5">{log.details}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {filteredLogs.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <Filter className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No activity found</p>
            <p className="text-xs mt-1">
              {activityLog.length === 0 ? 'Activity will appear here as you use the system' : 'Try adjusting your filters'}
            </p>
          </div>
        )}
      </div>
    </div>      
  );
};
