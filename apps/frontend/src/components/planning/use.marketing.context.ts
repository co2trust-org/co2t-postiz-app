'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
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

export type PlanningSnapshotPayload = {
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

export const COMPARE_SNAPSHOTS_KEY = 'planning-snapshots-compare-7-14-30';

/** Parallel load of 7-, 14-, and 30-day pipeline snapshots for dashboard comparison. */
export function usePlanningSnapshotsCompare() {
  const fetch = useFetch();
  const load = useCallback(async (): Promise<{
    h7: PlanningSnapshotPayload;
    h14: PlanningSnapshotPayload;
    h30: PlanningSnapshotPayload;
  }> => {
    const [r7, r14, r30] = await Promise.all([
      fetch('/marketing-context/planning-snapshot?days=7'),
      fetch('/marketing-context/planning-snapshot?days=14'),
      fetch('/marketing-context/planning-snapshot?days=30'),
    ]);
    if (!r7.ok || !r14.ok || !r30.ok) {
      throw new Error('Failed to load planning snapshots');
    }
    const [h7, h14, h30] = await Promise.all([
      r7.json() as Promise<PlanningSnapshotPayload>,
      r14.json() as Promise<PlanningSnapshotPayload>,
      r30.json() as Promise<PlanningSnapshotPayload>,
    ]);
    return { h7, h14, h30 };
  }, [fetch]);

  return useSWR(COMPARE_SNAPSHOTS_KEY, load, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
}
