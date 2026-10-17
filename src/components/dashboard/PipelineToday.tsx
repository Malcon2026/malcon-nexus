import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ImplantCase, WorkflowStage } from '../../types';
import { cn } from '../../utils/cn';
import {
  PIPELINE_STAGES,
  buildPipelineDay,
  findNextUpcoming,
  formatDayLabel,
  shiftDateKey,
  stageShortLabel,
  type AttentionScope,
  type AttentionSummary,
  type OpsCaseRow,
} from '../../lib/dashboardOps';

type PipelineView = 'timeline' | 'board' | 'list';

const VIEWS: { id: PipelineView; label: string }[] = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'board', label: 'Board' },
  { id: 'list', label: 'List' },
];

/** Rows shown before the "Show all" control; keeps the section compact on busy days. */
const COLLAPSED_ROWS = 8;

interface PipelineTodayProps {
  cases: ImplantCase[];
  todayKey: string;
  pendingRows: OpsCaseRow[];
  summary: AttentionSummary;
  onOpenCase: (caseId: string) => void;
  onViewCalendar: (dateKey: string) => void;
  onJumpToAttention: (scope: AttentionScope) => void;
}

const ownerLabel = (row: OpsCaseRow) => row.ownerFirstName ?? 'Unassigned';

const StageTrack: React.FC<{ stage: WorkflowStage }> = ({ stage }) => {
  const index = Math.max(0, PIPELINE_STAGES.indexOf(stage));
  return (
    <div
      className="ops-track"
      style={{ ['--stage-index' as string]: index }}
      role="img"
      aria-label={`Stage ${index + 1} of ${PIPELINE_STAGES.length}: ${stage}`}
    >
      {PIPELINE_STAGES.map((s, i) => (
        <span
          key={s}
          className={cn('ops-track__node', i < index && 'is-past', i === index && 'is-current')}
        />
      ))}
    </div>
  );
};

const TimelineItem: React.FC<{ row: OpsCaseRow; onOpenCase: (id: string) => void }> = ({ row, onOpenCase }) => (
  <li className="ops-tl">
    <div className="ops-tl__top">
      <button
        type="button"
        className="ops-tl__open"
        onClick={() => onOpenCase(row.id)}
        aria-label={`Open case ${row.caseNumber}, ${row.stage}, ${row.status.label}`}
      >
        {row.caseNumber}
      </button>
      <span className={cn('ops-status', `is-${row.status.tone}`)}>{row.status.label}</span>
    </div>
    <p className="ops-tl__line">
      <span className="ops-tl__stage">{stageShortLabel(row.stage)}</span>
      <span className="ops-tl__sep" aria-hidden>
        ·
      </span>
      {row.hospitalName}
    </p>
    <p className={cn('ops-tl__sub', !row.ownerName && 'is-unassigned')}>
      {ownerLabel(row)}
      <span className="ops-tl__sep" aria-hidden>
        —
      </span>
      {row.nextAction}
    </p>
    <StageTrack stage={row.stage} />
  </li>
);

const BoardGroups: React.FC<{ rows: OpsCaseRow[]; onOpenCase: (id: string) => void }> = ({ rows, onOpenCase }) => (
  <div className="ops-board">
    {PIPELINE_STAGES.filter((s) => rows.some((r) => r.stage === s)).map((s) => {
      const group = rows.filter((r) => r.stage === s);
      return (
        <section key={s} className="ops-board__group" aria-label={`${s}, ${group.length} cases`}>
          <h3 className="ops-board__head">
            {s}
            <span className="ops-board__count">{group.length}</span>
          </h3>
          <ul className="ops-board__list">
            {group.map((row) => (
              <li key={row.id} className="ops-board__item">
                <div className="min-w-0">
                  <button
                    type="button"
                    className="ops-tl__open"
                    onClick={() => onOpenCase(row.id)}
                    aria-label={`Open case ${row.caseNumber}, ${row.stage}`}
                  >
                    {row.caseNumber}
                  </button>
                  <p className="ops-board__hospital">{row.hospitalName}</p>
                </div>
                <span className={cn('ops-board__owner', !row.ownerName && 'is-unassigned')}>{ownerLabel(row)}</span>
              </li>
            ))}
          </ul>
        </section>
      );
    })}
  </div>
);

const CompactList: React.FC<{ rows: OpsCaseRow[]; onOpenCase: (id: string) => void }> = ({ rows, onOpenCase }) => (
  <ul className="ops-lines">
    {rows.map((row) => (
      <li key={row.id} className="ops-line">
        <button
          type="button"
          className="ops-tl__open"
          onClick={() => onOpenCase(row.id)}
          aria-label={`Open case ${row.caseNumber}, ${row.stage}, ${row.status.label}`}
        >
          {row.caseNumber}
        </button>
        <span className="ops-line__hospital">{row.hospitalName}</span>
        <span className="ops-line__stage">{stageShortLabel(row.stage)}</span>
        <span className={cn('ops-line__owner', !row.ownerName && 'is-unassigned')}>{ownerLabel(row)}</span>
      </li>
    ))}
  </ul>
);

export const PipelineToday: React.FC<PipelineTodayProps> = ({
  cases,
  todayKey,
  pendingRows,
  summary,
  onOpenCase,
  onViewCalendar,
  onJumpToAttention,
}) => {
  const [offset, setOffset] = useState(0);
  const [stage, setStage] = useState<WorkflowStage | null>(null);
  const [view, setView] = useState<PipelineView>('timeline');
  const [expanded, setExpanded] = useState(false);

  const dateKey = shiftDateKey(todayKey, offset);
  const isToday = offset === 0;
  const dayLabel = formatDayLabel(dateKey, todayKey);

  useEffect(() => {
    setStage(null);
    setExpanded(false);
  }, [offset, view]);

  const day = useMemo(() => buildPipelineDay(cases, dateKey, todayKey), [cases, dateKey, todayKey]);

  const filtered = stage ? day.rows.filter((r) => r.stage === stage) : day.rows;
  const shown = expanded ? filtered : filtered.slice(0, COLLAPSED_ROWS);
  const hidden = filtered.length - shown.length;

  const nextUpcoming = useMemo(
    () => findNextUpcoming(pendingRows, dateKey < todayKey ? todayKey : dateKey),
    [pendingRows, dateKey, todayKey],
  );

  const jumpToAttention = (scope: AttentionScope) => {
    onJumpToAttention(scope);
    document.getElementById('dash-needs-attention')?.scrollIntoView({ block: 'start' });
  };

  return (
    <section className="ops-sheet ops-pipe" aria-labelledby="ops-pipe-title">
      <header className="ops-head ops-head--compact">
        <div className="min-w-0">
          <h2 id="ops-pipe-title" className="ops-title ops-title--sm">
            {isToday ? 'Pipeline today' : `Pipeline · ${dayLabel}`}
          </h2>
          <p className="ops-sub">{isToday ? "Today's surgical workflow" : 'Surgical workflow'}</p>
        </div>
        <div className="ops-daynav" role="group" aria-label="Choose day">
          <button
            type="button"
            className="ops-daynav__step"
            aria-label="Previous day"
            onClick={() => setOffset((o) => o - 1)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button
            type="button"
            className="ops-daynav__label"
            onClick={() => setOffset(0)}
            title={isToday ? undefined : 'Back to today'}
            aria-label={isToday ? 'Today' : `${dayLabel}. Back to today`}
          >
            {isToday ? 'Today' : dayLabel}
          </button>
          <button
            type="button"
            className="ops-daynav__step"
            aria-label="Next day"
            onClick={() => setOffset((o) => o + 1)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>

      <div className="ops-pipe__bar">
        {day.rows.length > 0 && (
          <div className="ops-segment" role="group" aria-label="Pipeline view">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={cn('ops-segment__btn', view === v.id && 'is-active')}
                aria-pressed={view === v.id}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="ops-link" onClick={() => onViewCalendar(dateKey)}>
          View calendar
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      {day.rows.length === 0 ? (
        <div className="ops-quiet">
          <p className="ops-state__label">{isToday ? 'No cases today' : 'No cases scheduled'}</p>
          <p className="ops-state__text">
            {isToday ? 'The scheduled workflow is clear.' : `Nothing is scheduled for ${dayLabel}.`}
          </p>

          <dl className="ops-facts">
            <div className="ops-fact">
              <dt>Next upcoming case</dt>
              <dd>
                {nextUpcoming ? (
                  <>
                    <button type="button" className="ops-fact__link" onClick={() => onOpenCase(nextUpcoming.id)}>
                      {nextUpcoming.caseNumber}
                    </button>
                    <span className="ops-fact__meta">
                      {formatDayLabel(nextUpcoming.surgeryDateKey, todayKey)} · {nextUpcoming.hospitalName}
                    </span>
                  </>
                ) : (
                  <span className="ops-fact__meta">No upcoming cases scheduled</span>
                )}
              </dd>
            </div>
            <div className="ops-fact">
              <dt>Pending work</dt>
              <dd>
                {summary.pending > 0 ? (
                  <button type="button" className="ops-fact__link" onClick={() => jumpToAttention('all')}>
                    {summary.pending} {summary.pending === 1 ? 'case still requires' : 'cases still require'} attention
                  </button>
                ) : (
                  <span className="ops-fact__meta">Nothing pending</span>
                )}
              </dd>
            </div>
            <div className="ops-fact">
              <dt>Overdue</dt>
              <dd>
                {summary.overdue > 0 ? (
                  <button type="button" className="ops-fact__link is-danger" onClick={() => jumpToAttention('overdue')}>
                    {summary.overdue} {summary.overdue === 1 ? 'case needs' : 'cases need'} immediate action
                  </button>
                ) : (
                  <span className="ops-fact__meta">No overdue cases</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      ) : (
        <>
          <div className="ops-stages" role="group" aria-label="Filter today's cases by stage">
            {PIPELINE_STAGES.map((s) => {
              const count = day.counts[s] ?? 0;
              const active = stage === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={cn('ops-stage', active && 'is-active', count === 0 && 'is-empty')}
                  aria-pressed={active}
                  aria-label={`${s}: ${count} ${count === 1 ? 'case' : 'cases'}${
                    day.flagged[s] ? ', needs an owner or rework' : ''
                  }`}
                  onClick={() => setStage(active ? null : s)}
                >
                  <span className="ops-stage__count">
                    {count}
                    {day.flagged[s] && <span className="ops-stage__flag" aria-hidden />}
                  </span>
                  <span className="ops-stage__label">{stageShortLabel(s)}</span>
                </button>
              );
            })}
          </div>

          {stage && (
            <p className="ops-pipe__filter">
              {stage} only
              <button type="button" className="ops-link" onClick={() => setStage(null)}>
                Show all
              </button>
            </p>
          )}

          {filtered.length === 0 ? (
            <p className="ops-pipe__none">No cases in this stage {isToday ? 'today' : `on ${dayLabel}`}.</p>
          ) : view === 'timeline' ? (
            <ol className="ops-tls" aria-label="Case flow">
              {shown.map((row) => (
                <TimelineItem key={row.id} row={row} onOpenCase={onOpenCase} />
              ))}
            </ol>
          ) : view === 'board' ? (
            <BoardGroups rows={shown} onOpenCase={onOpenCase} />
          ) : (
            <CompactList rows={shown} onOpenCase={onOpenCase} />
          )}

          {hidden > 0 && (
            <button type="button" className="ops-pipe__more" onClick={() => setExpanded(true)}>
              Show {hidden} more
            </button>
          )}
          {expanded && filtered.length > COLLAPSED_ROWS && (
            <button type="button" className="ops-pipe__more" onClick={() => setExpanded(false)}>
              Show fewer
            </button>
          )}
        </>
      )}
    </section>
  );
};
