import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(configService: ConfigService) {
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
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
