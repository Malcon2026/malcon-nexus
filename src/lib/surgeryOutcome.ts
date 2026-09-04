import type { ImplantCase, StageRecord, SurgeryOutcome } from '../types';

export function isSurgeryAwaitingAdminClose(c: ImplantCase): boolean {
  return c.surgeryOutcome === 'cancelled' || c.surgeryOutcome === 'parked';
}

export function getSurgeryOutcomeLabel(outcome: SurgeryOutcome | '' | undefined): string | null {
  if (outcome === 'parked') return 'Parked';
  if (outcome === 'cancelled') return 'Cancelled';
  return null;
}

/** Stage badge text — shows Parked/Cancelled instead of Submitted when applicable. */
export function getStageStatusLabel(stage: StageRecord, implantCase: ImplantCase): string {
  if (
    stage.stage === 'Surgery' &&
    stage.status === 'Submitted' &&
    implantCase.surgeryOutcome
  ) {
    return getSurgeryOutcomeLabel(implantCase.surgeryOutcome) ?? stage.status;
  }
  return stage.status;
}

export function surgeryOutcomeLogAction(outcome: SurgeryOutcome): string {
  return outcome === 'parked' ? 'Surgery: Parked' : 'Surgery: Cancelled';
}
