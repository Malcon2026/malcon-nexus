import React, { useMemo } from 'react';
import { Download } from 'lucide-react';
import { Card, CardBody } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useStore } from '../../store/useStore';
import { exportHospitalsCsv } from '../../utils/reportsExport';

export const ReportsHospitalsSection: React.FC = () => {
  const hospitals = useStore((s) => s.hospitals);
  const cases = useStore((s) => s.cases);

  const rows = useMemo(
    () =>
      hospitals
        .map((h) => {
          const hospitalCases = cases.filter((c) => c.hospital.id === h.id);
          return {
            ...h,
            totalCases: hospitalCases.length,
            activeCases: hospitalCases.filter((c) => c.status !== 'Completed' && c.status !== 'Cancelled').length,
            completedCases: hospitalCases.filter((c) => c.status === 'Completed').length,
          };
        })
        .sort((a, b) => b.totalCases - a.totalCases),
    [hospitals, cases],
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={() => exportHospitalsCsv(hospitals, cases)}>
          Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-2xl font-bold text-gray-900">{hospitals.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Hospitals</p>
        </Card>
        <Card className="p-4">
          <p className="text-2xl font-bold text-emerald-600">{hospitals.filter((h) => h.status === 'Active').length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Active</p>
        </Card>
        <Card className="p-4 col-span-2 sm:col-span-1">
          <p className="text-2xl font-bold text-indigo-600">{cases.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">Total Cases Linked</p>
        </Card>
      </div>

      <Card>
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/80">
                {['Hospital', 'City', 'Contact', 'Status', 'Total Cases', 'Active', 'Completed'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/60">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{row.name}</p>
                    <p className="text-xs text-gray-400">{row.branch}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{row.city}</td>
                  <td className="px-4 py-3 text-gray-700">{row.contactPerson}</td>
                  <td className="px-4 py-3">
                    <Badge className={`text-[10px] ${row.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                      {row.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold">{row.totalCases}</td>
                  <td className="px-4 py-3 text-amber-600 font-medium">{row.activeCases}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{row.completedCases}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="text-center py-12 text-sm text-gray-400">No hospitals found</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
};
