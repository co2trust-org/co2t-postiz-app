/** First displayable URL from Post.image JSON (array of { path } or { id, path }). */
export function getFirstPostMediaUrl(
  imageJson: string | null | undefined
): string | null {
  if (!imageJson?.trim()) return null;
  try {
    const parsed = JSON.parse(imageJson) as unknown;
    if (!Array.isArray(parsed) || !parsed.length) return null;
    const first = parsed[0] as { path?: string; url?: string };
    const raw = first?.path || first?.url;
    if (!raw || typeof raw !== 'string') return null;
    return raw.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Turn stored media paths into URLs that load in the current browser tab.
 * - Same-origin `/uploads/...` must stay relative (or be rewritten to `window.location.origin`)
 *   so we never pin images to a mismatched FRONTEND_URL (e.g. test vs prod).
 * - External CDN URLs (Meta, R2, etc.) are left unchanged.
 */
export function resolveCalendarMediaUrl(raw: string): string {
  if (!raw) return '';

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    if (typeof window === 'undefined') {
      return raw;
    }
    try {
      const u = new URL(raw);
      if (u.pathname.startsWith('/uploads/')) {
        return `${window.location.origin}${u.pathname}${u.search}`;
      }
    } catch {
      /* ignore */
    }
    return raw;
  }

  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.startsWith('/uploads/')) {
    return path;
  }
  // Stored relative path like "2026/04/04/file.jpg" → served under /uploads/
  return `/uploads${path}`;
}
