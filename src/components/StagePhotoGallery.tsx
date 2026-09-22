import React from 'react';
import { Camera } from 'lucide-react';
import type { Document } from '../types';
import { isImageDocument, stagePhotoDisplayUrl } from '../lib/stagePhotos';

interface StagePhotoGalleryProps {
  documents: Document[];
  title?: string;
  compact?: boolean;
}

export const StagePhotoGallery: React.FC<StagePhotoGalleryProps> = ({
  documents,
  title = 'Submission Photos',
  compact = false,
}) => {
  const photos = documents.filter(isImageDocument);
  if (photos.length === 0) return null;

  return (
    <div className={compact ? 'mt-3' : 'mt-4'}>
      <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
        <Camera className="h-3.5 w-3.5" />
        {title}
      </p>
      <p className="text-[10px] text-gray-400 mb-2">
        Preview only. For full quality, use office PC or Google Drive archive.
      </p>
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {photos.map((doc) => (
          <div key={doc.id} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            <img
              src={stagePhotoDisplayUrl(doc)}
              alt={doc.name}
              className={`w-full object-contain bg-black/5 ${compact ? 'max-h-48' : 'max-h-64'}`}
            />
            <div className="px-3 py-2 bg-white border-t border-gray-100">
              <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
              <p className="text-[10px] text-gray-400">
                {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
