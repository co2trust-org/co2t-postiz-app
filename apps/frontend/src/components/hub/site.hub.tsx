'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { FC, ReactNode, useEffect, useMemo, useState } from 'react';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import type { PricingInnerInterface } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/pricing';
import { useUser } from '@gitroom/frontend/components/layout/user.context';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { HubMarketingDashboard } from '@gitroom/frontend/components/hub/site.hub.dashboard';

type HubItem = {
  key: string;
  name: string;
  icon: ReactNode;
  path: string;
  onClick?: () => void;
};

type MenuLike = {
  name: string;
  hide?: boolean;
  requireBilling?: boolean;
  role?: string[];
  path?: string;
  onClick?: () => void;
};

function sidebarItemVisible(
  item: MenuLike,
  user: ReturnType<typeof useUser>,
  billingEnabled: boolean,
  billingLabel: string
): boolean {
  if (item.hide) {
    return false;
  }
  if (item.requireBilling && !billingEnabled) {
    return false;
  }
  if (item.name === billingLabel && user?.isLifetime) {
    return false;
  }
  if (item.role) {
    return item.role.includes(user?.role ?? '');
  }
  return true;
}

function HubCard(props: {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const base =
    'group flex flex-col gap-[10px] rounded-[12px] border border-tableBorder bg-newBgColor hover:bg-boxHover hover:border-btnPrimary/30 p-[18px] text-start outline-none transition-colors focus-visible:ring-2 focus-visible:ring-btnPrimary ring-offset-2 ring-offset-newBgColor';

  if (props.onClick && !props.href) {
    return (
      <button type="button" onClick={props.onClick} className={clsx(base)}>
        {props.children}
      </button>
    );
  }

  return (
    <Link href={props.href ?? '#'} prefetch className={clsx(base)}>
      {props.children}
    </Link>
  );
}

export const SiteHub: FC = () => {
  const t = useT();
  const user = useUser();
  const { billingEnabled, isGeneral, frontEndUrl, environment, mcpUrl } =
    useVariables();
  const { firstMenu, secondMenu } = useMenuItem();

  const billingLabel = useMemo(() => t('billing', 'Billing'), [t]);

  const tierSlug = useMemo(() => {
    if (!user?.tier) {
      return undefined;
    }
    return typeof user.tier === 'object' &&
      user.tier !== null &&
      'current' in user.tier
      ? (user.tier as PricingInnerInterface).current
      : undefined;
  }, [user?.tier]);

  const canSeeFirstTray = useMemo(
    () =>
      !!user?.orgId &&
      (tierSlug !== 'FREE' || !isGeneral || !billingEnabled),
    [tierSlug, user?.orgId, isGeneral, billingEnabled]
  );

  const rows = useMemo(() => {
    const primary: HubItem[] = canSeeFirstTray
      ? firstMenu
          .filter((f) =>
            sidebarItemVisible(f, user, billingEnabled, billingLabel)
          )
          .map((item) => ({
            key: item.name,
            name: item.name,
            icon: item.icon,
            path: item.path,
            onClick: item.onClick,
          }))
      : [];

    const secondary: HubItem[] = secondMenu
      .filter((f) =>
        sidebarItemVisible(f, user, billingEnabled, billingLabel)
      )
      .map((item) => ({
        key: item.name,
        name: item.name,
        icon: item.icon,
        path: item.path,
        onClick: item.onClick,
      }));

    return [...primary, ...secondary];
  }, [
    billingLabel,
    billingEnabled,
    canSeeFirstTray,
    firstMenu,
    secondMenu,
    user,
  ]);

  const [clientOrigin, setClientOrigin] = useState('');
  useEffect(() => {
    setClientOrigin(window.location.origin);
  }, []);
  const siteUrl = frontEndUrl || clientOrigin;

  return (
    <div className="flex flex-1 flex-col gap-[28px] p-[24px] tablet:p-[40px] max-w-[980px] w-full mx-auto overflow-auto scrollbar scrollbar-thumb-fifth scrollbar-track-newBgColorInner">
      <header className="flex flex-col gap-[12px]">
        <h2 className="text-[26px] font-[600] text-textColor tracking-tight">
          {t('site_hub_heading', 'Marketing home')}
        </h2>
        <p className="text-[14px] leading-[1.55] text-textItemBlur max-w-[720px]">
          {t(
            'site_hub_intro',
            'See how your publishing pipeline looks for the week ahead, where you stand versus your target, and prioritized steps to get back on track—then open any workspace from the shortcuts below.'
          )}
        </p>
      </header>

      <HubMarketingDashboard />

      <section
        aria-labelledby="hub-site-details"
        className="rounded-[12px] border border-tableBorder bg-newBgColorInner p-[18px]"
      >
        <h3
          id="hub-site-details"
          className="text-[13px] font-[600] uppercase tracking-wide text-textItemBlur mb-[12px]"
        >
          {t('site_hub_details', 'About this site')}
        </h3>
        <ul className="flex flex-col gap-[8px] text-[13px] text-textColor">
          {siteUrl ? (
            <li>
              <span className="text-textItemBlur">
                {t('site_hub_url_label', 'App URL')}:
              </span>{' '}
              <span className="break-all">{siteUrl}</span>
            </li>
          ) : null}
          {environment ? (
            <li>
              <span className="text-textItemBlur">
                {t('site_hub_environment', 'Environment')}:
              </span>{' '}
              <span>{environment}</span>
            </li>
          ) : null}
          {mcpUrl ? (
            <li className="text-textItemBlur">
              {t(
                'site_hub_mcp_hint',
                'MCP and Public API URLs are configured for this deployment (see Settings › Public API for your keys).'
              )}
            </li>
          ) : null}
        </ul>
      </section>

      <section aria-labelledby="hub-workspaces-heading">
        <h3
          id="hub-workspaces-heading"
          className="text-[15px] font-[600] text-textColor mb-[8px]"
        >
          {t('site_hub_workspaces', 'Workspaces')}
        </h3>
        <p className="text-[13px] text-textItemBlur mb-[14px]">
          {t(
            'site_hub_shortcuts_intro',
            'Same destinations as the left rail—jump in from here when you are done with the dashboard above.'
          )}
        </p>
        <div className="sr-only" id="hub-quick-links">
          {t('site_hub_shortcuts', 'Shortcuts')}
        </div>
        <div className="grid grid-cols-1 min-[560px]:grid-cols-2 gap-[14px]">
          {rows.map((item) => {
            const isExternal = item.path.startsWith('http');

            const cardInner = (
              <>
                <div className="text-textItemFocused">{item.icon}</div>
                <div className="flex flex-col gap-[4px]">
                  <span className="text-[14px] font-[600] text-textColor group-hover:text-textItemFocused leading-tight">
                    {item.name}
                  </span>
                  {(item.path && item.path !== '#') ||
                  typeof item.onClick === 'function' ? (
                    <span className="text-[11px] text-textItemBlur truncate">
                      {typeof item.onClick === 'function'
                        ? t('site_hub_external_action', 'Opens or runs…')
                        : isExternal
                          ? item.path
                          : item.path}
                    </span>
                  ) : null}
                </div>
              </>
            );

            if (item.onClick) {
              return (
                <HubCard key={item.key} onClick={item.onClick}>
                  {cardInner}
                </HubCard>
              );
            }

            if (isExternal) {
              return (
                <a
                  key={item.key}
                  href={item.path}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={clsx(
                    'group flex flex-col gap-[10px] rounded-[12px] border border-tableBorder bg-newBgColor hover:bg-boxHover hover:border-btnPrimary/30 p-[18px] text-start transition-colors focus-visible:ring-2 focus-visible:ring-btnPrimary ring-offset-2 ring-offset-newBgColor'
                  )}
                >
                  {cardInner}
                </a>
              );
            }

            return (
              <HubCard key={item.key} href={item.path}>
                {cardInner}
              </HubCard>
            );
          })}
        </div>
      </section>
    </div>
  );
};
