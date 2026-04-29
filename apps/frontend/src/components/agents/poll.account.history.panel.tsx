'use client';

import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import clsx from 'clsx';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import useSWR from 'swr';
import { expandPosts } from '@gitroom/helpers/utils/posts.list.minify';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useAddProviderAndConnect } from '@gitroom/frontend/components/launches/add.provider.component';

dayjs.extend(utc);

export const POLL_NOTES_KEY = 'agent.poll.history.notes';
export const POLL_IMAGES_KEY = 'agent.poll.history.images';
export const AGENT_MODEL_KEY = 'agent.ai.model';
export const OPENAI_EXTRAS_KEY = 'agent.openai.extras';

const MAX_CACHED_IMAGES = 6;
const ANALYTICS_POLL_RETRY = 2;
const POLL_SUPPORTED_IDENTIFIERS = ['instagram', 'instagram-standalone', 'facebook'];
export const AGENT_MODEL_OPTIONS = [
  {
    value: 'gpt-5.5',
    label: 'gpt-5.5 (frontier, latest generation)',
  },
  { value: 'gpt-5.4', label: 'gpt-5.4' },
  { value: 'gpt-5.4-mini', label: 'gpt-5.4-mini' },
  { value: 'gpt-5.4-nano', label: 'gpt-5.4-nano (low cost)' },
  { value: 'gpt-5.1', label: 'gpt-5.1' },
  { value: 'gpt-5.1-mini', label: 'gpt-5.1-mini' },
  { value: 'gpt-5', label: 'gpt-5' },
  { value: 'gpt-5-mini', label: 'gpt-5-mini' },
  {
    value: 'gpt-4.1',
    label: 'gpt-4.1 (prior gen default)',
  },
  { value: 'gpt-4.1-mini', label: 'gpt-4.1-mini' },
  { value: 'gpt-4.1-nano', label: 'gpt-4.1-nano (cheapest 4.x)' },
  { value: 'gpt-4o', label: 'gpt-4o' },
  { value: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { value: 'o4-mini', label: 'o4-mini (reasoning)' },
  { value: 'o3-mini', label: 'o3-mini (reasoning)' },
];

const MAX_COMPILED_CONTEXT_CHARS = 10000;

export type OpenAiExtras = {
  /** Maps to CopilotKit OpenAIAdapter.disableParallelToolCalls */
  sequentialToolCalls: boolean;
  /** Maps to CopilotKit OpenAIAdapter.keepSystemRole — keep literal "system" role in messages */
  keepSystemRole: boolean;
};

type SocialIntegration = {
  id: string;
  name: string;
  identifier: string;
  disabled?: boolean;
  refreshNeeded?: boolean;
  updatedAt?: string;
};

type CachedImage = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
};

function stripHtml(html: string) {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type PostRow = {
  content?: string;
  publishDate?: string;
  state?: string;
};

export const PollAccountHistoryPanel: FC<{
  aiModel: string;
  onModelChange: (model: string) => void;
  compiledContextPreview: string;
  setCompiledAgentContext: (text: string) => void;
  openAiExtras: OpenAiExtras;
  mergeOpenAiExtras: (next: Partial<OpenAiExtras>) => void;
}> = ({
  aiModel,
  onModelChange,
  compiledContextPreview,
  setCompiledAgentContext,
  openAiExtras,
  mergeOpenAiExtras,
}) => {
  const fetch = useFetch();
  const t = useT();
  const connectInstagram = useAddProviderAndConnect('instagram');
  const connectFacebook = useAddProviderAndConnect('facebook');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [dateRange, setDateRange] = useState(30);
  const [isPolling, setIsPolling] = useState(false);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [pollError, setPollError] = useState('');
  const [postsError, setPostsError] = useState('');
  const [lastPolledAt, setLastPolledAt] = useState('');
  const [lastPostsSyncedAt, setLastPostsSyncedAt] = useState('');
  const [pollResult, setPollResult] = useState<any[]>([]);
  const [postsSnapshot, setPostsSnapshot] = useState<PostRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [debouncedNotes, setDebouncedNotes] = useState('');
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([]);
  const [includeAnalyticsInContext, setIncludeAnalyticsInContext] =
    useState(true);
  const [includePostsInContext, setIncludePostsInContext] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(false);

  const loadIntegrations = useCallback(async () => {
    const response = await fetch('/integrations/list');
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      return [];
    }
    if (!response.ok) {
      return [];
    }
    const raw =
      data && typeof data === 'object' && data !== null && 'integrations' in data
        ? (data as { integrations: unknown }).integrations
        : undefined;
    return Array.isArray(raw) ? raw : [];
  }, [fetch]);

  const { data: integrations } = useSWR<SocialIntegration[]>(
    'agent-poll-history-integrations',
    loadIntegrations,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      revalidateOnMount: true,
      refreshWhenHidden: false,
      refreshWhenOffline: false,
      fallbackData: [],
    }
  );

  const socialIntegrations = useMemo(() => {
    return (integrations || []).filter((item) =>
      POLL_SUPPORTED_IDENTIFIERS.includes(item.identifier)
    );
  }, [integrations]);

  const selectedIntegration = useMemo(() => {
    return socialIntegrations.find((item) => item.id === selectedIntegrationId);
  }, [socialIntegrations, selectedIntegrationId]);

  useEffect(() => {
    if (!socialIntegrations.length) {
      setSelectedIntegrationId('');
      return;
    }

    if (
      !selectedIntegrationId ||
      !socialIntegrations.some((item) => item.id === selectedIntegrationId)
    ) {
      setSelectedIntegrationId(socialIntegrations[0].id);
    }
  }, [socialIntegrations, selectedIntegrationId]);

  useEffect(() => {
    const savedText = localStorage.getItem(POLL_NOTES_KEY);
    if (savedText) {
      setNoteText(savedText);
      setDebouncedNotes(savedText);
    }

    const savedImages = localStorage.getItem(POLL_IMAGES_KEY);
    if (savedImages) {
      try {
        const parsed = JSON.parse(savedImages) as CachedImage[];
        setCachedImages(Array.isArray(parsed) ? parsed : []);
      } catch {
        setCachedImages([]);
      }
    }

  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedNotes(noteText), 400);
    return () => window.clearTimeout(timer);
  }, [noteText]);

  useEffect(() => {
    localStorage.setItem(POLL_NOTES_KEY, noteText);
  }, [noteText]);

  const saveModel = useCallback(
    (model: string) => {
      onModelChange(model);
      localStorage.setItem(AGENT_MODEL_KEY, model);
    },
    [onModelChange]
  );

  const pollAnalytics = useCallback(async () => {
    if (!selectedIntegrationId) return;
    setIsPolling(true);
    setPollError('');
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt <= ANALYTICS_POLL_RETRY; attempt++) {
      try {
        const response = await fetch(
          `/analytics/${selectedIntegrationId}?date=${dateRange}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setPollResult(Array.isArray(data) ? data : []);
        setLastPolledAt(dayjs().format('MMM D, YYYY h:mm A'));
        setIsPolling(false);
        return;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        if (attempt < ANALYTICS_POLL_RETRY) {
          await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        }
      }
    }
    console.warn('[agent] poll account history failed', lastErr);
    setPollError(
      t(
        'unable_to_poll_account_history',
        'Unable to poll account history for this channel right now.'
      ) + (lastErr?.message ? ` (${lastErr.message})` : '')
    );
    setPollResult([]);
    setIsPolling(false);
  }, [selectedIntegrationId, dateRange, t, fetch]);

  const loadPostizPublishedPosts = useCallback(async () => {
    if (!selectedIntegrationId) return;
    setIsLoadingPosts(true);
    setPostsError('');
    try {
      const end = dayjs.utc();
      const start = end.subtract(dateRange, 'day');
      const params = new URLSearchParams({
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        integrationId: selectedIntegrationId,
      });
      const response = await fetch(`/posts/?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const raw = await response.json();
      const data = expandPosts(raw);
      const rows = Array.isArray(data.posts)
        ? (data.posts as PostRow[])
        : [];
      const published = rows
        .filter((p) => p.state === 'PUBLISHED')
        .sort((a, b) => {
          const ta = dayjs.utc(a.publishDate ?? 0).valueOf();
          const tb = dayjs.utc(b.publishDate ?? 0).valueOf();
          return tb - ta;
        });
      setPostsSnapshot(published.slice(0, 24));
      setLastPostsSyncedAt(dayjs().format('MMM D, YYYY h:mm A'));
    } catch (e) {
      setPostsSnapshot([]);
      setPostsError(
        t(
          'agent_posts_context_load_failed',
          'Could not load Postiz calendar posts for this channel.'
        ) + (e instanceof Error ? ` (${e.message})` : '')
      );
    } finally {
      setIsLoadingPosts(false);
    }
  }, [selectedIntegrationId, dateRange, t, fetch]);

  const refreshAllSources = useCallback(async () => {
    await pollAnalytics();
    await loadPostizPublishedPosts();
  }, [pollAnalytics, loadPostizPublishedPosts]);

  const compileAgentContext = useCallback(() => {
    const integrationLabel =
      selectedIntegration?.name ?? t('unknown_channel', 'Channel');
    const parts: string[] = [];

    if (includeAnalyticsInContext && pollResult.length && selectedIntegration) {
      parts.push(
        `## ${integrationLabel} — platform analytics (rollup, last ${dateRange} days)`
      );
      for (const item of pollResult) {
        const total = (item?.data || []).reduce(
          (acc: number, curr: { total: number }) =>
            acc + (typeof curr.total === 'number' ? curr.total : 0),
          0
        );
        parts.push(`- ${item.label}: ${new Intl.NumberFormat().format(total)}`);
      }
    }

    if (includePostsInContext && postsSnapshot.length && selectedIntegration) {
      parts.push(
        `## ${integrationLabel} — published posts in Postiz (${postsSnapshot.length} in range, excerpts)`
      );
      for (const p of postsSnapshot) {
        const excerpt = stripHtml(p.content ?? '').slice(0, 280);
        const d = dayjs.utc(p.publishDate).format('YYYY-MM-DD HH:mm UTC');
        parts.push(`- ${d}: ${excerpt || '(empty)'}`);
      }
    }

    if (debouncedNotes.trim()) {
      parts.push('## Operator notes');
      parts.push(debouncedNotes.trim());
    }

    if (cachedImages.length) {
      parts.push(
        `The user pinned ${cachedImages.length} reference image(s) in the agent panel — they should attach relevant ones in chat if needed.`
      );
    }

    const text = parts.join('\n\n').slice(0, MAX_COMPILED_CONTEXT_CHARS);
    setCompiledAgentContext(text);
  }, [
    cachedImages.length,
    dateRange,
    debouncedNotes,
    includeAnalyticsInContext,
    includePostsInContext,
    pollResult,
    postsSnapshot,
    selectedIntegration,
    setCompiledAgentContext,
    t,
  ]);

  useEffect(() => {
    compileAgentContext();
  }, [compileAgentContext]);

  const toggleExtra = useCallback(
    (patch: Partial<OpenAiExtras>) => {
      mergeOpenAiExtras(patch);
    },
    [mergeOpenAiExtras]
  );

  const toDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const cacheImages = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      if (!files.length) return;
      const next = [...cachedImages];

      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          continue;
        }
        if (next.length >= MAX_CACHED_IMAGES) {
          break;
        }
        const dataUrl = await toDataUrl(file);
        next.push({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl,
        });
      }

      setCachedImages(next);
      localStorage.setItem(POLL_IMAGES_KEY, JSON.stringify(next));
      event.target.value = '';
    },
    [cachedImages, toDataUrl]
  );

  const removeCachedImage = useCallback(
    (index: number) => {
      const next = cachedImages.filter((_, i) => i !== index);
      setCachedImages(next);
      localStorage.setItem(POLL_IMAGES_KEY, JSON.stringify(next));
    },
    [cachedImages]
  );

  return (
    <div className="w-full bg-newTableHeader border border-newTableBorder rounded-[12px] p-[12px]">
      <div className="flex flex-wrap gap-[10px] items-start justify-between mb-[10px]">
        <div className="min-w-[200px]">
          <button
            type="button"
            className="flex items-center gap-[6px] text-start"
            onClick={() => setPanelCollapsed((x) => !x)}
          >
            <span className="text-[14px] font-[600]">
              {t('poll_account_history', 'Channel context & polls')}
            </span>
            <span className="text-[11px] opacity-60">{panelCollapsed ? '▸' : '▾'}</span>
          </button>
          <p className="text-[11px] opacity-70 mt-[2px] max-w-[520px]">
            {t(
              'poll_account_help',
              'Pull Meta analytics plus your Postiz published history into the assistant. Notes and previews are wired into Copilot—not just decorative.'
            )}
          </p>
        </div>

        {!panelCollapsed && (
          <div className="flex flex-wrap gap-[8px] items-center justify-end">
            <div className="flex items-center gap-[6px]">
              <span className="text-[12px] opacity-70">
                {t('ai_model', 'AI Model')}
              </span>
              <select
                className="h-[32px] rounded-[8px] bg-newBgColorInner border border-newTableBorder px-[8px] text-[12px] max-w-[160px]"
                value={aiModel}
                onChange={(e) => saveModel(e.target.value)}
              >
                {AGENT_MODEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <details className="relative">
              <summary className="list-none cursor-pointer rounded-[8px] border border-newTableBorder bg-newBgColorInner px-[10px] py-[6px] text-[12px] whitespace-nowrap">
                {t('openai_interface_options', 'OpenAI routing')}
              </summary>
              <div className="absolute end-0 z-10 mt-[6px] w-[min(340px,calc(100vw-48px))] rounded-[10px] border border-newTableBorder bg-newTableHeader p-[10px] text-[11px] shadow-lg space-y-[8px]">
                <label className="flex gap-[8px] items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-[2px]"
                    checked={openAiExtras.sequentialToolCalls}
                    onChange={(e) =>
                      toggleExtra({ sequentialToolCalls: e.target.checked })
                    }
                  />
                  <span>
                    {t(
                      'copilot_disable_parallel_tools',
                      'Run tool calls sequentially (CopilotKit: disable parallel tools). Use when ordering matters.'
                    )}
                  </span>
                </label>
                <label className="flex gap-[8px] items-start cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-[2px]"
                    checked={openAiExtras.keepSystemRole}
                    onChange={(e) =>
                      toggleExtra({ keepSystemRole: e.target.checked })
                    }
                  />
                  <span>
                    {t(
                      'copilot_keep_system_role',
                      'Preserve legacy “system” message role instead of rewriting to newer developer-style roles.'
                    )}
                  </span>
                </label>
              </div>
            </details>

            <button
              type="button"
              onClick={connectInstagram}
              className="text-[11px] px-[8px] py-[6px] bg-btnSimple text-btnText rounded-[8px] whitespace-nowrap"
            >
              {t('connect_instagram', 'Instagram')}
            </button>
            <button
              type="button"
              onClick={connectFacebook}
              className="text-[11px] px-[8px] py-[6px] bg-btnSimple text-btnText rounded-[8px] whitespace-nowrap"
            >
              {t('connect_facebook', 'Facebook')}
            </button>
          </div>
        )}
      </div>

      {!panelCollapsed && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-[10px]">
            <div className="xl:col-span-5 rounded-[10px] border border-newTableBorder p-[10px] bg-newBgColorInner flex flex-col gap-[8px]">
              <div className="text-[11px] font-[600] opacity-85">
                {t('analytics_and_posts_controls', 'Data sources')}
              </div>

              <div className="flex flex-wrap gap-[8px] items-end">
                <div className="flex flex-col gap-[4px] min-w-[170px] flex-1">
                  <label className="text-[11px] opacity-70">
                    {t('channel', 'Channel')}
                  </label>
                  <select
                    className="h-[34px] rounded-[8px] bg-newTableHeader px-[8px] text-[12px]"
                    value={selectedIntegrationId}
                    onChange={(e) => setSelectedIntegrationId(e.target.value)}
                  >
                    {!socialIntegrations.length && (
                      <option value="">
                        {t('not_connected', 'Not connected')}
                      </option>
                    )}
                    {socialIntegrations.map((integration) => (
                      <option key={integration.id} value={integration.id}>
                        {integration.name} ({integration.identifier})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-[4px] w-[104px]">
                  <label className="text-[11px] opacity-70">
                    {t('range', 'Range')}
                  </label>
                  <select
                    className="h-[34px] rounded-[8px] bg-newTableHeader px-[8px] text-[12px]"
                    value={dateRange}
                    onChange={(e) => setDateRange(+e.target.value)}
                  >
                    <option value={7}>7 {t('days', 'Days')}</option>
                    <option value={30}>30 {t('days', 'Days')}</option>
                    <option value={90}>90 {t('days', 'Days')}</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-[8px] text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeAnalyticsInContext}
                  onChange={(e) =>
                    setIncludeAnalyticsInContext(e.target.checked)
                  }
                />
                {t('include_poll_analytics_context', 'Include platform analytics rollup')}
              </label>

              <label className="flex items-center gap-[8px] text-[11px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePostsInContext}
                  onChange={(e) => setIncludePostsInContext(e.target.checked)}
                />
                {t('include_postiz_posts_context', 'Include Postiz published post excerpts')}
              </label>

              <div className="flex flex-wrap gap-[8px]">
                <button
                  type="button"
                  onClick={pollAnalytics}
                  disabled={!selectedIntegrationId || isPolling}
                  className="h-[34px] px-[12px] rounded-[8px] bg-btnSimple text-btnText disabled:opacity-50 text-[12px]"
                >
                  {isPolling
                    ? t('polling', 'Polling...')
                    : t('poll_analytics', 'Poll analytics')}
                </button>
                <button
                  type="button"
                  onClick={loadPostizPublishedPosts}
                  disabled={!selectedIntegrationId || isLoadingPosts}
                  className="h-[34px] px-[12px] rounded-[8px] bg-btnSimple text-btnText disabled:opacity-50 text-[12px]"
                >
                  {isLoadingPosts
                    ? t('loading', 'Loading...')
                    : t('load_postiz_posts', 'Load Postiz posts')}
                </button>
                <button
                  type="button"
                  onClick={refreshAllSources}
                  disabled={
                    !selectedIntegrationId || isPolling || isLoadingPosts
                  }
                  className={clsx(
                    'h-[34px] px-[12px] rounded-[8px] text-[12px]',
                    !selectedIntegrationId || isPolling || isLoadingPosts
                      ? 'bg-btnSimple opacity-50'
                      : 'bg-btnPrimary text-btnText'
                  )}
                >
                  {t('refresh_all_sources', 'Refresh all')}
                </button>
              </div>

              <div className="text-[10px] opacity-75 leading-snug flex flex-wrap gap-x-[12px] gap-y-[4px]">
                {selectedIntegration ? (
                  <>
                    <span>
                      {t('status', 'Status')}:&nbsp;
                      {selectedIntegration.disabled
                        ? t('disabled', 'Disabled')
                        : t('active', 'Active')}
                      {selectedIntegration.refreshNeeded &&
                        ` · ${t('refresh_needed', 'Refresh needed')}`}
                    </span>
                    {lastPolledAt && (
                      <span>
                        {t('analytics_updated', 'Analytics')}: {lastPolledAt}
                      </span>
                    )}
                    {lastPostsSyncedAt && (
                      <span>
                        {t('postiz_posts_updated', 'Postiz rows')}:{' '}
                        {lastPostsSyncedAt}
                      </span>
                    )}
                  </>
                ) : (
                  <span>
                    {t(
                      'connect_ig_or_fb_to_poll',
                      'Connect Instagram or Facebook for analytics; Postiz calendar works across channels.'
                    )}
                  </span>
                )}
              </div>

              {pollError && (
                <div className="text-[11px] text-red-400">{pollError}</div>
              )}
              {postsError && (
                <div className="text-[11px] text-orange-400">{postsError}</div>
              )}

              {!!pollResult.length && (
                <div className="flex flex-wrap gap-[6px] max-h-[100px] overflow-y-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor pr-[4px]">
                  {pollResult.map((item: any, index: number) => {
                    const total = (item?.data || []).reduce(
                      (acc: number, curr: { total: number }) =>
                        acc + (typeof curr.total === 'number' ? curr.total : 0),
                      0
                    );
                    return (
                      <div
                        key={`poll-item-${index}`}
                        className="rounded-[6px] border border-newTableBorder px-[8px] py-[4px] bg-newTableHeader min-w-[100px]"
                      >
                        <div className="text-[10px] opacity-75 truncate">
                          {item.label}
                        </div>
                        <div className="text-[14px] font-[700] tabular-nums">
                          {new Intl.NumberFormat().format(total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="xl:col-span-4 rounded-[10px] border border-newTableBorder p-[10px] bg-newBgColorInner flex flex-col gap-[6px] min-h-[160px]">
              <div className="text-[12px] font-[600]">
                {t('account_history_notes', 'Notes')}
              </div>
              <textarea
                className="w-full flex-1 min-h-[88px] max-h-[180px] rounded-[8px] p-[10px] bg-newTableHeader resize-y text-[12px]"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t(
                  'add_notes_about_account_history',
                  'Notes go straight into the assistant (system context): positioning, funnel, voice, bans...'
                )}
              />
              <div className="text-[11px] flex flex-wrap gap-[8px] items-center justify-between">
                <label className="px-[10px] py-[6px] rounded-[8px] bg-btnSimple text-btnText cursor-pointer text-[11px]">
                  {t('cache_images', 'Reference images')}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={cacheImages}
                  />
                </label>
                <span className="opacity-70">{cachedImages.length}/{MAX_CACHED_IMAGES}</span>
              </div>

              {!!cachedImages.length && (
                <div className="grid grid-cols-4 gap-[6px]">
                  {cachedImages.map((image, index) => (
                    <div
                      key={`${image.name}-${index}`}
                      className="relative rounded-[6px] overflow-hidden border border-newTableBorder"
                    >
                      <img
                        src={image.dataUrl}
                        alt={image.name}
                        className="w-full h-[52px] object-cover"
                      />
                      <button
                        type="button"
                        className="absolute top-[2px] end-[2px] bg-black/60 text-white text-[10px] w-[14px] h-[14px] rounded-full leading-[14px] text-center"
                        onClick={() => removeCachedImage(index)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="xl:col-span-3 rounded-[10px] border border-newTableBorder p-[10px] bg-newBgColorInner flex flex-col gap-[6px] min-h-[160px]">
              <div className="text-[12px] font-[600]">
                {t('agent_context_preview', 'What the agent reads')}
              </div>
              <div className="text-[10px] opacity-70 mb-[4px]">
                {compiledContextPreview.length} / {MAX_COMPILED_CONTEXT_CHARS}{' '}
                {t('chars', 'characters')}
              </div>
              <pre className="text-[10px] leading-snug whitespace-pre-wrap break-words flex-1 min-h-[100px] max-h-[200px] overflow-auto rounded-[8px] bg-newTableHeader border border-newTableBorder p-[8px]">
                {compiledContextPreview ||
                  t('no_context_until_poll', 'Run refresh or toggle sources to build context.')}
              </pre>
              {postsSnapshot.length > 0 && (
                <div className="text-[10px] opacity-60">
                  {t(
                    'postiz_posts_in_buffer',
                    `Postiz excerpts loaded: ${postsSnapshot.length}`
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
