import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Plus, Search, Stethoscope, UserRound } from 'lucide-react';
import type { CreateCaseDraft } from '../../lib/createCaseFromDraft';
import type { Doctor, Hospital, ImplantCase } from '../../types';
import { cn } from '../../utils/cn';
import { NEXUS_FORM_CONTROL } from '../../constants/formStyles';
import { normalizeTitleCaseWords } from '../../lib/textFormat';
import { SurgeryDateQuickPick } from '../SurgeryDateQuickPick';
import type { Priority } from '../../types';
import { priorityColors } from '../../utils/helpers';
import { formatHospitalLabel } from '../HospitalSearchSelect';
import { PickerSheet } from './PickerSheet';
import type { DoctorOption } from './caseCreateHelpers';
import { commonProcedures, masterDoctorPickerOptions, recentDoctorNames } from './caseCreateHelpers';

export type SurgeryField = 'doctor' | 'procedure' | 'date';

/** The slice of the draft the surgery UI needs (Add Case and Edit Case both provide it). */
export type SurgeryFormFields = Pick<
  CreateCaseDraft,
  'hospitalId' | 'doctorName' | 'surgeryDate' | 'surgeryDateMode' | 'implantRequired' | 'implantType' | 'implantCompany' | 'priority'
>;

interface SurgeryStepProps {
  form: SurgeryFormFields;
  patch: (partial: Partial<SurgeryFormFields>) => void;
  hospital: Hospital | undefined;
  cases: ImplantCase[];
  doctors: Doctor[];
  /** Implant type & company — admin and store manager. */
  showImplantDetails?: boolean;
  error: { field: SurgeryField; message: string } | null;
  /** Increment to open the doctor sheet (used by validation). */
  openDoctorSignal: number;
  procedureRef: React.RefObject<HTMLInputElement | null>;
  onSubmitFromKeyboard: () => void;
  /** Register a new master-list doctor (auto MLS-DOC code). */
  onAddDoctor?: (name: string) => Promise<void>;
}

const PRIORITIES: Priority[] = ['Critical', 'High', 'Medium', 'Low'];

const fieldLabel = 'block text-sm font-semibold text-gray-900 mb-2';

/* ------------------------------ Doctor sheet ------------------------------ */

export const DoctorSheet: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  options: DoctorOption[];
  value: string;
  onSelect: (name: string) => void;
  onAddDoctor?: (name: string) => Promise<void>;
}> = ({ isOpen, onClose, options, value, onSelect, onAddDoctor }) => {
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const isTouchPhone =
    typeof window !== 'undefined' && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  useEffect(() => {
    if (isOpen) setQuery('');
  }, [isOpen]);

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter(
        (o) =>
          o.name.toLowerCase().includes(q) ||
          (o.doctorCode ?? '').toLowerCase().includes(q),
      )
    : options;
  const exact = options.some((o) => o.name.toLowerCase() === q);
  const newName = normalizeTitleCaseWords(query.trim());

  const pick = (name: string) => {
    onSelect(name);
    onClose();
  };

  const addNew = async () => {
    if (!newName || exact || !onAddDoctor || adding) return;
    setAdding(true);
    try {
      await onAddDoctor(newName);
      pick(newName);
    } catch (e: any) {
      alert("Failed to add doctor: " + (e.message || String(e)));
      console.error(e);
    } finally {
      setAdding(false);
    }
  };

  return (
    <PickerSheet isOpen={isOpen} onClose={onClose} title="Select doctor">
      <div className="px-4 sm:px-5 pb-2 sticky top-0 bg-white z-10">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            id="case-create-doctor-search"
            type="search"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            autoFocus={!isTouchPhone}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName && !exact && onAddDoctor) {
                e.preventDefault();
                void addNew();
              }
            }}
            placeholder="Search master list or add new doctor"
            aria-label="Search or add doctor"
            className="nexus-field-input !min-h-[48px] !text-base"
          />
        </div>
      </div>

      <ul className="pb-3">
        {newName && !exact && onAddDoctor ? (
          <li>
            <button
              type="button"
              disabled={adding}
              onClick={() => void addNew()}
              className="flex w-full items-center gap-3 px-4 sm:px-5 min-h-[56px] py-2 text-left text-[var(--color-accent)] hover:bg-gray-50 focus:outline-none focus-visible:bg-[var(--color-accent-muted)] disabled:opacity-60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-muted)]">
                <Plus className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                {adding ? 'Adding…' : `Add “${newName}” to master list`}
              </span>
            </button>
          </li>
        ) : null}

        {filtered.map((o) => {
          const selected = o.name.toLowerCase() === value.trim().toLowerCase();
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o.name)}
                aria-pressed={selected}
                className={cn(
                  'flex w-full items-center gap-3 px-4 sm:px-5 min-h-[56px] py-2 text-left hover:bg-gray-50 focus:outline-none focus-visible:bg-[var(--color-accent-muted)]',
                  selected && 'bg-[var(--color-accent-muted)]',
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <UserRound className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-gray-900">{o.name}</span>
                  <span className="block text-xs text-gray-500">
                    {o.doctorCode ? `${o.doctorCode}` : 'Master list'}
                    {o.count > 0 ? ` · ${o.count} case${o.count === 1 ? '' : 's'}` : ''}
                  </span>
                </span>
                {selected ? <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-label="Selected" /> : null}
              </button>
            </li>
          );
        })}

        {!newName && filtered.length === 0 ? (
          <li className="px-5 py-8 text-center text-sm text-gray-500">
            No doctors on the master list yet.
            <br />
            Type a name above to add one with the next MLS-DOC code.
          </li>
        ) : null}
      </ul>
    </PickerSheet>
  );
};

/* -------------------------------- The step -------------------------------- */

export const SurgeryStep: React.FC<SurgeryStepProps> = ({
  form,
  patch,
  hospital,
  cases,
  doctors,
  showImplantDetails = false,
  error,
  openDoctorSignal,
  procedureRef,
  onSubmitFromKeyboard,
  onAddDoctor,
}) => {
  const [doctorOpen, setDoctorOpen] = useState(false);

  useEffect(() => {
    if (openDoctorSignal > 0) setDoctorOpen(true);
  }, [openDoctorSignal]);

  const doctorOptions = useMemo(() => masterDoctorPickerOptions(cases, doctors), [cases, doctors]);
  const recentNames = useMemo(() => recentDoctorNames(cases, doctors, 4), [cases, doctors]);
  const selectedCode = useMemo(() => {
    const n = form.doctorName.trim().toLowerCase();
    return doctorOptions.find((o) => o.name.toLowerCase() === n)?.doctorCode;
  }, [doctorOptions, form.doctorName]);
  const quickDoctors = recentNames
    .filter((n) => n.toLowerCase() !== form.doctorName.trim().toLowerCase())
    .slice(0, 3)
    .map((name) => ({ name }));
  const procedures = useMemo(() => commonProcedures(cases), [cases]);
  const errFor = (f: SurgeryField) => (error?.field === f ? error.message : null);

  const inputClass = `${NEXUS_FORM_CONTROL} !text-base !min-h-[52px]`;
  const hasDoctor = Boolean(form.doctorName.trim());

  return (
    <div className="space-y-7">
      {/* WHEN */}
      <section aria-labelledby="cc-when">
        <span id="cc-when" className={fieldLabel}>
          When is the surgery?
        </span>
        <SurgeryDateQuickPick
          size="lg"
          customLabel="Choose date"
          value={form.surgeryDate}
          mode={form.surgeryDateMode}
          onChange={(surgeryDate, surgeryDateMode) => patch({ surgeryDate, surgeryDateMode })}
        />
        {errFor('date') ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {errFor('date')}
          </p>
        ) : null}
      </section>

      {/* WHO */}
      <section aria-labelledby="cc-who">
        <span id="cc-who" className={fieldLabel}>
          Which doctor?
        </span>
        <button
          type="button"
          onClick={() => setDoctorOpen(true)}
          aria-haspopup="dialog"
          aria-invalid={errFor('doctor') ? true : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-2xl border bg-white px-4 min-h-[60px] py-2 text-left transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
            errFor('doctor') ? 'border-red-300' : hasDoctor ? 'border-[var(--color-accent)]' : 'border-gray-200 hover:border-gray-300',
          )}
        >
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              hasDoctor ? 'bg-[var(--color-accent)] text-white' : 'bg-gray-100 text-gray-500',
            )}
          >
            <Stethoscope className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            {hasDoctor ? (
              <>
                <span className="block truncate text-[15px] font-semibold text-gray-900">{form.doctorName}</span>
                <span className="block truncate text-xs text-gray-500">
                  {[selectedCode, hospital ? formatHospitalLabel(hospital) : 'Tap to change']
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </>
            ) : (
              <span className="block text-[15px] font-medium text-gray-500">Select or add doctor</span>
            )}
          </span>
          {hasDoctor ? (
            <Check className="h-5 w-5 shrink-0 text-[var(--color-accent)]" aria-label="Doctor selected" />
          ) : (
            <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" aria-hidden />
          )}
        </button>
        {errFor('doctor') ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {errFor('doctor')}
          </p>
        ) : null}

        {quickDoctors.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Recent doctors">
            {quickDoctors.map((d) => (
              <button
                key={d.name}
                type="button"
                onClick={() => patch({ doctorName: d.name })}
                className="min-h-[44px] rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {d.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setDoctorOpen(true)}
              className="inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
            >
              <Plus className="h-4 w-4" aria-hidden /> Add doctor
            </button>
          </div>
        ) : !hasDoctor ? (
          <button
            type="button"
            onClick={() => setDoctorOpen(true)}
            className="mt-3 inline-flex min-h-[44px] items-center gap-1 rounded-full px-3 text-sm font-semibold text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add doctor
          </button>
        ) : null}
      </section>

      {/* WHAT */}
      <section>
        <label htmlFor="cc-procedure" className={fieldLabel}>
          What is the procedure?
        </label>
        <input
          id="cc-procedure"
          ref={procedureRef}
          className={cn(inputClass, errFor('procedure') && '!border-red-300')}
          value={form.implantRequired}
          onChange={(e) => patch({ implantRequired: e.target.value })}
          onBlur={(e) => patch({ implantRequired: normalizeTitleCaseWords(e.target.value) })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmitFromKeyboard();
            }
          }}
          placeholder="e.g. Total knee replacement"
          enterKeyHint="next"
          autoComplete="off"
          aria-invalid={errFor('procedure') ? true : undefined}
        />
        {errFor('procedure') ? (
          <p role="alert" className="mt-2 text-sm font-medium text-red-600">
            {errFor('procedure')}
          </p>
        ) : null}
        {!form.implantRequired.trim() && procedures.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Common procedures">
            {procedures.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => patch({ implantRequired: p })}
                className="min-h-[44px] rounded-full border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {p}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {showImplantDetails ? (
        <section className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cc-implant-type" className={fieldLabel}>
              Implant type
            </label>
            <input
              id="cc-implant-type"
              className={inputClass}
              value={form.implantType}
              onChange={(e) => patch({ implantType: e.target.value })}
              onBlur={(e) => patch({ implantType: normalizeTitleCaseWords(e.target.value) })}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor="cc-implant-company" className={fieldLabel}>
              Company
            </label>
            <input
              id="cc-implant-company"
              className={inputClass}
              value={form.implantCompany}
              onChange={(e) => patch({ implantCompany: e.target.value })}
              onBlur={(e) => patch({ implantCompany: normalizeTitleCaseWords(e.target.value) })}
              placeholder="Optional"
              autoComplete="off"
            />
          </div>
        </section>
      ) : null}

      {/* Priority */}
      <section aria-labelledby="cc-priority">
        <span id="cc-priority" className={fieldLabel}>
          Priority
        </span>
        <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Priority">
          {PRIORITIES.map((priority) => {
            const active = form.priority === priority;
            return (
              <button
                key={priority}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => patch({ priority })}
                className={cn(
                  'min-h-[48px] rounded-xl border px-1 text-sm font-semibold transition-colors',
                  'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] focus-visible:ring-offset-1',
                  active
                    ? cn(priorityColors[priority], 'ring-2 ring-offset-1')
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                )}
              >
                {priority}
              </button>
            );
          })}
        </div>
      </section>

      <DoctorSheet
        isOpen={doctorOpen}
        onClose={() => setDoctorOpen(false)}
        options={doctorOptions}
        value={form.doctorName}
        onSelect={(doctorName) => patch({ doctorName })}
        onAddDoctor={onAddDoctor}
      />
    </div>
  );
};
