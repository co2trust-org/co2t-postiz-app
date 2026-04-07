import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { ProductsService } from '@gitroom/nestjs-libraries/database/prisma/products/products.service';

@Injectable()
export class AssistantProductsTool implements AgentToolInterface {
  constructor(private _products: ProductsService) {}
  name = 'assistantProductsTool';

  run() {
    return createTool({
      id: 'products',
      description: `Product catalog tools: discover API shape, list cached products, get one, ingest from CO2 Trust API, search by name.`,
      // Single object schema — OpenAI Responses API rejects z.discriminatedUnion JSON Schema ("type: None").
      inputSchema: z.object({
        operation: z.enum(['discover', 'list', 'get', 'ingest', 'search']),
        cursor: z.string().optional(),
        limit: z.number().optional(),
        updatedAfter: z.string().optional(),
        id: z.string().optional(),
        slug: z.string().optional(),
        externalId: z.string().optional(),
        mode: z.enum(['summary', 'full']).optional(),
        dryRun: z.boolean().optional(),
        query: z.string().optional(),
      }),
      mcp: {
        annotations: {
          title: 'Products',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;

        switch (inputData.operation) {
          case 'discover':
            return this._products.discover();
          case 'list': {
            const updatedAfter = inputData.updatedAfter
              ? new Date(inputData.updatedAfter)
              : undefined;
            return this._products.listForOrg(organizationId, {
              cursor: inputData.cursor,
              limit: inputData.limit,
              updatedAfter:
                updatedAfter && !Number.isNaN(updatedAfter.getTime())
                  ? updatedAfter
                  : undefined,
            });
          }
          case 'get':
            return this._products.getForOrg(organizationId, {
              id: inputData.id,
              slug: inputData.slug,
              externalId: inputData.externalId,
            });
          case 'ingest': {
            if (!inputData.mode) {
              throw new Error('ingest requires mode: summary | full');
            }
            return this._products.ingest(organizationId, {
              mode: inputData.mode,
              limit: inputData.limit,
              updatedAfter: inputData.updatedAfter,
              dryRun: inputData.dryRun,
            });
          }
          case 'search': {
            if (!inputData.query?.trim()) {
              throw new Error('search requires query');
            }
            return this._products.searchForOrg(
              organizationId,
              inputData.query,
              inputData.limit
            );
          }
          default:
            return { error: 'unknown_operation' };
        }
      },
    });
  }
}
