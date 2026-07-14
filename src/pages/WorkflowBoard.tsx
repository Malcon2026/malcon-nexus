import React from 'react';
import { motion } from 'framer-motion';
import { Calendar, User, AlertTriangle, ArrowRight, Eye } from 'lucide-react';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { useStore } from '../store/useStore';
import type { WorkflowStage } from '../types';
import { priorityColors, stageColors, formatDate } from '../utils/helpers';

const KANBAN_STAGES: WorkflowStage[] = [
  'Kit Preparation', 'Surgery', 'Cleaning', 'Audit', 'Billing', 'Bill Submission', 'Completed'
];

const STAGE_LABELS: Record<WorkflowStage, { title: string; desc: string }> = {
  'Kit Preparation': { title: 'Kit Preparation', desc: 'Stores dept' },
  'Surgery': { title: 'Surgery', desc: 'Scrub person' },
  'Cleaning': { title: 'Cleaning', desc: 'Clean dept' },
  'Audit': { title: 'Stores Audit', desc: 'Audit dept' },
  'Billing': { title: 'Billing', desc: 'Accounts' },
  'Bill Submission': { title: 'Bill Submission', desc: 'Bill submission team' },
  'Completed': { title: 'Completed', desc: 'Case closed' },
};

export const WorkflowBoard: React.FC = () => {
  const { cases, setSelectedCase, setActiveTab } = useStore();

  const getCasesForStage = (stage: WorkflowStage) =>
    cases.filter(c => c.currentStage === stage);

  return (
    <div className="p-4 sm:p-6 h-full flex flex-col max-w-[1800px] mx-auto w-full min-w-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">Workflow Board</h1>
          <p className="text-sm text-gray-500 mt-0.5">Visual overview of all cases across workflow stages</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <div className="flex items-center gap-1.5"><div className="h-2.5 w-2.5 rounded-full bg-gray-900 shrink-0" /><span className="text-xs sm:text-sm">Cards only move after Admin approval</span></div>
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1 max-w-full">
        {KANBAN_STAGES.map((stage) => {
          const stageCases = getCasesForStage(stage);
          const sc = stageColors[stage];
          const info = STAGE_LABELS[stage];

          return (
            <div key={stage} className="flex-none w-72 sm:w-64 flex flex-col">
              {/* Column Header */}
              <div className={`${sc.bg} border ${sc.border} rounded-xl px-3 py-2.5 mb-3`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${sc.dot}`} />
                      <span className={`text-xs font-bold ${sc.text}`}>{info.title}</span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5 ml-4">{info.desc}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    {stageCases.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-3 min-h-20">
                {stageCases.map((c, cardIdx) => {
                  const pc = priorityColors[c.priority];
                  const isOverdueSurgery = new Date(c.surgeryDate) < new Date() && c.status !== 'Completed';
                  const isWaiting = c.status === 'Waiting For Approval';

                  return (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: cardIdx * 0.05 }}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-gray-200 transition-all cursor-pointer group"
                      onClick={() => { setSelectedCase(c.id); setActiveTab('cases'); }}
                    >
                      <div className="p-3">
                        {/* Top row */}
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-xs font-bold text-indigo-600">{c.caseNumber}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{c.implantType || c.implantRequired.split(' ').slice(0, 3).join(' ')}</p>
                          </div>
                          <Badge className={`${pc} text-[10px] shrink-0`}>{c.priority}</Badge>
                        </div>

                        {/* Hospital */}
                        <p className="text-xs font-semibold text-gray-800 truncate">{c.hospital.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{c.doctor.name}</p>

                        {/* Status indicator */}
                        {isWaiting && (
                          <div className="flex items-center gap-1 mt-2 px-2 py-1 bg-amber-50 border border-amber-100 rounded-lg">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span className="text-[10px] text-amber-700 font-medium">Awaiting Admin</span>
                          </div>
                        )}

                        {/* Assigned Employee */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-50">
                          {c.assignedEmployee ? (
                            <div className="flex items-center gap-1.5">
                              <Avatar name={c.assignedEmployee.name} size="xs" />
                              <span className="text-[10px] text-gray-600 truncate max-w-[80px]">{c.assignedEmployee.name.split(' ')[0]}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-gray-400">
                              <User className="h-3 w-3" />
                              <span className="text-[10px]">Unassigned</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            {isOverdueSurgery && <AlertTriangle className="h-3 w-3 text-red-500" />}
                            <div className="flex items-center gap-0.5 text-[10px] text-gray-400">
                              <Calendar className="h-3 w-3" />
                              {formatDate(c.surgeryDate).split(' ').slice(0, 2).join(' ')}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* View action */}
                      <div className="px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-medium">
                          <Eye className="h-3 w-3" />
                          View details
                          <ArrowRight className="h-3 w-3" />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}

                {stageCases.length === 0 && (
                  <div className="h-24 border-2 border-dashed border-gray-100 rounded-xl flex items-center justify-center">
                    <p className="text-xs text-gray-300 font-medium">No cases</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 sm:gap-6 mt-4 pt-4 border-t border-gray-100">
        <p className="text-xs font-medium text-gray-500 w-full sm:w-auto">Legend:</p>
        {[
          { color: 'bg-amber-400', label: 'Waiting for Approval' },
          { color: 'bg-indigo-500', label: 'Active / In Progress' },
          { color: 'bg-red-500', label: 'Overdue Surgery' },
          { color: 'bg-gray-300', label: 'Unassigned' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <div className={`h-2 w-2 rounded-full ${color}`} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
};
