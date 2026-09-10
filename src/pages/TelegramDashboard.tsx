import React, { useMemo, useState } from 'react';
import { MessageCircle, Search, Send, Users, UserCheck, UserX } from 'lucide-react';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { useStore } from '../store/useStore';
import { sendTelegramBroadcast } from '../lib/telegramBroadcast';
import { filterAttendanceStaff } from '../lib/staff';

export const TelegramDashboard: React.FC = () => {
  const { employees, viewMode } = useStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'connected' | 'not-connected'>('all');
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  if (viewMode !== 'admin') {
    return (
      <div className="p-6 text-sm text-gray-500">Admin access required.</div>
    );
  }

  const staff = useMemo(() => filterAttendanceStaff(employees), [employees]);

  const connected = staff.filter((e) => e.telegramChatId?.trim());
  const notConnected = staff.filter((e) => !e.telegramChatId?.trim());

  const filtered = useMemo(() => {
    let list = staff;
    if (filter === 'connected') list = connected;
    if (filter === 'not-connected') list = notConnected;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.employeeCode?.toLowerCase().includes(q) ||
        e.department.toLowerCase().includes(q),
    );
  }, [staff, connected, notConnected, filter, search]);

  const toggleSelect = (id: string, canSelect: boolean) => {
    if (!canSelect) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllConnected = () => {
    setSelected(new Set(connected.map((e) => e.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const runBroadcast = async (target: 'all' | 'selected') => {
    const text = message.trim();
    if (!text) {
      setResult('Enter a message first.');
      return;
    }
    if (target === 'selected' && selected.size === 0) {
      setResult('Select at least one connected employee.');
      return;
    }

    setBusy(true);
    setResult(null);
    const res = await sendTelegramBroadcast(
      text,
      target,
      target === 'selected' ? [...selected] : undefined,
    );
    setBusy(false);

    if (!res.ok) {
      setResult(res.error);
      return;
    }
    const failNote =
      res.failed > 0 && res.failures?.length
        ? ` Failed: ${res.failures.map((f) => f.name).join(', ')}.`
        : '';
    setResult(`Sent to ${res.sent} employee(s).${res.failed ? ` ${res.failed} failed.` : ''}${failNote}`);
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1100px] mx-auto w-full min-w-0">
      <div className="mb-6">
        <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
          <MessageCircle className="h-5 w-5" />
          Telegram Dashboard
        </h1>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardBody className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{connected.length}</p>
              <p className="text-xs text-gray-500">Connected</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <UserX className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{notConnected.length}</p>
              <p className="text-xs text-gray-500">Not connected</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-3 py-4">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-indigo-700" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{staff.length}</p>
              <p className="text-xs text-gray-500">Active staff</p>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h3 className="text-sm font-semibold text-gray-900">Send message</h3>
        </CardHeader>
        <CardBody className="space-y-4">
          <textarea
            className="w-full min-h-[120px] px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y"
            placeholder="Type your message to employees on Telegram…"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
          />
          <p className="text-xs text-gray-500">{message.length} / 4000 characters</p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              disabled={busy || connected.length === 0}
              onClick={() => runBroadcast('all')}
            >
              {busy ? 'Sending…' : `Send to all connected (${connected.length})`}
            </Button>
            <Button
              variant="outline"
              size="sm"
              icon={<Send className="h-4 w-4" />}
              disabled={busy || selected.size === 0}
              onClick={() => runBroadcast('selected')}
            >
              Send to selected ({selected.size})
            </Button>
          </div>
          {result && (
            <p className={`text-sm ${result.startsWith('Sent') ? 'text-green-700' : 'text-red-600'}`}>
              {result}
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-900">Employees</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`px-2.5 py-1 text-xs rounded-full ${filter === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilter('connected')}
                className={`px-2.5 py-1 text-xs rounded-full ${filter === 'connected' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Connected
              </button>
              <button
                type="button"
                onClick={() => setFilter('not-connected')}
                className={`px-2.5 py-1 text-xs rounded-full ${filter === 'not-connected' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                Not connected
              </button>
              <button type="button" onClick={selectAllConnected} className="px-2.5 py-1 text-xs rounded-full bg-indigo-50 text-indigo-700">
                Select all connected
              </button>
              <button type="button" onClick={clearSelection} className="px-2.5 py-1 text-xs rounded-full bg-gray-50 text-gray-600">
                Clear
              </button>
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search name, code, department…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-3 w-10" />
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Telegram</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => {
                  const isConnected = Boolean(emp.telegramChatId?.trim());
                  return (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(emp.id)}
                          disabled={!isConnected}
                          onChange={() => toggleSelect(emp.id, isConnected)}
                          className="rounded border-gray-300"
                          aria-label={`Select ${emp.name}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{emp.name}</td>
                      <td className="px-4 py-3 text-gray-600 font-mono text-xs">{emp.employeeCode || '—'}</td>
                      <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                      <td className="px-4 py-3">
                        {isConnected ? (
                          <Badge className="bg-green-50 text-green-800 border-green-200">Connected</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200">Not connected</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-gray-500">No employees match your filters.</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
