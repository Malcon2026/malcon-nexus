import React from 'react';
import { EmployeeSearchSelect } from './EmployeeSearchSelect';
import type { Employee } from '../types';
import { STAGE_DEPARTMENT_MAP, findStageRecord, type StageWithAssistant } from '../lib/caseWorkflow';
import type { ImplantCase } from '../types';

interface StageExtraPersonFieldsProps {
  stage: StageWithAssistant;
  employees: Employee[];
  primaryEmployeeId: string;
  extraEnabled: boolean;
  assistantId: string;
  onExtraEnabledChange: (enabled: boolean) => void;
  onAssistantChange: (employeeId: string) => void;
  disabled?: boolean;
}

export const StageExtraPersonFields: React.FC<StageExtraPersonFieldsProps> = ({
  stage,
  employees,
  primaryEmployeeId,
  extraEnabled,
  assistantId,
  onExtraEnabledChange,
  onAssistantChange,
  disabled = false,
}) => {
  const surgerySelf = primaryEmployeeId === '__self__';

  return (
    <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={extraEnabled}
          disabled={disabled || surgerySelf}
          onChange={(e) => {
            const on = e.target.checked;
            onExtraEnabledChange(on);
            if (!on) onAssistantChange('');
          }}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-[11px] font-medium text-gray-700">Extra person required</span>
      </label>
      {surgerySelf ? (
        <p className="text-[10px] text-gray-400">Not available when surgery is self-performed.</p>
      ) : null}
      {extraEnabled && !surgerySelf ? (
        <div>
          <p className="text-[10px] text-gray-500 mb-1">
            Extra helper{stage === 'Delivery' ? ' (any department)' : ''} — cannot submit; primary submits
          </p>
          <EmployeeSearchSelect
            employees={employees}
            value={assistantId}
            onChange={onAssistantChange}
            placeholder="Pick extra person..."
            suggestedDepartment={stage === 'Surgery' ? STAGE_DEPARTMENT_MAP.Surgery : undefined}
            disabled={disabled}
          />
        </div>
      ) : null}
    </div>
  );
};

export function emptyStageAssistantIds(): Record<StageWithAssistant, string> {
  return { Delivery: '', Surgery: '' };
}

export function emptyStageExtraFlags(): Record<StageWithAssistant, boolean> {
  return { Delivery: false, Surgery: false };
}

export function stageAssistantsFromCase(
  stages: ImplantCase['stages'],
): Record<StageWithAssistant, string> {
  const result = emptyStageAssistantIds();
  for (const stage of ['Delivery', 'Surgery'] as const) {
    result[stage] = findStageRecord(stages, stage)?.assistantEmployee?.id ?? '';
  }
  return result;
}

export function stageExtraFlagsFromCase(
  stages: ImplantCase['stages'],
): Record<StageWithAssistant, boolean> {
  const ids = stageAssistantsFromCase(stages);
  return {
    Delivery: Boolean(ids.Delivery),
    Surgery: Boolean(ids.Surgery),
  };
}
