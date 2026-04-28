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
import clsx from 'clsx';
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
import {
  AGENT_MODEL_KEY,
  AGENT_MODEL_OPTIONS,
  OPENAI_EXTRAS_KEY,
  OpenAiExtras,
  PollAccountHistoryPanel,
} from '@gitroom/frontend/components/agents/poll.account.history.panel';
import { BrandBrainPanel } from '@gitroom/frontend/components/agents/brand.brain.panel';
import { useOptionalBrandBrain } from '@gitroom/frontend/components/agents/brand.brain.context';
import { formatBrandBrainForPrompt } from '@gitroom/frontend/components/agents/brand.brain.model';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { Integrations as SocialIntegrations } from '@gitroom/frontend/components/launches/calendar.context';

const MAX_THREAD_MESSAGES = 200;
const MAX_MESSAGE_CONTENT_CHARS = 12000;
const MAX_PROMPT_CHARS = 8000;
const MAX_INTEGRATION_CONTEXT_LENGTH = 3500;
const MAX_INTEGRATIONS_IN_CONTEXT = 20;

export type AgentChatMode = 'agent' | 'brand-brain';

type BrandBrainQuestion = {
  id: string;
  question: string;
  options: string[];
};

const BRAND_BRAIN_QUESTIONS: BrandBrainQuestion[] = [
  {
    id: 'goal',
    question: 'Primary social goal',
    options: ['Awareness', 'Engagement', 'Leads', 'Community trust'],
  },
  {
    id: 'voice',
    question: 'Preferred voice',
    options: ['Thought leader', 'Educational', 'Bold challenger', 'Human and warm'],
  },
  {
    id: 'priority_channel',
    question: 'Priority channel',
    options: ['LinkedIn', 'Instagram', 'X', 'Threads'],
  },
  {
    id: 'cadence',
    question: 'Posting cadence',
    options: ['3x week', '5x week', 'Daily', 'Campaign bursts'],
  },
];

export const AgentChat: FC<{ mode?: AgentChatMode }> = ({ mode = 'agent' }) => {
  const { backendUrl } = useVariables();
  const params = useParams<{ id?: string }>();
  const { properties } = useContext(PropertiesContext);
  const brandBrain = useOptionalBrandBrain();
  const t = useT();
  const [aiModel, setAiModel] = useState('gpt-4.1');
  const [compiledAgentContext, setCompiledAgentContext] = useState('');
  const [openAiExtras, setOpenAiExtras] = useState<OpenAiExtras>(() => {
    try {
      const raw = localStorage.getItem(OPENAI_EXTRAS_KEY);
      if (!raw) {
        return { sequentialToolCalls: false, keepSystemRole: false };
      }
      const j = JSON.parse(raw) as Record<string, unknown>;
      return {
        sequentialToolCalls: j.sequentialToolCalls === true,
        keepSystemRole: j.keepSystemRole === true,
      };
    } catch {
      return { sequentialToolCalls: false, keepSystemRole: false };
    }
  });
  const threadId = typeof params?.id === 'string' ? params.id : 'new';

  const mergeOpenAiExtras = useCallback(
    (partial: Partial<OpenAiExtras>) => {
      setOpenAiExtras((prev) => {
        const next = { ...prev, ...partial };
        try {
          localStorage.setItem(OPENAI_EXTRAS_KEY, JSON.stringify(next));
        } catch {
          /* noop */
        }
        return next;
      });
    },
    []
  );

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
      {...(threadId === 'new' ? {} : { threadId })}
      credentials="include"
      runtimeUrl={backendUrl + '/copilot/agent'}
      showDevConsole={false}
      agent="postiz"
      properties={{
        integrations: properties,
        aiModel,
        agentAccountContext: compiledAgentContext,
        disableParallelToolCalls: openAiExtras.sequentialToolCalls,
        keepSystemRole: openAiExtras.keepSystemRole,
        uiMode: mode,
        brandBrainCloud:
          mode === 'brand-brain' && brandBrain
            ? formatBrandBrainForPrompt(brandBrain.data)
            : undefined,
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
          {mode === 'agent' && (
            <PollAccountHistoryPanel
              aiModel={aiModel}
              onModelChange={setAiModel}
              compiledContextPreview={compiledAgentContext}
              setCompiledAgentContext={setCompiledAgentContext}
              openAiExtras={openAiExtras}
              mergeOpenAiExtras={mergeOpenAiExtras}
            />
          )}
          {mode === 'brand-brain' && <BrandBrainPanel />}
          <div className="w-full flex-1 min-h-0">
            <CopilotChat
              className="w-full h-full"
              labels={{
                title:
                  mode === 'brand-brain'
                    ? t('brand_brain', 'Brand Brain')
                    : t('your_assistant', 'Your Assistant'),
                initial:
                  mode === 'brand-brain'
                    ? t(
                        'brand_brain_welcome_message',
                        `Hello, I am your Brand Brain.

Build parent brands and concepts in the cloud above, link missions to themes, then use "AI ideas (from cloud)" to send a full prompt, or type below.

I use your cloud (not generic assumptions) to suggest on-brand posts, campaigns, and social angles.`
                      )
                    : t('agent_welcome_message', `Hello, I am your Postiz agent 🙌🏻.
              
I can schedule a post or multiple posts to multiple channels and generate pictures and videos.

You can select the channels you want to use from the left menu.

You can see your previous conversations from the right menu.

You can also use me as an MCP Server, check Settings >> Public API
`),
              }}
              UserMessage={Message}
              Input={(props) => <NewInput {...props} mode={mode} />}
            />
          </div>
        </div>
      </div>
    </CopilotKit>
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
  /** Bumps whenever we navigate away — ignore stale loads (setMessages identity is unstable across Copilot internals). */
  const requestIdRef = useRef(0);
  const setMessagesRef = useRef(setMessages);
  setMessagesRef.current = setMessages;

  useEffect(() => {
    if (!id || id === 'new') {
      requestIdRef.current += 1;
      setMessagesRef.current([]);
      return;
    }

    const seq = ++requestIdRef.current;

    void (async () => {
      try {
        const res = await fetch(`/copilot/${id}/list`);
        if (seq !== requestIdRef.current) {
          return;
        }

        if (!res.ok) {
          console.warn(
            '[agent] load thread messages failed',
            id,
            res.status
          );
          setMessagesRef.current([]);
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

        if (seq !== requestIdRef.current) {
          return;
        }

        if (!Array.isArray(rows)) {
          setMessagesRef.current([]);
          return;
        }

        const slicedRows = rows.slice(-MAX_THREAD_MESSAGES);

        setMessagesRef.current(
          slicedRows.map((p: { role: string; content: string }) => {
            return new TextMessage({
              content: String(p.content ?? '').slice(0, MAX_MESSAGE_CONTENT_CHARS),
              role: mapRoleToCopilot(p.role),
            });
          })
        );
      } catch (e) {
        console.warn('[agent] load thread messages error', id, e);
        if (seq !== requestIdRef.current) {
          return;
        }
        setMessagesRef.current([]);
      }
    })();
  }, [fetch, id]);

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
const NewInput: FC<InputProps & { mode?: AgentChatMode }> = ({
  mode = 'agent',
  ...props
}) => {
  const [media, setMedia] = useState([] as { path: string; id: string }[]);
  const [value, setValue] = useState('');
  const { properties } = useContext(PropertiesContext);
  const brandBrain = useOptionalBrandBrain();
  const [brandBrainAnswers, setBrandBrainAnswers] = useState<Record<string, string>>(
    {}
  );
  const t = useT();

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

  const setBrandBrainAnswer = useCallback((questionId: string, option: string) => {
    setBrandBrainAnswers((prev) => ({ ...prev, [questionId]: option }));
  }, []);

  const brandBrainModelContext = useMemo(() => {
    const selected = BRAND_BRAIN_QUESTIONS.map((question) => ({
      question: question.question,
      answer: brandBrainAnswers[question.id],
    })).filter((item) => item.answer);
    if (!selected.length) {
      return '';
    }

    return `[--brand-brain-model--]
Use this social model context while answering:
${selected.map((item) => `- ${item.question}: ${item.answer}`).join('\n')}
[--brand-brain-model--]`;
  }, [brandBrainAnswers]);

  const brandBrainFullContext = useMemo(() => {
    if (!brandBrain) {
      return '';
    }
    const cloud = formatBrandBrainForPrompt(brandBrain.data);
    const m = brandBrainModelContext;
    if (!m) {
      return cloud;
    }
    return `${m}\n${cloud}`;
  }, [brandBrain, brandBrainModelContext]);

  const sendBrandBrainModel = useCallback(() => {
    if (!brandBrainFullContext) {
      return;
    }
    props.onSend(
      `${brandBrainFullContext}

Ask me one focused follow-up multiple choice question to refine this model further, then suggest 3 post clusters that connect the cloud concepts.`
    );
  }, [brandBrainFullContext, props]);

  const prefillFromPanel = brandBrain?.pendingChatPrefill;
  useEffect(() => {
    if (mode !== 'brand-brain' || !prefillFromPanel || !brandBrain) {
      return;
    }
    setValue(prefillFromPanel);
    brandBrain.clearPendingChatPrefill();
  }, [mode, prefillFromPanel, brandBrain]);

  return (
    <>
      {mode === 'brand-brain' && (
        <div className="mb-[8px] rounded-[10px] border border-newTableBorder bg-newTableHeader p-[10px] flex flex-col gap-[8px]">
          <div className="text-[12px] font-[600]">
            {t(
              'brand_brain_guided_questions',
              'Guided strategy questions (multiple choice)'
            )}
          </div>
          {BRAND_BRAIN_QUESTIONS.map((question) => (
            <div key={question.id} className="flex flex-col gap-[6px]">
              <div className="text-[12px] opacity-80">{question.question}</div>
              <div className="flex flex-wrap gap-[6px]">
                {question.options.map((option) => (
                  <button
                    key={`${question.id}-${option}`}
                    type="button"
                    onClick={() => setBrandBrainAnswer(question.id, option)}
                    className={clsx(
                      'rounded-[8px] border px-[8px] py-[4px] text-[11px]',
                      brandBrainAnswers[question.id] === option
                        ? 'bg-btnPrimary text-white border-btnPrimary'
                        : 'bg-newBgColor border-newTableBorder'
                    )}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={sendBrandBrainModel}
              disabled={!brandBrainFullContext}
              className="h-[32px] px-[10px] rounded-[8px] bg-btnPrimary text-btnText disabled:opacity-50"
            >
              {t('send_to_brand_brain', 'Send model to Brand Brain')}
            </button>
          </div>
        </div>
      )}
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
          const brainContext = mode === 'brand-brain' ? brandBrainFullContext : '';
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
            (integrationsContext ? `\n${integrationsContext}` : '') +
            (brainContext ? `\n${brainContext}` : '')
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
  const toaster = useToaster();
  const t = useT();
  const { properties, allIntegrations: allIntegrationsFromContext } =
    useContext(PropertiesContext);
  const startModal = useCallback(async () => {
    const accounts: SocialIntegrations[] =
      allIntegrationsFromContext.length > 0
        ? allIntegrationsFromContext
        : properties;

    if (!accounts.length) {
      toaster.show(
        t(
          'agent_post_modal_no_channels',
          'No connected channels. Connect an account in Launches, then try again.'
        ),
        'warning'
      );
      respond('User could not open the post editor (no connected channels).');
      return;
    }

    for (const integration of args.list) {
      const acct = accounts.find((p) => p.id === integration.integrationId);
      if (!acct) {
        toaster.show(
          t(
            'agent_post_modal_unknown_channel',
            'This draft references a channel that was not found. Check connected accounts.'
          ),
          'warning'
        );
        respond(
          `User could not open the post (unknown integrationId ${integration.integrationId}).`
        );
        return;
      }

      await new Promise((res) => {
        const group = makeId(10);
        // Fresh launch state + full account list (selected sidebar channels may be empty).
        useLaunchStore.getState().reset();
        useLaunchStore.getState().setAllIntegrations(accounts);

        modals.openModal({
          id: 'add-edit-modal',
          closeOnClickOutside: false,
          removeLayout: true,
          closeOnEscape: false,
          withCloseButton: false,
          askClose: true,
          fullScreen: true,
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
                integrationPicture: acct.picture || '',
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
                  integration: acct,
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
                allIntegrations={accounts}
                integrations={accounts}
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
  }, [
    args,
    respond,
    properties,
    allIntegrationsFromContext,
    modals,
    toaster,
    t,
  ]);

  useEffect(() => {
    startModal();
  }, [startModal]);
  return <div className="sr-only" aria-live="polite" />;
};
