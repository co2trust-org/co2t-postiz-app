import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { PromoImageTemplateService } from '@gitroom/nestjs-libraries/database/prisma/promo-image-template/promo-image-template.service';
import {
  CreatePromoImageTemplateDto,
  GeneratePromoImageDto,
  UpdatePromoImageTemplateDto,
} from '@gitroom/nestjs-libraries/dtos/promo-image-template/promo-image-template.dto';

@ApiTags('PromoImageTemplates')
@Controller('/promo-image-templates')
export class PromoImageTemplateController {
  constructor(private _promo: PromoImageTemplateService) {}

  @Get('/')
  list(@GetOrgFromRequest() org: Organization) {
    return this._promo.list(org.id);
  }

  @Get('/:id')
  get(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._promo.get(org.id, id);
  }

  @Post('/')
  create(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CreatePromoImageTemplateDto
  ) {
    return this._promo.create(org.id, body);
  }

  @Put('/:id')
  update(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: UpdatePromoImageTemplateDto
  ) {
    return this._promo.update(org.id, id, body);
  }

  @Delete('/:id')
  remove(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string
  ) {
    return this._promo.delete(org.id, id);
  }

  @Post('/:id/generate')
  generate(
    @GetOrgFromRequest() org: Organization,
    @Param('id') id: string,
    @Body() body: GeneratePromoImageDto
  ) {
    return this._promo.generate(org, id, body);
  }
}
