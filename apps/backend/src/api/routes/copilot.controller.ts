import {
  Logger,
  Controller,
  Get,
  Post,
  Req,
  Res,
  Query,
  Param,
} from '@nestjs/common';
import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNodeHttpEndpoint,
  copilotRuntimeNextJSAppRouterEndpoint,
} from '@copilotkit/runtime';
import { GetOrgFromRequest } from '@gitroom/nestjs-libraries/user/org.from.request';
import { Organization } from '@prisma/client';
import { SubscriptionService } from '@gitroom/nestjs-libraries/database/prisma/subscriptions/subscription.service';
import { MastraAgent } from '@ag-ui/mastra';
import { MastraService } from '@gitroom/nestjs-libraries/chat/mastra.service';
import { Request, Response } from 'express';
import { RequestContext } from '@mastra/core/di';
import { CheckPolicies } from '@gitroom/backend/services/auth/permissions/permissions.ability';
import { AuthorizationActions, Sections } from '@gitroom/backend/services/auth/permissions/permission.exception.class';

export type ChannelsContext = {
  integrations: string;
  organization: string;
  ui: string;
};

/** Mastra recall() returns `messages` (MastraDBMessage[]), not uiMessages. Normalize for the agent UI. */
function textFromMastraDbMessage(msg: Record<string, unknown>): string {
  const content = msg?.content as Record<string, unknown> | string | undefined;
  if (typeof content === 'string') {
    return content;
  }
  if (content && typeof content === 'object') {
    if (content.format === 2 && Array.isArray(content.parts)) {
      return (content.parts as Record<string, unknown>[])
        .map((p) => {
          if (p?.type === 'text' && typeof p.text === 'string') {
            return p.text as string;
          }
          if (typeof p.text === 'string') {
            return p.text as string;
          }
          return '';
        })
        .filter(Boolean)
        .join('\n');
    }
    if (typeof content.content === 'string') {
      return content.content;
    }
  }
  return '';
}

const ALLOWED_OPENAI_MODELS = ['gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano'];
const DEFAULT_OPENAI_MODEL = 'gpt-4.1';
const MAX_THREAD_LIST_LIMIT = 200;
const MAX_THREAD_RECALL_MESSAGES = 200;

@Controller('/copilot')
export class CopilotController {
  constructor(
    private _subscriptionService: SubscriptionService,
    private _mastraService: MastraService
  ) {}

  private resolveRequestedModel(req: Request): string {
    const requestedModel = req?.body?.variables?.properties?.aiModel;
    if (
      typeof requestedModel === 'string' &&
      ALLOWED_OPENAI_MODELS.includes(requestedModel)
    ) {
      return requestedModel;
    }
    return DEFAULT_OPENAI_MODEL;
  }

  @Post('/chat')
  chatAgent(@Req() req: Request, @Res() res: Response) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return res
        .status(503)
        .json({ error: 'openai_api_key_missing', message: 'AI unavailable' });
    }
    const model = this.resolveRequestedModel(req);

    const copilotRuntimeHandler = copilotRuntimeNodeHttpEndpoint({
      endpoint: '/copilot/chat',
      runtime: new CopilotRuntime(),
      serviceAdapter: new OpenAIAdapter({
        model,
      }),
    });

    return copilotRuntimeHandler(req, res);
  }

  @Post('/agent')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async agent(
    @Req() req: Request,
    @Res() res: Response,
    @GetOrgFromRequest() organization: Organization
  ) {
    if (
      process.env.OPENAI_API_KEY === undefined ||
      process.env.OPENAI_API_KEY === ''
    ) {
      Logger.warn('OpenAI API key not set, chat functionality will not work');
      return res
        .status(503)
        .json({ error: 'openai_api_key_missing', message: 'AI unavailable' });
    }
    const mastra = await this._mastraService.mastra();
    const requestContext = new RequestContext<ChannelsContext>();
    requestContext.set(
      'integrations',
      req?.body?.variables?.properties?.integrations || []
    );

    requestContext.set('organization', JSON.stringify(organization));
    requestContext.set('ui', 'true');
    const model = this.resolveRequestedModel(req);

    const agents = MastraAgent.getLocalAgents({
      resourceId: organization.id,
      mastra,
      requestContext: requestContext as any,
    });

    const runtime = new CopilotRuntime({
      agents,
    });

    const copilotRuntimeHandler = copilotRuntimeNextJSAppRouterEndpoint({
      endpoint: '/copilot/agent',
      runtime,
      // properties: req.body.variables.properties,
      serviceAdapter: new OpenAIAdapter({
        model,
      }),
    });

    return copilotRuntimeHandler.handleRequest(req, res);
  }

  @Get('/credits')
  calculateCredits(
    @GetOrgFromRequest() organization: Organization,
    @Query('type') type: 'ai_images' | 'ai_videos'
  ) {
    return this._subscriptionService.checkCredits(
      organization,
      type || 'ai_images'
    );
  }

  @Get('/:thread/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getMessagesList(
    @GetOrgFromRequest() organization: Organization,
    @Param('thread') threadId: string
  ): Promise<any> {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      const recalled = await memory.recall({
        resourceId: organization.id,
        threadId,
        page: 0,
        perPage: MAX_THREAD_RECALL_MESSAGES,
      });
      const raw = recalled.messages || [];
      const uiMessages = (raw as Record<string, unknown>[]).map((m) => ({
        role: m.role === 'assistant' || m.role === 'user' || m.role === 'system'
          ? m.role
          : 'assistant',
        content: textFromMastraDbMessage(m),
      }));
      return {
        uiMessages,
        messages: raw,
        total: recalled.total,
      };
    } catch (err) {
      Logger.warn(
        `copilot thread messages failed threadId=${threadId}: ${(err as Error)?.message}`
      );
      return { uiMessages: [], messages: [], error: 'load_failed' };
    }
  }

  @Get('/list')
  @CheckPolicies([AuthorizationActions.Create, Sections.AI])
  async getList(@GetOrgFromRequest() organization: Organization) {
    const mastra = await this._mastraService.mastra();
    const memory = await mastra.getAgent('postiz').getMemory();
    try {
      const list = await memory.listThreads({
        filter: { resourceId: organization.id },
        perPage: MAX_THREAD_LIST_LIMIT,
        page: 0,
        orderBy: { field: 'createdAt', direction: 'DESC' },
      });

      return {
        threads: list.threads.map((p) => ({
          id: p.id,
          title: p.title,
        })),
      };
    } catch (err) {
      Logger.warn(
        `copilot thread list failed orgId=${organization.id}: ${(err as Error)?.message}`
      );
      return { threads: [], error: 'load_failed' };
    }
  }
}
