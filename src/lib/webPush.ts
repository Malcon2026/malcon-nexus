import { supabase } from './supabase';
import { USE_SUPABASE } from './database/config';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? '';

function supportsWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function isWebPushSupported(): boolean {
  return supportsWebPush() && Boolean(VAPID_PUBLIC_KEY);
}

export function webPushPermission(): NotificationPermission | 'unsupported' {
  if (!supportsWebPush()) return 'unsupported';
  return Notification.permission;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  } catch (err) {
    console.error('[webPush] service worker registration failed:', err);
    return null;
  }
}

export async function subscribeToWebPush(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!USE_SUPABASE) return { ok: false, error: 'Supabase is not enabled.' };
  if (!isWebPushSupported()) {
    return { ok: false, error: 'Push notifications are not supported on this browser.' };
  }
  if (!VAPID_PUBLIC_KEY) {
    return { ok: false, error: 'Push is not configured yet. Contact admin.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, error: 'Notification permission was denied.' };
  }

  const registration = (await navigator.serviceWorker.getRegistration('/')) ?? (await registerServiceWorker());
  if (!registration) {
    return { ok: false, error: 'Could not register the app for notifications.' };
  }

  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const { error, data } = await supabase.functions.invoke('push-subscribe', {
    body: {
      endpoint: json.endpoint,
      keys: json.keys,
      userAgent: navigator.userAgent,
    },
  });

  if (error) {
    return { ok: false, error: error.message ?? 'Failed to save subscription.' };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as { error: string }).error) };
  }

  return { ok: true };
}

type PushEvent = 'assignment' | 'postpone';

async function invokePush(event: PushEvent, caseId: string, employeeId: string): Promise<void> {
  if (!USE_SUPABASE || !employeeId) return;

  try {
    const { data, error } = await supabase.functions.invoke('send-push', {
      body: { event, caseId, employeeId },
    });

    if (error) {
      console.error('[webPush] notification failed:', error.message, data ?? '');
      return;
    }

    if (data && typeof data === 'object' && 'error' in data && !('skipped' in data)) {
      console.error('[webPush] notification failed:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('[webPush] notification failed:', err);
  }
}

export function notifyPushAssignment(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  void invokePush('assignment', caseId, employeeId);
}

export function notifyPushPostpone(caseId: string, employeeId: string | undefined | null): void {
  if (!employeeId) return;
  void invokePush('postpone', caseId, employeeId);
}
