const KEY = 'mn_food_open_after_punch_in';

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
