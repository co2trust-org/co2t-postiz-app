import { internalFetch } from '@gitroom/helpers/utils/internal.fetch';
import { VideoOrImage } from '@gitroom/react/helpers/video.or.image';
import { getT } from '@gitroom/react/translation/get.translation.service.backend';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import Link from 'next/link';
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

dayjs.extend(utc);

export const dynamic = 'force-dynamic';

type PortalPost = {
  id: string;
  state: string;
  content: string | null;
  image: string | null;
  publishDate: string;
  releaseURL: string | null;
  integration: {
    name: string;
    picture: string | null;
    providerIdentifier: string;
    profile: string | null;
  } | null;
  tags: { id: string; name: string; color: string }[];
};

type PortalFeedResponse = {
  slug: string;
  title: string;
  tags: string[];
  showDraftsFromChannels?: boolean;
  page: number;
  limit: number;
  total: number;
  posts: PortalPost[];
};

async function loadFeed(slug: string, page: number): Promise<PortalFeedResponse | null> {
  const res = await internalFetch(
    `/public/portal/${encodeURIComponent(slug)}?page=${page}&limit=20`
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    return null;
  }
  return res.json();
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const data = await loadFeed(slug, 0);
  const base = isGeneralServerSide() ? 'Postiz' : 'Gitroom';
  if (!data) {
    return { title: `${base} — Portal` };
  }
  return {
    title: `${data.title} — ${base}`,
    description:
      data.tags.length > 0
        ? `Posts tagged: ${data.tags.join(', ')}`
        : data.showDraftsFromChannels
          ? 'Published and website-only draft posts'
          : 'Published posts',
  };
}

export default async function PortalPage(props: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ page?: string }>;
}) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;
  const pageRaw = parseInt(searchParams?.page ?? '0', 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 0 ? pageRaw : 0;

  const [data, t] = await Promise.all([loadFeed(slug, page), getT()]);
  if (!data) {
    notFound();
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));
  const hasPrev = page > 0;
  const hasNext = page + 1 < totalPages;

  return (
    <div className="text-white mx-auto w-full max-w-[900px] px-4 py-8">
      <header className="mb-10 border-b border-tableBorder pb-6">
        <p className="text-sm text-gray-400 mb-1">
          {t('public_portal_label', 'Public portal')}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{data.title}</h1>
        {data.tags.length > 0 && (
          <p className="text-sm text-gray-400 mt-2">
            {t('filtered_by_tags', 'Filtered by tags')}:{' '}
            <span className="text-textColor">{data.tags.join(', ')}</span>
          </p>
        )}
        <p className="text-xs text-gray-500 mt-3">
          {data.showDraftsFromChannels
            ? t(
                'showing_published_and_site_drafts',
                'Showing published posts and drafts saved to your website-only channel(s).'
              )
            : t('showing_published_only', 'Showing published posts only')}
          .
        </p>
      </header>

      {data.posts.length === 0 ? (
        <div className="text-center text-gray-400 py-16 text-[15px]">
          {t(
            'public_portal_empty',
            data.showDraftsFromChannels
              ? 'No posts match this portal yet.'
              : 'No published posts yet for this portal.'
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-8">
          {data.posts.map((post) => (
            <li
              key={post.id}
              className="bg-third border border-tableBorder rounded-[12px] overflow-hidden"
            >
              <div className="p-4 flex gap-3">
                {post.integration && (
                  <div className="flex shrink-0">
                    <div className="relative w-[50px] h-[50px]">
                      <img
                        className="w-full h-full rounded-full border border-tableBorder object-cover bg-black"
                        alt=""
                        src={post.integration.picture || '/postiz.svg'}
                      />
                      <div className="absolute -end-[4px] -bottom-[4px] w-[26px] h-[26px]">
                        <img
                          className="w-full h-full rounded-full border border-tableBorder bg-black"
                          alt=""
                          src={`/icons/platforms/${post.integration.providerIdentifier}.png`}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold text-sm">
                      {post.integration?.name ?? '—'}
                    </span>
                    {post.integration?.profile && (
                      <span className="text-gray-500 text-sm">
                        @{post.integration.profile}
                      </span>
                    )}
                    <span className="text-gray-500 text-xs ml-auto">
                      {dayjs.utc(post.publishDate).local().format('MMM D, YYYY h:mm A')}
                    </span>
                    {post.state === 'DRAFT' && (
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-950/80 text-amber-100 border border-amber-800/60"
                        title={t(
                          'site_draft_badge_hint',
                          'Draft on a website-only channel; not sent to social platforms.'
                        )}
                      >
                        {t('site_draft_badge', 'Site only')}
                      </span>
                    )}
                  </div>
                  {post.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {post.tags.map((tg) => (
                        <span
                          key={tg.id}
                          className="text-[11px] px-2 py-0.5 rounded-full border border-tableBorder"
                          style={{ borderColor: tg.color || undefined }}
                        >
                          {tg.name}
                        </span>
                      ))}
                    </div>
                  )}
                  <div
                    className="text-sm whitespace-pre-wrap max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: post.content || '',
                    }}
                  />
                  {post.image && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {(() => {
                        try {
                          const imgs = JSON.parse(post.image || '[]') as {
                            name?: string;
                            path: string;
                          }[];
                          return imgs.map((img) => (
                            <div
                              key={img.name || img.path}
                              className="flex-1 min-w-[120px] max-h-[420px] rounded-[10px] overflow-hidden"
                            >
                              <VideoOrImage
                                isContain={true}
                                src={img.path}
                                autoplay={false}
                              />
                            </div>
                          ));
                        } catch {
                          return null;
                        }
                      })()}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 pt-3 text-[13px]">
                    <Link
                      className="text-[#8b7fd6] hover:underline"
                      href={`/p/${post.id}`}
                    >
                      {t('preview_post', 'Preview')}
                    </Link>
                    {post.releaseURL && (
                      <a
                        className="text-[#8b7fd6] hover:underline"
                        href={post.releaseURL}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t('view_original', 'View original')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {(hasPrev || hasNext) && (
        <nav className="flex justify-center gap-6 mt-12 text-sm">
          {hasPrev ? (
            <Link
              className="text-[#8b7fd6] hover:underline"
              href={
                page <= 1
                  ? `/portal/${slug}`
                  : `/portal/${slug}?page=${page - 1}`
              }
            >
              {t('previous', 'Previous')}
            </Link>
          ) : (
            <span className="text-gray-600">{t('previous', 'Previous')}</span>
          )}
          <span className="text-gray-500">
            {t(
              'portal_page_indicator',
              `Page ${page + 1} of ${totalPages}`
            )}
          </span>
          {hasNext ? (
            <Link
              className="text-[#8b7fd6] hover:underline"
              href={`/portal/${slug}?page=${page + 1}`}
            >
              {t('next', 'Next')}
            </Link>
          ) : (
            <span className="text-gray-600">{t('next', 'Next')}</span>
          )}
        </nav>
      )}
    </div>
  );
}
