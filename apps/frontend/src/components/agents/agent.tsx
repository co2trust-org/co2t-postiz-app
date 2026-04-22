'use client';

import React, {
  createContext,
  FC,
  useCallback,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import clsx from 'clsx';
import useCookie from 'react-use-cookie';
import useSWR from 'swr';
import { orderBy } from 'lodash';
import { SVGLine } from '@gitroom/frontend/components/launches/launches.component';
import ImageWithFallback from '@gitroom/react/helpers/image.with.fallback';
import SafeImage from '@gitroom/react/helpers/safe.image';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useWaitForClass } from '@gitroom/helpers/utils/use.wait.for.class';
import { MultiMediaComponent } from '@gitroom/frontend/components/media/media.component';
import { Integration } from '@prisma/client';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const MediaPortal: FC<{
  media: { path: string; id: string }[];
  value: string;
  setMedia: (event: {
    target: {
      name: string;
      value?: {
        id: string;
        path: string;
        alt?: string;
        thumbnail?: string;
        thumbnailTimestamp?: number;
      }[];
    };
  }) => void;
}> = ({ media, setMedia, value }) => {
  const waitForClass = useWaitForClass('copilotKitMessages');
  const t = useT();
  if (!waitForClass) return null;
  return (
    <div className="pl-[14px] pr-[24px] whitespace-nowrap editor rm-bg">
      <MultiMediaComponent
        allData={[{ content: value }]}
        text={value}
        label={t('attachments', 'Attachments')}
        description=""
        value={media}
        dummy={false}
        name="image"
        onChange={setMedia}
        onOpen={() => {}}
        onClose={() => {}}
      />
    </div>
  );
};

export const AgentList: FC<{ onChange: (arr: any[]) => void }> = ({
  onChange,
}) => {
  const fetch = useFetch();
  const t = useT();
  const [selected, setSelected] = useState([]);

  const load = useCallback(async () => {
    return (await (await fetch('/integrations/list')).json()).integrations;
  }, []);

  const [collapseMenu, setCollapseMenu] = useCookie('collapseMenu', '0');

  const { data } = useSWR('integrations', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
    fallbackData: [],
  });

  const setIntegration = useCallback(
    (integration: Integration) => () => {
      if (selected.some((p) => p.id === integration.id)) {
        onChange(selected.filter((p) => p.id !== integration.id));
        setSelected(selected.filter((p) => p.id !== integration.id));
      } else {
        onChange([...selected, integration]);
        setSelected([...selected, integration]);
      }
    },
    [onChange, selected]
  );

  const sortedIntegrations = useMemo(() => {
    return orderBy(
      data || [],
      ['type', 'disabled', 'identifier'],
      ['desc', 'asc', 'asc']
    );
  }, [data]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        collapseMenu === '1' ? 'group sidebar w-[100px]' : 'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="flex items-center">
          <h2 className="group-[.sidebar]:hidden flex-1 text-[20px] font-[500] mb-[15px]">
            {t('select_channels', 'Select Channels')}
          </h2>
          <div
            onClick={() => setCollapseMenu(collapseMenu === '1' ? '0' : '1')}
            className="-mt-3 group-[.sidebar]:rotate-[180deg] group-[.sidebar]:mx-auto text-btnText bg-btnSimple rounded-[6px] w-[24px] h-[24px] flex items-center justify-center cursor-pointer select-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="7"
              height="13"
              viewBox="0 0 7 13"
              fill="none"
            >
              <path
                d="M6 11.5L1 6.5L6 1.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <div className={clsx('flex flex-col gap-[15px]')}>
          {sortedIntegrations.map((integration, index) => (
            <div
              onClick={setIntegration(integration)}
              key={integration.id}
              className={clsx(
                'flex gap-[12px] items-center group/profile justify-center hover:bg-boxHover rounded-e-[8px] hover:opacity-100 cursor-pointer',
                !selected.some((p) => p.id === integration.id) && 'opacity-20'
              )}
            >
              <div
                className={clsx(
                  'relative rounded-full flex justify-center items-center gap-[6px]',
                  integration.disabled && 'opacity-50'
                )}
              >
                {(integration.inBetweenSteps || integration.refreshNeeded) && (
                  <div className="absolute start-0 top-0 w-[39px] h-[46px] cursor-pointer">
                    <div className="bg-red-500 w-[15px] h-[15px] rounded-full start-0 -top-[5px] absolute z-[200] text-[10px] flex justify-center items-center">
                      !
                    </div>
                    <div className="bg-primary/60 w-[39px] h-[46px] start-0 top-0 absolute rounded-full z-[199]" />
                  </div>
                )}
                <div className="h-full w-[4px] -ms-[12px] rounded-s-[3px] opacity-0 group-hover/profile:opacity-100 transition-opacity">
                  <SVGLine />
                </div>
                <ImageWithFallback
                  fallbackSrc={`/icons/platforms/${integration.identifier}.png`}
                  src={integration.picture}
                  className="rounded-[8px]"
                  alt={integration.identifier}
                  width={36}
                  height={36}
                />
                <SafeImage
                  src={`/icons/platforms/${integration.identifier}.png`}
                  className="rounded-[8px] absolute z-10 bottom-[5px] -end-[5px] border border-fifth"
                  alt={integration.identifier}
                  width={18.41}
                  height={18.41}
                />
              </div>
              <div
                className={clsx(
                  'flex-1 whitespace-nowrap text-ellipsis overflow-hidden group-[.sidebar]:hidden',
                  integration.disabled && 'opacity-50'
                )}
              >
                {integration.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const PropertiesContext = createContext({ properties: [] });
export const Agent: FC<{ children: ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState([]);

  return (
    <PropertiesContext.Provider value={{ properties }}>
      <AgentList onChange={setProperties} />
      <div className="bg-newBgColorInner flex flex-1">{children}</div>
      <Threads />
    </PropertiesContext.Provider>
  );
};

const THREADS_SWR_KEY = 'agent-copilot-threads';
const THREAD_LIST_POLL_MS = 60_000;

type BrandNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  type: 'core' | 'cluster' | 'idea';
};

const BRAND_KNOWLEDGE_NODES: BrandNode[] = [
  { id: 'core', label: 'CO2Trust Brand', x: 50, y: 50, type: 'core' },
  { id: 'pillar-transparency', label: 'Transparency', x: 24, y: 27, type: 'cluster' },
  { id: 'pillar-action', label: 'Actionable Climate Steps', x: 77, y: 26, type: 'cluster' },
  { id: 'pillar-community', label: 'Community Momentum', x: 81, y: 72, type: 'cluster' },
  { id: 'pillar-proof', label: 'Proof + Outcomes', x: 20, y: 73, type: 'cluster' },
  { id: 'idea-1', label: 'Myth vs Fact', x: 9, y: 14, type: 'idea' },
  { id: 'idea-2', label: 'Weekly Challenge', x: 92, y: 14, type: 'idea' },
  { id: 'idea-3', label: 'Founder Voice', x: 95, y: 55, type: 'idea' },
  { id: 'idea-4', label: 'Customer Win', x: 9, y: 57, type: 'idea' },
];

const BRAND_KNOWLEDGE_LINKS: Array<[string, string]> = [
  ['core', 'pillar-transparency'],
  ['core', 'pillar-action'],
  ['core', 'pillar-community'],
  ['core', 'pillar-proof'],
  ['pillar-transparency', 'idea-1'],
  ['pillar-action', 'idea-2'],
  ['pillar-community', 'idea-3'],
  ['pillar-proof', 'idea-4'],
  ['pillar-action', 'pillar-community'],
  ['pillar-transparency', 'pillar-proof'],
];

const BRAND_POST_CLUSTERS = [
  {
    title: 'Awareness Cloud',
    channels: 'LinkedIn, X, Threads',
    themes: ['Myth vs Fact', 'Easy wins at home', 'Climate language made simple'],
  },
  {
    title: 'Trust Building Cloud',
    channels: 'LinkedIn, Blog snippets',
    themes: [
      'Real impact numbers',
      'Behind-the-scenes process',
      'Case-study mini stories',
    ],
  },
  {
    title: 'Engagement Cloud',
    channels: 'Instagram, Threads, LinkedIn',
    themes: ['Polls and prompts', '7-day micro challenge', 'Community spotlight'],
  },
];

const nodeById = new Map(BRAND_KNOWLEDGE_NODES.map((node) => [node.id, node]));

const nodeClassName: Record<BrandNode['type'], string> = {
  core: 'bg-btnPrimary text-white border-btnPrimary',
  cluster: 'bg-[#1f2637] text-white border-[#3d4c6b]',
  idea: 'bg-newBgColor text-gray-200 border-fifth',
};

const BrandKnowledgePanel: FC = () => {
  const t = useT();
  return (
    <div className="flex flex-col gap-[14px] px-[2px] pb-[8px]">
      <div className="text-[12px] opacity-80 leading-[1.4]">
        {t(
          'brand_web_description',
          'A living map of your brand voice, social positioning, and idea clusters that can be turned into posts.'
        )}
      </div>

      <div className="relative rounded-[12px] border border-fifth bg-newBgColor p-[10px] h-[290px] overflow-hidden">
        {BRAND_KNOWLEDGE_LINKS.map(([source, target]) => {
          const sourceNode = nodeById.get(source);
          const targetNode = nodeById.get(target);
          if (!sourceNode || !targetNode) return null;

          const left = Math.min(sourceNode.x, targetNode.x);
          const top = Math.min(sourceNode.y, targetNode.y);
          const width = Math.abs(sourceNode.x - targetNode.x);
          const height = Math.abs(sourceNode.y - targetNode.y);

          return (
            <div
              key={`${source}-${target}`}
              className="absolute border border-dashed border-[#3a445d] opacity-50 pointer-events-none"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: `${Math.max(width, 0.4)}%`,
                height: `${Math.max(height, 0.4)}%`,
              }}
            />
          );
        })}

        {BRAND_KNOWLEDGE_NODES.map((node) => (
          <div
            key={node.id}
            className={clsx(
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-[10px] border px-[8px] py-[6px] text-[10px] leading-[1.2] max-w-[120px] text-center shadow-md',
              nodeClassName[node.type]
            )}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            {node.label}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-[8px]">
        {BRAND_POST_CLUSTERS.map((cluster) => (
          <div
            key={cluster.title}
            className="rounded-[10px] border border-fifth bg-newBgColor px-[10px] py-[8px]"
          >
            <div className="text-[12px] font-[600]">{cluster.title}</div>
            <div className="text-[11px] opacity-70 mb-[4px]">{cluster.channels}</div>
            <div className="text-[11px] opacity-90">
              {cluster.themes.join(' • ')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const Threads: FC = () => {
  const fetch = useFetch();
  const pathname = usePathname();
  const t = useT();
  const [activeTab, setActiveTab] = useState<'threads' | 'brand'>('threads');
  const threads = useCallback(async () => {
    const res = await fetch('/copilot/list');
    if (!res.ok) {
      throw new Error(`threads ${res.status}`);
    }
    const data = await res.json();
    return {
      threads: Array.isArray(data?.threads) ? data.threads : [],
    };
  }, [fetch]);
  const params = useParams<{ id?: string }>();
  const id = typeof params?.id === 'string' ? params.id : 'new';

  const { data, error, isLoading, mutate } = useSWR(THREADS_SWR_KEY, threads, {
    refreshInterval: THREAD_LIST_POLL_MS,
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5_000,
    shouldRetryOnError: true,
    errorRetryCount: 3,
    keepPreviousData: true,
    fallbackData: { threads: [] },
  });

  useEffect(() => {
    mutate();
  }, [id, pathname, mutate]);

  return (
    <div
      className={clsx(
        'trz bg-newBgColorInner flex flex-col gap-[15px] transition-all relative',
        'w-[260px]'
      )}
    >
      <div className="absolute top-0 start-0 w-full h-full p-[20px] overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColor">
        <div className="mb-[15px] justify-center flex group-[.sidebar]:pb-[15px]">
          <Link
            href={`/agents`}
            className="text-white whitespace-nowrap flex-1 pt-[12px] pb-[14px] ps-[16px] pe-[20px] group-[.sidebar]:p-0 min-h-[44px] max-h-[44px] rounded-md bg-btnPrimary flex justify-center items-center gap-[5px] outline-none"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="21"
              height="20"
              viewBox="0 0 21 20"
              fill="none"
              className="min-w-[21px] min-h-[20px]"
            >
              <path
                d="M10.5001 4.16699V15.8337M4.66675 10.0003H16.3334"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="flex-1 text-start text-[16px] group-[.sidebar]:hidden">
              {t('start_a_new_chat', 'Start a new chat')}
            </div>
          </Link>
        </div>
        <div className="mb-[12px] rounded-[8px] bg-newBgColor p-[3px] flex gap-[3px]">
          <button
            type="button"
            onClick={() => setActiveTab('threads')}
            className={clsx(
              'flex-1 rounded-[6px] py-[6px] text-[12px] transition-colors',
              activeTab === 'threads'
                ? 'bg-btnPrimary text-white'
                : 'text-gray-300 hover:bg-black/20'
            )}
          >
            {t('chats', 'Chats')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('brand')}
            className={clsx(
              'flex-1 rounded-[6px] py-[6px] text-[12px] transition-colors',
              activeTab === 'brand'
                ? 'bg-btnPrimary text-white'
                : 'text-gray-300 hover:bg-black/20'
            )}
          >
            {t('brand_brain', 'Brand Brain')}
          </button>
        </div>
        {activeTab === 'threads' ? (
          <>
            {error && (
              <div className="mb-[10px] text-[12px] text-red-400 px-[10px]">
                {t(
                  'chat_history_load_error',
                  'Could not refresh chat list. Check connection or try again.'
                )}
                <button
                  type="button"
                  className="ms-[8px] underline"
                  onClick={() => mutate()}
                >
                  {t('retry', 'Retry')}
                </button>
              </div>
            )}
            {isLoading && !data?.threads?.length && (
              <div className="text-[12px] opacity-60 px-[10px] mb-[8px]">
                {t('loading_chats', 'Loading chats…')}
              </div>
            )}
            <div className="flex flex-col gap-[1px]">
              {data?.threads?.map((p: any) => (
                <Link
                  className={clsx(
                    'overflow-ellipsis overflow-hidden whitespace-nowrap hover:bg-newBgColor px-[10px] py-[6px] rounded-[10px] cursor-pointer',
                    p.id === id && 'bg-newBgColor'
                  )}
                  href={`/agents/${p.id}`}
                  key={p.id}
                >
                  {p.title}
                </Link>
              ))}
            </div>
          </>
        ) : (
          <BrandKnowledgePanel />
        )}
      </div>
    </div>
  );
};
