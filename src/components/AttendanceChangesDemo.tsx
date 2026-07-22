import React from 'react';
import { Clock, LogIn, LogOut, MapPin, Sparkles } from 'lucide-react';
import { Card, CardBody } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { REGISTER_CELL_STYLES, PAYABLE_DAYS_PER_CYCLE, type RegisterCellCode } from '../lib/attendanceRegister';

const DEMO_CODES: RegisterCellCode[] = ['P', 'PI', 'L', 'PL', 'A', 'WO'];

function DemoCell({ code }: { code: RegisterCellCode }) {
  const style = REGISTER_CELL_STYLES[code];
  const label = code === 'PI' ? 'P●' : code;
  return (
    <span
      className={`inline-flex h-7 w-7 items-center justify-center rounded font-bold text-[10px] border border-gray-400/60 ${style.bg} ${style.text}`}
      title={style.title}
    >
      {label}
    </span>
  );
}

const CHANGES = [
  {
    title: 'Punch out after midnight',
    detail: 'Open shifts stay active past 12:00 AM. Punch Out works the next day and closes yesterday’s shift.',
  },
  {
    title: 'English + Telugu reminder',
    detail: 'If someone forgot to punch out, a short bilingual banner shows on the attendance screen.',
  },
  {
    title: 'Register cell borders',
    detail: 'P / L / A / WO cells have a light grey border so the grid is easier to read.',
  },
  {
    title: 'Weekly offs count as paid',
    detail: `Pay days = Present + Leave + Sunday off (WO), capped at ${PAYABLE_DAYS_PER_CYCLE}.`,
  },
  {
    title: 'Salary cycle',
    detail: 'May salary: 27th → 27th. June onward: 28th prev month → 27th salary month.',
  },
];

export const AttendanceChangesDemo: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Attendance updates demo</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Preview of recent changes for staff and admins. This screen uses sample UI only — not live data.
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-white">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-indigo-100 text-xs font-medium uppercase tracking-wide">Sample — Employee view</p>
              <p className="text-2xl font-bold tabular-nums mt-0.5">01:15:42 AM</p>
              <p className="text-indigo-100 text-xs mt-1">Wednesday, 22 July 2026</p>
            </div>
            <Badge className="bg-emerald-500/20 text-emerald-100 border-emerald-400/30 self-start">
              ● Punched In
            </Badge>
          </div>
        </div>
        <CardBody className="p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Punch In</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">09:02:18 PM</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Tuesday (previous day)</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Punch Out</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">—</p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
              <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Hours</p>
              <p className="text-lg font-bold text-gray-900 tabular-nums mt-1">4h 13m</p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <Clock className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium text-amber-900">
                You forgot to punch out yesterday. Use Punch Out now.
              </p>
              <p className="text-amber-800">
                మీరు నిన్న punch out చేయడం మర్చిపోయారు. ఇప్పుడు Punch Out ఉపయోగించండి.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
            <MapPin className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
            <span>At office: punch directly · Off-site: reason + admin approval</span>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" size="md" className="flex-1" icon={<LogIn className="h-4 w-4" />} disabled>
              Punch In
            </Button>
            <Button variant="outline" size="md" className="flex-1" icon={<LogOut className="h-4 w-4" />}>
              Punch Out
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Register cells (with borders)</h3>
            <p className="text-xs text-gray-500 mt-1">How status codes appear in the salary register grid.</p>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            {DEMO_CODES.map((code) => (
              <div key={code} className="flex flex-col items-center gap-1">
                <DemoCell code={code} />
                <span className="text-[10px] text-gray-500">{REGISTER_CELL_STYLES[code].title}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-xs border-collapse min-w-[420px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left font-semibold text-gray-700">Employee</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">25</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">26</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-400 bg-gray-100/80">27 Sun</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-600">28</th>
                  <th className="px-2 py-2 text-center font-semibold text-gray-700">Pay</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">Sample Employee</td>
                  <td className="px-2 py-2 text-center"><DemoCell code="P" /></td>
                  <td className="px-2 py-2 text-center"><DemoCell code="L" /></td>
                  <td className="px-2 py-2 text-center bg-gray-50/80"><DemoCell code="WO" /></td>
                  <td className="px-2 py-2 text-center"><DemoCell code="A" /></td>
                  <td className="px-2 py-2 text-center font-semibold text-gray-800">
                    28<span className="text-gray-400 font-normal">/{PAYABLE_DAYS_PER_CYCLE}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500">
            Pay = P + L + WO (Sundays included). Absent days are not paid. Maximum {PAYABLE_DAYS_PER_CYCLE} days per salary cycle.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">What changed</h3>
          <ul className="space-y-3">
            {CHANGES.map((item) => (
              <li key={item.title} className="flex gap-3 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{item.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>
    </div>
  );
};
