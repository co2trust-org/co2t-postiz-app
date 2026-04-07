import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProductsRepository {
  constructor(
    private _source: PrismaRepository<'productSource'>,
    private _cache: PrismaRepository<'productCache'>,
    private _brief: PrismaRepository<'productBrief'>,
    private _brand: PrismaRepository<'brandAssistantProfile'>,
    private _audit: PrismaRepository<'assistantHttpAuditLog'>
  ) {}

  upsertSource(orgId: string, sourceKey: string, baseUrl: string) {
    return this._source.model.productSource.upsert({
      where: {
        organizationId_sourceKey: { organizationId: orgId, sourceKey },
      },
      create: {
        organizationId: orgId,
        sourceKey,
        baseUrl,
      },
      update: { baseUrl },
    });
  }

  touchSourceIngested(sourceId: string) {
    return this._source.model.productSource.update({
      where: { id: sourceId },
      data: { lastIngestedAt: new Date() },
    });
  }

  getSource(orgId: string, sourceKey: string) {
    return this._source.model.productSource.findUnique({
      where: {
        organizationId_sourceKey: { organizationId: orgId, sourceKey },
      },
    });
  }

  async upsertProduct(
    orgId: string,
    sourceId: string,
    data: {
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
      rawJson?: string | null;
      updatedAtExternal?: Date | null;
    }
  ) {
    return this._cache.model.productCache.upsert({
      where: {
        sourceId_externalId: { sourceId, externalId: data.externalId },
      },
      create: {
        organizationId: orgId,
        sourceId,
        ...data,
      },
      update: {
        ...data,
      },
    });
  }

  listProducts(
    orgId: string,
    sourceId: string,
    take: number,
    cursor?: string,
    updatedAfter?: Date
  ) {
    return this._cache.model.productCache.findMany({
      where: {
        organizationId: orgId,
        sourceId,
        ...(updatedAfter
          ? { updatedAtExternal: { gte: updatedAfter } }
          : {}),
      },
      take: take + 1,
      ...(cursor
        ? {
            skip: 1,
            cursor: { id: cursor },
          }
        : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        externalId: true,
        slug: true,
        name: true,
        updatedAtExternal: true,
        updatedAtLocal: true,
      },
    });
  }

  findByExternalId(orgId: string, sourceId: string, externalId: string) {
    return this._cache.model.productCache.findFirst({
      where: { organizationId: orgId, sourceId, externalId },
      include: { brief: true, source: true },
    });
  }

  findBySlug(orgId: string, slug: string) {
    return this._cache.model.productCache.findFirst({
      where: { organizationId: orgId, slug },
      include: { brief: true, source: true },
    });
  }

  findByCacheId(orgId: string, id: string) {
    return this._cache.model.productCache.findFirst({
      where: { organizationId: orgId, id },
      include: { brief: true, source: true },
    });
  }

  searchByName(orgId: string, q: string, limit: number) {
    return this._cache.model.productCache.findMany({
      where: {
        organizationId: orgId,
        name: { contains: q, mode: 'insensitive' },
      },
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        externalId: true,
        slug: true,
        name: true,
        descriptionShort: true,
        updatedAtExternal: true,
      },
    });
  }

  upsertBrief(
    orgId: string,
    productCacheId: string,
    data: {
      positioning?: string | null;
      keyBenefits: string;
      idealCustomer?: string | null;
      proofPoints: string;
      disclaimers: string;
      doNotSay: string;
    }
  ) {
    return this._brief.model.productBrief.upsert({
      where: { productCacheId },
      create: {
        organizationId: orgId,
        productCacheId,
        ...data,
        lastGeneratedAt: new Date(),
      },
      update: {
        ...data,
        lastGeneratedAt: new Date(),
      },
    });
  }

  getBrandProfile(orgId: string) {
    return this._brand.model.brandAssistantProfile.findUnique({
      where: { organizationId: orgId },
    });
  }

  upsertBrandProfile(
    orgId: string,
    data: {
      voice?: string | null;
      toneNotes?: string | null;
      bannedPhrases?: string;
      disclaimers?: string;
      examples?: string;
    }
  ) {
    return this._brand.model.brandAssistantProfile.upsert({
      where: { organizationId: orgId },
      create: {
        organizationId: orgId,
        voice: data.voice ?? null,
        toneNotes: data.toneNotes ?? null,
        bannedPhrases: data.bannedPhrases ?? '[]',
        disclaimers: data.disclaimers ?? '[]',
        examples: data.examples ?? '[]',
      },
      update: {
        voice: data.voice,
        toneNotes: data.toneNotes,
        bannedPhrases: data.bannedPhrases,
        disclaimers: data.disclaimers,
        examples: data.examples,
      },
    });
  }

  createAuditLog(data: {
    organizationId: string;
    method: string;
    url: string;
    status?: number | null;
    durationMs?: number | null;
    error?: string | null;
  }) {
    return this._audit.model.assistantHttpAuditLog.create({ data });
  }
}
