import React, { useMemo } from 'react';
import { Lock } from 'lucide-react';
import type { Document, Employee, StageRecord } from '../../types';
import { isImageDocument, stagePhotoThumbUrlForViewer } from '../../lib/stagePhotos';
import { canViewCaseStagePhotos } from '../../lib/superAdmin';
import { LazyPhotoViewer, type LazyPhotoItem } from '../LazyPhotoViewer';

function imageDocs(stage: StageRecord): Document[] {
  return (stage.documents ?? []).filter(isImageDocument);
}

function stagePhotoAltText(
  stageName: string,
  index: number,
  total: number,
  caseNumber?: string,
): string {
  const prefix = caseNumber ? `Case ${caseNumber}, ` : '';
  return `${prefix}${stageName} stage photo ${index + 1} of ${total}`;
}

/**
 * In-timeline stage photo button.
 *
 * Deliberately renders no images: the user must press "View photos" and then only
 * thumbnails are fetched (signed for the private stage-photos bucket).
 */
export const CaseStageMiniGallery: React.FC<{
  stage: StageRecord;
  viewer: Employee;
  caseNumber?: string;
}> = ({ stage, viewer, caseNumber }) => {
  const docs = useMemo(() => imageDocs(stage), [stage]);

  if (docs.length === 0) return null;

  if (!canViewCaseStagePhotos(viewer)) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {docs.length} photo{docs.length === 1 ? '' : 's'} — preview restricted
      </p>
    );
  }

  const photos: LazyPhotoItem[] = docs.map((doc, index) => ({
    id: doc.id,
    alt: stagePhotoAltText(stage.stage, index, docs.length, caseNumber),
    url: doc.url,
    title: doc.name,
    caption: `${doc.uploadedBy} • ${new Date(doc.uploadedAt).toLocaleString('en-IN')}`,
  }));

  return (
    <div className="mt-3">
      <LazyPhotoViewer
        photos={photos}
        title={`${stage.stage} photos`}
        note="Thumbnails only — full-resolution photos are archived separately."
        resolveUrl={(photo) => {
          const doc = docs.find((d) => d.id === photo.id);
          return doc ? stagePhotoThumbUrlForViewer(doc, viewer) : Promise.resolve(null);
        }}
      />
    </div>
  );
};
