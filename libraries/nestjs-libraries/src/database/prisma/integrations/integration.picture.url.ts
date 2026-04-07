/**
 * Profile / avatar URLs from major social CDNs can be stored as-is. Re-hosting them
 * through LocalStorage produces FRONTEND_URL/uploads/... paths that 404 when the
 * backend write path is not the same volume the Next.js /api/uploads route reads,
 * or when the container filesystem is ephemeral.
 */
export function shouldStoreIntegrationPictureUrlAsIs(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }
  const u = url.toLowerCase();
  return (
    u.includes('facebook.com') ||
    u.includes('fbcdn.net') ||
    u.includes('instagram.com') ||
    u.includes('cdninstagram.com') ||
    u.includes('imagedelivery.net') ||
    u.includes('twimg.com') ||
    u.includes('googleusercontent.com') ||
    u.includes('linkedin.com') ||
    u.includes('licdn.com') ||
    u.includes('pbs.twimg.com')
  );
}
