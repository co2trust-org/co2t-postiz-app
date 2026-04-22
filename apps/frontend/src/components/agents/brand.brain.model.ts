import { makeId } from '@gitroom/nestjs-libraries/services/make.is';

export const BRAND_BRAIN_STORAGE_KEY = 'co2t.brand-brain.v1';
export const BRAND_BRAIN_PROMPT_MAX = 15000;

export type ConceptKind = 'mission' | 'theme' | 'idea';

export type Brand = {
  id: string;
  name: string;
  siteUrl?: string;
  tagline?: string;
};

export type Concept = {
  id: string;
  brandId: string;
  label: string;
  kind: ConceptKind;
  note?: string;
};

export type ConceptLink = {
  id: string;
  fromConceptId: string;
  toConceptId: string;
  relation?: string;
};

export type BrandBrainPersisted = {
  version: 1;
  brands: Brand[];
  concepts: Concept[];
  links: ConceptLink[];
  activeBrandId: string | null;
};

export function createInitialBrandBrain(): BrandBrainPersisted {
  const b1 = makeId(10);
  const b2 = makeId(10);
  const m1 = makeId(10);
  const m2 = makeId(10);
  const t1 = makeId(10);
  return {
    version: 1,
    activeBrandId: b1,
    brands: [
      {
        id: b1,
        name: 'CO2T.earth',
        siteUrl: 'https://co2t.earth',
        tagline: 'Transparent climate action you can track.',
      },
      {
        id: b2,
        name: 'CO2True',
        siteUrl: 'https://co2true.com',
        tagline: 'Proof-first measurement for real outcomes.',
      },
    ],
    concepts: [
      {
        id: m1,
        brandId: b1,
        kind: 'mission',
        label: 'Open verification for every climate claim',
      },
      {
        id: t1,
        brandId: b1,
        kind: 'theme',
        label: 'Radical clarity over green noise',
      },
      {
        id: m2,
        brandId: b2,
        kind: 'mission',
        label: 'True carbon accounting for operators',
      },
    ],
    links: [
      {
        id: makeId(10),
        fromConceptId: m1,
        toConceptId: t1,
        relation: 'reinforces',
      },
    ],
  };
}

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
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BRAND_BRAIN_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota */
  }
}

/** Positions in % for the spiderweb; computed from brand + its concepts. */
export function layoutConceptPositions(
  brand: Brand,
  concepts: Concept[]
): {
  id: string;
  label: string;
  kind: ConceptKind;
  x: number;
  y: number;
}[] {
  const byKind: Record<ConceptKind, Concept[]> = {
    mission: [],
    theme: [],
    idea: [],
  };
  for (const c of concepts) {
    byKind[c.kind].push(c);
  }

  const result: { id: string; label: string; kind: ConceptKind; x: number; y: number }[] = [];

  const placeRing = (items: Concept[], radius: number, phase: number) => {
    const n = items.length;
    if (!n) {
      return;
    }
    items.forEach((c, i) => {
      const t = n === 1 ? 0 : (i / n) * 2 * Math.PI;
      const ang = phase + t;
      result.push({
        id: c.id,
        label: c.label,
        kind: c.kind,
        x: 50 + radius * Math.cos(ang),
        y: 50 - radius * Math.sin(ang) * 0.86,
      });
    });
  };

  placeRing(byKind.mission, 22, 0);
  placeRing(byKind.theme, 34, Math.PI / 5);
  placeRing(byKind.idea, 44, (Math.PI * 2) / 7);

  return result;
}

export function buildLinksForView(
  conceptIds: Set<string>,
  links: ConceptLink[]
): [string, string][] {
  const out: [string, string][] = [];
  for (const l of links) {
    if (conceptIds.has(l.fromConceptId) && conceptIds.has(l.toConceptId)) {
      out.push([l.fromConceptId, l.toConceptId]);
    }
  }
  return out;
}

export function formatBrandBrainForPrompt(data: BrandBrainPersisted): string {
  const lines: string[] = [
    'Brand Brain cloud (user-maintained; respect names and links):',
  ];
  for (const b of data.brands) {
    const tag = b.tagline ? ` — ${b.tagline}` : '';
    const site = b.siteUrl ? ` [${b.siteUrl}]` : '';
    lines.push(`- Brand "${b.name}"${tag}${site} (id: ${b.id})`);
  }
  lines.push('Concepts:');
  for (const c of data.concepts) {
    const brand = data.brands.find((x) => x.id === c.brandId);
    const bname = brand?.name || c.brandId;
    const note = c.note ? ` — ${c.note}` : '';
    lines.push(
      `  • [${c.kind.toUpperCase()}] "${c.label}" (brand: ${bname}, id: ${c.id})${note}`
    );
  }
  if (data.links.length) {
    lines.push('Links between concepts:');
    const cmap = new Map(data.concepts.map((c) => [c.id, c]));
    for (const l of data.links) {
      const a = cmap.get(l.fromConceptId);
      const b = cmap.get(l.toConceptId);
      const rel = l.relation ? ` (${l.relation})` : '';
      if (a && b) {
        lines.push(
          `  • "${a.label}" -> "${b.label}"${rel}`
        );
      }
    }
  }
  lines.push(
    `Active brand for this thread: ${
      data.brands.find((b) => b.id === data.activeBrandId)?.name || '(none)'
    }`
  );
  let text = lines.join('\n');
  if (text.length > BRAND_BRAIN_PROMPT_MAX) {
    text = text.slice(0, BRAND_BRAIN_PROMPT_MAX) + '\n…(truncated)';
  }
  return `[--brand-brain-cloud--]\n${text}\n[--brand-brain-cloud--]`;
}

export function buildAiIdeasTemplate(data: BrandBrainPersisted, brandName: string) {
  return `Using the Brand Brain cloud, propose 5 concrete social post ideas for "${brandName}".

For each: title, 2–3 sentence body hook, which mission/theme it supports, and best channel (LinkedIn, Instagram, X, Threads, etc.).

Focus on the relationships between concepts and avoid generic climate slogans.`;
}
