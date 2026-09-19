import React from 'react';
import { LayoutGrid, FolderOpen, GitBranch } from 'lucide-react';
import { Card, CardBody } from '../components/ui/Card';
import { useStore } from '../store/useStore';

const tiles = [
  { id: 'live-cases', label: 'Live cases', hint: 'Kiosk board', icon: LayoutGrid, color: 'text-violet-600', bg: 'bg-violet-50' },
  { id: 'cases', label: 'All cases', hint: 'Search & open', icon: FolderOpen, color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { id: 'workflow', label: 'Workflow', hint: 'Stages board', icon: GitBranch, color: 'text-emerald-600', bg: 'bg-emerald-50' },
] as const;

export const StoresKioskHome: React.FC = () => {
  const setActiveTab = useStore((s) => s.setActiveTab);
  const activeCases = useStore((s) =>
    s.cases.filter((c) => c.status === 'Active' || c.status === 'Waiting For Approval').length,
  );

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Stores kiosk</h1>
        <p className="text-sm text-gray-500 mt-1">
          Cases only — {activeCases} active on the board. No attendance or petrol here.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {tiles.map(({ id, label, hint, icon: Icon, color, bg }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="text-left rounded-2xl border border-gray-200 bg-white p-4 shadow-sm hover:border-indigo-200 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className={`h-11 w-11 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`h-6 w-6 ${color}`} />
            </div>
            <p className="text-sm font-bold text-gray-900">{label}</p>
            <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
          </button>
        ))}
      </div>
      <Card>
        <CardBody className="text-sm text-gray-600">
          Use <strong>Live cases</strong> on a tablet at the stores desk. Assign kit prep and restock from the case
          detail when you are the assigned stores contact.
        </CardBody>
      </Card>
    </div>
  );
};
