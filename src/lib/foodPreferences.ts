import { getISTDateKey } from './attendance';

const KEY = 'mn_food_open_after_punch_in';

/** Last calendar day (IST) to show strong “new feature” blink on the Food tile. */
export const FOOD_TILE_ATTENTION_UNTIL = '2026-10-18';

export function isFoodTileAttentionPeriod(): boolean {
  return getISTDateKey() <= FOOD_TILE_ATTENTION_UNTIL;
}

/** urgent = not submitted today; new = submitted but still in launch attention window. */
export function getFoodTileBlinkLevel(pendingToday: boolean): 'urgent' | 'new' | null {
  if (pendingToday) return 'urgent';
  if (isFoodTileAttentionPeriod()) return 'new';
  return null;
}

export function getFoodOpenAfterPunchIn(): boolean {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return true;
    return raw === '1' || raw === 'true';
  } catch {
    return true;
  }
}

export function setFoodOpenAfterPunchIn(enabled: boolean): void {
  try {
    localStorage.setItem(KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
