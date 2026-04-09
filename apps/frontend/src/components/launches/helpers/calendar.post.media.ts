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

/** Absolute URL for calendar thumbnails (local uploads need site origin + static prefix). */
export function resolveCalendarMediaUrl(
  raw: string,
  frontEndUrl: string,
  uploadDirectory: string
): string {
  if (!raw) return '';
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  const base = (frontEndUrl || '').replace(/\/$/, '');
  const path = raw.startsWith('/') ? raw : `/${raw}`;
  if (path.startsWith('/uploads/')) {
    return `${base}${path}`;
  }
  const dir = (uploadDirectory || 'uploads').replace(/^\//, '').replace(/\/$/, '');
  return `${base}/${dir}${path}`;
}
