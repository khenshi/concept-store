import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PinoLogger } from 'nestjs-pino';
import type { Pool, QueryConfig } from 'pg';
import { Prisma, PrismaClient } from '../../generated/prisma/client';

type QueryEventClient = {
  $on(eventType: 'query', callback: (event: Prisma.QueryEvent) => void): void;
};

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readinessPool?: Pool;
  private readinessFlight?: Promise<boolean>;
  private initialized = false;
  private draining = false;

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
    const connect = adapter.connect.bind(adapter);
    adapter.connect = async () => {
      const connected = await connect();
      this.readinessPool = connected.underlyingDriver();
      return connected;
    };
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
    try {
      await this.$connect();
      this.initialized = true;
      if (await this.probeReadiness()) return;
      throw new Error('Database initialization failed');
    } catch {
      this.initialized = false;
      this.draining = true;
      await this.$disconnect().catch(() => undefined);
      throw new Error('Database initialization failed');
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.draining = true;
    await this.readinessFlight;
    await this.$disconnect();
  }

  probeReadiness(): Promise<boolean> {
    if (!this.initialized || this.draining || !this.readinessPool) {
      return Promise.resolve(false);
    }
    if (!this.readinessFlight) {
      this.readinessFlight = this.runReadinessProbe(this.readinessPool).finally(
        () => {
          this.readinessFlight = undefined;
        },
      );
    }
    return this.readinessFlight;
  }

  private async runReadinessProbe(pool: Pool): Promise<boolean> {
    try {
      const client = await pool.connect();
      const onError = () => undefined;
      client.on('error', onError);
      let failed = true;
      try {
        if (this.draining) return false;
        const query: QueryConfig & { query_timeout: number } = {
          text: 'SELECT 1',
          query_timeout: 1_000,
        };
        await client.query(query);
        failed = false;
        return !this.draining;
      } finally {
        client.release(failed);
        client.removeListener('error', onError);
      }
    } catch {
      return false;
    }
  }
}
