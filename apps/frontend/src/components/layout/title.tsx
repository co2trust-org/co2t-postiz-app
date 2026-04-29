'use client';

import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { useMenuItem } from '@gitroom/frontend/components/layout/top.menu';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

export const Title = () => {
  const path = usePathname();
  const t = useT();
  const { all: menuItems } = useMenuItem();
  const currentTitle = useMemo(() => {
    if (!path) {
      return '';
    }
    if (path.startsWith('/hub')) {
      return t('site_hub_title', 'Marketing home');
    }
    return menuItems.find((item) => path.indexOf(item.path) > -1)?.name;
  }, [path, menuItems, t]);

  return <h1>{currentTitle}</h1>;
};
