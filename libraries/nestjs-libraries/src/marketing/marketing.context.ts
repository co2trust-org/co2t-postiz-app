import {
  BrandBrainPersisted,
  createInitialBrandBrain,
  parseBrandBrainFromJson,
} from './brand.brain.shared';

export type HorizonDaysPreset = 7 | 14 | 30;

export type PlanningDefinitionsV1 = {
  horizonDaysDefault: HorizonDaysPreset;
  campaignTheme?: string;
  targetPostsPerWeek?: number;
  focusConceptIds?: string[];
  notes?: string;
};

export type MarketingContextDocumentV1 = {
  version: 1;
  brandBrain: BrandBrainPersisted;
  planning: PlanningDefinitionsV1;
};

export const defaultPlanningDefinitions = (): PlanningDefinitionsV1 => ({
  horizonDaysDefault: 14,
});

export function createDefaultMarketingContextDocument(): MarketingContextDocumentV1 {
  return {
    version: 1,
    brandBrain: createInitialBrandBrain(),
    planning: defaultPlanningDefinitions(),
  };
}

function isHorizonDays(n: unknown): n is HorizonDaysPreset {
  return n === 7 || n === 14 || n === 30;
}

function parsePlanning(raw: unknown): PlanningDefinitionsV1 {
  if (!raw || typeof raw !== 'object') {
    return defaultPlanningDefinitions();
  }
  const p = raw as Record<string, unknown>;
  const horizon = p.horizonDaysDefault;
  return {
    horizonDaysDefault: isHorizonDays(horizon)
      ? horizon
      : defaultPlanningDefinitions().horizonDaysDefault,
    campaignTheme:
      typeof p.campaignTheme === 'string' ? p.campaignTheme : undefined,
    targetPostsPerWeek:
      typeof p.targetPostsPerWeek === 'number' && Number.isFinite(p.targetPostsPerWeek)
        ? p.targetPostsPerWeek
        : undefined,
    focusConceptIds: Array.isArray(p.focusConceptIds)
      ? p.focusConceptIds.filter((x): x is string => typeof x === 'string')
      : undefined,
    notes: typeof p.notes === 'string' ? p.notes : undefined,
  };
}

/** Parse unknown DB JSON into a normalized v1 document. */
export function parseMarketingContextDocument(raw: unknown): MarketingContextDocumentV1 {
  if (!raw || typeof raw !== 'object') {
    return createDefaultMarketingContextDocument();
  }
  const doc = raw as Record<string, unknown>;
  const version = doc.version;
  if (version !== 1) {
    return createDefaultMarketingContextDocument();
  }
  const brandBrain = parseBrandBrainFromJson(doc.brandBrain);
  return {
    version: 1,
    brandBrain,
    planning: parsePlanning(doc.planning),
  };
}

export type PatchMarketingContextInput = {
  brandBrain?: BrandBrainPersisted;
  planning?: Partial<PlanningDefinitionsV1>;
};

export function mergeMarketingContextPatch(
  current: MarketingContextDocumentV1,
  patch: PatchMarketingContextInput
): MarketingContextDocumentV1 {
  const nextPlanning: PlanningDefinitionsV1 = { ...current.planning };
  if (patch.planning) {
    const p = patch.planning;
    if (p.horizonDaysDefault !== undefined) {
      nextPlanning.horizonDaysDefault = isHorizonDays(p.horizonDaysDefault)
        ? p.horizonDaysDefault
        : current.planning.horizonDaysDefault;
    }
    if (p.campaignTheme !== undefined) {
      nextPlanning.campaignTheme = p.campaignTheme;
    }
    if (p.targetPostsPerWeek !== undefined) {
      nextPlanning.targetPostsPerWeek = p.targetPostsPerWeek;
    }
    if (p.focusConceptIds !== undefined) {
      nextPlanning.focusConceptIds = p.focusConceptIds;
    }
    if (p.notes !== undefined) {
      nextPlanning.notes = p.notes;
    }
  }
  return {
    version: 1,
    brandBrain: patch.brandBrain ?? current.brandBrain,
    planning: nextPlanning,
  };
}
