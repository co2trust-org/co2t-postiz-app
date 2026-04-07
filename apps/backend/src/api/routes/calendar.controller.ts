import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { ApiTags } from '@nestjs/swagger';
import { CalendarRebalanceDto } from '@gitroom/nestjs-libraries/dtos/posts/calendar.rebalance.dto';

@ApiTags('Calendar')
@Controller('/calendar')
export class CalendarController {
  constructor(private _postsService: PostsService) {}

  @Get('/')
  async getCalendar(
    @GetOrgFromRequest() org: Organization,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('integrationId') integrationId?: string
  ) {
    return this._postsService.getCalendar(org.id, from, to, integrationId);
  }

  @Post('/rebalance')
  async rebalance(
    @GetOrgFromRequest() org: Organization,
    @Body() body: CalendarRebalanceDto
  ) {
    return this._postsService.proposeCalendarRebalance(org.id, body);
  }
}
