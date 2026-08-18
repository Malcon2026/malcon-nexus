import React from 'react';
import { ExternalLink } from 'lucide-react';
import { googleMapsUrl } from '../lib/plusCode';

export const PlusCodeLink: React.FC<{
  label: string;
  plusCode: string;
  lat?: number | null;
  lng?: number | null;
  accuracyM?: number | null;
}> = ({ label, plusCode, lat, lng, accuracyM }) => {
  if (!plusCode && (lat == null || lng == null)) return null;
  const href = googleMapsUrl(plusCode, lat ?? undefined, lng ?? undefined);
  const accuracy =
    accuracyM != null && Number.isFinite(accuracyM) ? ` · ±${Math.round(accuracyM)} m` : '';

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-sky-700 hover:text-sky-900 hover:underline break-all"
    >
      <span className="font-medium text-gray-600 shrink-0">{label}</span>
      <span className="font-mono">{plusCode || `${lat}, ${lng}`}</span>
      {accuracy && <span className="text-gray-400 font-sans">{accuracy}</span>}
      <ExternalLink className="h-3 w-3 shrink-0 text-sky-500" />
    </a>
  );
};
