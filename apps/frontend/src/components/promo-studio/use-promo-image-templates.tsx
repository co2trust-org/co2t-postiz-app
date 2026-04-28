'use client';

import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useCallback } from 'react';
import useSWR from 'swr';

export type PromoTemplateField = {
  key: string;
  label: string;
  placeholder?: string;
};

export type PromoImageTemplateDto = {
  id: string;
  organizationId: string;
  name: string;
  promptTemplate: string;
  styleBlock: string | null;
  fieldSchema: PromoTemplateField[];
  defaultTagIds: string[];
  createdAt: string;
  updatedAt: string;
};

export function usePromoImageTemplates() {
  const fetch = useFetch();
  const load = useCallback(async (): Promise<PromoImageTemplateDto[]> => {
    const r = await fetch('/promo-image-templates');
    if (!r.ok) {
      throw new Error('Failed to load templates');
    }
    return r.json();
  }, [fetch]);
  return useSWR('promo-image-templates', load);
}

export function usePromoImageTemplate(templateId: string | null) {
  const fetch = useFetch();
  const load = useCallback(async (): Promise<PromoImageTemplateDto> => {
    if (!templateId) {
      throw new Error('Missing template id');
    }
    const r = await fetch(`/promo-image-templates/${templateId}`);
    if (!r.ok) {
      throw new Error('Failed to load template');
    }
    return r.json();
  }, [fetch, templateId]);
  return useSWR(
    templateId ? `promo-image-template-${templateId}` : null,
    load
  );
}
