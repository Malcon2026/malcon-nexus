export interface TvNoticeConfig {
  text: string;
  color: string;
  sepColor: string;
}

export const DEFAULT_TV_NOTICE_COLOR = '#fbbf24';
export const DEFAULT_TV_NOTICE_SEP_COLOR = '#9a8cff';

export const TV_NOTICE_TEXT_COLORS = [
  { label: 'Amber', value: '#fbbf24' },
  { label: 'White', value: '#f4f6fb' },
  { label: 'Red', value: '#f87171' },
  { label: 'Green', value: '#34d399' },
  { label: 'Blue', value: '#93c5fd' },
  { label: 'Violet', value: '#9a8cff' },
  { label: 'Pink', value: '#f472b6' },
  { label: 'Cyan', value: '#22d3ee' },
] as const;

export const TV_NOTICE_SEP_COLORS = [
  { label: 'Violet', value: '#9a8cff' },
  { label: 'Amber', value: '#fbbf24' },
  { label: 'White', value: '#f4f6fb' },
  { label: 'Muted', value: '#5b6478' },
  { label: 'Red', value: '#f87171' },
  { label: 'Green', value: '#34d399' },
] as const;

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Parse stored tv_notice — plain text (legacy) or JSON with colors. */
export function parseTvNotice(raw: string): TvNoticeConfig {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { text: '', color: DEFAULT_TV_NOTICE_COLOR, sepColor: DEFAULT_TV_NOTICE_SEP_COLOR };
  }

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as Partial<TvNoticeConfig>;
      return {
        text: String(parsed.text ?? '').slice(0, 400),
        color: isHexColor(parsed.color) ? parsed.color : DEFAULT_TV_NOTICE_COLOR,
        sepColor: isHexColor(parsed.sepColor) ? parsed.sepColor : DEFAULT_TV_NOTICE_SEP_COLOR,
      };
    } catch {
      /* legacy plain text */
    }
  }

  return {
    text: trimmed.slice(0, 400),
    color: DEFAULT_TV_NOTICE_COLOR,
    sepColor: DEFAULT_TV_NOTICE_SEP_COLOR,
  };
}

/** Serialize for storage; empty text clears the notice. */
export function serializeTvNotice(config: TvNoticeConfig): string {
  const text = config.text.trim().slice(0, 400);
  if (!text) return '';

  const color = isHexColor(config.color) ? config.color : DEFAULT_TV_NOTICE_COLOR;
  const sepColor = isHexColor(config.sepColor) ? config.sepColor : DEFAULT_TV_NOTICE_SEP_COLOR;

  if (color === DEFAULT_TV_NOTICE_COLOR && sepColor === DEFAULT_TV_NOTICE_SEP_COLOR) {
    return JSON.stringify({ text, color, sepColor });
  }
  return JSON.stringify({ text, color, sepColor });
}
