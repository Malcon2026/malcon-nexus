import React from 'react';
import { Camera, ExternalLink } from 'lucide-react';
import type { Document } from '../types';
import { isImageDocument } from '../lib/stagePhotos';

interface StagePhotoGalleryProps {
  documents: Document[];
  title?: string;
  compact?: boolean;
}

export const StagePhotoGallery: React.FC<StagePhotoGalleryProps> = ({
  documents,
  title = 'Submission Photo',
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
      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {photos.map((doc) => (
          <div key={doc.id} className="rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            <a href={doc.url} target="_blank" rel="noopener noreferrer" className="block group">
              <img
                src={doc.url}
                alt={doc.name}
                className={`w-full object-contain bg-black/5 ${compact ? 'max-h-48' : 'max-h-64'}`}
              />
            </a>
            <div className="px-3 py-2 flex items-center justify-between gap-2 bg-white border-t border-gray-100">
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{doc.name}</p>
                <p className="text-[10px] text-gray-400">
                  {doc.uploadedBy} • {new Date(doc.uploadedAt).toLocaleString('en-IN')}
                </p>
              </div>
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
              >
                <ExternalLink className="h-3 w-3" />
                Open
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
