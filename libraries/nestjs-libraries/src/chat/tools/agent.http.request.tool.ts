import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { AssistantHttpService } from '@gitroom/nestjs-libraries/chat/assistant.http.service';

@Injectable()
export class AgentHttpRequestTool implements AgentToolInterface {
  constructor(private _http: AssistantHttpService) {}
  name = 'agentHttpRequestTool';

  run() {
    return createTool({
      id: 'httpRequest',
      description: `Allowlisted HTTP client for probing or calling internal APIs (e.g. CO2 Trust products on Railway). Hosts are restricted; service token is injected when configured. All calls are audit-logged.`,
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE']),
        url: z.string().url().describe('Absolute URL; host must be allowlisted'),
        headers: z.record(z.string()).optional(),
        query: z
          .record(z.union([z.string(), z.number(), z.boolean()]))
          .optional(),
        body: z.any().optional(),
      }),
      outputSchema: z.object({
        status: z.number(),
        headers: z.record(z.string()),
        data: z.any(),
      }),
      mcp: {
        annotations: {
          title: 'HTTP Request (allowlisted)',
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;
        return this._http.executeForOrg(organizationId, {
          method: inputData.method,
          url: inputData.url,
          headers: inputData.headers,
          query: inputData.query as Record<
            string,
            string | number | boolean | undefined
          >,
          body: inputData.body,
        });
      },
    });
  }
}
