import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Camera, ChevronLeft, ChevronRight, FolderOpen, ImageOff, Loader2, X,
} from 'lucide-react';
import {
  fetchGalleryAlbums,
  fetchGalleryPhotos,
  formatGalleryDateLabel,
  formatGalleryDateTitle,
  formatPhotoTime,
  type GalleryAlbumSummary,
  type GalleryPhoto,
} from '../lib/galleryFeed';

type AlbumType = 'att' | 'case';

type OpenAlbum = {
  type: AlbumType;
  dateKey: string;
  title: string;
  dateLabel: string;
};

function ThumbStack({ urls, emptyIcon }: { urls: string[]; emptyIcon: React.ReactNode }) {
  if (!urls.length) {
    return (
      <div className="relative w-14 h-14 shrink-0">
        <div className="absolute inset-0 rounded-xl bg-[var(--mn-surface-2)] border border-[var(--mn-border)] grid place-items-center text-[var(--mn-dim)]">
          {emptyIcon}
        </div>
      </div>
    );
  }

  const shown = urls.slice(0, 3);
  return (
    <div className="relative w-14 h-14 shrink-0">
      {shown.map((url, i) => (
        <img
          key={url}
          src={url}
          alt=""
          loading="lazy"
          className="absolute w-11 h-11 rounded-[10px] object-cover border-2 border-[var(--mn-bg)] shadow-md"
          style={{
            top: i * 3,
            left: i * 3,
            zIndex: 3 - i,
            opacity: i === 0 ? 1 : i === 1 ? 0.75 : 0.5,
            transform: i === 0 ? 'none' : `scale(${1 - i * 0.06})`,
          }}
        />
      ))}
    </div>
  );
}

function AlbumRow({
  type,
  dateKey,
  title,
  dateLabel,
  count,
  thumbs,
  isToday,
  onOpen,
}: {
  type: AlbumType;
  dateKey: string;
  title: string;
  dateLabel: string;
  count: number;
  thumbs: string[];
  isToday: boolean;
  onOpen: () => void;
}) {
  const accent = type === 'att' ? 'border-l-cyan-400/60' : 'border-l-violet-400/60';
  const badge =
    type === 'att'
      ? 'bg-cyan-500/12 text-cyan-300'
      : 'bg-violet-500/12 text-violet-300';

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`w-full flex items-center gap-3.5 p-2.5 pr-3 rounded-2xl border border-[var(--mn-border)] bg-[var(--mn-surface)]/80 backdrop-blur-sm text-left transition-all duration-200 hover:bg-[var(--mn-surface-2)] hover:border-[var(--mn-border-strong)] hover:-translate-y-px hover:shadow-lg border-l-[3px] ${accent} ${isToday ? 'ring-1 ring-cyan-500/20' : ''}`}
    >
      <ThumbStack
        urls={thumbs}
        emptyIcon={type === 'att' ? <Camera className="w-5 h-5" /> : <FolderOpen className="w-5 h-5" />}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-[15px] font-semibold tracking-tight text-[var(--mn-text)] truncate">
            {title}
          </h3>
          {isToday && (
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300">
              Today
            </span>
          )}
        </div>
        <p className="text-xs text-[var(--mn-muted)] mt-0.5 truncate">
          {dateLabel} · {type === 'att' ? 'Punch-in selfies' : 'Stage photos submitted'}
        </p>
      </div>
      <span className={`shrink-0 min-w-9 h-9 px-2 rounded-xl grid place-items-center text-sm font-bold ${badge}`}>
        {count}
      </span>
    </button>
  );
}

export function GalleryPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState('');
  const [albums, setAlbums] = useState<GalleryAlbumSummary[]>([]);
  const [attTotal, setAttTotal] = useState(0);
  const [caseTotal, setCaseTotal] = useState(0);

  const [openAlbum, setOpenAlbum] = useState<OpenAlbum | null>(null);
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Add ?token=YOUR_SECRET to the URL');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchGalleryAlbums(token)
      .then((data) => {
        if (cancelled) return;
        setTodayKey(data.todayKey);
        setAlbums(data.albums);
        setAttTotal(data.attTotal);
        setCaseTotal(data.caseTotal);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Failed to load gallery');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const openAlbumView = useCallback(
    async (type: AlbumType, dateKey: string) => {
      const title = formatGalleryDateTitle(dateKey, todayKey);
      const dateLabel = formatGalleryDateLabel(dateKey);
      setOpenAlbum({ type, dateKey, title, dateLabel });
      setPhotos([]);
      setPhotosLoading(true);
      setLightboxIndex(null);

      try {
        const data = await fetchGalleryPhotos(token, dateKey, type);
        setPhotos(data.photos);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load photos');
      } finally {
        setPhotosLoading(false);
      }
    },
    [token, todayKey],
  );

  const goHome = () => {
    setOpenAlbum(null);
    setPhotos([]);
    setLightboxIndex(null);
  };

  const lbStep = useCallback(
    (delta: number) => {
      if (!photos.length || lightboxIndex === null) return;
      setLightboxIndex((lightboxIndex + delta + photos.length) % photos.length);
    },
    [photos.length, lightboxIndex],
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') lbStep(-1);
      if (e.key === 'ArrowRight') lbStep(+1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIndex, lbStep]);

  const attAlbums = useMemo(
    () => albums.filter((a) => a.attCount > 0 || a.dateKey === todayKey),
    [albums, todayKey],
  );
  const caseAlbums = useMemo(
    () => albums.filter((a) => a.caseCount > 0 || a.dateKey === todayKey),
    [albums, todayKey],
  );

  const currentPhoto = lightboxIndex !== null ? photos[lightboxIndex] : null;

  return (
    <div className="min-h-[100dvh] bg-[var(--mn-bg)] text-[var(--mn-text)] bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.07),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(167,139,250,0.05),transparent)]">
      <header className="sticky top-0 z-20 border-b border-[var(--mn-border)] bg-[var(--mn-bg)]/80 backdrop-blur-xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {openAlbum ? (
            <button
              type="button"
              onClick={goHome}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-[var(--mn-border)] bg-[var(--mn-surface)] text-sm font-medium text-[var(--mn-text)] hover:bg-[var(--mn-surface-2)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Albums
            </button>
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-violet-400 grid place-items-center text-sm shadow-lg shadow-cyan-500/20 shrink-0">
              ◆
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-semibold tracking-tight truncate">
              {openAlbum ? openAlbum.title : 'Malcon Gallery'}
            </h1>
            <p className="text-xs text-[var(--mn-muted)] truncate">
              {openAlbum ? openAlbum.dateLabel : 'Attendance & case photos'}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 pb-12">
        {!token && (
          <div className="mt-10 text-center px-6">
            <ImageOff className="w-10 h-10 mx-auto text-[var(--mn-dim)] mb-3" />
            <h2 className="text-lg font-semibold">Gallery link required</h2>
            <p className="text-sm text-[var(--mn-muted)] mt-2">
              Open this page with a secret token, e.g.{' '}
              <code className="text-cyan-300/90">/gallery?token=…</code>
            </p>
          </div>
        )}

        {token && loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-[var(--mn-muted)]">
            <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
            <p className="text-sm">Loading albums…</p>
          </div>
        )}

        {token && !loading && error && !openAlbum && (
          <div className="mt-8 p-4 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 text-sm">
            {error}
          </div>
        )}

        {token && !loading && !openAlbum && !error && (
          <>
            <div className="pt-7 pb-2">
              <h2 className="text-2xl font-bold tracking-tight">Photo albums</h2>
              <p className="text-sm text-[var(--mn-muted)] mt-2 leading-relaxed">
                Punch-in selfies and case stage photos, grouped by date.
              </p>
            </div>

            <section className="mt-7">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="w-7 h-7 rounded-lg bg-cyan-500/12 text-cyan-300 grid place-items-center">
                    <Camera className="w-3.5 h-3.5" />
                  </span>
                  Attendance
                </div>
                <span className="text-xs text-[var(--mn-dim)]">{attTotal} photos</span>
              </div>
              <div className="flex flex-col gap-2">
                {attAlbums.map((a) => (
                  <AlbumRow
                    key={`att-${a.dateKey}`}
                    type="att"
                    dateKey={a.dateKey}
                    title={formatGalleryDateTitle(a.dateKey, todayKey)}
                    dateLabel={formatGalleryDateLabel(a.dateKey)}
                    count={a.attCount}
                    thumbs={a.attThumbs}
                    isToday={a.dateKey === todayKey}
                    onOpen={() => openAlbumView('att', a.dateKey)}
                  />
                ))}
              </div>
            </section>

            <section className="mt-8">
              <div className="flex items-center justify-between mb-3 px-0.5">
                <div className="flex items-center gap-2.5 text-sm font-semibold">
                  <span className="w-7 h-7 rounded-lg bg-violet-500/12 text-violet-300 grid place-items-center">
                    <FolderOpen className="w-3.5 h-3.5" />
                  </span>
                  Cases
                </div>
                <span className="text-xs text-[var(--mn-dim)]">{caseTotal} photos</span>
              </div>
              <div className="flex flex-col gap-2">
                {caseAlbums.map((a) => (
                  <AlbumRow
                    key={`case-${a.dateKey}`}
                    type="case"
                    dateKey={a.dateKey}
                    title={formatGalleryDateTitle(a.dateKey, todayKey)}
                    dateLabel={formatGalleryDateLabel(a.dateKey)}
                    count={a.caseCount}
                    thumbs={a.caseThumbs}
                    isToday={a.dateKey === todayKey}
                    onOpen={() => openAlbumView('case', a.dateKey)}
                  />
                ))}
              </div>
            </section>

            <p className="mt-10 p-4 rounded-xl border border-[var(--mn-border)] bg-[var(--mn-surface)]/50 text-xs text-[var(--mn-dim)] leading-relaxed">
              Attendance selfies stay in cloud ~24 hours, then archive on office PC. Case photos ~30 days in cloud.
            </p>
          </>
        )}

        {openAlbum && (
          <div className="pt-5 animate-in fade-in duration-300">
            <div className="p-4 rounded-2xl border border-[var(--mn-border)] bg-[var(--mn-surface)]/80 mb-4">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full mb-2 ${
                  openAlbum.type === 'att'
                    ? 'bg-cyan-500/12 text-cyan-300'
                    : 'bg-violet-500/12 text-violet-300'
                }`}
              >
                {openAlbum.type === 'att' ? (
                  <>
                    <Camera className="w-3 h-3" /> Attendance
                  </>
                ) : (
                  <>
                    <FolderOpen className="w-3 h-3" /> Cases
                  </>
                )}
              </span>
              <h3 className="text-lg font-bold tracking-tight">{openAlbum.title}</h3>
              <p className="text-sm text-[var(--mn-muted)] mt-1">
                {photosLoading ? 'Loading…' : `${photos.length} photos · ${openAlbum.dateLabel}`}
              </p>
            </div>

            {photosLoading && (
              <div className="flex justify-center py-16">
                <Loader2 className="w-7 h-7 animate-spin text-cyan-400" />
              </div>
            )}

            {!photosLoading && !photos.length && (
              <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-[var(--mn-border)]">
                <div className="text-3xl mb-3 opacity-40">🌙</div>
                <h4 className="font-semibold">No photos in cloud</h4>
                <p className="text-sm text-[var(--mn-muted)] mt-2">
                  Nothing stored for this date — may be archived on office PC.
                </p>
              </div>
            )}

            {!photosLoading && photos.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1 rounded-2xl overflow-hidden bg-[var(--mn-border)]">
                {photos.map((p, i) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="group relative aspect-square bg-[var(--mn-surface)] overflow-hidden"
                  >
                    <img
                      src={p.url}
                      alt={p.cap}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="absolute bottom-0 left-0 right-0 p-2 text-[10px] font-medium text-white truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {p.cap}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {currentPhoto && openAlbum && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightboxIndex(null);
          }}
        >
          <div className="absolute top-0 inset-x-0 flex items-center justify-between p-4 pt-[max(16px,env(safe-area-inset-top))]">
            <span className="text-sm text-[var(--mn-muted)] tabular-nums">
              {(lightboxIndex ?? 0) + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => lbStep(-1)}
            className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>

          <img
            src={currentPhoto.url}
            alt={currentPhoto.cap}
            className="max-w-[min(92vw,720px)] max-h-[62vh] object-contain rounded-lg shadow-2xl"
          />

          <button
            type="button"
            onClick={() => lbStep(+1)}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          <div className="absolute bottom-0 inset-x-0 p-6 pb-[max(24px,env(safe-area-inset-bottom))] text-center bg-gradient-to-t from-black/80 to-transparent">
            <h4 className="text-base font-semibold">{currentPhoto.cap}</h4>
            <p className="text-sm text-[var(--mn-muted)] mt-1">
              {currentPhoto.sub} · {formatPhotoTime(currentPhoto.at)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
