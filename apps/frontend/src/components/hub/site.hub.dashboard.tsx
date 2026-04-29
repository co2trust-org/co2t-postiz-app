'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { FC, useMemo } from 'react';
import { useIntegrationList } from '@gitroom/frontend/components/launches/helpers/use.integration.list';
import {
  COMPARE_SNAPSHOTS_KEY,
  type PlanningSnapshotPayload,
  useMarketingContext,
  usePlanningSnapshotsCompare,
} from '@gitroom/frontend/components/planning/use.marketing.context';
import type { MarketingContextDocumentV1 } from '@gitroom/nestjs-libraries/marketing/marketing.context';
import { mutate } from 'swr';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type HubStatusTone = 'start' | 'attention' | 'steady' | 'strong';

function plannedTotal(s: PlanningSnapshotPayload): number {
  return s.totals.draft + s.totals.queued;
}

function expectedInHorizon(
  targetPerWeek: number | '' | undefined,
  days: number
): number | null {
  if (typeof targetPerWeek !== 'number' || targetPerWeek <= 0) {
    return null;
  }
  return Math.ceil((targetPerWeek * days) / 7);
}

type ActionItem = {
  id: string;
  title: string;
  detail: string;
  href: string;
  emphasis?: boolean;
};

function buildActions(args: {
  t: ReturnType<typeof useT>;
  integrations: { disabled?: boolean; id: string }[];
  h7?: PlanningSnapshotPayload;
  weeklyTarget: number | null;
  horizonDefault: MarketingContextDocumentV1['planning']['horizonDaysDefault'];
}): ActionItem[] {
  const {
    t,
    integrations,
    h7,
    weeklyTarget,
    horizonDefault,
  } = args;

  const activeCh = integrations.filter((i) => !i.disabled).length;
  const total = h7 ? plannedTotal(h7) : 0;
  const expected = expectedInHorizon(weeklyTarget ?? undefined, 7);
  const gap =
    expected != null ? Math.max(0, expected - total) : null;
  const daysQueued = h7?.daysWithQueuedPost ?? 0;

  const out: ActionItem[] = [];

  if (integrations.length === 0) {
    out.push({
      id: 'channels',
      title: t(
        'hub_action_connect_channels',
        'Connect at least one social channel'
      ),
      detail: t(
        'hub_action_connect_channels_detail',
        'Launches unlock scheduling, analytics, and Agent tools. Connect the networks you actively market on.'
      ),
      href: '/launches',
      emphasis: true,
    });
  } else if (activeCh === 0) {
    out.push({
      id: 'channels_disabled',
      title: t(
        'hub_action_enable_channels',
        'Enable a connected channel'
      ),
      detail: t(
        'hub_action_enable_channels_detail',
        'Your integrations exist but none are enabled—pick at least one in Launches to publish again.'
      ),
      href: '/launches',
      emphasis: true,
    });
  }

  if (weeklyTarget === null && activeCh > 0) {
    out.push({
      id: 'target',
      title: t(
        'hub_action_set_weekly_target',
        'Set a weekly publishing target'
      ),
      detail: t(
        'hub_action_set_weekly_target_detail',
        'In Planning, set “target posts per week” so Postiz can show gaps versus your horizon (7 / 14 / 30 days).'
      ),
      href: '/planning',
      emphasis: !out.some((x) => x.emphasis),
    });
  }

  if (activeCh > 0 && total === 0) {
    out.push({
      id: 'pipeline',
      title: t(
        'hub_action_fill_pipeline',
        'Fill your upcoming pipeline'
      ),
      detail: t(
        'hub_action_fill_pipeline_detail',
        'Nothing is drafted or queued in the next 7 days—add posts in Calendar or brainstorm with Agent, then approve into the queue.'
      ),
      href: '/agents',
      emphasis:
        out.filter((x) => x.emphasis).length === 0 && weeklyTarget !== null,
    });
  }

  if (
    activeCh > 0 &&
    expected != null &&
    gap !== null &&
    gap > Math.max(1, Math.floor(expected / 3))
  ) {
    out.push({
      id: 'gap',
      title: t(
        'hub_action_close_gap',
        'Close the gap to your 7‑day outlook'
      ),
      detail:
        horizonDefault === 7
          ? t(
              'hub_action_close_gap_detail_7',
              `You aim for ~${expected} posts across the next week; you have ${total} in draft plus queue. Schedule or draft more so the pipeline matches your goal.`
            )
          : t(
              'hub_action_close_gap_detail',
              `Your default planning window is ${horizonDefault} days—check Planning and align the calendar so the next week still reflects your weekly target.`
            ),
      href: '/launches',
    });
  }

  if (activeCh > 0 && total > 0 && daysQueued < 2 && daysQueued >= 0) {
    out.push({
      id: 'rhythm',
      title: t(
        'hub_action_posting_rhythm',
        'Improve posting rhythm'
      ),
      detail: t(
        'hub_action_posting_rhythm_detail',
        'Fewer than two days in the next week have queued posts. Consider spacing content across more days for consistent reach.'
      ),
      href: '/planning',
    });
  }

  if (activeCh > 0) {
    out.push({
      id: 'brand',
      title: t(
        'hub_action_brand_context',
        'Keep Brand Brain aligned with campaigns'
      ),
      detail: t(
        'hub_action_brand_context_detail',
        'Update themes and concepts so Agent and Planning reflect what you are promoting this month.'
      ),
      href: '/brand-brain',
    });
  }

  if (activeCh > 0) {
    out.push({
      id: 'analytics',
      title: t('hub_action_review_analytics', 'Review what is working'),
      detail: t(
        'hub_action_review_analytics_detail',
        'Use Analytics to see engagement by channel and double down on formats that perform.'
      ),
      href: '/analytics',
    });
  }

  const seen = new Set<string>();
  return out.filter((a) => {
    if (seen.has(a.id)) {
      return false;
    }
    seen.add(a.id);
    return true;
  });
}

function statusFromSignals(
  t: ReturnType<typeof useT>,
  args: {
    activeCh: number;
    total7: number;
    expected7: number | null;
    gap: number | null;
    hasTarget: boolean;
  }
): { tone: HubStatusTone; label: string; sub: string } {
  const { activeCh, total7, expected7, gap, hasTarget } = args;

  if (activeCh === 0) {
    return {
      tone: 'start',
      label: t('hub_status_start_label', 'Getting started'),
      sub: t(
        'hub_status_start_sub',
        'Connect channels to unlock scheduling and this dashboard.'
      ),
    };
  }

  if (!hasTarget) {
    return {
      tone: 'attention',
      label: t('hub_status_need_target_label', 'Set your cadence'),
      sub: t(
        'hub_status_need_target_sub',
        'Add a weekly target in Planning to measure pipeline health.'
      ),
    };
  }

  if (total7 === 0) {
    return {
      tone: 'attention',
      label: t('hub_status_pipeline_empty_label', 'Pipeline needs content'),
      sub: t(
        'hub_status_pipeline_empty_sub',
        'Nothing is lined up for the next week—draft or queue posts.'
      ),
    };
  }

  if (expected7 != null && gap != null && gap > Math.max(1, expected7 / 3)) {
    return {
      tone: 'attention',
      label: t('hub_status_behind_label', 'Behind your goal'),
      sub: t(
        'hub_status_behind_sub',
        'Your 7‑day pipeline is under the target you set—schedule more.'
      ),
    };
  }

  if (expected7 != null && total7 >= expected7) {
    return {
      tone: 'strong',
      label: t('hub_status_on_target_label', 'On target'),
      sub: t(
        'hub_status_on_target_sub',
        'Your next-week pipeline meets or exceeds the weekly target.'
      ),
    };
  }

  return {
    tone: 'steady',
    label: t('hub_status_progress_label', 'Making progress'),
    sub: t(
      'hub_status_progress_sub',
      'Keep refining themes and timing in Planning and Brand Brain.'
    ),
  };
}

const toneBorder: Record<HubStatusTone, string> = {
  start: 'border-tableBorder bg-newBgColorInner',
  attention: 'border-amber-500/50 bg-amber-500/5',
  steady: 'border-emerald-500/35 bg-emerald-500/5',
  strong: 'border-emerald-500/60 bg-emerald-500/10',
};

export const HubMarketingDashboard: FC = () => {
  const t = useT();
  const { data: compare, error: compareError, isLoading: compareLoading } =
    usePlanningSnapshotsCompare();
  const { data: marketingData, isLoading: ctxLoading } = useMarketingContext();
  const { data: integrationsRaw, isLoading: intLoading } = useIntegrationList();

  const integrations = Array.isArray(integrationsRaw) ? integrationsRaw : [];
  const h7 = compare?.h7;
  const planning = marketingData?.context?.planning;
  const weeklyTarget =
    typeof planning?.targetPostsPerWeek === 'number'
      ? planning.targetPostsPerWeek
      : null;

  const activeCh = useMemo(
    () => integrations.filter((i) => !i.disabled).length,
    [integrations]
  );

  const total7 = h7 ? plannedTotal(h7) : 0;
  const expected7 = expectedInHorizon(weeklyTarget ?? undefined, 7);
  const gap =
    expected7 != null ? Math.max(0, expected7 - total7) : null;

  const status = useMemo(
    () =>
      statusFromSignals(t, {
        activeCh,
        total7,
        expected7,
        gap,
        hasTarget: weeklyTarget !== null,
      }),
    [t, activeCh, total7, expected7, gap, weeklyTarget]
  );

  const actions = useMemo(
    () =>
      buildActions({
        t,
        integrations,
        h7,
        weeklyTarget,
        horizonDefault: planning?.horizonDaysDefault ?? 14,
      }),
    [t, integrations, h7, weeklyTarget, planning?.horizonDaysDefault]
  );

  const loading = (compareLoading && !compare) || (ctxLoading && !marketingData);

  if (loading) {
    return (
      <section
        className="rounded-[12px] border border-tableBorder bg-newBgColor p-[20px] animate-pulse"
        aria-busy="true"
        aria-label={t('hub_dash_loading', 'Loading dashboard')}
      >
        <div className="h-[20px] bg-newColColor rounded-[6px] w-1/3 mb-[14px]" />
        <div className="h-[12px] bg-newColColor rounded-[6px] w-2/3 mb-[20px]" />
        <div className="h-[80px] bg-newColColor rounded-[8px]" />
      </section>
    );
  }

  if (compareError) {
    return (
      <section className="rounded-[12px] border border-red-500/40 bg-red-500/10 p-[18px] text-[13px] text-red-400">
        <p className="mb-[10px]">
          {t(
            'hub_dash_error',
            'Could not load planning snapshots. Refresh the page or check your connection.'
          )}
        </p>
        <button
          type="button"
          className="text-[12px] underline"
          onClick={() => mutate(COMPARE_SNAPSHOTS_KEY)}
        >
          {t('retry', 'Retry')}
        </button>
      </section>
    );
  }

  const daysQueued = h7?.daysWithQueuedPost ?? null;

  return (
    <div className="flex flex-col gap-[18px]">
      <section
        className={clsx(
          'rounded-[12px] border p-[20px] flex flex-col gap-[14px]',
          toneBorder[status.tone]
        )}
        aria-labelledby="hub-status-heading"
      >
        <div className="flex flex-col tablet:flex-row tablet:items-start tablet:justify-between gap-[12px]">
          <div>
            <p
              id="hub-status-heading"
              className="text-[11px] font-[600] uppercase tracking-wide text-textItemBlur mb-[4px]"
            >
              {t('hub_dash_marketing_pulse', 'Marketing pulse')}
            </p>
            <h3 className="text-[18px] font-[600] text-textColor leading-tight">
              {status.label}
            </h3>
            <p className="text-[13px] text-textItemBlur mt-[6px] max-w-[560px]">
              {status.sub}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 min-[520px]:grid-cols-2 gap-[12px]">
          <div className="rounded-[10px] border border-tableBorder bg-newBgColor px-[14px] py-[12px]">
            <p className="text-[11px] uppercase text-textItemBlur font-[600] mb-[4px]">
              {t('hub_dash_channels', 'Active channels')}
            </p>
            <p className="text-[22px] font-[700] text-textColor tabular-nums">
              {activeCh}
            </p>
            <p className="text-[11px] text-textItemBlur mt-[2px]">
              {t(
                'hub_dash_channels_hint',
                'Connected accounts ready to post'
              )}
            </p>
          </div>
          <div className="rounded-[10px] border border-tableBorder bg-newBgColor px-[14px] py-[12px]">
            <p className="text-[11px] uppercase text-textItemBlur font-[600] mb-[4px]">
              {t('hub_dash_next7', 'Next 7 days — pipeline')}
            </p>
            <p className="text-[22px] font-[700] text-textColor tabular-nums">
              {total7}
            </p>
            <p className="text-[11px] text-textItemBlur mt-[2px]">
              {t('hub_dash_next7_hint', 'Draft + queued posts in the window')}
            </p>
          </div>
          <div className="rounded-[10px] border border-tableBorder bg-newBgColor px-[14px] py-[12px]">
            <p className="text-[11px] uppercase text-textItemBlur font-[600] mb-[4px]">
              {t('hub_dash_weekly_target', 'Weekly target')}
            </p>
            <p className="text-[22px] font-[700] text-textColor tabular-nums">
              {weeklyTarget !== null ? weeklyTarget : '—'}
            </p>
            <p className="text-[11px] text-textItemBlur mt-[2px]">
              {expected7 != null
                ? t(
                    'hub_dash_expected_7',
                    `Implied ~${expected7} posts / 7 days`
                  )
                : t(
                    'hub_dash_no_target_set',
                    'Set in Planning to track gaps'
                  )}
            </p>
          </div>
          <div className="rounded-[10px] border border-tableBorder bg-newBgColor px-[14px] py-[12px]">
            <p className="text-[11px] uppercase text-textItemBlur font-[600] mb-[4px]">
              {t('hub_dash_days_scheduled', 'Days with queued posts')}
            </p>
            <p className="text-[22px] font-[700] text-textColor tabular-nums">
              {daysQueued !== null ? daysQueued : '—'}
            </p>
            <p className="text-[11px] text-textItemBlur mt-[2px]">
              {t(
                'hub_dash_days_scheduled_hint',
                'Across the snapshot window'
              )}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="hub-actions-heading">
        <h3
          id="hub-actions-heading"
          className="text-[15px] font-[600] text-textColor mb-[10px]"
        >
          {t('hub_dash_priorities', 'Recommended next steps')}
        </h3>
        <ol className="flex flex-col gap-[10px] list-decimal list-inside marker:text-btnPrimary marker:font-[600]">
          {actions.slice(0, 6).map((a, idx) => (
            <li key={a.id} className="rounded-[12px] border border-tableBorder bg-newBgColor p-[14px]">
              <div className="inline-block ms-[6px] w-[calc(100%-12px)]">
                <div className="flex flex-col tablet:flex-row tablet:items-center tablet:justify-between gap-[10px]">
                  <div>
                    <span className="text-[13px] font-[600] text-textColor">
                      {idx + 1}. {a.title}
                    </span>
                    <p className="text-[12px] text-textItemBlur mt-[6px] leading-[1.45]">
                      {a.detail}
                    </p>
                  </div>
                  <Link
                    href={a.href}
                    prefetch
                    className={clsx(
                      'shrink-0 text-center whitespace-nowrap rounded-[8px] px-[14px] py-[8px] text-[12px] font-[600]',
                      a.emphasis
                        ? 'bg-btnPrimary text-btnText hover:opacity-90'
                        : 'bg-btnSimple text-btnText hover:opacity-90'
                    )}
                  >
                    {t('hub_dash_go', 'Go')}
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
