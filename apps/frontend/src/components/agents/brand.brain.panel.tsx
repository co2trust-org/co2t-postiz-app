'use client';

import React, { FC } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

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

export const BrandBrainPanel: FC = () => {
  const t = useT();
  return (
    <div className="w-full rounded-[12px] border border-newTableBorder bg-newTableHeader p-[10px] flex flex-col gap-[12px]">
      <div className="text-[13px] font-[600]">
        {t('brand_brain_modeling', 'Brand Brain Modeling')}
      </div>
      <div className="text-[12px] opacity-80 leading-[1.4]">
        {t(
          'brand_web_description',
          'A living spiderweb map of your brand voice, social positioning, and clustered post themes.'
        )}
      </div>

      <div className="relative rounded-[12px] border border-fifth bg-newBgColor p-[10px] h-[270px] overflow-hidden">
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-[8px]">
        {BRAND_POST_CLUSTERS.map((cluster) => (
          <div
            key={cluster.title}
            className="rounded-[10px] border border-fifth bg-newBgColor px-[10px] py-[8px]"
          >
            <div className="text-[12px] font-[600]">{cluster.title}</div>
            <div className="text-[11px] opacity-70 mb-[4px]">{cluster.channels}</div>
            <div className="text-[11px] opacity-90">{cluster.themes.join(' • ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
