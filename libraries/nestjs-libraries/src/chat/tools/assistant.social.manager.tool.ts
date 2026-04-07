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
      inputSchema: z.discriminatedUnion('operation', [
        z.object({
          operation: z.literal('posts.list'),
          from: z.string(),
          to: z.string(),
          integrationId: z.string().optional(),
          status: z
            .array(z.enum(['QUEUE', 'DRAFT', 'PUBLISHED', 'ERROR']))
            .optional(),
        }),
        z.object({
          operation: z.literal('posts.get'),
          postId: z.string(),
        }),
        z.object({
          operation: z.literal('posts.update'),
          postId: z.string(),
          publishDate: z.string().optional(),
          dateAction: z.enum(['schedule', 'update']).optional(),
          rescheduleWorkflow: z.boolean().optional(),
          settings: z.record(z.any()).optional(),
          segments: z
            .array(
              z.object({
                id: z.string(),
                content: z.string().optional(),
                delay: z.number().optional(),
                image: z.array(z.any()).optional(),
              })
            )
            .optional(),
        }),
        z.object({
          operation: z.literal('posts.move'),
          postId: z.string(),
          newDate: z.string(),
          rescheduleWorkflow: z.boolean().optional(),
        }),
        z.object({
          operation: z.literal('posts.delete'),
          postId: z.string().optional(),
          groupId: z.string().optional(),
        }),
        z.object({
          operation: z.literal('posts.duplicate'),
          postId: z.string(),
        }),
        z.object({
          operation: z.literal('calendar.get'),
          from: z.string(),
          to: z.string(),
          integrationId: z.string().optional(),
        }),
        z.object({
          operation: z.literal('calendar.rebalance'),
          from: z.string(),
          to: z.string(),
          integrationId: z.string().optional(),
          cadence: z.enum(['daily', 'every_other_day', 'mwf']).optional(),
          maxPerDay: z.number().optional(),
        }),
        z.object({
          operation: z.literal('analytics.postPerformance'),
          postId: z.string(),
          date: z.number().optional().describe('Unix seconds; default now'),
        }),
        z.object({
          operation: z.literal('analytics.summary'),
          from: z.string(),
          to: z.string(),
          integrationId: z.string().optional(),
        }),
        z.object({
          operation: z.literal('brand.get'),
        }),
        z.object({
          operation: z.literal('brand.update'),
          voice: z.string().optional(),
          tone: z.string().optional(),
          banned_phrases: z.array(z.string()).optional(),
          required_disclaimers: z.array(z.string()).optional(),
          examples: z.array(z.string()).optional(),
        }),
        z.object({
          operation: z.literal('approvals.submitDraft'),
          draftId: z.string(),
          reviewers: z.array(z.string()),
        }),
        z.object({
          operation: z.literal('approvals.getStatus'),
          draftId: z.string(),
        }),
        z.object({
          operation: z.literal('approvals.approve'),
          draftId: z.string(),
        }),
        z.object({
          operation: z.literal('approvals.reject'),
          draftId: z.string(),
          reason: z.string(),
        }),
      ]),
      outputSchema: z.any(),
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
          case 'posts.list':
            return this._posts.agentPostsList(organizationId, {
              startDate: inputData.from,
              endDate: inputData.to,
              integrationId: inputData.integrationId,
              state: inputData.status,
            } as any);
          case 'posts.get':
            return this._posts.getPost(organizationId, inputData.postId);
          case 'posts.update': {
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
          case 'posts.move':
            return this._posts.patchPostGroup(organizationId, inputData.postId, {
              publishDate: inputData.newDate,
              dateAction: 'schedule',
              rescheduleWorkflow: inputData.rescheduleWorkflow ?? true,
            });
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
            throw new Error('postId or groupId required');
          case 'posts.duplicate':
            return this._posts.duplicatePostGroup(
              organizationId,
              inputData.postId
            );
          case 'calendar.get':
            return this._posts.getCalendar(
              organizationId,
              inputData.from,
              inputData.to,
              inputData.integrationId
            );
          case 'calendar.rebalance': {
            const body: CalendarRebalanceDto = {
              from: inputData.from,
              to: inputData.to,
              integrationId: inputData.integrationId,
              cadence: inputData.cadence,
              maxPerDay: inputData.maxPerDay,
            };
            return this._posts.proposeCalendarRebalance(organizationId, body);
          }
          case 'analytics.postPerformance':
            return this._posts.checkPostAnalytics(
              organizationId,
              inputData.postId,
              inputData.date ?? Math.floor(Date.now() / 1000)
            );
          case 'analytics.summary':
            return this._posts.agentAnalyticsSummary(
              organizationId,
              inputData.from,
              inputData.to,
              inputData.integrationId
            );
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
          case 'approvals.reject':
            return {
              notImplemented: true,
              message:
                'Approval workflow tables and states are not deployed yet; use draft/QUEUE posts and human review in UI.',
              operation: inputData.operation,
            };
          default:
            return { error: 'unknown_operation' };
        }
      },
    });
  }
}
