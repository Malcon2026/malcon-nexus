import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { Document, Employee } from '../types';
import { isImageDocument, stagePhotoThumbUrlForViewer } from '../lib/stagePhotos';
import { canViewCaseStagePhotos } from '../lib/superAdmin';
import { LazyPhotoViewer, type LazyPhotoItem } from './LazyPhotoViewer';

interface StagePhotoGalleryProps {
  documents: Document[];
  title?: string;
  compact?: boolean;
  viewer?: Pick<Employee, 'email' | 'role'> | null;
}

/**
 * Approval-queue submission photo button.
 *
 * Click-to-load: no thumbnail request happens while the queue renders, and only
 * the thumbnail is fetched when the reviewer opens the viewer.
 */
export const StagePhotoGallery: React.FC<StagePhotoGalleryProps> = ({
  documents,
  title = 'Submission Photos',
  compact = false,
  viewer = null,
}) => {
  const photos = useMemo(() => documents.filter(isImageDocument), [documents]);

  if (photos.length === 0) return null;

  if (!canViewCaseStagePhotos(viewer)) {
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

  const items: LazyPhotoItem[] = photos.map((doc) => ({
    id: doc.id,
    alt: doc.name,
    url: doc.url,
    title: doc.name,
    caption: `${doc.uploadedBy} • ${new Date(doc.uploadedAt).toLocaleString('en-IN')}`,
  }));

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <LazyPhotoViewer
        photos={items}
        label={`View ${title} (${photos.length})`}
        title={title}
        note="Thumbnails only — full-resolution photos are archived separately."
        resolveUrl={(photo) => {
          const doc = photos.find((d) => d.id === photo.id);
          return doc ? stagePhotoThumbUrlForViewer(doc, viewer) : Promise.resolve(null);
        }}
      />
    </div>
  );
};
