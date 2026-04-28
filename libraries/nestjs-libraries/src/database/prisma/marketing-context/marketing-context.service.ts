import {
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { OrganizationRepository } from '@gitroom/nestjs-libraries/database/prisma/organizations/organization.repository';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { MediaRepository } from '@gitroom/nestjs-libraries/database/prisma/media/media.repository';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import {
  createDefaultMarketingContextDocument,
  mergeMarketingContextPatch,
  MarketingContextDocumentV1,
  parseMarketingContextDocument,
  PatchMarketingContextInput,
} from '@gitroom/nestjs-libraries/marketing/marketing.context';
import { buildMergedAgentContextWithOrgMarketing } from '@gitroom/nestjs-libraries/marketing/marketing.agent.brief';
import { BrandBrainPersisted } from '@gitroom/nestjs-libraries/marketing/brand.brain.shared';
import dayjs from 'dayjs';
import type { Prisma } from '@prisma/client';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

@Injectable()
export class MarketingContextService {
  constructor(
    private _organizationRepository: OrganizationRepository,
    private _postsService: PostsService,
    private _mediaRepository: MediaRepository,
    private _integrationService: IntegrationService
  ) {}

  async getMarketingContext(
    orgId: string
  ): Promise<{ context: MarketingContextDocumentV1 | null }> {
    const row =
      await this._organizationRepository.getMarketingContextJson(orgId);
    const raw = row?.marketingContext;
    if (raw == null || (isRecord(raw) && Object.keys(raw).length === 0)) {
      return { context: null };
    }
    return { context: parseMarketingContextDocument(raw) };
  }

  /** Merge PATCH into stored document; creates defaults if absent. */
  async patchMarketingContext(
    orgId: string,
    body: PatchMarketingContextInput | Record<string, unknown>
  ): Promise<{ context: MarketingContextDocumentV1 }> {
    const currentRow =
      await this._organizationRepository.getMarketingContextJson(orgId);
    const raw = currentRow?.marketingContext;
    const base: MarketingContextDocumentV1 =
      raw == null
        ? createDefaultMarketingContextDocument()
        : parseMarketingContextDocument(raw);

    const patch =
      this.normalizePatch(body);
    if (patch.brandBrain) {
      this.ensureBrandBrainShape(patch.brandBrain);
    }

    const next = mergeMarketingContextPatch(base, patch);
    await this._organizationRepository.updateMarketingContextJson(
      orgId,
      JSON.parse(JSON.stringify(next)) as Prisma.InputJsonValue
    );
    return { context: next };
  }

  normalizePatch(body: PatchMarketingContextInput | Record<string, unknown>): PatchMarketingContextInput {
    if (!isRecord(body)) {
      throw new HttpException('Invalid body', HttpStatus.BAD_REQUEST);
    }
    const out: PatchMarketingContextInput = {};
    if (body.brandBrain !== undefined) {
      if (!isRecord(body.brandBrain)) {
        throw new HttpException(
          'brandBrain must be an object',
          HttpStatus.BAD_REQUEST
        );
      }
      out.brandBrain = body.brandBrain as unknown as BrandBrainPersisted;
    }
    if (body.planning !== undefined && body.planning !== null) {
      if (!isRecord(body.planning)) {
        throw new HttpException(
          'planning must be an object',
          HttpStatus.BAD_REQUEST
        );
      }
      out.planning = body.planning;
    }
    return out;
  }

  private ensureBrandBrainShape(bb: BrandBrainPersisted): void {
    if (bb.version !== 1 || !Array.isArray(bb.brands)) {
      throw new HttpException(
        'Invalid brandBrain document',
        HttpStatus.BAD_REQUEST
      );
    }
  }

  async getPlanningSnapshot(orgId: string, daysRaw: unknown) {
    const daysParsed = typeof daysRaw === 'string' ? Number(daysRaw) : Number(daysRaw);
    const days = Number.isFinite(daysParsed)
      ? Math.min(90, Math.max(1, Math.floor(daysParsed)))
      : 14;
    const from = dayjs.utc().startOf('day');
    const to = from.add(days, 'day').endOf('day');
    const fromIso = from.toISOString();
    const toIso = to.toISOString();

    const posts = await this._postsService.getCalendar(
      orgId,
      fromIso,
      toIso,
      undefined
    );

    let draftTotal = 0;
    let queueTotal = 0;
    type Row = {
      integrationId: string;
      draft: number;
      queue: number;
    };
    const byIntegration = new Map<string, Row>();
    const stateVals = posts as unknown as { integrationId?: string; state?: string }[];
    for (const row of stateVals) {
      if (!row.integrationId) {
        continue;
      }
      const agg =
        byIntegration.get(row.integrationId) ||
        ({
          integrationId: row.integrationId,
          draft: 0,
          queue: 0,
        } satisfies Row);

      const st = row.state?.toUpperCase();
      if (st === 'DRAFT') {
        agg.draft += 1;
        draftTotal += 1;
      } else if (st === 'QUEUE') {
        agg.queue += 1;
        queueTotal += 1;
      }

      byIntegration.set(row.integrationId, agg);
    }

    const integrations = await this._integrationService.getIntegrationsList(
      orgId
    );

    const nameById = new Map(
      (integrations as { id: string; name: string }[]).map((i) => [
        i.id,
        i.name || '',
      ])
    );

    const byIntegrationList = [...byIntegration.values()].map((r) => ({
      integrationId: r.integrationId,
      integrationName: String(nameById.get(r.integrationId) ?? ''),
      draft: r.draft,
      queue: r.queue,
    }));

    const mediaImportedInRange =
      await this._mediaRepository.countImportedInDateRange(
        orgId,
        from.toDate(),
        to.toDate()
      );

    const daysScheduledWithQueuePost = await this.daysWithQueueCount(
      orgId,
      fromIso,
      toIso
    );

    return {
      days,
      fromUtc: fromIso,
      toUtc: toIso,
      totals: {
        draft: draftTotal,
        queued: queueTotal,
      },
      byIntegration: byIntegrationList,
      mediaImportedInRange,
      daysWithQueuedPost: daysScheduledWithQueuePost,
    };
  }

  private async daysWithQueueCount(
    orgId: string,
    fromIso: string,
    toIso: string
  ): Promise<number> {
    const posts = await this._postsService.getCalendar(
      orgId,
      fromIso,
      toIso,
      undefined
    );
    const days = new Set<string>();
    for (const p of posts as unknown as { state?: string; publishDate?: Date }[]) {
      if (p.state?.toUpperCase() === 'QUEUE' && p.publishDate) {
        days.add(dayjs.utc(p.publishDate).format('YYYY-MM-DD'));
      }
    }
    return days.size;
  }

  /**
   * Server merge for Copilot: org marketing + operator sidebar (same 14k cap as controller).
   */
  async mergeAgentOperatorContext(
    orgId: string,
    operatorSidebarContext: string
  ): Promise<string> {
    const row =
      await this._organizationRepository.getMarketingContextJson(orgId);
    const raw = row?.marketingContext;
    if (raw == null) {
      return operatorSidebarContext.slice(0, 14000);
    }
    const doc = parseMarketingContextDocument(raw);
    return buildMergedAgentContextWithOrgMarketing({
      operatorSidebarContext,
      doc,
    });
  }
}
