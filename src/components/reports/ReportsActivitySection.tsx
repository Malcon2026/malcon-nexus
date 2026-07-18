import React, { useMemo, useState } from 'react';
import { Download, Search } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { formatDateTime } from '../../utils/helpers';
import { exportActivityCsv } from '../../utils/reportsExport';

export const ReportsActivitySection: React.FC = () => {
  const activityLog = useStore((s) => s.activityLog);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const entityTypes = useMemo(
    () => [...new Set(activityLog.map((e) => e.entityType))].sort(),
    [activityLog],
  );

  const filtered = useMemo(
    () =>
      activityLog.filter((log) => {
        if (filterType !== 'all' && log.entityType !== filterType) return false;
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          log.action.toLowerCase().includes(q) ||
          log.performedBy.toLowerCase().includes(q) ||
          log.entityLabel.toLowerCase().includes(q) ||
          log.details.toLowerCase().includes(q)
        );
      }),
    [activityLog, filterType, search],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[12rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search activity…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 bg-gray-50"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="all">All types</option>
          {entityTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => exportActivityCsv(filtered)}>
          Export CSV
        </Button>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Time', 'Action', 'Type', 'Entity', 'By', 'Details'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.slice(0, 100).map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-3"><Badge className="text-[10px] bg-gray-100 text-gray-700 border-gray-200">{log.action}</Badge></td>
                  <td className="px-4 py-3 text-gray-600">{log.entityType}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{log.entityLabel}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Avatar name={log.performedBy} size="sm" />
                      <span className="text-gray-700">{log.performedBy}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-400">No activity found</p>
          )}
          {filtered.length > 100 && (
            <p className="text-center py-3 text-xs text-gray-400 border-t border-gray-50">
              Showing 100 of {filtered.length} events — export CSV for full list
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
