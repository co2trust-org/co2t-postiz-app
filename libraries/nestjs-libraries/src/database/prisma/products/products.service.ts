import { Injectable, Logger } from '@nestjs/common';
import { ProductsRepository } from '@gitroom/nestjs-libraries/database/prisma/products/products.repository';

const DEFAULT_SOURCE_KEY = 'co2t_api_testnet';

function safeJsonStringify(v: unknown, fallback: string) {
  try {
    return JSON.stringify(v ?? []);
  } catch {
    return fallback;
  }
}

function pickString(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return undefined;
}

function normalizeProductRow(raw: Record<string, unknown>): {
  externalId: string;
  slug?: string | null;
  name: string;
  descriptionShort?: string | null;
  descriptionLong?: string | null;
  images: string;
  price?: string | null;
  currency?: string | null;
  claims: string;
  evidence: string;
  tags: string;
  category?: string | null;
  rawJson: string;
  updatedAtExternal?: Date | null;
} | null {
  const externalId =
    pickString(raw.productId) ||
    pickString(raw.id) ||
    pickString(raw.externalId);
  if (!externalId) {
    return null;
  }
  const name =
    pickString(raw.name) ||
    pickString(raw.title) ||
    `Product ${externalId}`;
  const descShort =
    pickString(raw.descriptionShort) ||
    pickString(raw.shortDescription) ||
    pickString(raw.summary);
  const descLong =
    pickString(raw.description) ||
    pickString(raw.longDescription) ||
    pickString(raw.descriptionLong);

  let images: unknown[] = [];
  if (Array.isArray(raw.images)) {
    images = raw.images as unknown[];
  } else if (Array.isArray(raw.imageUrls)) {
    images = raw.imageUrls as unknown[];
  } else if (raw.image && typeof raw.image === 'object') {
    images = [raw.image];
  }

  const imageUrls = images
    .map((img) => {
      if (typeof img === 'string') return img;
      if (img && typeof img === 'object' && 'url' in img) {
        return pickString((img as { url: unknown }).url);
      }
      return undefined;
    })
    .filter(Boolean) as string[];

  const tags: string[] = [];
  if (Array.isArray(raw.tags)) {
    for (const t of raw.tags) {
      const s = pickString(t);
      if (s) tags.push(s);
    }
  }
  if (Array.isArray(raw.categories)) {
    for (const t of raw.categories) {
      const s = pickString(t);
      if (s) tags.push(s);
    }
  }

  let updatedAtExternal: Date | null = null;
  const u =
    pickString(raw.updatedAt) ||
    pickString(raw.updated_at) ||
    pickString(raw.modifiedAt);
  if (u) {
    const d = new Date(u);
    if (!Number.isNaN(d.getTime())) updatedAtExternal = d;
  }

  const price =
    pickString(raw.price) ||
    (raw.variants &&
    Array.isArray(raw.variants) &&
    raw.variants[0] &&
    typeof raw.variants[0] === 'object'
      ? pickString((raw.variants[0] as { price?: unknown }).price)
      : undefined);
  const currency =
    pickString(raw.currency) ||
    (raw.variants &&
    Array.isArray(raw.variants) &&
    raw.variants[0] &&
    typeof raw.variants[0] === 'object'
      ? pickString((raw.variants[0] as { currency?: unknown }).currency)
      : undefined);

  return {
    externalId,
    slug: pickString(raw.slug) || null,
    name,
    descriptionShort: descShort || null,
    descriptionLong: descLong || null,
    images: safeJsonStringify(imageUrls, '[]'),
    price: price || null,
    currency: currency || null,
    claims: safeJsonStringify(raw.claims, '[]'),
    evidence: safeJsonStringify(
      raw.evidence || raw.certifications || [],
      '[]'
    ),
    tags: safeJsonStringify(tags, '[]'),
    category: pickString(raw.category) || null,
    rawJson: safeJsonStringify(raw, '{}'),
    updatedAtExternal,
  };
}

function briefFromProduct(normalized: ReturnType<typeof normalizeProductRow>) {
  if (!normalized) return null;
  const benefits: string[] = [];
  if (normalized.descriptionShort) {
    benefits.push(normalized.descriptionShort.slice(0, 280));
  }
  return {
    positioning: normalized.name,
    keyBenefits: safeJsonStringify(benefits, '[]'),
    idealCustomer: null as string | null,
    proofPoints: normalized.evidence,
    disclaimers: '[]',
    doNotSay: '[]',
  };
}

@Injectable()
export class ProductsService {
  private readonly _log = new Logger(ProductsService.name);

  constructor(private _repo: ProductsRepository) {}

  discover() {
    const base =
      process.env.CO2T_PRODUCTS_API_BASE ||
      'https://main-api-development.up.railway.app';
    return {
      sourceKey: DEFAULT_SOURCE_KEY,
      listPath: '/co2trust-services/v1/products',
      detailPathTemplate: '/co2trust-services/v1/products/{id}',
      postizRestBase: process.env.NEXT_PUBLIC_BACKEND_URL || '(set NEXT_PUBLIC_BACKEND_URL)',
      authMode: process.env.CO2T_PRODUCTS_API_TOKEN
        ? 'bearer_injected_via_httpRequest_tool'
        : 'none_configured_set_CO2T_PRODUCTS_API_TOKEN',
      sampleNormalizedFields: [
        'externalId',
        'name',
        'descriptionShort',
        'images',
        'tags',
        'category',
      ],
      configuredBaseUrl: base,
    };
  }

  async listForOrg(
    orgId: string,
    opts: { cursor?: string; limit?: number; updatedAfter?: Date }
  ) {
    const source = await this._repo.getSource(orgId, DEFAULT_SOURCE_KEY);
    if (!source) {
      return { items: [], nextCursor: null as string | null };
    }
    const limit = Math.min(opts.limit ?? 20, 100);
    const rows = await this._repo.listProducts(
      orgId,
      source.id,
      limit,
      opts.cursor,
      opts.updatedAfter
    );
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;
    return { items, nextCursor };
  }

  async getForOrg(
    orgId: string,
    opts: { id?: string; slug?: string; externalId?: string }
  ) {
    const source = await this._repo.getSource(orgId, DEFAULT_SOURCE_KEY);
    if (!source) return null;
    if (opts.slug) {
      return this._repo.findBySlug(orgId, opts.slug);
    }
    if (opts.externalId) {
      return this._repo.findByExternalId(orgId, source.id, opts.externalId);
    }
    if (opts.id) {
      return this._repo.findByCacheId(orgId, opts.id);
    }
    return null;
  }

  async searchForOrg(orgId: string, query: string, limit?: number) {
    return this._repo.searchByName(
      orgId,
      query,
      Math.min(limit ?? 10, 50)
    );
  }

  async ingest(
    orgId: string,
    opts: {
      mode: 'summary' | 'full';
      limit?: number;
      updatedAfter?: string;
      dryRun?: boolean;
    }
  ) {
    const baseUrl = (
      process.env.CO2T_PRODUCTS_API_BASE ||
      'https://main-api-development.up.railway.app'
    ).replace(/\/$/, '');
    const token = process.env.CO2T_PRODUCTS_API_TOKEN || '';
    const pageSize = Math.min(opts.mode === 'summary' ? 20 : 50, 100);
    const maxItems =
      opts.limit ?? (opts.mode === 'summary' ? 10 : 500);

    if (opts.dryRun) {
      return {
        dryRun: true,
        wouldFetchFrom: `${baseUrl}/co2trust-services/v1/products`,
        maxItems,
        mode: opts.mode,
      };
    }

    const source = await this._repo.upsertSource(
      orgId,
      DEFAULT_SOURCE_KEY,
      baseUrl
    );

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const upserted: string[] = [];
    let page = 1;
    let totalFetched = 0;

    while (totalFetched < maxItems) {
      const url = new URL(
        `${baseUrl}/co2trust-services/v1/products`
      );
      url.searchParams.set('page', String(page));
      url.searchParams.set('size', String(pageSize));
      url.searchParams.set('order', 'desc');

      const res = await fetch(url.toString(), { headers });
      if (!res.ok) {
        const text = await res.text();
        this._log.warn(`Product ingest HTTP ${res.status}: ${text.slice(0, 200)}`);
        break;
      }
      const body = (await res.json()) as Record<string, unknown>;
      const content = (body.content || body.items || body.data || body.results) as
        | unknown[]
        | undefined;
      const list = Array.isArray(content) ? content : [];

      if (!list.length) {
        break;
      }

      for (const item of list) {
        if (totalFetched >= maxItems) break;
        if (!item || typeof item !== 'object') continue;
        const normalized = normalizeProductRow(item as Record<string, unknown>);
        if (!normalized) continue;

        const row = await this._repo.upsertProduct(orgId, source.id, normalized);
        upserted.push(row.id);
        totalFetched++;

        if (opts.mode === 'full') {
          const brief = briefFromProduct(normalized);
          if (brief) {
            await this._repo.upsertBrief(orgId, row.id, brief);
          }
        }
      }

      const totalPages = pickString(body.totalPages);
      const total = Number(body.total);
      page++;
      if (totalPages && page > Number(totalPages)) break;
      if (list.length < pageSize) break;
      if (Number.isFinite(total) && totalFetched >= total) break;
    }

    await this._repo.touchSourceIngested(source.id);

    return {
      upsertedCount: upserted.length,
      upsertedIds: upserted,
      sourceId: source.id,
    };
  }

  getBrand(orgId: string) {
    return this._repo.getBrandProfile(orgId);
  }

  async updateBrand(
    orgId: string,
    body: {
      voice?: string;
      tone?: string;
      banned_phrases?: string[];
      required_disclaimers?: string[];
      examples?: string[];
    }
  ) {
    return this._repo.upsertBrandProfile(orgId, {
      voice: body.voice,
      toneNotes: body.tone,
      bannedPhrases: safeJsonStringify(body.banned_phrases, '[]'),
      disclaimers: safeJsonStringify(body.required_disclaimers, '[]'),
      examples: safeJsonStringify(body.examples, '[]'),
    });
  }
}
