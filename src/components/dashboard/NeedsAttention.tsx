import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { Priority, WorkflowStage } from '../../types';
import { cn } from '../../utils/cn';
import { getStageStyle } from '../../utils/helpers';
import {
  ATTENTION_STAGES,
  filterAttentionRows,
  formatSurgeryDate,
  formatUrgency,
  sortAttentionRows,
  type AttentionScope,
  type AttentionSort,
  type AttentionSummary,
  type OpsCaseRow,
} from '../../lib/dashboardOps';
import { RowActions } from './RowActions';

const PAGE_SIZE = 10;

const SCOPES: { id: AttentionScope; label: string; hint: string }[] = [
  { id: 'all', label: 'All', hint: 'Every pending case' },
  { id: 'overdue', label: 'Overdue', hint: 'Surgery date has passed' },
  { id: 'today', label: 'Today', hint: 'Surgery scheduled today' },
  { id: 'week', label: 'This week', hint: 'Surgery in the next 7 days, after today' },
];

const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

const pad2 = (n: number) => String(n).padStart(2, '0');

interface NeedsAttentionProps {
  rows: OpsCaseRow[];
  summary: AttentionSummary;
  scope: AttentionScope;
  onScopeChange: (scope: AttentionScope) => void;
  onOpenCase: (caseId: string) => void;
  onOpenAllCases: () => void;
  onOpenWorkflow: () => void;
}

const SummaryFigure: React.FC<{
  value: number;
  label: string;
  tone?: 'danger' | 'warn';
  title: string;
}> = ({ value, label, tone, title }) => (
  <div className="ops-figure" title={title}>
    <span className={cn('ops-figure__value', value > 0 && tone && `is-${tone}`)}>{pad2(value)}</span>
    <span className="ops-figure__label">{label}</span>
  </div>
);

const CaseRow: React.FC<{
  row: OpsCaseRow;
  onOpenCase: (caseId: string) => void;
  onOpenWorkflow: () => void;
}> = ({ row, onOpenCase, onOpenWorkflow }) => {
  const stageStyle = getStageStyle(row.stage);
  const location = [row.doctorName && `Dr. ${row.doctorName.replace(/^Dr\.?\s+/i, '')}`, row.city]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={cn('ops-row', `ops-row--${row.tier}`)}>
      <span className="ops-row__tick" aria-hidden />

      <div className="ops-row__case">
        <div className="ops-row__headline">
          <button
            type="button"
            className="ops-row__open"
            onClick={() => onOpenCase(row.id)}
            aria-label={`Open case ${row.caseNumber}, ${row.stage}, ${formatUrgency(row)}`}
          >
            {row.caseNumber}
          </button>
          {row.postponed && <span className="ops-row__flag">Postponed</span>}
        </div>
        <p className="ops-row__hospital">
          {row.hospitalName}
          {row.hospitalBranch && <span className="ops-row__branch"> · {row.hospitalBranch}</span>}
        </p>
        {location && <p className="ops-row__meta">{location}</p>}
      </div>

      <div className="ops-row__stage">
        <p className="ops-row__stage-name">
          <span className={cn('ops-dot', stageStyle.dot)} aria-hidden />
          {row.stage}
        </p>
        <p className="ops-row__action">{row.nextAction}</p>
      </div>

      <div className="ops-row__date">
        <p className="ops-row__date-value">{formatSurgeryDate(row.surgeryDateKey)}</p>
        <p className={cn('ops-row__urgency', row.tier)}>{formatUrgency(row)}</p>
      </div>

      <div className="ops-row__owner">
        {row.ownerName ? (
          <p className="ops-row__owner-name">
            <span className="ops-initial" aria-hidden>
              {row.ownerName.charAt(0).toUpperCase()}
            </span>
            {row.ownerFirstName}
          </p>
        ) : (
          <p className="ops-row__owner-name is-unassigned">Unassigned</p>
        )}
        <p className={cn('ops-row__priority', `is-${row.priority.toLowerCase()}`)}>{row.priority} priority</p>
      </div>

      <RowActions row={row} onOpenCase={onOpenCase} onOpenWorkflow={onOpenWorkflow} />
    </li>
  );
};

export const NeedsAttention: React.FC<NeedsAttentionProps> = ({
  rows,
  summary,
  scope,
  onScopeChange,
  onOpenCase,
  onOpenAllCases,
  onOpenWorkflow,
}) => {
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<WorkflowStage | 'all'>('all');
  const [priority, setPriority] = useState<Priority | 'all'>('all');
  const [sort, setSort] = useState<AttentionSort>('urgency');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [scope, query, stage, priority, sort]);

  const visible = useMemo(
    () => sortAttentionRows(filterAttentionRows(rows, { scope, stage, priority, query }), sort),
    [rows, scope, stage, priority, query, sort],
  );

  const filtered = scope !== 'all' || stage !== 'all' || priority !== 'all' || query.trim() !== '';
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = visible.slice(start, start + PAGE_SIZE);

  const clearFilters = () => {
    onScopeChange('all');
    setStage('all');
    setPriority('all');
    setQuery('');
  };

  return (
    <section className="ops-sheet ops-attn" id="dash-needs-attention" aria-labelledby="ops-attn-title">
      <header className="ops-head">
        <div className="min-w-0">
          <h2 id="ops-attn-title" className="ops-title">
            Needs attention
          </h2>
          <p className="ops-sub">Cases requiring action, sorted by urgency</p>
        </div>
        <button type="button" className="ops-link" onClick={onOpenAllCases}>
          View all cases
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </header>

      {rows.length === 0 ? (
        <div className="ops-state">
          <p className="ops-state__label is-clear">All clear</p>
          <p className="ops-state__text">No pending cases require attention.</p>
        </div>
      ) : (
        <>
          <div className="ops-summary" role="group" aria-label="Pending workload">
            <SummaryFigure
              value={summary.overdue}
              label="Overdue"
              tone="danger"
              title="Surgery date has passed and the case is still open"
            />
            <SummaryFigure value={summary.today} label="Due today" tone="warn" title="Surgery scheduled today" />
            <SummaryFigure value={summary.week} label="Due this week" title="Surgery in the next 7 days, after today" />
            <SummaryFigure value={summary.pending} label="Pending" title="All open cases" />
          </div>

          <div className="ops-toolbar">
            <label className="ops-search">
              <Search className="ops-search__icon" aria-hidden />
              <span className="sr-only">Search pending cases</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cases, hospitals, doctors…"
              />
            </label>

            <div className="ops-segment" role="group" aria-label="Filter by due date">
              {SCOPES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={cn('ops-segment__btn', scope === s.id && 'is-active')}
                  aria-pressed={scope === s.id}
                  title={s.hint}
                  onClick={() => onScopeChange(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>

            <div className="ops-selects">
              <select
                className="ops-select"
                aria-label="Filter by stage"
                value={stage}
                onChange={(e) => setStage(e.target.value as WorkflowStage | 'all')}
              >
                <option value="all">All stages</option>
                {ATTENTION_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <select
                className="ops-select"
                aria-label="Filter by priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority | 'all')}
              >
                <option value="all">Any priority</option>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <select
                className="ops-select"
                aria-label="Sort cases"
                value={sort}
                onChange={(e) => setSort(e.target.value as AttentionSort)}
              >
                <option value="urgency">Sort: Urgency</option>
                <option value="date">Sort: Surgery date</option>
                <option value="priority">Sort: Priority</option>
              </select>
            </div>
          </div>

          {pageRows.length === 0 ? (
            <div className="ops-state ops-state--inline">
              <p className="ops-state__text">No pending cases match these filters.</p>
              <button type="button" className="ops-link" onClick={clearFilters}>
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <div className="ops-cols" aria-hidden>
                <span>Case</span>
                <span>Workflow</span>
                <span>Surgery</span>
                <span>Owner</span>
                <span />
              </div>
              <ul className="ops-rows" aria-label="Pending cases">
                {pageRows.map((row) => (
                  <CaseRow key={row.id} row={row} onOpenCase={onOpenCase} onOpenWorkflow={onOpenWorkflow} />
                ))}
              </ul>
            </>
          )}

          <footer className="ops-foot">
            <p className="ops-foot__count" aria-live="polite">
              {visible.length === 0 ? (
                <>0 of {summary.pending} pending cases</>
              ) : filtered ? (
                <>
                  Showing {start + 1}–{start + pageRows.length} of {visible.length} matching
                  <span className="ops-foot__dim"> · {summary.pending} pending</span>
                </>
              ) : (
                <>
                  Showing {start + 1}–{start + pageRows.length} of {summary.pending} pending cases
                </>
              )}
            </p>
            {pageCount > 1 && (
              <nav className="ops-pager" aria-label="Pending cases pages">
                <button
                  type="button"
                  className="ops-pager__btn"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden />
                </button>
                <span className="ops-pager__label">
                  {currentPage} / {pageCount}
                </span>
                <button
                  type="button"
                  className="ops-pager__btn"
                  aria-label="Next page"
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </nav>
            )}
          </footer>
        </>
      )}
    </section>
  );
};
