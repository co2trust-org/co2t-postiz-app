import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TemporalService } from 'nestjs-temporal-core';
import { Connection } from '@temporalio/client';

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

      const { customAttributes } =
        await connection.operatorService.listSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
        });

      const neededAttribute = ['organizationId', 'postId'];
      const missingAttributes = neededAttribute.filter(
        (attr) => !customAttributes[attr]
      );

      if (missingAttributes.length > 0) {
        await connection.operatorService.addSearchAttributes({
          namespace: process.env.TEMPORAL_NAMESPACE || 'default',
          searchAttributes: missingAttributes.reduce((all, current) => {
            // @ts-ignore
            all[current] = 1;
            return all;
          }, {}),
        });
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
