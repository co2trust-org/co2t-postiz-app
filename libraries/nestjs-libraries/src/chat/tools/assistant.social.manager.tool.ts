import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { ProductsService } from '@gitroom/nestjs-libraries/database/prisma/products/products.service';
import { PatchPostDto } from '@gitroom/nestjs-libraries/dtos/posts/patch.post.dto';
import { CalendarRebalanceDto } from '@gitroom/nestjs-libraries/dtos/posts/calendar.rebalance.dto';

@Injectable()
export class AssistantSocialManagerTool implements AgentToolInterface {
  constructor(
    private _posts: PostsService,
    private _brand: ProductsService
  ) {}
  name = 'assistantSocialManagerTool';

  run() {
    return createTool({
      id: 'socialManager',
      description: `Post CRUD, calendar, rebalance proposal, per-post analytics, workspace analytics summary, brand profile read/update. Approvals are not yet in DB — submit/approve/reject return not_implemented.`,
      // Single object schema — OpenAI rejects discriminatedUnion tool parameters.
      inputSchema: z.object({
        operation: z.enum([
          'posts.list',
          'posts.get',
          'posts.update',
          'posts.move',
          'posts.delete',
          'posts.duplicate',
          'calendar.get',
          'calendar.rebalance',
          'analytics.postPerformance',
          'analytics.summary',
          'brand.get',
          'brand.update',
          'approvals.submitDraft',
          'approvals.getStatus',
          'approvals.approve',
          'approvals.reject',
        ]),
        from: z.string().optional(),
        to: z.string().optional(),
        integrationId: z.string().optional(),
        status: z
          .array(z.enum(['QUEUE', 'DRAFT', 'PUBLISHED', 'ERROR']))
          .optional(),
        postId: z.string().optional(),
        groupId: z.string().optional(),
        publishDate: z.string().optional(),
        newDate: z.string().optional(),
        dateAction: z.enum(['schedule', 'update']).optional(),
        rescheduleWorkflow: z.boolean().optional(),
        settings: z.record(z.unknown()).optional(),
        segments: z
          .array(
            z.object({
              id: z.string(),
              content: z.string().optional(),
              delay: z.number().optional(),
              image: z.array(z.unknown()).optional(),
            })
          )
          .optional(),
        cadence: z.enum(['daily', 'every_other_day', 'mwf']).optional(),
        maxPerDay: z.number().optional(),
        date: z
          .number()
          .optional()
          .describe('Unix seconds for analytics.postPerformance; default now'),
        voice: z.string().optional(),
        tone: z.string().optional(),
        banned_phrases: z.array(z.string()).optional(),
        required_disclaimers: z.array(z.string()).optional(),
        examples: z.array(z.string()).optional(),
        draftId: z.string().optional(),
        reviewers: z.array(z.string()).optional(),
        reason: z.string().optional(),
      }),
      mcp: {
        annotations: {
          title: 'Social manager',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        switch (inputData.operation) {
          case 'posts.list': {
            if (!inputData.from || !inputData.to) {
              throw new Error('posts.list requires from and to (ISO date range)');
            }
            return this._posts.agentPostsList(organizationId, {
              startDate: inputData.from,
              endDate: inputData.to,
              integrationId: inputData.integrationId,
              state: inputData.status,
            } as any);
          }
          case 'posts.get': {
            if (!inputData.postId) {
              throw new Error('posts.get requires postId');
            }
            return this._posts.getPost(organizationId, inputData.postId);
          }
          case 'posts.update': {
            if (!inputData.postId) {
              throw new Error('posts.update requires postId');
            }
            const patch: PatchPostDto = {
              publishDate: inputData.publishDate,
              dateAction: inputData.dateAction,
              rescheduleWorkflow: inputData.rescheduleWorkflow,
              settings: inputData.settings as any,
              segments: inputData.segments as any,
            };
            return this._posts.patchPostGroup(
              organizationId,
              inputData.postId,
              patch
            );
          }
          case 'posts.move': {
            if (!inputData.postId || !inputData.newDate) {
              throw new Error('posts.move requires postId and newDate');
            }
            return this._posts.patchPostGroup(organizationId, inputData.postId, {
              publishDate: inputData.newDate,
              dateAction: 'schedule',
              rescheduleWorkflow: inputData.rescheduleWorkflow ?? true,
            });
          }
          case 'posts.delete':
            if (inputData.postId) {
              return this._posts.deletePostByPostId(
                organizationId,
                inputData.postId
              );
            }
            if (inputData.groupId) {
              return this._posts.deletePost(organizationId, inputData.groupId);
            }
            throw new Error('posts.delete requires postId or groupId');
          case 'posts.duplicate': {
            if (!inputData.postId) {
              throw new Error('posts.duplicate requires postId');
            }
            return this._posts.duplicatePostGroup(
              organizationId,
              inputData.postId
            );
          }
          case 'calendar.get': {
            if (!inputData.from || !inputData.to) {
              throw new Error('calendar.get requires from and to');
            }
            return this._posts.getCalendar(
              organizationId,
              inputData.from,
              inputData.to,
              inputData.integrationId
            );
          }
          case 'calendar.rebalance': {
            if (!inputData.from || !inputData.to) {
              throw new Error('calendar.rebalance requires from and to');
            }
            const body: CalendarRebalanceDto = {
              from: inputData.from,
              to: inputData.to,
              integrationId: inputData.integrationId,
              cadence: inputData.cadence,
              maxPerDay: inputData.maxPerDay,
            };
            return this._posts.proposeCalendarRebalance(organizationId, body);
          }
          case 'analytics.postPerformance': {
            if (!inputData.postId) {
              throw new Error('analytics.postPerformance requires postId');
            }
            return this._posts.checkPostAnalytics(
              organizationId,
              inputData.postId,
              inputData.date ?? Math.floor(Date.now() / 1000)
            );
          }
          case 'analytics.summary': {
            if (!inputData.from || !inputData.to) {
              throw new Error('analytics.summary requires from and to');
            }
            return this._posts.agentAnalyticsSummary(
              organizationId,
              inputData.from,
              inputData.to,
              inputData.integrationId
            );
          }
          case 'brand.get':
            return this._brand.getBrand(organizationId);
          case 'brand.update':
            return this._brand.updateBrand(organizationId, {
              voice: inputData.voice,
              tone: inputData.tone,
              banned_phrases: inputData.banned_phrases,
              required_disclaimers: inputData.required_disclaimers,
              examples: inputData.examples,
            });
          case 'approvals.submitDraft':
          case 'approvals.getStatus':
          case 'approvals.approve':
          case 'approvals.reject': {
            if (
              inputData.operation === 'approvals.reject' &&
              (!inputData.draftId || !inputData.reason)
            ) {
              throw new Error('approvals.reject requires draftId and reason');
            }
            if (
              ['approvals.getStatus', 'approvals.approve'].includes(
                inputData.operation
              ) &&
              !inputData.draftId
            ) {
              throw new Error(`${inputData.operation} requires draftId`);
            }
            if (
              inputData.operation === 'approvals.submitDraft' &&
              (!inputData.draftId ||
                !inputData.reviewers?.length)
            ) {
              throw new Error(
                'approvals.submitDraft requires draftId and reviewers'
              );
            }
            return {
              notImplemented: true,
              message:
                'Approval workflow tables and states are not deployed yet; use draft/QUEUE posts and human review in UI.',
              operation: inputData.operation,
            };
          }
          default:
            return { error: 'unknown_operation' };
        }
      },
    });
  }
}
