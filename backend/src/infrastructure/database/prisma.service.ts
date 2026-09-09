import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PinoLogger } from 'nestjs-pino';
import { Prisma, PrismaClient } from '../../generated/prisma/client';

type QueryEventClient = {
  $on(eventType: 'query', callback: (event: Prisma.QueryEvent) => void): void;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    const logQueries = configService.getOrThrow<boolean>('LOG_DB_QUERIES');
    const adapter = new PrismaPg({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
      max: configService.getOrThrow<number>('DB_POOL_MAX'),
      idleTimeoutMillis: configService.getOrThrow<number>(
        'DB_POOL_IDLE_TIMEOUT_MS',
      ),
      connectionTimeoutMillis: configService.getOrThrow<number>(
        'DB_CONNECTION_TIMEOUT_MS',
      ),
      query_timeout: configService.getOrThrow<number>('DB_QUERY_TIMEOUT_MS'),
    });
    super({
      adapter,
      log: logQueries ? [{ emit: 'event', level: 'query' }] : [],
    });
    this.logger.setContext(PrismaService.name);
    if (logQueries) {
      const includeParameters = configService.getOrThrow<boolean>(
        'LOG_DB_QUERY_PARAMETERS',
      );
      const eventClient = this as unknown as QueryEventClient;
      eventClient.$on('query', (event) => {
        this.logger.debug(
          {
            sql: event.query,
            durationMs: event.duration,
            target: event.target,
            ...(includeParameters ? { parameters: event.params } : {}),
          },
          'database query',
        );
      });
    }
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
