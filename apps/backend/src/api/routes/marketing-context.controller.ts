import {
  Body,
  Controller,
  Get,
  Patch,
  Query,
} from '@nestjs/common';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { MarketingContextService } from '@gitroom/nestjs-libraries/database/prisma/marketing-context/marketing-context.service';

@ApiTags('Marketing')
@Controller('/marketing-context')
export class MarketingContextController {
  constructor(private _marketingContextService: MarketingContextService) {}

  @Get('/')
  async getContext(@GetOrgFromRequest() org: Organization) {
    return this._marketingContextService.getMarketingContext(org.id);
  }

  @Patch('/')
  async patchContext(
    @GetOrgFromRequest() org: Organization,
    @Body() body: Record<string, unknown>
  ) {
    return this._marketingContextService.patchMarketingContext(org.id, body);
  }

  @Get('/planning-snapshot')
  async planningSnapshot(
    @GetOrgFromRequest() org: Organization,
    @Query('days') days?: string
  ) {
    return this._marketingContextService.getPlanningSnapshot(org.id, days);
  }
}
