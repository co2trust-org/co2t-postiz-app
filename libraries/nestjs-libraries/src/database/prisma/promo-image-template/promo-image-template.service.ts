import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Organization } from '@prisma/client';
import { PromoImageTemplateRepository } from '@gitroom/nestjs-libraries/database/prisma/promo-image-template/promo-image-template.repository';
import { MediaService } from '@gitroom/nestjs-libraries/database/prisma/media/media.service';
import {
  CreatePromoImageTemplateDto,
  GeneratePromoImageDto,
  PromoTemplateFieldDefDto,
  UpdatePromoImageTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/promo-image-template/promo-image-template.dto';

const BRAND_BRAIN_CONTEXT_MAX = 15000;

export function interpolatePlaceholders(
  template: string,
  vars: Record<string, string>
) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v ?? '');
  }
  return out;
}

function parseFieldSchema(raw: string): PromoTemplateFieldDefDto[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseDefaultTagIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((x) => typeof x === 'string')
      : [];
  } catch {
    return [];
  }
}

function mapTemplateRow(row: {
  id: string;
  organizationId: string;
  name: string;
  promptTemplate: string;
  styleBlock: string | null;
  fieldSchema: string;
  defaultTagIds: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    fieldSchema: parseFieldSchema(row.fieldSchema),
    defaultTagIds: parseDefaultTagIds(row.defaultTagIds),
  };
}

@Injectable()
export class PromoImageTemplateService {
  constructor(
    private _repo: PromoImageTemplateRepository,
    private _mediaService: MediaService
  ) {}

  list(orgId: string) {
    return this._repo.findManyForOrg(orgId).then((rows) => rows.map(mapTemplateRow));
  }

  async get(orgId: string, id: string) {
    const row = await this._repo.findByIdForOrg(orgId, id);
    if (!row) {
      throw new NotFoundException();
    }
    return mapTemplateRow(row);
  }

  create(orgId: string, body: CreatePromoImageTemplateDto) {
    return this._repo.create(orgId, body).then(mapTemplateRow);
  }

  async update(orgId: string, id: string, body: UpdatePromoImageTemplateDto) {
    const updated = await this._repo.update(orgId, id, body);
    if (!updated) {
      throw new NotFoundException();
    }
    return mapTemplateRow(updated);
  }

  async delete(orgId: string, id: string) {
    const ok = await this._repo.delete(orgId, id);
    if (!ok) {
      throw new NotFoundException();
    }
    return { ok: true };
  }

  async generate(
    org: Organization,
    templateId: string,
    body: GeneratePromoImageDto
  ) {
    const templateRow = await this._repo.findByIdForOrg(org.id, templateId);
    if (!templateRow) {
      throw new NotFoundException();
    }
    const template = mapTemplateRow(templateRow);
    const vars: Record<string, string> = { ...(body.variables ?? {}) };
    for (const field of template.fieldSchema) {
      if (vars[field.key] === undefined) {
        vars[field.key] = '';
      }
    }

    let description = interpolatePlaceholders(template.promptTemplate, vars);
    if (body.includeBrandBrain && body.brandBrainContext?.trim()) {
      let bb = body.brandBrainContext.trim();
      if (bb.length > BRAND_BRAIN_CONTEXT_MAX) {
        bb = bb.slice(0, BRAND_BRAIN_CONTEXT_MAX) + '\n…(truncated)';
      }
      description = `${description}\n\n${bb}`;
    }

    let styleSection = '';
    if (template.styleBlock?.trim()) {
      const styled = interpolatePlaceholders(template.styleBlock, vars).trim();
      if (styled) {
        styleSection = `
<!-- style -->
${styled}
<!-- /style -->
`;
      }
    }

    const prompt = `
<!-- description -->
${description}
<!-- /description -->
${styleSection}
`;

    const saved = await this._mediaService.generateImageWithPromptUploadAndSave(
      org,
      prompt
    );
    if (!saved) {
      return false;
    }

    const tagIds = template.defaultTagIds;
    if (tagIds.length) {
      return this._mediaService.setMediaTags(org.id, saved.id, tagIds);
    }
    return { ...saved, tags: [] as { id: string; name: string; color: string }[] };
  }
}
