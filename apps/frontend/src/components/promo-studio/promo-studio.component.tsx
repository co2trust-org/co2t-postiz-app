'use client';

import { FC, useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import Link from 'next/link';
import {
  formatBrandBrainForPrompt,
  loadBrandBrainFromStorage,
} from '@gitroom/frontend/components/agents/brand.brain.model';
import {
  usePromoImageTemplate,
  usePromoImageTemplates,
} from '@gitroom/frontend/components/promo-studio/use-promo-image-templates';

export const PromoStudioComponent: FC = () => {
  const t = useT();
  const fetch = useFetch();
  const { data: templates, isLoading: loadingList, mutate: mutateList } =
    usePromoImageTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: templateDetail, isLoading: loadingDetail } =
    usePromoImageTemplate(selectedId);

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [includeBrandBrain, setIncludeBrandBrain] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [lastMedia, setLastMedia] = useState<{
    id: string;
    path: string;
    tags?: { id: string; name: string; color: string }[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchTags = useCallback(async () => {
    const r = await fetch('/posts/tags');
    const j = await r.json();
    return Array.isArray(j) ? j : j?.tags ?? [];
  }, [fetch]);
  const { data: allTags } = useSWR('promo-studio-post-tags', fetchTags);

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createPrompt, setCreatePrompt] = useState(
    'Promotional graphic for {{headline}}. Campaign: {{campaign}}.'
  );
  const [createStyle, setCreateStyle] = useState(
    'Clean modern social graphic, bold typography, high contrast, no small text.'
  );
  const [createFieldsJson, setCreateFieldsJson] = useState(
    '[\n  {"key":"headline","label":"Headline","placeholder":"Main message"},\n  {"key":"campaign","label":"Campaign","placeholder":"e.g. Biochar on Tour"}\n]'
  );
  const [createDefaultTagIds, setCreateDefaultTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (!templateDetail) {
      return;
    }
    const next: Record<string, string> = {};
    for (const f of templateDetail.fieldSchema || []) {
      next[f.key] = '';
    }
    setVariables(next);
  }, [templateDetail?.id]);

  const generate = useCallback(async () => {
    if (!selectedId) {
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      let brandBrainContext: string | undefined;
      if (includeBrandBrain) {
        brandBrainContext = formatBrandBrainForPrompt(loadBrandBrainFromStorage());
      }
      const r = await fetch(`/promo-image-templates/${selectedId}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          variables,
          includeBrandBrain,
          brandBrainContext,
        }),
      });
      const body = await r.json();
      if (!r.ok) {
        throw new Error(body?.message || 'Generation failed');
      }
      if (body === false) {
        setError(
          t(
            'promo_studio_no_credits',
            'Not enough credits to generate an image.'
          )
        );
        return;
      }
      setLastMedia({
        id: body.id,
        path: body.path,
        tags: body.tags,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }, [selectedId, variables, includeBrandBrain, fetch, t]);

  const createTemplate = useCallback(async () => {
    setError(null);
    let fieldSchema: unknown;
    try {
      fieldSchema = JSON.parse(createFieldsJson || '[]');
    } catch {
      setError('Invalid JSON in field schema');
      return;
    }
    if (!Array.isArray(fieldSchema)) {
      setError('Field schema must be a JSON array');
      return;
    }
    const r = await fetch('/promo-image-templates', {
      method: 'POST',
      body: JSON.stringify({
        name: createName.trim(),
        promptTemplate: createPrompt,
        styleBlock: createStyle.trim() || undefined,
        fieldSchema,
        defaultTagIds: createDefaultTagIds,
      }),
    });
    if (!r.ok) {
      const b = await r.json().catch(() => ({}));
      setError(b?.message || 'Could not create template');
      return;
    }
    await mutateList();
    setShowCreate(false);
    setCreateName('');
  }, [
    createName,
    createPrompt,
    createStyle,
    createFieldsJson,
    createDefaultTagIds,
    fetch,
    mutateList,
  ]);

  const toggleDefaultTag = useCallback((tagId: string) => {
    setCreateDefaultTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }, []);

  return (
    <div className="flex flex-col gap-[20px] max-w-[900px]">
      <div>
        <h1 className="text-[22px] font-[700] mb-[6px]">
          {t('promo_studio', 'Promo Studio')}
        </h1>
        <p className="text-[14px] text-newTextColor/70">
          {t(
            'promo_studio_blurb',
            'Generate promo images from org templates. Optional: include your Brand Brain context from local storage (same as the Brand Brain page).'
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-[10px] items-center">
        <Button secondary onClick={() => setShowCreate((s) => !s)}>
          {showCreate
            ? t('promo_studio_hide_new', 'Hide new template')
            : t('promo_studio_new_template', 'New template')}
        </Button>
        <Link
          href="/media"
          className="text-[14px] text-[#612BD3] hover:underline"
        >
          {t('open_media_library', 'Open Media library')}
        </Link>
        <Link
          href="/brand-brain/new"
          className="text-[14px] text-[#612BD3] hover:underline"
        >
          {t('open_brand_brain', 'Edit Brand Brain')}
        </Link>
      </div>

      {showCreate && (
        <div className="rounded-[12px] border border-newColColor p-[16px] flex flex-col gap-[12px] bg-newBgColorInner">
          <div className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[600]">{t('name', 'Name')}</div>
            <input
              className="h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[600]">
              {t('prompt_template', 'Prompt template')}
            </div>
            <textarea
              className="w-full min-h-[100px] rounded-[8px] border border-newColColor bg-newBgColorInner px-[12px] py-[10px] text-[14px] outline-none focus:border-[#612BD3]"
              value={createPrompt}
              onChange={(e) => setCreatePrompt(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[600]">{t('style_block', 'Style block')}</div>
            <textarea
              className="w-full min-h-[80px] rounded-[8px] border border-newColColor bg-newBgColorInner px-[12px] py-[10px] text-[14px] outline-none focus:border-[#612BD3]"
              value={createStyle}
              onChange={(e) => setCreateStyle(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-[6px]">
            <div className="text-[13px] font-[600]">Field schema (JSON)</div>
            <textarea
              className="w-full min-h-[120px] font-mono text-[12px] rounded-[8px] border border-newColColor bg-newBgColorInner px-[12px] py-[10px] outline-none focus:border-[#612BD3]"
              value={createFieldsJson}
              onChange={(e) => setCreateFieldsJson(e.target.value)}
            />
          </div>
          {Array.isArray(allTags) && allTags.length > 0 && (
            <div className="flex flex-col gap-[8px]">
              <div className="text-[13px] font-[600]">
                {t('default_tags', 'Default tags on generated media')}
              </div>
              <div className="flex flex-wrap gap-[8px]">
                {allTags.map((tag: { id: string; name: string; color: string }) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleDefaultTag(tag.id)}
                    className="rounded-full px-[12px] py-[6px] text-[12px] font-[600] border border-newColColor"
                    style={{
                      backgroundColor: createDefaultTagIds.includes(tag.id)
                        ? `${tag.color}33`
                        : 'transparent',
                    }}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Button onClick={createTemplate} disabled={!createName.trim()}>
            {t('save_template', 'Save template')}
          </Button>
        </div>
      )}

      {error && (
        <div className="rounded-[8px] bg-red-500/10 text-red-200 px-[12px] py-[10px] text-[14px]">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-[10px]">
        <label className="text-[14px] font-[600]">
          {t('template', 'Template')}
        </label>
        <select
          className="h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
          value={selectedId || ''}
          onChange={(e) => {
            const v = e.target.value || null;
            setSelectedId(v);
            setLastMedia(null);
          }}
          disabled={loadingList}
        >
          <option value="">
            {loadingList
              ? t('loading', 'Loading…')
              : t('select_template', 'Select a template')}
          </option>
          {(templates || []).map((tm) => (
            <option key={tm.id} value={tm.id}>
              {tm.name}
            </option>
          ))}
        </select>
      </div>

      {loadingDetail && selectedId && (
        <div className="text-[14px] text-newTextColor/60">
          {t('loading', 'Loading…')}
        </div>
      )}

      {templateDetail && (
        <div className="flex flex-col gap-[14px] rounded-[12px] border border-newColColor p-[16px]">
          {(templateDetail.fieldSchema || []).map((f) => (
            <div key={f.key} className="flex flex-col gap-[6px]">
              <div className="text-[13px] font-[600]">{f.label}</div>
              <input
                placeholder={f.placeholder}
                className="h-[44px] px-[14px] rounded-[8px] bg-newBgColorInner border border-newColColor text-[14px] outline-none focus:border-[#612BD3]"
                value={variables[f.key] ?? ''}
                onChange={(e) =>
                  setVariables((prev) => ({ ...prev, [f.key]: e.target.value }))
                }
              />
            </div>
          ))}

          <label className="flex items-center gap-[10px] cursor-pointer text-[14px]">
            <input
              type="checkbox"
              checked={includeBrandBrain}
              onChange={(e) => setIncludeBrandBrain(e.target.checked)}
            />
            {t('include_brand_brain', 'Include Brand Brain in prompt')}
          </label>

          <Button onClick={generate} disabled={generating || !selectedId}>
            {generating
              ? t('generating', 'Generating…')
              : t('generate_image', 'Generate image')}
          </Button>
        </div>
      )}

      {lastMedia && (
        <div className="rounded-[12px] border border-newColColor p-[16px] flex flex-col gap-[12px]">
          <div className="text-[16px] font-[600]">
            {t('result', 'Result')}
          </div>
          {lastMedia.tags && lastMedia.tags.length > 0 && (
            <div className="flex flex-wrap gap-[6px]">
              {lastMedia.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full px-[10px] py-[4px] text-[11px] font-[600]"
                  style={{ backgroundColor: `${tag.color}33` }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lastMedia.path}
            alt=""
            className="max-w-full max-h-[480px] rounded-[8px] object-contain border border-newColColor"
          />
        </div>
      )}
    </div>
  );
};
