/** Browser-focused helpers + re-exports from shared brand brain library. */

export {
  BRAND_BRAIN_PROMPT_MAX,
  BRAND_BRAIN_STORAGE_KEY,
  type Brand,
  type BrandBrainPersisted,
  type Concept,
  type ConceptKind,
  type ConceptLink,
  buildAiIdeasTemplate,
  buildLinksForView,
  createInitialBrandBrain,
  formatBrandBrainForPrompt,
  layoutConceptPositions,
} from '@gitroom/nestjs-libraries/marketing/brand.brain.shared';

import { BRAND_BRAIN_STORAGE_KEY } from '@gitroom/nestjs-libraries/marketing/brand.brain.shared';
import {
  createInitialBrandBrain,
  type BrandBrainPersisted,
} from '@gitroom/nestjs-libraries/marketing/brand.brain.shared';

export function loadBrandBrainFromStorage(): BrandBrainPersisted {
  if (typeof window === 'undefined') {
    return createInitialBrandBrain();
  }
  try {
    const raw = localStorage.getItem(BRAND_BRAIN_STORAGE_KEY);
    if (!raw) {
      return createInitialBrandBrain();
    }
    const parsed = JSON.parse(raw) as BrandBrainPersisted;
    if (parsed?.version !== 1 || !Array.isArray(parsed.brands)) {
      return createInitialBrandBrain();
    }
    if (!parsed.brands.length) {
      return createInitialBrandBrain();
    }
    if (!parsed.activeBrandId && parsed.brands[0]) {
      parsed.activeBrandId = parsed.brands[0].id;
    }
    return parsed;
  } catch {
    return createInitialBrandBrain();
  }
}

export function saveBrandBrainToStorage(data: BrandBrainPersisted) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(BRAND_BRAIN_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}
