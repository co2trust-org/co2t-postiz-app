import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Temporal call timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

@Injectable()
export class TemporalRegister implements OnModuleInit {
  constructor(private _client: TemporalService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.TEMPORAL_TLS === 'true') {
      return;
    }
    try {
      const connection = this._client?.client?.getRawClient()
        ?.connection as Connection | undefined;

      if (!connection) {
        Logger.warn('Temporal connection is unavailable, skipping search attribute registration');
        return;
      }

      const { customAttributes } = await withTimeout(
        connection.operatorService.listSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        }),
        5000
      );

      const neededAttribute = ['organizationId', 'postId'];
      const missingAttributes = neededAttribute.filter(
        (attr) => !customAttributes[attr]
      );

      if (missingAttributes.length > 0) {
        await withTimeout(
          connection.operatorService.addSearchAttributes({
            namespace: process.env.TEMPORAL_NAMESPACE || 'default',
            searchAttributes: missingAttributes.reduce((all, current) => {
              // @ts-ignore
              all[current] = 1;
              return all;
            }, {}),
          }),
          5000
        );
      }
    } catch (error) {
      Logger.warn(
        `Temporal search attribute bootstrap skipped: ${
          error instanceof Error ? error.message : 'unknown error'
        }`
      );
    }
  }
}

@Global()
@Module({
  imports: [],
  controllers: [],
  providers: [TemporalRegister],
  get exports() {
    return this.providers;
  },
})
export class TemporalRegisterMissingSearchAttributesModule {}
