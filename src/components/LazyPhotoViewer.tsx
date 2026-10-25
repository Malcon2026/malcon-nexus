import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Loader2, X } from 'lucide-react';

export interface LazyPhotoItem {
  id: string;
  alt: string;
  /** Thumbnail URL. May be empty when `resolveUrl` supplies it on open. */
  url?: string | null;
  title?: string;
  caption?: string;
}

export interface LazyPhotoViewerProps {
  photos: LazyPhotoItem[];
  /** Trigger label. Defaults to "View photos (n)". */
  label?: string;
  title?: string;
  note?: string;
  className?: string;
  buttonClassName?: string;
  /** Resolve thumbnail URLs only when the viewer opens (e.g. short-lived signed URLs). */
  resolveUrl?: (photo: LazyPhotoItem) => Promise<string | null>;
}

const DEFAULT_BUTTON =
  'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-[var(--color-accent)]/50 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]';

/**
 * Click-to-load photo viewer.
 *
 * Nothing is requested while the page renders: no <img> tag exists until the user
 * presses the button. Only thumbnails are fetched, and each image is cached in
 * component state so reopening does not re-download.
 */
export const LazyPhotoViewer: React.FC<LazyPhotoViewerProps> = ({
  photos,
  label,
  title = 'Photos',
  note,
  className,
  buttonClassName,
  resolveUrl,
}) => {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openViewer = useCallback(async () => {
    setOpen(true);
    if (Object.keys(urls).length >= photos.length) return;

    setLoading(true);
    const next: Record<string, string> = {};
    await Promise.all(
      photos.map(async (photo) => {
        try {
          const url = resolveUrl ? await resolveUrl(photo) : photo.url ?? null;
          if (url) next[photo.id] = url;
        } catch {
          /* leave this thumb blank; the grid shows a placeholder */
        }
      }),
    );
    setUrls(next);
    setLoading(false);
  }, [photos, resolveUrl, urls]);

  if (photos.length === 0) return null;

  const active = activeId ? photos.find((p) => p.id === activeId) ?? null : null;
  const activeUrl = active ? urls[active.id] : null;

  return (
    <>
      <button
        type="button"
        onClick={() => void openViewer()}
        className={className ? `${buttonClassName ?? DEFAULT_BUTTON} ${className}` : buttonClassName ?? DEFAULT_BUTTON}
      >
        <Camera className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {label ?? `View photos (${photos.length})`}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={() => setOpen(false)}
        >
          <div
            className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {title} · {photos.length}
                </p>
                {note ? <p className="mt-0.5 text-[11px] text-gray-500">{note}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 text-gray-600 hover:bg-gray-50"
                aria-label="Close photos"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
              {loading ? (
                <p className="flex items-center justify-center gap-2 py-10 text-xs text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading thumbnails…
                </p>
              ) : (
                <>
                  {active && (
                    <div className="mb-3 overflow-hidden rounded-xl bg-black">
                      {activeUrl ? (
                        <img
                          src={activeUrl}
                          alt={active.alt}
                          className="mx-auto max-h-[55vh] w-auto object-contain"
                        />
                      ) : (
                        <p className="py-10 text-center text-xs text-gray-300">
                          Thumbnail unavailable
                        </p>
                      )}
                    </div>
                  )}

                  <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
                    {photos.map((photo) => {
                      const src = urls[photo.id];
                      return (
                        <li key={photo.id}>
                          <button
                            type="button"
                            onClick={() => setActiveId(photo.id)}
                            className={`block w-full overflow-hidden rounded-lg border bg-gray-50 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
                              activeId === photo.id
                                ? 'border-[var(--color-accent)]'
                                : 'border-gray-200 hover:border-[var(--color-accent)]/60'
                            }`}
                          >
                            <span className="block aspect-square overflow-hidden bg-gray-100">
                              {src ? (
                                <img
                                  src={src}
                                  alt={photo.alt}
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <span className="flex h-full items-center justify-center text-[11px] text-gray-400">
                                  —
                                </span>
                              )}
                            </span>
                            {photo.title || photo.caption ? (
                              <span className="block px-1.5 py-1.5">
                                {photo.title ? (
                                  <span className="block truncate text-[11px] font-semibold text-gray-900">
                                    {photo.title}
                                  </span>
                                ) : null}
                                {photo.caption ? (
                                  <span className="block truncate text-[10px] text-gray-500">
                                    {photo.caption}
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
