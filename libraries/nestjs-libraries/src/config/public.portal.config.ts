export type PublicPortalSlugConfig = {
  organizationId: string;
  tags?: string[];
  title?: string;
  /**
   * Post integration IDs (cuid) for “website-only” / junk channels.
   * DRAFT posts on these integrations are listed on the public portal (same tag rules as published).
   * PUBLISHED posts are unchanged.
   */
  draftChannelIds?: string[];
};

let cached: Record<string, PublicPortalSlugConfig> | null = null;
let cachedRaw: string | undefined;

function loadMap(): Record<string, PublicPortalSlugConfig> {
  const raw = process.env.PUBLIC_PORTAL_SLUGS?.trim();
  if (!raw) {
    return {};
  }
  if (cached && cachedRaw === raw) {
    return cached;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, PublicPortalSlugConfig> = {};
    for (const [slug, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const v = value as Record<string, unknown>;
      const organizationId =
        typeof v.organizationId === 'string' ? v.organizationId.trim() : '';
      if (!organizationId) {
        continue;
      }
      const title = typeof v.title === 'string' ? v.title.trim() : undefined;
      let tags: string[] | undefined;
      if (Array.isArray(v.tags)) {
        tags = v.tags
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter(Boolean);
      }
      let draftChannelIds: string[] | undefined;
      if (Array.isArray(v.draftChannelIds)) {
        draftChannelIds = v.draftChannelIds
          .map((t) => (typeof t === 'string' ? t.trim() : ''))
          .filter(Boolean);
      }
      out[slug.trim()] = {
        organizationId,
        ...(tags?.length ? { tags } : {}),
        ...(title ? { title } : {}),
        ...(draftChannelIds?.length ? { draftChannelIds } : {}),
      };
    }
    cached = out;
    cachedRaw = raw;
    return out;
  } catch {
    cached = {};
    cachedRaw = raw;
    return {};
  }
}

export function getPublicPortalBySlug(
  slug: string
): PublicPortalSlugConfig | null {
  const map = loadMap();
  return map[slug] ?? null;
}
