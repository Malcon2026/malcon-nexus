import React from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Bilingual } from './BilingualText';
import { locationDeniedMessage } from '../lib/geolocationPrompt';
import type { GeolocationPermissionState } from '../lib/geolocationPrompt';

type Props = {
  permission: GeolocationPermissionState;
  requesting: boolean;
  onRetry: () => void;
};

export const EmployeeLocationBanner: React.FC<Props> = ({ permission, requesting, onRetry }) => {
  if (permission === 'granted') return null;

  const denied = permission === 'denied';
  const en = denied
    ? locationDeniedMessage()
    : 'Allow location so punch-in and trips work. We will ask each time you open the app.';
  const te = denied
    ? 'Location off undi. Phone Settings → Malcon Nexus → Location Allow, leka kindha Try again.'
    : 'Punch-in kosam location allow cheyandi. App open chesinappudu malli adugutam.';

  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 flex gap-3 items-start ${
        denied ? 'border-amber-300/80 bg-amber-50/40' : 'border-sky-200/80 bg-sky-50/30'
      }`}
    >
      <MapPin className={`h-5 w-5 shrink-0 mt-0.5 ${denied ? 'text-amber-700' : 'text-sky-600'}`} />
      <div className="flex-1 min-w-0">
        <Bilingual enClassName="text-sm font-medium text-gray-900" teClassName="text-gray-600 mt-0.5" en={en} te={te} />
        <button
          type="button"
          onClick={() => void onRetry()}
          disabled={requesting}
          className="mt-2.5 inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-semibold px-3.5 py-2 hover:opacity-90 disabled:opacity-60"
        >
          {requesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {requesting ? 'Asking…' : 'Try again / Allow location'}
        </button>
      </div>
    </div>
  );
};
