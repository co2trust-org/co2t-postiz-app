'use client';

import clsx from 'clsx';
import Link from 'next/link';
import type { FC } from 'react';
import {
  HorizonDaysPreset,
  MarketingContextDocumentV1,
} from '@gitroom/nestjs-libraries/marketing/marketing.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MARKETING_CONTEXT_KEY,
  useMarketingContext,
  usePatchMarketingContext,
  usePlanningSnapshot,
} from '@gitroom/frontend/components/planning/use.marketing.context';
import { loadBrandBrainFromStorage } from '@gitroom/frontend/components/agents/brand.brain.model';
import { mutate } from 'swr';

type SnapshotResponse = {
  days: number;
  totals: { draft: number; queued: number };
  byIntegration: {
    integrationId: string;
    integrationName: string;
    draft: number;
    queue: number;
  }[];
  mediaImportedInRange: number;
  daysWithQueuedPost: number;
};

const horizons: HorizonDaysPreset[] = [7, 14, 30];

export function PlanningHub() {
  const t = useT();
  const [horizon, setHorizon] = useState<HorizonDaysPreset>(14);

  const { data: marketingData, isLoading: marketingLoading } = useMarketingContext();
  const patchMarketing = usePatchMarketingContext();

  const seededLocalBrain = useRef(false);
  useEffect(() => {
    if (marketingLoading || marketingData?.context !== null || seededLocalBrain.current) {
      return;
    }
    seededLocalBrain.current = true;
    void (async () => {
      try {
        await patchMarketing({ brandBrain: loadBrandBrainFromStorage() });
        await mutate(MARKETING_CONTEXT_KEY);
      } catch {
        /* ignore */
      }
    })();
  }, [marketingLoading, marketingData?.context, patchMarketing]);

  const [campaignTheme, setCampaignTheme] = useState('');
  const [notes, setNotes] = useState('');
  const [targetPostsPerWeek, setTargetPostsPerWeek] = useState<number | ''>(
    ''
  );
  const [focusConceptIds, setFocusConceptIds] = useState<string[]>([]);

  const planningHydratedRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const ctx = marketingData?.context;
    if (!ctx?.planning || planningHydratedRef.current) {
      return;
    }
    planningHydratedRef.current = true;
    const pl = ctx.planning;
    if (pl.horizonDaysDefault) {
      setHorizon(pl.horizonDaysDefault);
    }
    setCampaignTheme(pl.campaignTheme ?? '');
    setNotes(pl.notes ?? '');
    setTargetPostsPerWeek(
      typeof pl.targetPostsPerWeek === 'number' ? pl.targetPostsPerWeek : ''
    );
    setFocusConceptIds(pl.focusConceptIds ?? []);
  }, [marketingData]);

  const { data: snapshot, isLoading: snapLoading } = usePlanningSnapshot(horizon);

  const schedulePlanningSave = useCallback(
    (partial: Partial<MarketingContextDocumentV1['planning']>) => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void (async () => {
          try {
            await patchMarketing({ planning: partial });
            await mutate(MARKETING_CONTEXT_KEY);
          } catch {
            /* ignore */
          }
        })();
      }, 600);
    },
    [patchMarketing]
  );

  const activeBrand =
    marketingData?.context?.brandBrain.brands.find(
      (b) => b.id === marketingData?.context?.brandBrain.activeBrandId
    ) ?? marketingData?.context?.brandBrain.brands[0];

  const conceptsForBrand = (marketingData?.context?.brandBrain.concepts ?? []).filter(
    (c) => c.brandId === activeBrand?.id
  );

  const snap = snapshot as SnapshotResponse | undefined;

  const toggleConceptFixed = useCallback(
    (id: string) => {
      setFocusConceptIds((prev) => {
        const next = prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id];
        schedulePlanningSave({
          horizonDaysDefault: horizon,
          focusConceptIds: next,
        });
        return next;
      });
    },
    [horizon, schedulePlanningSave]
  );

  if (marketingLoading && !marketingData) {
    return (
      <div className="flex flex-1 justify-center py-[48px] text-textColor">
        {t('loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px] max-w-[900px] w-full px-[16px] py-[24px] text-textColor">
      <div>
        <h1 className="text-[22px] font-[700] mb-[6px]">
          {t('planning_hub_title', 'Planning hub')}
        </h1>
        <p className="text-[14px] opacity-85">
          {t(
            'planning_hub_subtitle',
            'Campaign goals, Brand Brain focal concepts, and a snapshot of drafts and queued posts.'
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-[8px]">
        <span className="text-[12px] uppercase tracking-wide opacity-70 w-full mb-[4px]">
          {t('horizon_days', 'Horizon')}
        </span>
        {horizons.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => {
              setHorizon(d);
              schedulePlanningSave({ horizonDaysDefault: d });
            }}
            className={clsx(
              'rounded-[8px] px-[14px] py-[8px] text-[13px] font-[600]',
              horizon === d
                ? 'bg-btnPrimary text-btnText'
                : 'border border-newTableBorder bg-newTableHeader hover:opacity-90'
            )}
          >
            {d === 7
              ? t('days_7', '7 days')
              : d === 14
                ? t('days_14', '14 days')
                : t('days_30', '30 days')}
          </button>
        ))}
      </div>

      <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[12px]">
        <h2 className="text-[16px] font-[600]">
          {t('pipeline_snapshot', 'Pipeline')}
        </h2>
        {snapLoading && !snap ? (
          <div className="text-[13px] opacity-75">
            {t('loading', 'Loading...')}
          </div>
        ) : snap ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-[12px] text-[13px]">
              <Stat
                label={t('drafts_in_range', 'Drafts')}
                value={String(snap.totals.draft)}
              />
              <Stat
                label={t('queued_in_range', 'Queued')}
                value={String(snap.totals.queued)}
              />
              <Stat
                label={t('media_imported', 'Media added')}
                value={String(snap.mediaImportedInRange)}
              />
              <Stat
                label={t('days_with_queue', 'Days with queued post')}
                value={String(snap.daysWithQueuedPost)}
              />
            </div>
            <div className="text-[12px] opacity-75">
              {snap.byIntegration?.length ? (
                <div className="flex flex-col gap-[6px]">
                  {(snap.byIntegration as SnapshotResponse['byIntegration']).map(
                    (row) => (
                      <div
                        key={row.integrationId}
                        className="flex justify-between gap-[12px]"
                      >
                        <span className="truncate">{row.integrationName}</span>
                        <span className="shrink-0 opacity-85">
                          {row.queue} queued · {row.draft} drafts
                        </span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <span>
                  {t('no_calendar_rows', 'No draft or queued slots in range.')}
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-[13px] opacity-75">—</div>
        )}
        <Link
          href="/launches"
          className="text-[13px] text-btnPrimary hover:underline self-start font-[600]"
        >
          {t('open_calendar', 'Open calendar')}
        </Link>
      </section>

      <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[12px]">
        <h2 className="text-[16px] font-[600]">
          {t('brand_snapshot', 'Brand concepts')}
        </h2>
        {!activeBrand ? (
          <p className="text-[13px] opacity-80">
            {t('no_active_brand', 'No brands yet')}
          </p>
        ) : (
          <>
            <div className="text-[14px] font-[600]">{activeBrand.name}</div>
            {activeBrand.tagline ? (
              <div className="text-[13px] opacity-85">{activeBrand.tagline}</div>
            ) : null}
            <div className="flex flex-wrap gap-[6px]">
              {conceptsForBrand.slice(0, 12).map((c) => (
                <span
                  key={c.id}
                  className="rounded-[8px] border border-newTableBorder px-[8px] py-[4px] text-[11px]"
                >
                  [{c.kind}] {c.label}
                </span>
              ))}
            </div>
          </>
        )}
        <Link
          href="/brand-brain/new"
          className="text-[13px] text-btnPrimary hover:underline font-[600] self-start"
        >
          {t('edit_brand_brain', 'Edit Brand Brain')}
        </Link>
      </section>

      <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[14px]">
        <h2 className="text-[16px] font-[600]">
          {t('planning_definitions', 'Planning definitions')}
        </h2>
        <label className="flex flex-col gap-[6px] text-[13px]">
          {t('campaign_theme', 'Campaign / theme')}
          <input
            className="rounded-[8px] border border-newTableBorder bg-newBgColor px-[10px] py-[8px] text-[13px]"
            value={campaignTheme}
            onChange={(e) => {
              const v = e.target.value;
              setCampaignTheme(v);
              schedulePlanningSave({
                horizonDaysDefault: horizon,
                campaignTheme: v,
              });
            }}
          />
        </label>
        <label className="flex flex-col gap-[6px] text-[13px]">
          {t('target_posts_week', 'Target posts per week')}
          <input
            type="number"
            min={0}
            className="rounded-[8px] border border-newTableBorder bg-newBgColor px-[10px] py-[8px] text-[13px] max-w-[160px]"
            value={targetPostsPerWeek === '' ? '' : targetPostsPerWeek}
            onChange={(e) => {
              const raw = e.target.value;
              const n = raw === '' ? '' : Number(raw);
              setTargetPostsPerWeek(
                n === '' || Number.isNaN(Number(n)) ? '' : n
              );
              schedulePlanningSave({
                horizonDaysDefault: horizon,
                targetPostsPerWeek:
                  n === '' || Number.isNaN(Number(n)) ? undefined : Number(n),
              });
            }}
          />
        </label>
        <label className="flex flex-col gap-[6px] text-[13px]">
          {t('planner_notes', 'Planner notes')}
          <textarea
            className="rounded-[8px] border border-newTableBorder bg-newBgColor px-[10px] py-[8px] text-[13px] min-h-[88px]"
            value={notes}
            onChange={(e) => {
              const v = e.target.value;
              setNotes(v);
              schedulePlanningSave({
                horizonDaysDefault: horizon,
                notes: v,
              });
            }}
          />
        </label>
        <div className="flex flex-col gap-[8px]">
          <div className="text-[13px] font-[600]">
            {t('focus_concepts', 'Focus concepts')}
          </div>
          <div className="flex flex-wrap gap-[6px]">
            {conceptsForBrand.map((c) => {
              const on = focusConceptIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleConceptFixed(c.id)}
                  className={clsx(
                    'rounded-[8px] px-[10px] py-[5px] text-[11px]',
                    on
                      ? 'bg-btnPrimary text-btnText'
                      : 'border border-newTableBorder bg-newTableHeader'
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[8px] border border-newTableBorder bg-newTableHeader px-[10px] py-[8px]">
    <div className="text-[11px] uppercase opacity-70">{label}</div>
    <div className="text-[18px] font-[700]">{value}</div>
  </div>
);
