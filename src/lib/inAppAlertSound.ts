const SIREN_URL = '/sounds/siren.mp3';
const STORAGE_KEY = 'malconnexus_in_app_sound';

let audio: HTMLAudioElement | null = null;

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio(SIREN_URL);
    audio.preload = 'auto';
  }
  return audio;
}

export function isInAppSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setInAppSoundEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
}

function vibrateAlert(): void {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 200, 100, 200]);
  }
}

/** Play siren when enabled and the app tab is visible (foreground). */
export function playInAppSiren(): void {
  if (!isInAppSoundEnabled()) return;
  if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;

  try {
    const el = getAudio();
    el.currentTime = 0;
    void el.play().catch((err) => console.warn('[siren] play blocked:', err));
    vibrateAlert();
  } catch (err) {
    console.warn('[siren] failed:', err);
  }
}

/** Settings "Test siren" — requires a user tap; ignores visibility check. */
export function previewInAppSiren(): void {
  try {
    const el = getAudio();
    el.currentTime = 0;
    void el.play().catch((err) => console.warn('[siren] preview blocked:', err));
    vibrateAlert();
  } catch (err) {
    console.warn('[siren] preview failed:', err);
  }
}
