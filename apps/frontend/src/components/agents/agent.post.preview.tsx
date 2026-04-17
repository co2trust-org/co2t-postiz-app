'use client';

import React, { FC, useMemo } from 'react';
import clsx from 'clsx';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { resolveCalendarMediaUrl } from '@gitroom/frontend/components/launches/helpers/calendar.post.media';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const POST_PREVIEW_START = '[POST_PREVIEW]';
export const POST_PREVIEW_END = '[/POST_PREVIEW]';

export type AgentPostPreviewPayload = {
  type: 'post_preview';
  integration?: {
    id?: string;
    name?: string;
    identifier?: string;
    picture?: string;
  };
  /** HTML body (same as calendar post content). */
  content: string;
  /** Optional extra image URLs (full https or relative upload paths). */
  imageUrls?: string[];
  state?: 'DRAFT' | 'QUEUE' | string;
};

function parsePreviewJson(inner: string): AgentPostPreviewPayload | null {
  try {
    const data = JSON.parse(inner.trim()) as AgentPostPreviewPayload;
    if (data?.type !== 'post_preview' || typeof data.content !== 'string') {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

/**
 * Extract JSON post_preview blocks and return remaining text (markdown/HTML/plain).
 */
export function extractAgentPostPreviews(raw: string): {
  previews: AgentPostPreviewPayload[];
  rest: string;
} {
  if (!raw?.includes(POST_PREVIEW_START)) {
    return { previews: [], rest: raw };
  }
  const previews: AgentPostPreviewPayload[] = [];
  let rest = raw;
  const regex = new RegExp(
    `${escapeRegex(POST_PREVIEW_START)}([\\s\\S]*?)${escapeRegex(POST_PREVIEW_END)}`,
    'g'
  );
  rest = rest.replace(regex, (_m, inner: string) => {
    const p = parsePreviewJson(inner);
    if (p) previews.push(p);
    return '';
  });
  return { previews, rest: rest.trim() };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const AgentPostPreviewCard: FC<{ payload: AgentPostPreviewPayload }> = ({
  payload,
}) => {
  const t = useT();
  const int = payload.integration || {};
  const picture = int.picture?.trim() || '/no-picture.jpg';
  const identifier = int.identifier || 'unknown';
  const name = int.name || identifier;

  const thumbs = useMemo(() => {
    const urls = (payload.imageUrls || [])
      .map((u) => resolveCalendarMediaUrl(u))
      .filter(Boolean);
    return urls.slice(0, 4);
  }, [payload.imageUrls]);

  const plainSnippet = useMemo(
    () =>
      stripHtmlValidation('none', payload.content, false, true, false) ||
      t('no_content', 'no content'),
    [payload.content, t]
  );

  return (
    <div
      className="w-full max-w-[420px] rounded-[10px] overflow-hidden border border-newTableBorder bg-newColColor mb-[12px] text-textColor shadow-sm"
      data-agent-post-preview="true"
    >
      <div className="text-white text-[11px] min-h-[24px] w-full px-[8px] py-[6px] flex items-center gap-[8px] bg-btnPrimary">
        <span className="truncate font-[500]">{name}</span>
        {payload.state === 'DRAFT' && (
          <span className="text-[10px] opacity-90 shrink-0">
            {t('draft', 'Draft')}
          </span>
        )}
      </div>
      <div className="flex gap-[8px] p-[10px] items-start">
        <div className="relative shrink-0 min-w-[40px]">
          <ImageWithFallback
            className="w-[40px] h-[40px] rounded-[8px] object-cover ring-1 ring-newTableBorder"
            src={picture}
            fallbackSrc="/no-picture.jpg"
            width={40}
            height={40}
          />
          <img
            className="w-[18px] h-[18px] rounded-[6px] absolute z-10 top-[26px] end-[-3px] border border-fifth bg-newBgColorInner"
            src={`/icons/platforms/${identifier}.png`}
            alt=""
          />
        </div>
        {thumbs.length > 0 && (
          <div className="flex gap-[6px] shrink-0 flex-wrap">
            {thumbs.map((src, i) => (
              <ImageWithFallback
                key={`${src}-${i}`}
                className="w-[72px] h-[72px] rounded-[8px] object-cover border border-newTableBorder bg-newTableHeader"
                src={src}
                fallbackSrc="/no-picture.jpg"
                width={72}
                height={72}
              />
            ))}
          </div>
        )}
        <div className="flex-1 min-w-0 text-[13px] leading-snug line-clamp-4 text-start">
          {plainSnippet}
        </div>
      </div>
    </div>
  );
};

export const AgentPostPreviewCards: FC<{ previews: AgentPostPreviewPayload[] }> = ({
  previews,
}) => {
  if (!previews.length) return null;
  return (
    <div className="flex flex-col gap-[8px] w-full mb-[10px]">
      {previews.map((p, i) => (
        <AgentPostPreviewCard key={i} payload={p} />
      ))}
    </div>
  );
};
