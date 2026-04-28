import { Injectable } from '@nestjs/common';
import { PrismaRepository } from '@gitroom/nestjs-libraries/database/prisma/prisma.service';
import {
  CreatePromoImageTemplateDto,
  UpdatePromoImageTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/promo-image-template/promo-image-template.dto';

@Injectable()
export class PromoImageTemplateRepository {
  constructor(private _promo: PrismaRepository<'promoImageTemplate'>) {}

  findManyForOrg(organizationId: string) {
    return this._promo.model.promoImageTemplate.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  findByIdForOrg(organizationId: string, id: string) {
    return this._promo.model.promoImageTemplate.findFirst({
      where: { organizationId, id },
    });
  }

  create(organizationId: string, body: CreatePromoImageTemplateDto) {
    const fieldSchema = JSON.stringify(body.fieldSchema ?? []);
    const defaultTagIds = JSON.stringify(body.defaultTagIds ?? []);
    return this._promo.model.promoImageTemplate.create({
      data: {
        organizationId,
        name: body.name,
        promptTemplate: body.promptTemplate,
        styleBlock: body.styleBlock ?? null,
        fieldSchema,
        defaultTagIds,
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    body: UpdatePromoImageTemplateDto
  ) {
    const existing = await this.findByIdForOrg(organizationId, id);
    if (!existing) {
      return null;
    }
    const data: Record<string, string | null | undefined> = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.promptTemplate !== undefined) {
      data.promptTemplate = body.promptTemplate;
    }
    if (body.styleBlock !== undefined) data.styleBlock = body.styleBlock;
    if (body.fieldSchema !== undefined) {
      data.fieldSchema = JSON.stringify(body.fieldSchema);
    }
    if (body.defaultTagIds !== undefined) {
      data.defaultTagIds = JSON.stringify(body.defaultTagIds);
    }
    return this._promo.model.promoImageTemplate.update({
      where: { id },
      data: data as any,
    });
  }

  async delete(organizationId: string, id: string) {
    const result = await this._promo.model.promoImageTemplate.deleteMany({
      where: { organizationId, id },
    });
    return result.count > 0;
  }
}
