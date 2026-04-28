'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback, useMemo } from 'react';
import useSWR from 'swr';
import type { MarketingContextDocumentV1 } from '@gitroom/nestjs-libraries/marketing/marketing.context';

export const MARKETING_CONTEXT_KEY = '/marketing-context';

async function fetchMarketingContext(fetch: ReturnType<typeof useFetch>) {
  const res = await fetch(MARKETING_CONTEXT_KEY);
  if (!res.ok) {
    throw new Error('Failed to load marketing context');
  }
  return res.json() as Promise<{ context: MarketingContextDocumentV1 | null }>;
}

/** GET persisted org marketing context (brand brain + planning). */
export function useMarketingContext() {
  const fetch = useFetch();
  const load = useCallback(() => fetchMarketingContext(fetch), [fetch]);
  return useSWR(MARKETING_CONTEXT_KEY, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    revalidateIfStale: false,
  });
}

export function usePatchMarketingContext() {
  const fetch = useFetch();
  return useCallback(
    async (body: {
      brandBrain?: MarketingContextDocumentV1['brandBrain'];
      planning?: Partial<MarketingContextDocumentV1['planning']>;
    }) => {
      const res = await fetch(MARKETING_CONTEXT_KEY, {
        method: 'PATCH',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        throw new Error('Failed to save marketing context');
      }
      return res.json() as Promise<{ context: MarketingContextDocumentV1 }>;
    },
    [fetch]
  );
}

export function usePlanningSnapshot(days: number) {
  const fetch = useFetch();
  const key =
    days > 0
      ? `/marketing-context/planning-snapshot?days=${days}`
      : null;
  const load = useCallback(async () => {
    if (!key) {
      return null;
    }
    const res = await fetch(key);
    if (!res.ok) {
      throw new Error('Failed to load planning snapshot');
    }
    return res.json();
  }, [fetch, key]);
  return useSWR(key, load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
}
