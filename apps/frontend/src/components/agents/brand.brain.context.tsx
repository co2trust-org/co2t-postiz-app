'use client';

import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import {
  Brand,
  BrandBrainPersisted,
  Concept,
  ConceptKind,
  createInitialBrandBrain,
  loadBrandBrainFromStorage,
  saveBrandBrainToStorage,
} from '@gitroom/frontend/components/agents/brand.brain.model';
import {
  MARKETING_CONTEXT_KEY,
  useMarketingContext,
  usePatchMarketingContext,
} from '@gitroom/frontend/components/planning/use.marketing.context';
import { mutate } from 'swr';

export type BrandBrainContextValue = {
  data: BrandBrainPersisted;
  activeBrand: Brand | null;
  setActiveBrandId: (id: string) => void;
  addBrand: (b: { name: string; siteUrl?: string; tagline?: string }) => void;
  updateBrand: (id: string, patch: Partial<Pick<Brand, 'name' | 'siteUrl' | 'tagline'>>) => void;
  addConcept: (input: {
    brandId: string;
    label: string;
    kind: ConceptKind;
    note?: string;
    linkToConceptIds: string[];
    relationLabel?: string;
  }) => void;
  removeConcept: (id: string) => void;
  addLink: (from: string, to: string, relation?: string) => void;
  removeLink: (id: string) => void;
  /** Insert text into the Brand Brain chat input (next tick). */
  prefillChatInput: (text: string) => void;
  /** Consumed by Brand Brain `NewInput` */
  pendingChatPrefill: string | null;
  clearPendingChatPrefill: () => void;
  conceptsForActiveBrand: Concept[];
};

const BrandBrainContext = createContext<BrandBrainContextValue | null>(null);

export const BrandBrainProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [data, setData] = useState<BrandBrainPersisted>(createInitialBrandBrain);
  const [pendingChatPrefill, setPendingChatPrefill] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const lastSavedJson = useRef<string>('');
  const didMigrateEmpty = useRef(false);

  const { data: marketingRes, isLoading: marketingLoading } = useMarketingContext();
  const patchMarketing = usePatchMarketingContext();

  useEffect(() => {
    if (marketingLoading) {
      return;
    }
    if (marketingRes?.context?.brandBrain) {
      const bb = marketingRes.context.brandBrain;
      setData(bb);
      lastSavedJson.current = JSON.stringify(bb);
      setHydrated(true);
      return;
    }
    if (didMigrateEmpty.current) {
      return;
    }
    didMigrateEmpty.current = true;
    const local = loadBrandBrainFromStorage();
    setData(local);
    lastSavedJson.current = JSON.stringify(local);
    setHydrated(true);
    void (async () => {
      try {
        await patchMarketing({ brandBrain: local });
        await mutate(MARKETING_CONTEXT_KEY);
      } catch {
        /* network / auth */
      }
    })();
  }, [marketingLoading, marketingRes, patchMarketing]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    saveBrandBrainToStorage(data);
  }, [data, hydrated]);

  useEffect(() => {
    if (!hydrated || marketingLoading) {
      return;
    }
    const json = JSON.stringify(data);
    if (json === lastSavedJson.current) {
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          await patchMarketing({ brandBrain: data });
          lastSavedJson.current = json;
          await mutate(MARKETING_CONTEXT_KEY);
        } catch {
          /* ignore */
        }
      })();
    }, 700);
    return () => window.clearTimeout(t);
  }, [data, hydrated, marketingLoading, patchMarketing]);

  const activeBrand = useMemo(() => {
    if (!data.activeBrandId) {
      return data.brands[0] || null;
    }
    return data.brands.find((b) => b.id === data.activeBrandId) || data.brands[0] || null;
  }, [data.activeBrandId, data.brands]);

  const setActiveBrandId = useCallback((id: string) => {
    setData((d) => ({ ...d, activeBrandId: id }));
  }, []);

  const addBrand = useCallback(
    (b: { name: string; siteUrl?: string; tagline?: string }) => {
      const name = b.name.trim();
      if (!name) {
        return;
      }
      const id = makeId(10);
      setData((d) => ({
        ...d,
        brands: [
          ...d.brands,
          { id, name, siteUrl: b.siteUrl?.trim() || undefined, tagline: b.tagline?.trim() || undefined },
        ],
        activeBrandId: id,
      }));
    },
    []
  );

  const updateBrand = useCallback(
    (id: string, patch: Partial<Pick<Brand, 'name' | 'siteUrl' | 'tagline'>>) => {
      setData((d) => ({
        ...d,
        brands: d.brands.map((b) => {
          if (b.id !== id) {
            return b;
          }
          return {
            ...b,
            name: patch.name !== undefined ? patch.name : b.name,
            siteUrl: patch.siteUrl !== undefined ? patch.siteUrl : b.siteUrl,
            tagline: patch.tagline !== undefined ? patch.tagline : b.tagline,
          };
        }),
      }));
    },
    []
  );

  const addConcept = useCallback(
    (input: {
      brandId: string;
      label: string;
      kind: ConceptKind;
      note?: string;
      linkToConceptIds: string[];
      relationLabel?: string;
    }) => {
      const label = input.label.trim();
      if (!label) {
        return;
      }
      const id = makeId(10);
      setData((d) => {
        const newConcept: Concept = {
          id,
          brandId: input.brandId,
          kind: input.kind,
          label,
          note: input.note?.trim() || undefined,
        };
        const newLinks: typeof d.links = [];
        for (const target of input.linkToConceptIds) {
          if (target && target !== id) {
            newLinks.push({
              id: makeId(10),
              fromConceptId: id,
              toConceptId: target,
              relation: input.relationLabel?.trim() || 'linked',
            });
          }
        }
        return {
          ...d,
          concepts: [...d.concepts, newConcept],
          links: [...d.links, ...newLinks],
        };
      });
    },
    []
  );

  const removeConcept = useCallback((conceptId: string) => {
    setData((d) => ({
      ...d,
      concepts: d.concepts.filter((c) => c.id !== conceptId),
      links: d.links.filter(
        (l) => l.fromConceptId !== conceptId && l.toConceptId !== conceptId
      ),
    }));
  }, []);

  const addLink = useCallback((from: string, to: string, relation?: string) => {
    if (!from || !to || from === to) {
      return;
    }
    setData((d) => {
      const dup = d.links.some(
        (l) =>
          (l.fromConceptId === from && l.toConceptId === to) ||
          (l.fromConceptId === to && l.toConceptId === from)
      );
      if (dup) {
        return d;
      }
      return {
        ...d,
        links: [
          ...d.links,
          {
            id: makeId(10),
            fromConceptId: from,
            toConceptId: to,
            relation: relation || 'linked',
          },
        ],
      };
    });
  }, []);

  const removeLink = useCallback((linkId: string) => {
    setData((d) => ({ ...d, links: d.links.filter((l) => l.id !== linkId) }));
  }, []);

  const prefillChatInput = useCallback((text: string) => {
    setPendingChatPrefill(text);
  }, []);

  const clearPendingChatPrefill = useCallback(() => {
    setPendingChatPrefill(null);
  }, []);

  const conceptsForActiveBrand = useMemo(() => {
    const bid = data.activeBrandId || data.brands[0]?.id;
    if (!bid) {
      return [];
    }
    return data.concepts.filter((c) => c.brandId === bid);
  }, [data.concepts, data.activeBrandId, data.brands]);

  const value = useMemo<BrandBrainContextValue>(
    () => ({
      data,
      activeBrand: activeBrand || null,
      setActiveBrandId,
      addBrand,
      updateBrand,
      addConcept,
      removeConcept,
      addLink,
      removeLink,
      prefillChatInput,
      pendingChatPrefill,
      clearPendingChatPrefill,
      conceptsForActiveBrand,
    }),
    [
      data,
      activeBrand,
      setActiveBrandId,
      addBrand,
      updateBrand,
      addConcept,
      removeConcept,
      addLink,
      removeLink,
      prefillChatInput,
      pendingChatPrefill,
      clearPendingChatPrefill,
      conceptsForActiveBrand,
    ]
  );

  return (
    <BrandBrainContext.Provider value={value}>{children}</BrandBrainContext.Provider>
  );
};

export function useOptionalBrandBrain(): BrandBrainContextValue | null {
  return useContext(BrandBrainContext);
}
