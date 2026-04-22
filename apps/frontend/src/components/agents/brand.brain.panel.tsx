'use client';

import React, { FC, useCallback, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useModals } from '@gitroom/frontend/components/layout/new-modal';
import { useOptionalBrandBrain } from '@gitroom/frontend/components/agents/brand.brain.context';
import {
  BrandBrainPersisted,
  buildAiIdeasTemplate,
  buildLinksForView,
  Concept,
  ConceptKind,
  formatBrandBrainForPrompt,
  layoutConceptPositions,
} from '@gitroom/frontend/components/agents/brand.brain.model';

const KIND_CLASS: Record<ConceptKind, string> = {
  mission: 'bg-[#1f2637] text-white border-[#3d4c6b]',
  theme: 'bg-newBgColor text-gray-200 border-fifth',
  idea: 'bg-boxHover text-textColor border-fifth',
};

const AddBrandForm: FC<{
  onAdd: (b: { name: string; siteUrl?: string; tagline?: string }) => void;
  close: () => void;
}> = ({ onAdd, close }) => {
  const t = useT();
  const [name, setName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [tagline, setTagline] = useState('');
  return (
    <div className="flex flex-col gap-[12px] p-[4px] text-[13px] text-textColor">
      <p className="text-[12px] opacity-80">
        {t(
          'brand_brain_add_brand_help',
          'Add a parent brand. You can then attach missions, themes, and ideas, and link them in the cloud.'
        )}
      </p>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">{t('name', 'Name')}</span>
        <input
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="CO2T.earth"
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">Site (optional)</span>
        <input
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="https://"
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">Tagline / mission (optional)</span>
        <input
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
        />
      </label>
      <div className="flex justify-end gap-[8px]">
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] border border-fifth"
          onClick={close}
        >
          {t('cancel', 'Cancel')}
        </button>
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] bg-btnPrimary text-btnText"
          onClick={() => {
            onAdd({ name, siteUrl, tagline });
            close();
          }}
        >
          {t('add', 'Add')}
        </button>
      </div>
    </div>
  );
};

const AddConceptForm: FC<{
  options: Pick<Concept, 'id' | 'label' | 'kind'>[];
  onAdd: (input: {
    label: string;
    kind: ConceptKind;
    note?: string;
    linkToConceptIds: string[];
    relationLabel?: string;
  }) => void;
  close: () => void;
}> = ({ options, onAdd, close }) => {
  const t = useT();
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<ConceptKind>('mission');
  const [note, setNote] = useState('');
  const [linkIds, setLinkIds] = useState<Record<string, boolean>>({});
  const [relation, setRelation] = useState('reinforces');

  const toggle = (id: string) => {
    setLinkIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="flex flex-col gap-[12px] p-[4px] text-[13px] text-textColor max-h-[min(80vh,520px)] overflow-auto">
      <p className="text-[12px] opacity-80">
        {t(
          'brand_brain_add_concept_help',
          'Add a node to the active brand. Link it to existing nodes so the agent understands how ideas and missions connect.'
        )}
      </p>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">Label</span>
        <input
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">Type</span>
        <select
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={kind}
          onChange={(e) => setKind(e.target.value as ConceptKind)}
        >
          <option value="mission">Mission</option>
          <option value="theme">Theme / pillar</option>
          <option value="idea">Idea / post angle</option>
        </select>
      </label>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">Note (optional)</span>
        <input
          className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {options.length > 0 && (
        <>
          <div className="text-[11px] font-[600]">Link to existing concepts</div>
          <div className="flex flex-col gap-[6px] max-h-[160px] overflow-auto">
            {options.map((c) => (
              <label key={c.id} className="flex items-center gap-[8px] text-[12px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!linkIds[c.id]}
                  onChange={() => toggle(c.id)}
                />
                <span>
                  {c.label}{' '}
                  <span className="opacity-50">({c.kind})</span>
                </span>
              </label>
            ))}
          </div>
          <label className="flex flex-col gap-[4px]">
            <span className="text-[11px] opacity-70">Relation label (optional)</span>
            <input
              className="rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
            />
          </label>
        </>
      )}
      <div className="flex justify-end gap-[8px]">
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] border border-fifth"
          onClick={close}
        >
          {t('cancel', 'Cancel')}
        </button>
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] bg-btnPrimary text-btnText"
          onClick={() => {
            onAdd({
              label,
              kind,
              note: note || undefined,
              linkToConceptIds: Object.keys(linkIds).filter((id) => linkIds[id]),
              relationLabel: relation || undefined,
            });
            close();
          }}
        >
          {t('add_to_cloud', 'Add to cloud')}
        </button>
      </div>
    </div>
  );
};

const AiPromptDialog: FC<{
  data: BrandBrainPersisted;
  brandName: string;
  onSendToChat: (text: string) => void;
  close: () => void;
}> = ({ data, brandName, onSendToChat, close }) => {
  const t = useT();
  const cloud = useMemo(() => formatBrandBrainForPrompt(data), [data]);
  const template = useMemo(
    () => buildAiIdeasTemplate(data, brandName),
    [data, brandName]
  );
  const [extra, setExtra] = useState('');

  const full = useMemo(
    () => `${template}\n\n${cloud}\n\n${extra}`.trim(),
    [template, cloud, extra]
  );

  return (
    <div className="flex flex-col gap-[10px] p-[4px] text-[12px] text-textColor max-h-[min(90vh,560px)]">
      <p className="opacity-80 leading-[1.4]">
        {t(
          'brand_brain_ai_dialog_help',
          'This preloads your full Brand Brain cloud into the chat so the assistant can base ideas on what you have built, not on generic copy.'
        )}
      </p>
      <label className="flex flex-col gap-[4px]">
        <span className="text-[11px] opacity-70">
          {t('add_focus', 'Optional focus (angle, product, or campaign)')}
        </span>
        <textarea
          className="min-h-[72px] rounded-[8px] border border-fifth bg-newTableHeader px-[10px] py-[8px] outline-none"
          value={extra}
          onChange={(e) => setExtra(e.target.value)}
          placeholder={t('focus_placeholder', 'e.g. Q2 launch, LinkedIn only, B2B operators')}
        />
      </label>
      <div className="text-[10px] opacity-60 max-h-[120px] overflow-auto rounded-[8px] border border-fifth p-[8px] font-mono whitespace-pre-wrap">
        {full.slice(0, 1200)}
        {full.length > 1200 ? '…' : ''}
      </div>
      <div className="flex justify-end gap-[8px]">
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] border border-fifth"
          onClick={close}
        >
          {t('close', 'Close')}
        </button>
        <button
          type="button"
          className="px-[10px] py-[6px] rounded-[8px] bg-btnPrimary text-btnText"
          onClick={() => {
            onSendToChat(full);
            close();
          }}
        >
          {t('insert_into_brand_brain_chat', 'Insert into Brand Brain chat')}
        </button>
      </div>
    </div>
  );
};

export const BrandBrainPanel: FC = () => {
  const t = useT();
  const modals = useModals();
  const bb = useOptionalBrandBrain();
  if (!bb) {
    return null;
  }
  const {
    data,
    activeBrand,
    setActiveBrandId,
    addBrand,
    addConcept,
    removeConcept,
    conceptsForActiveBrand,
    prefillChatInput,
  } = bb;

  const posList = useMemo(() => {
    if (!activeBrand) {
      return [];
    }
    return layoutConceptPositions(activeBrand, conceptsForActiveBrand);
  }, [activeBrand, conceptsForActiveBrand]);

  const idToPos = useMemo(() => {
    const m = new Map<string, { x: number; y: number; label: string; kind: ConceptKind }>();
    for (const p of posList) {
      m.set(p.id, p);
    }
    return m;
  }, [posList]);

  const linePairs = useMemo(() => {
    if (!activeBrand) {
      return [] as [string, string][];
    }
    const cids = new Set(conceptsForActiveBrand.map((c) => c.id));
    return buildLinksForView(cids, data.links);
  }, [activeBrand, conceptsForActiveBrand, data.links]);

  const openAddBrand = useCallback(() => {
    modals.openModal({
      id: 'brand-brain-add-brand',
      size: '480px',
      title: t('add_core_brand', 'Add a core brand'),
      children: (close) => <AddBrandForm onAdd={addBrand} close={close} />,
    });
  }, [addBrand, modals, t]);

  const openAddConcept = useCallback(() => {
    if (!activeBrand) {
      return;
    }
    const opts = conceptsForActiveBrand.map((c) => ({
      id: c.id,
      label: c.label,
      kind: c.kind,
    }));
    modals.openModal({
      id: 'brand-brain-add-concept',
      size: '520px',
      title: t('add_concept_to_brand', 'Add concept to brand'),
      children: (close) => (
        <AddConceptForm
          options={opts}
          onAdd={(input) => addConcept({ ...input, brandId: activeBrand.id })}
          close={close}
        />
      ),
    });
  }, [activeBrand, addConcept, conceptsForActiveBrand, modals, t]);

  const openAiDialog = useCallback(() => {
    if (!activeBrand) {
      return;
    }
    modals.openModal({
      id: 'brand-brain-ai',
      size: '560px',
      title: t('ai_ideas_from_cloud', 'AI ideas from your cloud'),
      children: (close) => (
        <AiPromptDialog
          data={data}
          brandName={activeBrand.name}
          onSendToChat={prefillChatInput}
          close={close}
        />
      ),
    });
  }, [activeBrand, data, modals, prefillChatInput, t]);

  return (
    <div className="w-full rounded-[12px] border border-newTableBorder bg-newTableHeader p-[10px] flex flex-col gap-[10px]">
      <div className="flex flex-col gap-[6px] sm:flex-row sm:items-end sm:justify-between gap-y-[8px]">
        <div className="flex flex-col gap-[4px] min-w-0">
          <div className="text-[13px] font-[600]">
            {t('brand_brain_modeling', 'Brand Brain — your framework')}
          </div>
          <div className="text-[11px] opacity-80 leading-[1.4]">
            {t(
              'brand_brain_framework_blurb',
              'Define parent brands, then add missions, themes, and ideas. Links show how your messages connect. The assistant reads this cloud in Brand Brain mode.'
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-[6px] justify-end">
          <button
            type="button"
            onClick={openAddBrand}
            className="h-[32px] px-[10px] rounded-[8px] border border-fifth text-[12px] whitespace-nowrap"
          >
            {t('add_brand', 'Add brand')}
          </button>
          <button
            type="button"
            onClick={openAddConcept}
            disabled={!activeBrand}
            className="h-[32px] px-[10px] rounded-[8px] border border-fifth text-[12px] disabled:opacity-50"
          >
            {t('add_concept', 'Add concept')}
          </button>
          <button
            type="button"
            onClick={openAiDialog}
            disabled={!activeBrand}
            className="h-[32px] px-[10px] rounded-[8px] bg-btnPrimary text-btnText text-[12px] disabled:opacity-50"
          >
            {t('brand_brain_ai_prompt', 'AI ideas (from cloud)')}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-[8px] items-stretch sm:items-center">
        <label className="flex items-center gap-[8px] text-[12px] flex-1 min-w-0">
          <span className="opacity-70 shrink-0">{t('active_brand', 'Active brand')}</span>
          <select
            className="flex-1 min-w-0 rounded-[8px] border border-fifth bg-newBgColor px-[10px] py-[6px] text-[12px] outline-none"
            value={activeBrand?.id || ''}
            onChange={(e) => setActiveBrandId(e.target.value)}
          >
            {data.brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
                {b.siteUrl ? ` · ${b.siteUrl}` : ''}
              </option>
            ))}
          </select>
        </label>
        {activeBrand && (
          <div className="text-[11px] opacity-80 truncate" title={activeBrand.tagline}>
            {activeBrand.tagline || '—'}
          </div>
        )}
      </div>

      <div className="relative rounded-[12px] border border-fifth bg-newBgColor p-[10px] h-[min(50vh,320px)] min-h-[220px] overflow-hidden">
        {activeBrand && (
          <div
            className="absolute -translate-x-1/2 -translate-y-1/2 z-[2] rounded-[10px] border px-[10px] py-[6px] text-[10px] leading-[1.2] max-w-[140px] text-center shadow-md bg-btnPrimary text-white border-btnPrimary"
            style={{ left: '50%', top: '50%' }}
          >
            {activeBrand.name}
          </div>
        )}

        <svg
          className="absolute inset-0 w-full h-full z-[1] pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="xMidYMid meet"
        >
          {linePairs.map(([a, b]) => {
            const A = idToPos.get(a);
            const B = idToPos.get(b);
            if (!A || !B) {
              return null;
            }
            return (
              <line
                key={`${a}-${b}`}
                x1={A.x}
                y1={A.y}
                x2={B.x}
                y2={B.y}
                stroke="#3a445d"
                strokeWidth="0.35"
                strokeDasharray="1 0.6"
                opacity={0.55}
              />
            );
          })}
        </svg>

        {posList.map((node) => (
          <div
            key={node.id}
            className={clsx(
              'absolute -translate-x-1/2 -translate-y-1/2 z-[2] rounded-[10px] border px-[7px] py-[5px] text-[9px] leading-[1.2] max-w-[110px] text-center shadow-sm group',
              KIND_CLASS[node.kind]
            )}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className="flex flex-col">
              {node.label}
              <button
                type="button"
                onClick={() => removeConcept(node.id)}
                className="mt-[4px] text-[8px] opacity-0 group-hover:opacity-100 text-red-400"
              >
                {t('remove', 'remove')}
              </button>
            </span>
          </div>
        ))}
      </div>

      {conceptsForActiveBrand.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[6px] text-[11px]">
          {conceptsForActiveBrand.map((c) => (
            <div
              key={c.id}
              className="rounded-[8px] border border-fifth bg-newBgColor px-[8px] py-[6px] flex items-start justify-between gap-[6px]"
            >
              <div className="min-w-0">
                <div className="font-[600] text-[11px]">{c.label}</div>
                <div className="opacity-60 text-[10px] uppercase tracking-wide">{c.kind}</div>
                {c.note && <div className="opacity-80 mt-[2px]">{c.note}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {activeBrand && conceptsForActiveBrand.length === 0 && (
        <div className="text-[11px] opacity-70 text-center py-[4px]">
          {t(
            'empty_cloud_hint',
            'This brand has no concepts yet. Add mission, theme, or idea nodes to build the cloud.'
          )}
        </div>
      )}
    </div>
  );
};
