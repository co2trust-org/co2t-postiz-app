'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type TagRow = { id: string; name: string; color: string };

export const MediaTagsEditor: FC<{
  mediaId: string;
  initialSelectedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ mediaId, initialSelectedIds, onClose, onSaved }) => {
  const t = useT();
  const fetch = useFetch();
  const loadTags = useCallback(async () => {
    const r = await fetch('/posts/tags');
    const j = await r.json();
    const list = Array.isArray(j) ? j : j?.tags ?? [];
    return list as TagRow[];
  }, [fetch]);
  const { data: allTags, isLoading } = useSWR('media-tags-editor-tags', loadTags);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(initialSelectedIds)
  );

  useEffect(() => {
    setSelected(new Set(initialSelectedIds));
  }, [initialSelectedIds, mediaId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    const r = await fetch(`/media/${mediaId}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tagIds: [...selected] }),
    });
    if (!r.ok) {
      return;
    }
    onSaved();
    onClose();
  }, [fetch, mediaId, selected, onSaved, onClose]);

  if (isLoading || !allTags) {
    return (
      <div className="text-[14px] p-[12px]">
        {t('loading', 'Loading…')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[16px] p-[4px] min-w-[280px]">
      <div className="flex flex-wrap gap-[8px]">
        {allTags.map((tag) => (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggle(tag.id)}
            className="rounded-full px-[12px] py-[8px] text-[12px] font-[600] border border-newColColor transition-colors"
            style={{
              backgroundColor: selected.has(tag.id) ? `${tag.color}44` : 'transparent',
            }}
          >
            {tag.name}
          </button>
        ))}
      </div>
      {allTags.length === 0 && (
        <div className="text-[13px] text-newTextColor/70">
          {t(
            'media_tags_no_post_tags',
            'Create tags from a post first (post tags are shared with media).'
          )}
        </div>
      )}
      <div className="flex gap-[10px] justify-end">
        <Button secondary onClick={onClose}>
          {t('cancel', 'Cancel')}
        </Button>
        <Button onClick={save}>{t('save', 'Save')}</Button>
      </div>
    </div>
  );
};
