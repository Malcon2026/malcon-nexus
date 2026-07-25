/** Allowed tags/attrs for employee notice HTML. */

const ALLOWED_TAGS = new Set([
  'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'P', 'BR', 'DIV', 'SPAN',
  'UL', 'OL', 'LI',
  'A',
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  A: new Set(['href', 'target', 'rel']),
  SPAN: new Set(['style']),
};

function isSafeHref(href: string): boolean {
  const t = href.trim().toLowerCase();
  return t.startsWith('http://') || t.startsWith('https://') || t.startsWith('mailto:');
}

/** Strip unsafe tags/attrs; keep basic formatting only. */
export function sanitizeNoticeHtml(html: string): string {
  if (!html.trim()) return '';

  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = doc.body;

  const walk = (node: Node) => {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        const tag = el.tagName;

        if (!ALLOWED_TAGS.has(tag)) {
          // Unwrap: keep children, drop the tag
          while (el.firstChild) {
            node.insertBefore(el.firstChild, el);
          }
          node.removeChild(el);
          continue;
        }

        // Drop disallowed attributes
        for (const attr of Array.from(el.attributes)) {
          const allowed = ALLOWED_ATTRS[tag];
          if (!allowed || !allowed.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
        }

        if (tag === 'A') {
          const href = el.getAttribute('href') ?? '';
          if (!isSafeHref(href)) {
            el.removeAttribute('href');
          } else {
            el.setAttribute('target', '_blank');
            el.setAttribute('rel', 'noopener noreferrer');
          }
        }

        if (tag === 'SPAN') {
          const style = el.getAttribute('style') ?? '';
          // Only allow color from the palette buttons
          const colorMatch = style.match(/color:\s*([^;]+)/i);
          if (colorMatch) {
            el.setAttribute('style', `color: ${colorMatch[1].trim()}`);
          } else {
            el.removeAttribute('style');
          }
        }

        walk(el);
      } else if (child.nodeType === Node.COMMENT_NODE) {
        node.removeChild(child);
      }
    }
  };

  walk(body);
  return body.innerHTML.trim();
}

/** True when notice has no visible text. */
export function isNoticeEmpty(html: string): boolean {
  const text = html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length === 0;
}

/** Plain-text length for the character counter. */
export function noticeTextLength(html: string): number {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim().length;
}

/** Wrap legacy plain-text notices as a paragraph for the editor. */
export function normalizeNoticeHtml(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeNoticeHtml(trimmed);
  }
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
  return `<p>${escaped}</p>`;
}
