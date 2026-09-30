import React, { useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import type { Document, Employee, StageRecord } from '../../types';
import { isImageDocument, stagePhotoViewUrlForViewer } from '../../lib/stagePhotos';
import { canViewCaseStagePhotos } from '../../lib/superAdmin';

function imageDocs(stage: StageRecord): Document[] {
  return stage.documents.filter(isImageDocument);
}

function galleryMeta(docs: Document[]): string | null {
  if (docs.length === 0) return null;
  const d = docs[0];
  return `${d.uploadedBy} • ${new Date(d.uploadedAt).toLocaleString('en-IN')}`;
}

/** Load signed/view URLs for every image on the case (shared across timeline strips). */
export function useStagePhotoViewUrls(stages: StageRecord[], viewer: Employee) {
  const photos = useMemo(
    () => stages.flatMap((s) => imageDocs(s).map((doc) => ({ stage: s.stage, doc }))),
    [stages],
  );
  const photoKey = useMemo(() => photos.map((p) => p.doc.id).join(','), [photos]);
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
      for (const { doc } of photos) {
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

  return { canView, viewUrls, loading };
}

/** In-timeline photo grid (3-up, iPhone-style squares). Meta line once; no per-photo labels. */
export const CaseStageMiniGallery: React.FC<{
  stage: StageRecord;
  viewUrls: Record<string, string>;
  loading: boolean;
  canView: boolean;
}> = ({ stage, viewUrls, loading, canView }) => {
  const docs = imageDocs(stage);
  if (docs.length === 0) return null;

  if (!canView) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-500">
        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {docs.length} photo{docs.length === 1 ? '' : 's'} — preview restricted
      </p>
    );
  }

  const meta = galleryMeta(docs);

  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-gray-200/80 bg-gray-200/40">
      {meta ? <p className="bg-white/90 px-3 py-2 text-xs text-gray-500">{meta}</p> : null}
      <ul
        className="grid w-3/4 max-w-full grid-cols-3 gap-[2px] sm:gap-[3px]"
        aria-label={`${stage.stage} photos`}
      >
        {docs.map((doc) => {
          const src = viewUrls[doc.id];
          return (
            <li key={doc.id} className="aspect-square min-h-0 bg-gray-100">
              <a
                href={src || doc.url}
                target="_blank"
                rel="noreferrer"
                className="block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-accent)]"
              >
                {src ? (
                  <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full min-h-[21vw] items-center justify-center text-sm text-gray-400 sm:min-h-[90px]">
                    {loading ? '…' : '—'}
                  </span>
                )}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
