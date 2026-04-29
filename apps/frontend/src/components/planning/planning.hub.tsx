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
  PlanningSnapshotPayload,
  useMarketingContext,
  usePatchMarketingContext,
  usePlanningSnapshot,
  usePlanningSnapshotsCompare,
} from '@gitroom/frontend/components/planning/use.marketing.context';
import { loadBrandBrainFromStorage } from '@gitroom/frontend/components/agents/brand.brain.model';
import { mutate } from 'swr';

const horizons: HorizonDaysPreset[] = [7, 14, 30];

const HORIZON_LABEL: Record<number, string> = {
  7: '~1 week · good for 5–7 day lookaheads',
  14: '~2 weeks · aligns with 10–14 day planning',
  30: '~1 month · aligns with ~20–30 day planning',
};

function plannedTotal(s: PlanningSnapshotPayload): number {
  return s.totals.queued + s.totals.draft;
}

function expectedFromTarget(
  targetPerWeek: number | '' | undefined,
  days: number
): number | null {
  if (typeof targetPerWeek !== 'number' || targetPerWeek <= 0) {
    return null;
  }
  return Math.ceil((targetPerWeek * days) / 7);
}

export function PlanningHub() {
  const t = useT();
  const [horizon, setHorizon] = useState<HorizonDaysPreset>(14);

  const { data: marketingData, isLoading: marketingLoading } = useMarketingContext();
  const patchMarketing = usePatchMarketingContext();
  const {
    data: compareData,
    isLoading: compareLoading,
    mutate: mutateCompare,
  } = usePlanningSnapshotsCompare();

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

  useEffect(() => {
    const id = window.setInterval(() => {
      void mutateCompare();
    }, 120_000);
    return () => window.clearInterval(id);
  }, [mutateCompare]);

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

  const conceptsForBrand = (
    marketingData?.context?.brandBrain.concepts ?? []
  ).filter((c) => c.brandId === activeBrand?.id);

  const snap = snapshot as PlanningSnapshotPayload | undefined;

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

  const snapshotForHorizon = (): PlanningSnapshotPayload | undefined => {
    if (!compareData) {
      return snap;
    }
    if (horizon === 7) {
      return compareData.h7;
    }
    if (horizon === 14) {
      return compareData.h14;
    }
    return compareData.h30;
  };

  const selectedSnap = snapshotForHorizon();
  const weeklyTarget =
    typeof targetPostsPerWeek === 'number' ? targetPostsPerWeek : null;

  const doneSummary = () => {
    if (!selectedSnap) {
      return null;
    }
    const total = plannedTotal(selectedSnap);
    const exp = expectedFromTarget(
      typeof targetPostsPerWeek === 'number' ? targetPostsPerWeek : undefined,
      horizon
    );
    const gap = exp != null ? Math.max(0, exp - total) : null;
    return { total, exp, gap, queued: selectedSnap.totals.queued, draft: selectedSnap.totals.draft };
  };

  const summary = doneSummary();

  if (marketingLoading && !marketingData) {
    return (
      <div className="flex flex-1 justify-center py-[48px] text-textColor">
        {t('loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-[24px] max-w-[980px] w-full px-[16px] py-[24px] text-textColor">
      <div>
        <h1 className="text-[22px] font-[700] mb-[6px]">
          {t('planning_dashboard_title', 'Planning dashboard')}
        </h1>
        <p className="text-[14px] opacity-85 max-w-[760px]">
          {t(
            'planning_dashboard_subtitle',
            'See what is already lined up versus what is still in motion, across week, two-week, and month windows. Use the detail section below to dig into one window at a time.'
          )}
        </p>
      </div>

      <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[14px]">
        <div className="flex flex-col gap-[4px]">
          <h2 className="text-[16px] font-[600]">
            {t('horizons_at_a_glance', 'Time horizons at a glance')}
          </h2>
          <p className="text-[12px] opacity-75">
            {t(
              'horizon_mapping_hint',
              '7 / 14 / 30 day views map to short, medium, and longer planning cycles (similar to 5–7, 10–14, and 20–30 day goals).'
            )}
          </p>
        </div>
        {compareLoading && !compareData ? (
          <div className="text-[13px] opacity-75">
            {t('loading', 'Loading...')}
          </div>
        ) : compareData ? (
          <HorizonCompareTable
            t={t}
            h7={compareData.h7}
            h14={compareData.h14}
            h30={compareData.h30}
            targetPerWeek={
              typeof targetPostsPerWeek === 'number' ? targetPostsPerWeek : null
            }
          />
        ) : (
          <div className="text-[13px] opacity-75">—</div>
        )}
      </section>

      {summary && selectedSnap ? (
        <section className="rounded-[12px] border border-btnPrimary/30 bg-newTableHeader p-[16px] flex flex-col gap-[10px]">
          <h2 className="text-[15px] font-[600]">
            {t('selected_window_status', 'Selected window')}: {horizon}{' '}
            {t('days_abbr', 'days')}
          </h2>
          <ul className="text-[13px] flex flex-col gap-[6px] opacity-95 list-disc list-inside">
            <li>
              <strong className="font-[600]">
                {t('label_done_ready', 'Committed & in progress')}
              </strong>
              :               {summary.queued} {t('queued_label', 'scheduled (queued)')},{' '}
              {summary.draft} {t('drafts_label', 'drafts')} —{' '}
              {summary.total} {t('total_planned_moves', 'posts in the pipeline')}
            </li>
            <li>
              <strong className="font-[600]">{t('coverage', 'Cadence coverage')}</strong>
              : {selectedSnap.daysWithQueuedPost}{' '}
              {t(
                'distinct_days_queued',
                'distinct days include at least one scheduled post in this range'
              )}
              .
            </li>
            <li>
              <strong className="font-[600]">{t('label_still_open', 'Still to align')}</strong>:
              {weeklyTarget != null && summary.exp != null && summary.gap != null ? (
                <>
                  {' '}
                  {summary.gap === 0 ? (
                    <>
                      {t('at_or_above_target', 'You are at or above this rough target for the window.')}
                    </>
                  ) : (
                    <>
                      ~{summary.gap}{' '}
                      {t('more_slots_for_target', 'more post ideas or slots may help to reach')}{' '}
                      ~{summary.exp} ({weeklyTarget}{' '}
                      {t('posts_per_week_abbr', 'per week')}).{' '}
                    </>
                  )}
                </>
              ) : (
                <> {t('set_weekly_target_hint', 'Set a weekly post target below to estimate how many ideas or slots you may still need.')}</>
              )}
            </li>
            <li className="opacity-85">
              <strong className="font-[600]">{t('assets_side', 'Creative work')}</strong>:{' '}
              {selectedSnap.mediaImportedInRange}{' '}
              {t(
                'media_imported_blurb',
                'media files added in this period — add or generate artwork elsewhere and attach when you schedule.'
              )}
            </li>
          </ul>
          <button
            type="button"
            onClick={() => void mutateCompare()}
            className="self-start text-[12px] text-btnPrimary hover:underline font-[600]"
          >
            {t('refresh_dashboard', 'Refresh snapshot numbers')}
          </button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-[8px]">
        <span className="text-[12px] uppercase tracking-wide opacity-70 w-full mb-[4px]">
          {t('horizon_detail_pick', 'Detail view — pick a window')}
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
              'rounded-[8px] px-[14px] py-[8px] text-[13px] font-[600] flex flex-col items-start gap-[2px]',
              horizon === d
                ? 'bg-btnPrimary text-btnText'
                : 'border border-newTableBorder bg-newTableHeader hover:opacity-90'
            )}
          >
            <span>
              {d === 7
                ? t('days_7', '7 days')
                : d === 14
                  ? t('days_14', '14 days')
                  : t('days_30', '30 days')}
            </span>
            <span
              className={clsx(
                'text-[10px] font-[500] opacity-90 max-w-[220px] text-left leading-tight',
                horizon === d ? 'text-btnText/90' : 'opacity-70'
              )}
            >
              {HORIZON_LABEL[d]}
            </span>
          </button>
        ))}
      </div>

      <section className="rounded-[12px] border border-newTableBorder bg-newBgColorInner p-[16px] flex flex-col gap-[12px]">
        <h2 className="text-[16px] font-[600]">
          {t('pipeline_snapshot', 'Pipeline')} — {horizon}{' '}
          {t('days_abbr', 'days')}
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
                  {(
                    snap.byIntegration as PlanningSnapshotPayload['byIntegration']
                  ).map((row) => (
                    <div
                      key={row.integrationId}
                      className="flex justify-between gap-[12px]"
                    >
                      <span className="truncate">{row.integrationName}</span>
                      <span className="shrink-0 opacity-85">
                        {row.queue} queued · {row.draft} drafts
                      </span>
                    </div>
                  ))}
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

const HorizonCompareTable: FC<{
  h7: PlanningSnapshotPayload;
  h14: PlanningSnapshotPayload;
  h30: PlanningSnapshotPayload;
  targetPerWeek: number | null;
  t: (k: string, f: string) => string;
}> = ({ h7, h14, h30, targetPerWeek, t }) => {
  const cols = [
    { key: 'm7' as const, days: 7, snap: h7, label: `7 ${t('days_abbr', 'days')}` },
    { key: 'm14' as const, days: 14, snap: h14, label: `14 ${t('days_abbr', 'days')}` },
    {
      key: 'm30' as const,
      days: 30,
      snap: h30,
      label: `30 ${t('days_abbr', 'days')}`,
    },
  ];

  const row = (
    label: string,
    get: (s: PlanningSnapshotPayload) => string | number,
    sub?: string
  ) => (
    <tr className="border-b border-newTableBorder/80 last:border-0">
      <td className="py-[10px] pr-[12px] align-top text-[12px] opacity-85 max-w-[180px]">
        {label}
        {sub ? <div className="text-[10px] opacity-65 mt-[2px]">{sub}</div> : null}
      </td>
      {cols.map((c) => (
        <td
          key={c.key}
          className="py-[10px] px-[10px] align-top text-[13px] font-[600] text-center"
        >
          {get(c.snap)}
        </td>
      ))}
    </tr>
  );

  return (
    <div className="overflow-x-auto rounded-[8px] border border-newTableBorder">
      <table className="w-full min-w-[520px] border-collapse text-textColor">
        <thead>
          <tr className="bg-newTableHeader border-b border-newTableBorder">
            <th className="text-left py-[10px] px-[12px] text-[11px] uppercase opacity-70 font-[600]">
              {t('metric', 'Metric')}
            </th>
            {cols.map((c) => (
              <th
                key={c.key}
                className="py-[10px] px-[10px] text-[12px] font-[700] text-center"
              >
                <div>{c.label}</div>
                <div className="text-[10px] opacity-70 mt-[4px] whitespace-normal font-[500]">
                  {HORIZON_LABEL[c.days].split('·')[1]?.trim()}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {row(t('queued_label', 'Scheduled (queued)'), (s) => s.totals.queued)}
          {row(t('drafts_label', 'Drafts'), (s) => s.totals.draft)}
          {row(
            t('combined_pipeline', 'Queued + drafts'),
            (s) => plannedTotal(s),
            t(
              'combined_pipeline_help',
              'Work that exists in Postiz for the period'
            )
          )}
          {row(
            t('media_added_col', 'Media added'),
            (s) => s.mediaImportedInRange,
            t('media_added_help', 'Files for creative to pair with posts')
          )}
          {row(
            t('days_covered', 'Days with a scheduled post'),
            (s) => s.daysWithQueuedPost,
            t('days_covered_help', 'How many calendar days have ≥1 queued slot')
          )}
          {targetPerWeek != null && targetPerWeek > 0 ? (
            <>
              {row(
                t('target_bucket', 'Rough target for period'),
                (s) => {
                  const d = s.days;
                  const exp = expectedFromTarget(targetPerWeek, d);
                  return exp ?? '—';
                },
                t(
                  'target_bucket_help',
                  'From weekly target × horizon (approximate)'
                )
              )}
              {row(
                t('gap_estimate', 'Gap vs target (posts)'),
                (s) => {
                  const d = s.days;
                  const exp = expectedFromTarget(targetPerWeek, d);
                  if (exp == null) {
                    return '—';
                  }
                  return Math.max(0, exp - plannedTotal(s));
                },
                t(
                  'gap_estimate_help',
                  'How many more post ideas or slots to hit the rough target'
                )
              )}
            </>
          ) : null}
        </tbody>
      </table>
    </div>
  );
};

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-[8px] border border-newTableBorder bg-newTableHeader px-[10px] py-[8px]">
    <div className="text-[11px] uppercase opacity-70">{label}</div>
    <div className="text-[18px] font-[700]">{value}</div>
  </div>
);
