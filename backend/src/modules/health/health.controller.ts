import { Controller, Get, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { HealthService } from './health.service';

export const HEALTH_RATE_LIMIT = {
  limit: 120,
  ttl: 60_000,
  getTracker: () => 'health',
} as const;

@ApiTags('health')
@ApiTooManyRequestsResponse({ description: 'Health polling limit exceeded' })
@Throttle({ default: HEALTH_RATE_LIMIT })
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @ApiOperation({ summary: 'Check process liveness without database access' })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
    },
  })
  @Get('live')
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }

  @ApiOperation({
    summary: 'Check bounded database connectivity while serving',
  })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ready'] } },
      required: ['status'],
    },
  })
  @ApiServiceUnavailableResponse({
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['unavailable'] } },
      required: ['status'],
    },
  })
  @Get('ready')
  async ready(
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ status: 'ready' | 'unavailable' }> {
    const ready = await this.health.isReady();
    response.status(ready ? 200 : 503);
    return { status: ready ? 'ready' : 'unavailable' };
  }
}
