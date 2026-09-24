import React, { useEffect, useMemo, useState } from 'react';
import { Camera, Lock } from 'lucide-react';
import type { Document } from '../types';
import { isImageDocument, stagePhotoViewUrlForViewer } from '../lib/stagePhotos';
import { canViewCaseStagePhotos } from '../lib/superAdmin';
import type { Employee } from '../types';

interface StagePhotoGalleryProps {
  documents: Document[];
  title?: string;
  compact?: boolean;
  viewer?: Pick<Employee, 'email' | 'role'> | null;
}

export const StagePhotoGallery: React.FC<StagePhotoGalleryProps> = ({
  documents,
  title = 'Submission Photos',
  compact = false,
  viewer = null,
}) => {
  const photos = useMemo(() => documents.filter(isImageDocument), [documents]);
  const photoKey = useMemo(() => photos.map((p) => p.id).join(','), [photos]);
  const canView = canViewCaseStagePhotos(viewer);

  const [viewUrls, setViewUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canView || photos.length === 0) {
      setViewUrls({});
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next: Record<string, string> = {};
      for (const doc of photos) {
        const url = await stagePhotoViewUrlForViewer(doc, viewer);
        if (url) next[doc.id] = url;
      }
      if (!cancelled) {
        setViewUrls(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, photoKey, viewer?.email, photos]);

  if (photos.length === 0) return null;

  if (!canView) {
    return (
      <div
        className={`rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 ${compact ? 'mt-3' : 'mt-4'}`}
      >
        <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5 shrink-0" />
          {photos.length} stage photo{photos.length === 1 ? '' : 's'} submitted
        </p>
        <p className="text-[10px] text-gray-500 mt-1">
          Photo preview is limited to super admin accounts (e.g. Jeevan, Preetham). Staff can still
          upload when submitting their stage.
        </p>
      </div>
    );
  }

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <Camera className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="text-[10px] text-gray-400 mb-2">
        Super admin view. Full quality also on office PC archive.
      </p>
      {loading && photos.length > 0 && (
        <p className="text-[10px] text-gray-400 mb-2">Loading photos…</p>
      )}
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {photos.map((doc) => {
          const src = viewUrls[doc.id];
          return (
            <div key={doc.id} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
              {src ? (
                <img
                  src={src}
                  alt={doc.name}
                  className={`w-full object-contain bg-black/5 ${compact ? 'max-h-48' : 'max-h-64'}`}
                />
              ) : (
                <div
                  className={`grid place-items-center text-xs text-gray-400 ${compact ? 'h-32' : 'h-40'}`}
                >
                  {loading ? 'Loading…' : 'Preview unavailable'}
                </div>
              )}
              <div className="px-3 py-2 bg-white border-t border-gray-100">
                <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
                <p className="text-[10px] text-gray-400">
                  {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleString('en-IN')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
