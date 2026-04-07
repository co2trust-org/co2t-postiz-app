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
      description: `Product catalog: discover defaults, sources (registered base URLs), list/get/search cached rows by sourceKey, ingest from a chosen baseUrl into a sourceKey partition. Use a distinct sourceKey per environment (e.g. co2t_api_prod vs co2t_api_testnet) and pass sourceKey on list/search/get.`,
      // Single object schema — OpenAI Responses API rejects z.discriminatedUnion JSON Schema ("type: None").
      inputSchema: z.object({
        operation: z.enum([
          'discover',
          'sources',
          'list',
          'get',
          'ingest',
          'search',
        ]),
        /** Cache partition; default co2t_api_testnet. Set per server (e.g. co2t_api_prod). */
        sourceKey: z.string().optional(),
        /** Ingest only: API origin (https://...). Overrides CO2T_PRODUCTS_API_BASE for this run. */
        baseUrl: z
          .string()
          .optional()
          .describe('HTTPS API origin, no trailing slash required'),
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
          case 'sources':
            return this._products.listRegisteredSources(organizationId);
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
              sourceKey: inputData.sourceKey,
            });
          }
          case 'get':
            return this._products.getForOrg(organizationId, {
              id: inputData.id,
              slug: inputData.slug,
              externalId: inputData.externalId,
              sourceKey: inputData.sourceKey,
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
              baseUrl: inputData.baseUrl,
              sourceKey: inputData.sourceKey,
            });
          }
          case 'search': {
            if (!inputData.query?.trim()) {
              throw new Error('search requires query');
            }
            return this._products.searchForOrg(
              organizationId,
              inputData.query,
              inputData.limit,
              inputData.sourceKey
            );
          }
          default:
            return { error: 'unknown_operation' };
        }
      },
    });
  }
}
