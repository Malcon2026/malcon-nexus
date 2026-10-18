const IST = 'Asia/Kolkata';

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function istDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: IST });
}

export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

export function recentDateKeys(days: number): string[] {
  const keys: string[] = [];
  const today = todayIST();
  const [y, m, d] = today.split('-').map(Number);
  for (let i = 0; i < days; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d - i, 12, 0, 0));
    keys.push(dt.toLocaleDateString('en-CA', { timeZone: IST }));
  }
  return keys;
}

function isImageUrl(url: string): boolean {
  return (
    /\.(jpg|jpeg|png|webp|gif|heic|heif)(\?|$)/i.test(url) ||
    url.includes('/object/public/') ||
    url.includes('amazonaws.com/')
  );
}

export function isImageDoc(doc: { type?: string; url?: string; name?: string }): boolean {
  if (!doc.url) return false;
  if (doc.type?.startsWith('image/')) return true;
  if (/\.(jpg|jpeg|png|webp|gif|heic|heif)$/i.test(doc.name ?? '')) return true;
  return isImageUrl(doc.url);
}

export type GalleryFeedPhoto = {
  id: string;
  url: string;
  cap: string;
  sub: string;
  at: string;
};
