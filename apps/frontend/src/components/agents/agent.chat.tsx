'use client';

import React, {
  FC,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { CopilotChat, CopilotKitCSSProperties } from '@copilotkit/react-ui';
import {
  InputProps,
  UserMessageProps,
} from '@copilotkit/react-ui/dist/components/chat/props';
import { Input } from '@gitroom/frontend/components/agents/agent.input';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import {
  CopilotKit,
  useCopilotAction,
  useCopilotMessagesContext,
} from '@copilotkit/react-core';
import {
  MediaPortal,
  PropertiesContext,
} from '@gitroom/frontend/components/agents/agent';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useParams } from 'next/navigation';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import {
  MessageRole,
  TextMessage,
} from '@copilotkit/runtime-client-gql';
import { AddEditModal } from '@gitroom/frontend/components/new-launch/add.edit.modal';
import dayjs from 'dayjs';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { ExistingDataContextProvider } from '@gitroom/frontend/components/launches/helpers/use.existing.data';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import useSWR from 'swr';
import { useAddProviderAndConnect } from '@gitroom/frontend/components/launches/add.provider.component';

const POLL_NOTES_KEY = 'agent.poll.history.notes';
const POLL_IMAGES_KEY = 'agent.poll.history.images';
const AGENT_MODEL_KEY = 'agent.ai.model';
const MAX_CACHED_IMAGES = 6;
const ANALYTICS_POLL_RETRY = 2;
const POLL_SUPPORTED_IDENTIFIERS = ['instagram', 'instagram-standalone', 'facebook'];
const AGENT_MODEL_OPTIONS = [
  {
    value: 'gpt-4.1',
    label: 'gpt-4.1',
  },
  {
    value: 'gpt-4.1-mini',
    label: 'gpt-4.1-mini',
  },
  {
    value: 'gpt-4.1-nano',
    label: 'gpt-4.1-nano (cheapest)',
  },
];
const MAX_THREAD_MESSAGES = 200;
const MAX_MESSAGE_CONTENT_CHARS = 12000;
const MAX_PROMPT_CHARS = 8000;
const MAX_INTEGRATION_CONTEXT_LENGTH = 3500;
const MAX_INTEGRATIONS_IN_CONTEXT = 20;

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

export const AgentChat: FC = () => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id?: string }>();
  const { properties } = useContext(PropertiesContext);
  const t = useT();
  const [aiModel, setAiModel] = useState('gpt-4.1');
  const threadId = typeof params?.id === 'string' ? params.id : 'new';

  useEffect(() => {
    const savedModel = localStorage.getItem(AGENT_MODEL_KEY);
    if (
      savedModel &&
      AGENT_MODEL_OPTIONS.some((option) => option.value === savedModel)
    ) {
      setAiModel(savedModel);
    }
  }, []);

  return (
    <CopilotKit
      key={`agent-thread-${threadId}`}
      {...(threadId === 'new' ? {} : { threadId })}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
        aiModel,
      }}
    >
      <Hooks />
      <LoadMessages id={threadId} />
      <div
        style={
          {
            '--copilot-kit-primary-color': 'var(--new-btn-text)',
            '--copilot-kit-background-color': 'var(--new-bg-color)',
          } as CopilotKitCSSProperties
        }
        className="trz agent bg-newBgColorInner flex flex-col gap-[15px] transition-all flex-1 items-center relative"
      >
        <div className="absolute left-0 w-full h-full pb-[20px] px-[20px] pt-[20px] flex flex-col gap-[12px]">
          <PollAccountHistoryPanel aiModel={aiModel} onModelChange={setAiModel} />
          <div className="w-full flex-1 min-h-0">
            <CopilotChat
              className="w-full h-full"
              labels={{
                title: t('your_assistant', 'Your Assistant'),
                initial: t('agent_welcome_message', `Hello, I am your Postiz agent 🙌🏻.
              
I can schedule a post or multiple posts to multiple channels and generate pictures and videos.

You can select the channels you want to use from the left menu.

You can see your previous conversations from the right menu.

You can also use me as an MCP Server, check Settings >> Public API
`),
              }}
              UserMessage={Message}
              Input={NewInput}
            />
          </div>
        </div>
      </div>
    </CopilotKit>
  );
};

const PollAccountHistoryPanel: FC<{
  aiModel: string;
  onModelChange: (model: string) => void;
}> = ({ aiModel, onModelChange }) => {
  const fetch = useFetch();
  const t = useT();
  const connectInstagram = useAddProviderAndConnect('instagram');
  const connectFacebook = useAddProviderAndConnect('facebook');
  const [selectedIntegrationId, setSelectedIntegrationId] = useState('');
  const [dateRange, setDateRange] = useState(30);
  const [isPolling, setIsPolling] = useState(false);
  const [pollError, setPollError] = useState('');
  const [lastPolledAt, setLastPolledAt] = useState('');
  const [pollResult, setPollResult] = useState<any[]>([]);
  const [noteText, setNoteText] = useState('');
  const [cachedImages, setCachedImages] = useState<CachedImage[]>([]);

  const loadIntegrations = useCallback(async () => {
    const response = await fetch('/integrations/list');
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return data?.integrations || [];
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

  const pollHistory = useCallback(async () => {
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

  const saveNotes = useCallback((value: string) => {
    setNoteText(value);
    localStorage.setItem(POLL_NOTES_KEY, value);
  }, []);

  const saveModel = useCallback(
    (model: string) => {
      onModelChange(model);
      localStorage.setItem(AGENT_MODEL_KEY, model);
    },
    [onModelChange]
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
      <div className="flex items-center justify-between gap-[10px] mb-[10px]">
        <h3 className="text-[15px] font-[600]">
          {t('poll_account_history', 'Poll Account History')}
        </h3>
        <div className="flex gap-[8px] items-center">
          <div className="flex items-center gap-[6px]">
            <span className="text-[12px] opacity-70">
              {t('ai_model', 'AI Model')}
            </span>
            <select
              className="h-[32px] rounded-[8px] bg-newBgColorInner border border-newTableBorder px-[8px] text-[12px]"
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
          <button
            onClick={connectInstagram}
            className="text-[12px] px-[10px] py-[6px] bg-btnSimple text-btnText rounded-[8px]"
          >
            {t('connect_instagram', 'Connect Instagram')}
          </button>
          <button
            onClick={connectFacebook}
            className="text-[12px] px-[10px] py-[6px] bg-btnSimple text-btnText rounded-[8px]"
          >
            {t('connect_facebook', 'Connect Facebook')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-[12px]">
        <div className="rounded-[10px] border border-newTableBorder p-[10px] bg-newBgColorInner">
          <div className="flex flex-wrap items-end gap-[10px]">
            <div className="flex flex-col gap-[4px] min-w-[200px]">
              <label className="text-[12px] opacity-70">
                {t('channel', 'Channel')}
              </label>
              <select
                className="h-[36px] rounded-[8px] bg-newTableHeader px-[10px]"
                value={selectedIntegrationId}
                onChange={(e) => setSelectedIntegrationId(e.target.value)}
              >
                {!socialIntegrations.length && (
                  <option value="">{t('not_connected', 'Not connected')}</option>
                )}
                {socialIntegrations.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name} ({integration.identifier})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-[4px] min-w-[120px]">
              <label className="text-[12px] opacity-70">
                {t('range', 'Range')}
              </label>
              <select
                className="h-[36px] rounded-[8px] bg-newTableHeader px-[10px]"
                value={dateRange}
                onChange={(e) => setDateRange(+e.target.value)}
              >
                <option value={7}>7 {t('days', 'Days')}</option>
                <option value={30}>30 {t('days', 'Days')}</option>
                <option value={90}>90 {t('days', 'Days')}</option>
              </select>
            </div>
            <button
              onClick={pollHistory}
              disabled={!selectedIntegrationId || isPolling}
              className="h-[36px] px-[12px] rounded-[8px] bg-btnPrimary text-btnText disabled:opacity-50"
            >
              {isPolling
                ? t('polling', 'Polling...')
                : t('poll_now', 'Poll Now')}
            </button>
          </div>

          <div className="mt-[10px] text-[12px] opacity-80">
            {selectedIntegration ? (
              <div className="flex flex-wrap gap-[10px]">
                <span>
                  {t('status', 'Status')}:&nbsp;
                  {selectedIntegration.disabled
                    ? t('disabled', 'Disabled')
                    : t('active', 'Active')}
                </span>
                {selectedIntegration.refreshNeeded && (
                  <span>{t('refresh_needed', 'Refresh needed')}</span>
                )}
                {lastPolledAt && (
                  <span>
                    {t('last_polled', 'Last polled')}: {lastPolledAt}
                  </span>
                )}
              </div>
            ) : (
              <span>
                {t(
                  'connect_ig_or_fb_to_poll',
                  'Connect Instagram or Facebook to poll account history.'
                )}
              </span>
            )}
          </div>

          {pollError && (
            <div className="mt-[8px] text-[12px] text-red-400">{pollError}</div>
          )}

          {!!pollResult.length && (
            <div className="mt-[10px] grid grid-cols-1 sm:grid-cols-2 gap-[8px]">
              {pollResult.map((item: any, index: number) => {
                const total = (item?.data || []).reduce(
                  (acc: number, curr: { total: number }) => acc + curr.total,
                  0
                );
                return (
                  <div
                    key={`poll-item-${index}`}
                    className="rounded-[8px] border border-newTableBorder px-[10px] py-[8px] bg-newTableHeader"
                  >
                    <div className="text-[12px] opacity-80">{item.label}</div>
                    <div className="text-[18px] font-[600]">
                      {new Intl.NumberFormat().format(total)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[10px] border border-newTableBorder p-[10px] bg-newBgColorInner flex flex-col gap-[8px]">
          <div className="text-[13px] font-[600]">
            {t('account_history_notes', 'Account History Notes')}
          </div>
          <textarea
            className="w-full min-h-[100px] rounded-[8px] p-[10px] bg-newTableHeader resize-y"
            value={noteText}
            onChange={(e) => saveNotes(e.target.value)}
            placeholder={t(
              'add_notes_about_account_history',
              'Add notes about account history, audience patterns, and campaign learnings...'
            )}
          />
          <div className="flex items-center justify-between gap-[10px]">
            <label className="text-[12px] px-[10px] py-[6px] rounded-[8px] bg-btnSimple text-btnText cursor-pointer">
              {t('cache_images', 'Cache Images')}
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={cacheImages}
              />
            </label>
            <div className="text-[11px] opacity-70">
              {cachedImages.length}/{MAX_CACHED_IMAGES}
            </div>
          </div>
          {!!cachedImages.length && (
            <div className="grid grid-cols-3 gap-[8px]">
              {cachedImages.map((image, index) => (
                <div
                  key={`${image.name}-${index}`}
                  className="relative rounded-[8px] overflow-hidden border border-newTableBorder"
                >
                  <img
                    src={image.dataUrl}
                    alt={image.name}
                    className="w-full h-[68px] object-cover"
                  />
                  <button
                    type="button"
                    className="absolute top-[4px] end-[4px] bg-black/60 text-white text-[10px] w-[16px] h-[16px] rounded-full"
                    onClick={() => removeCachedImage(index)}
                  >
                    x
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function mapRoleToCopilot(
  role: string
): (typeof MessageRole)[keyof typeof MessageRole] {
  if (role === 'user') return MessageRole.User;
  if (role === 'system') return MessageRole.System;
  return MessageRole.Assistant;
}

const LoadMessages: FC<{ id?: string }> = ({ id }) => {
  const { setMessages } = useCopilotMessagesContext();
  const fetch = useFetch();
  const requestIdRef = useRef(0);

  const loadMessages = useCallback(
    async (idToSet: string) => {
      const currentRequestId = ++requestIdRef.current;
      try {
        const res = await fetch(`/copilot/${idToSet}/list`);
        if (!res.ok) {
          console.warn(
            '[agent] load thread messages failed',
            idToSet,
            res.status
          );
          if (currentRequestId !== requestIdRef.current) {
            return;
          }
          setMessages([]);
          return;
        }
        const data = await res.json();
        const rows =
          data.uiMessages ||
          (Array.isArray(data.messages)
            ? data.messages.map((m: Record<string, unknown>) => ({
                role: m.role,
                content:
                  typeof m.content === 'string'
                    ? m.content
                    : JSON.stringify(m.content ?? ''),
              }))
            : []);
        if (!Array.isArray(rows)) {
          if (currentRequestId !== requestIdRef.current) {
            return;
          }
          setMessages([]);
          return;
        }
        const slicedRows = rows.slice(-MAX_THREAD_MESSAGES);
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        setMessages(
          slicedRows.map((p: { role: string; content: string }) => {
            return new TextMessage({
              content: String(p.content ?? '').slice(0, MAX_MESSAGE_CONTENT_CHARS),
              role: mapRoleToCopilot(p.role),
            });
          })
        );
      } catch (e) {
        console.warn('[agent] load thread messages error', idToSet, e);
        if (currentRequestId !== requestIdRef.current) {
          return;
        }
        setMessages([]);
      }
    },
    [fetch, setMessages]
  );

  useEffect(() => {
    if (!id || id === 'new') {
      requestIdRef.current += 1;
      setMessages([]);
      return;
    }
    loadMessages(id);
  }, [id, loadMessages, setMessages]);

  return null;
};

const Message: FC<UserMessageProps> = (props) => {
  const convertContentToImagesAndVideo = useMemo(() => {
    return (props.message?.content || '')
      .replace(/Video: (http.*mp4\n)/g, (match, p1) => {
        return `<video controls class="h-[150px] w-[150px] rounded-[8px] mb-[10px]"><source src="${p1.trim()}" type="video/mp4">Your browser does not support the video tag.</video>`;
      })
      .replace(/Image: (http.*\n)/g, (match, p1) => {
        return `<img src="${p1.trim()}" class="h-[150px] w-[150px] max-w-full border border-newBgColorInner" />`;
      })
      .replace(/\[\-\-Media\-\-\](.*)\[\-\-Media\-\-\]/g, (match, p1) => {
        return `<div class="flex justify-center mt-[20px]">${p1}</div>`;
      })
      .replace(
        /(\[--integrations--\][\s\S]*?\[--integrations--\])/g,
        (match, p1) => {
          return ``;
        }
      );
  }, [props.message?.content]);
  return (
    <div
      className="copilotKitMessage copilotKitUserMessage min-w-[300px]"
      dangerouslySetInnerHTML={{ __html: convertContentToImagesAndVideo }}
    />
  );
};
const NewInput: FC<InputProps> = (props) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const { properties } = useContext(PropertiesContext);

  const buildIntegrationsContext = useCallback(() => {
    if (!properties.length) {
      return '';
    }

    const safeIntegrations = properties
      .slice(0, MAX_INTEGRATIONS_IN_CONTEXT)
      .map((p) => ({
        id: p.id,
        platform: p.identifier,
        profilePicture: p.picture,
      }));

    let serialized = JSON.stringify(safeIntegrations);
    if (serialized.length > MAX_INTEGRATION_CONTEXT_LENGTH) {
      serialized = serialized.slice(0, MAX_INTEGRATION_CONTEXT_LENGTH) + '…';
    }

    return `[--integrations--]
Use the following social media platforms: ${serialized}
[--integrations--]`;
  }, [properties]);

  return (
    <>
      <MediaPortal
        value={value}
        media={media}
        setMedia={(e) => setMedia(e.target.value)}
      />
      <Input
        {...props}
        onChange={setValue}
        onSend={(text) => {
          const integrationsContext = buildIntegrationsContext();
          const prompt = (
            text +
            (media.length > 0
              ? '\n[--Media--]' +
                media
                  .map((m) =>
                    m.path.indexOf('mp4') > -1
                      ? `Video: ${m.path}`
                      : `Image: ${m.path}`
                  )
                  .join('\n') +
                '\n[--Media--]'
              : '') +
            (integrationsContext ? `\n${integrationsContext}` : '')
          ).slice(0, MAX_PROMPT_CHARS);

          const send = props.onSend(
            prompt
          );
          setValue('');
          setMedia([]);
          return send;
        }}
      />
    </>
  );
};

export const Hooks: FC = () => {
  const modals = useModals();

  useCopilotAction({
    name: 'manualPosting',
    description:
      'This tool should be triggered when the user wants to manually add the generated post',
    parameters: [
      {
        name: 'list',
        type: 'object[]',
        description:
          'list of posts to schedule to different social media (integration ids)',
        attributes: [
          {
            name: 'integrationId',
            type: 'string',
            description: 'The integration id',
          },
          {
            name: 'date',
            type: 'string',
            description: 'UTC date of the scheduled post',
          },
          {
            name: 'settings',
            type: 'object',
            description: 'Settings for the integration [input:settings]',
          },
          {
            name: 'posts',
            type: 'object[]',
            description: 'list of posts / comments (one under another)',
            attributes: [
              {
                name: 'content',
                type: 'string',
                description: 'the content of the post',
              },
              {
                name: 'attachments',
                type: 'object[]',
                description: 'list of attachments',
                attributes: [
                  {
                    name: 'id',
                    type: 'string',
                    description: 'id of the attachment',
                  },
                  {
                    name: 'path',
                    type: 'string',
                    description: 'url of the attachment',
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    renderAndWaitForResponse: ({ args, status, respond }) => {
      if (status === 'executing') {
        return <OpenModal args={args} respond={respond} />;
      }

      return null;
    },
  });
  return null;
};

const OpenModal: FC<{
  respond: (value: any) => void;
  args: {
    list: {
      integrationId: string;
      date: string;
      settings?: Record<string, any>;
      posts: { content: string; attachments: { id: string; path: string }[] }[];
    }[];
  };
}> = ({ args, respond }) => {
  const modals = useModals();
  const { properties } = useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    for (const integration of args.list) {
      await new Promise((res) => {
        const group = makeId(10);
        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          size: '80%',
          title: ``,
          classNames: {
            modal: 'w-[100%] max-w-[1400px] text-textColor',
          },
          children: (
            <ExistingDataContextProvider
              value={{
                group,
                integration: integration.integrationId,
                integrationPicture:
                  properties.find((p) => p.id === integration.integrationId)
                    .picture || '',
                settings: integration.settings || {},
                posts: integration.posts.map((p) => ({
                  approvedSubmitForOrder: 'NO',
                  content: p.content,
                  createdAt: new Date().toISOString(),
                  state: 'DRAFT',
                  id: makeId(10),
                  settings: JSON.stringify(integration.settings || {}),
                  group,
                  integrationId: integration.integrationId,
                  integration: properties.find(
                    (p) => p.id === integration.integrationId
                  ),
                  publishDate: dayjs.utc(integration.date).toISOString(),
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                })),
              }}
            >
              <AddEditModal
                date={dayjs.utc(integration.date)}
                allIntegrations={properties}
                integrations={properties.filter(
                  (p) => p.id === integration.integrationId
                )}
                onlyValues={integration.posts.map((p) => ({
                  content: p.content,
                  id: makeId(10),
                  settings: integration.settings || {},
                  image: p.attachments.map((a) => ({
                    id: a.id,
                    path: a.path,
                  })),
                }))}
                reopenModal={() => {}}
                mutate={() => res(true)}
              />
            </ExistingDataContextProvider>
          ),
        });
      });
    }

    respond('User scheduled all the posts');
  }, [args, respond, properties]);

  useEffect(() => {
    startModal();
  }, []);
  return (
    <div onClick={() => respond('continue')}>
      Opening manually ${JSON.stringify(args)}
    </div>
  );
};
