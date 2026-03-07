import { Global, Injectable, Logger, Module, OnModuleInit } from '@nestjs/common';
import { Connection } from '@temporalio/client';
import { TemporalService } from 'nestjs-temporal-core';

@Injectable()
export class TemporalRegister implements OnModuleInit {
  private readonly _logger = new Logger(TemporalRegister.name);

  constructor(private readonly _client: TemporalService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.TEMPORAL_TLS === 'true') {
      return;
    }

    const rawClient = this._client?.client?.getRawClient();
    const connection = rawClient?.connection as Connection | undefined;
    if (!connection) {
      this._logger.warn(
        'Skipping Temporal search attribute registration: Temporal client is unavailable'
      );
      return;
    }

    try {
      const namespace = process.env.TEMPORAL_NAMESPACE || 'default';
      const listResponse = await connection.operatorService.listSearchAttributes(
        { namespace }
      );
      const customAttributes = listResponse?.customAttributes || {};
      const neededAttributes = ['organizationId', 'postId'];
      const missingAttributes = neededAttributes.filter(
        (attribute) => !customAttributes[attribute]
      );

      if (missingAttributes.length === 0) {
        return;
      }

      const searchAttributes = missingAttributes.reduce<Record<string, number>>(
        (all, current) => {
          all[current] = 1;
          return all;
        },
        {}
      );

      await connection.operatorService.addSearchAttributes({
        namespace,
        searchAttributes,
      });
    } catch (error: any) {
      // Keep backend booting when Temporal is unavailable (e.g. single-container installs).
      this._logger.warn(
        `Skipping Temporal search attribute registration: ${error?.message || error}`
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
