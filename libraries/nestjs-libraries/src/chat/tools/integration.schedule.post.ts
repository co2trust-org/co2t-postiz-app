import { AgentToolInterface } from '@gitroom/nestjs-libraries/chat/agent.tool.interface';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { socialIntegrationList } from '@gitroom/nestjs-libraries/integrations/integration.manager';
import { IntegrationService } from '@gitroom/nestjs-libraries/database/prisma/integrations/integration.service';
import { PostsService } from '@gitroom/nestjs-libraries/database/prisma/posts/posts.service';
import { makeId } from '@gitroom/nestjs-libraries/services/make.is';
import { AllProvidersSettings } from '@gitroom/nestjs-libraries/dtos/posts/providers-settings/all.providers.settings';
import { validate } from 'class-validator';
import { Integration } from '@prisma/client';
import { checkAuth } from '@gitroom/nestjs-libraries/chat/auth.context';
import { stripHtmlValidation } from '@gitroom/helpers/utils/strip.html.validation';
import { weightedLength } from '@gitroom/helpers/utils/count.length';

function countCharacters(text: string, type: string): number {
  if (type !== 'x') {
    return text.length;
  }
  return weightedLength(text);
}

/** Plain key/value from the tool before DTO validation / createPost — fills required platform fields when the agent omits settings[]. */
function applyProviderScheduleSettingsDefaults(
  providerIdentifier: string,
  partial: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...partial };
  if (providerIdentifier === 'x') {
    if (
      out.who_can_reply_post == null ||
      (typeof out.who_can_reply_post === 'string' &&
        out.who_can_reply_post.trim() === '')
    ) {
      out.who_can_reply_post = 'everyone';
    }
  }
  if (
    providerIdentifier === 'instagram' ||
    providerIdentifier === 'instagram-standalone'
  ) {
    if (
      out.post_type == null ||
      (typeof out.post_type === 'string' && out.post_type.trim() === '')
    ) {
      out.post_type = 'post';
    }
  }
  return out;
}

@Injectable()
export class IntegrationSchedulePostTool implements AgentToolInterface {
  constructor(
    private _postsService: PostsService,
    private _integrationService: IntegrationService
  ) {}
  name = 'integrationSchedulePostTool';

  run() {
    return createTool({
      id: 'schedulePostTool',
      mcp: {
        annotations: {
          title: 'Schedule Social Media Post',
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      description: `
This tool allows you to schedule a post to a social media platform, based on integrationSchema tool.
So for example:

If the user want to post a post to LinkedIn with one comment
- socialPost array length will be one
- postsAndComments array length will be two (one for the post, one for the comment)

If the user want to post 20 posts for facebook each in individual days without comments
- socialPost array length will be 20
- postsAndComments array length will be one

If the tools return errors, you would need to rerun it with the right parameters, don't ask again, just run it

You may omit "settings" (or pass an empty array) for many platforms. X (Twitter) and Instagram still need structured settings in the DTO; if you omit them, defaults apply (X: who_can_reply "everyone"; Instagram: post_type "post"). Instagram also requires at least one media URL on the first post (attachments). Prefer explicit values from integrationSchema when the user cares.
`,
      inputSchema: z.object({
        socialPost: z
          .array(
            z.object({
              integrationId: z
                .string()
                .describe('The id of the integration (not internal id)'),
              isPremium: z
                .boolean()
                .describe(
                  "If the integration is X, return if it's premium or not"
                ),
              date: z.string().describe('The date of the post in UTC time'),
              shortLink: z
                .boolean()
                .describe(
                  'If the post has a link inside, we can ask the user if they want to add a short link'
                ),
              type: z
                .enum(['draft', 'schedule', 'now'])
                .describe(
                  'The type of the post, if we pass now, we should pass the current date also'
                ),
              postsAndComments: z
                .array(
                  z.object({
                    content: z
                      .string()
                      .describe(
                        "The content of the post, HTML, Each line must be wrapped in <p> here is the possible tags: h1, h2, h3, u, strong, li, ul, p (you can't have u and strong together)"
                      ),
                    attachments: z
                      .array(z.string())
                      .describe('The image of the post (URLS)'),
                  })
                )
                .describe(
                  'first item is the post, every other item is the comments'
                ),
              settings: z
                .array(
                  z.object({
                    key: z
                      .string()
                      .describe('Name of the settings key to pass'),
                    value: z
                      .any()
                      .describe(
                        'Value of the key, always prefer the id then label if possible'
                      ),
                  })
                )
                .optional()
                .default([])
                .describe(
                  'Key/value pairs from integrationSchema [input:settings]. Omit or pass [] when only body/attachments matter (e.g. Facebook); platform DTO may still validate.'
                ),
            })
          )
          .describe('Individual post'),
      }),
      outputSchema: z.object({
        output: z
          .array(
            z.object({
              postId: z.string(),
              integration: z.string(),
            })
          )
          .or(z.object({ errors: z.string() })),
      }),
      execute: async (inputData, context) => {
        checkAuth(inputData, context);
        const organizationId = JSON.parse(
          (context?.requestContext as any)?.get('organization') as string
        ).id;
        const finalOutput = [];

        const integrations = {} as Record<string, Integration | null>;
        for (const platform of inputData.socialPost) {
          const integration = await this._integrationService.getIntegrationById(
            organizationId,
            platform.integrationId
          );
          integrations[platform.integrationId] = integration;

          if (!integration) {
            return {
              errors: JSON.stringify([
                {
                  integrationId: platform.integrationId,
                  error: 'Integration not found for this organization.',
                },
              ]),
            };
          }

          const meta = socialIntegrationList.find(
            (p) => p.identifier === integration.providerIdentifier
          );
          if (!meta) {
            return {
              errors: JSON.stringify([
                {
                  integrationId: platform.integrationId,
                  providerIdentifier: integration.providerIdentifier,
                  error:
                    'Could not load platform rules/settings for this integration (unknown provider).',
                },
              ]),
            };
          }

          if (
            integration.providerIdentifier === 'instagram' ||
            integration.providerIdentifier === 'instagram-standalone'
          ) {
            const firstBlock = platform.postsAndComments?.[0];
            const attachmentUrls = (firstBlock?.attachments ?? []).filter(
              (u: unknown): u is string =>
                typeof u === 'string' && u.trim().length > 0
            );
            if (attachmentUrls.length === 0) {
              Logger.warn(
                `integrationSchedulePostTool: Instagram requires media org=${organizationId} integrationId=${platform.integrationId}`
              );
              return {
                errors: JSON.stringify([
                  {
                    integrationId: platform.integrationId,
                    error:
                      'Instagram requires at least one image or video URL in postsAndComments[0].attachments (feed/reel/story all need media).',
                  },
                ]),
              };
            }
          }

          const { dto, maxLength, identifier } = meta;

          const settingsPairs = platform.settings ?? [];

          if (dto) {
            const newDTO = new dto();
            const fromKv = settingsPairs.reduce(
              (acc: Record<string, unknown>, s: { key: string; value: any }) => ({
                ...acc,
                [s.key]: s.value,
              }),
              {} as Record<string, unknown>
            );
            const withDefaults = applyProviderScheduleSettingsDefaults(
              integration.providerIdentifier,
              fromKv
            );
            const obj = Object.assign(newDTO, withDefaults);
            const errors = await validate(obj);
            if (errors.length) {
              return {
                errors: JSON.stringify(errors),
              };
            }

            const errorsLength = [];
            for (const post of platform.postsAndComments) {
              const maximumCharacters = maxLength(platform.isPremium);
              const strip = stripHtmlValidation('normal', post.content, true);
              const weightedLength = countCharacters(strip, identifier || '');
              const totalCharacters =
                weightedLength > strip.length ? weightedLength : strip.length;

              if (totalCharacters > (maximumCharacters || 1000000)) {
                errorsLength.push({
                  value: post.content,
                  error: `The maximum characters is ${maximumCharacters}, we got ${totalCharacters}, please fix it, and try integrationSchedulePostTool again.`,
                });
              }
            }

            if (errorsLength.length) {
              return {
                errors: JSON.stringify(errorsLength),
              };
            }
          }
        }

        for (const post of inputData.socialPost) {
          const integration = integrations[post.integrationId];

          if (!integration) {
            throw new Error('Integration not found');
          }

          const output = await this._postsService.createPost(organizationId, {
            date: post.date,
            type: post.type as 'draft' | 'schedule' | 'now',
            shortLink: post.shortLink,
            tags: [],
            posts: [
              {
                integration,
                group: makeId(10),
                settings: (() => {
                  const fromKv = (post.settings ?? []).reduce(
                    (acc: Record<string, unknown>, s: { key: string; value: any }) => ({
                      ...acc,
                      [s.key]: s.value,
                    }),
                    {} as Record<string, unknown>
                  );
                  const withDefaults = applyProviderScheduleSettingsDefaults(
                    integration.providerIdentifier,
                    fromKv
                  );
                  return {
                    __type: integration.providerIdentifier,
                    ...withDefaults,
                  } as AllProvidersSettings;
                })(),
                value: post.postsAndComments.map((p: any) => ({
                  content: p.content,
                  id: makeId(10),
                  delay: 0,
                  image: p.attachments.map((p: any) => ({
                    id: makeId(10),
                    path: p,
                  })),
                })),
              },
            ],
          });
          finalOutput.push(...output);
        }

        return {
          output: finalOutput,
        };
      },
    });
  }
}
