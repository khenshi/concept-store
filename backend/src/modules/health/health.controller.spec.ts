import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppController } from '../../app.controller';
import { STANDARD_RATE_LIMIT } from '../../config/rate-limit';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HEALTH_RATE_LIMIT } from './health.controller';
import { HealthModule } from './health.module';
import { HealthService } from './health.service';

describe('Health HTTP contracts', () => {
  let app: INestApplication;
  let server: Server;
  const prisma = { probeReadiness: jest.fn() };

  beforeEach(async () => {
    prisma.probeReadiness.mockReset().mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([STANDARD_RATE_LIMIT]), HealthModule],
      controllers: [AppController],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    server = app.getHttpServer() as Server;
    await app.listen(0, '127.0.0.1');
  });

  afterEach(async () => {
    await app.close();
  });

  it('keeps root compatible and liveness independent of the database', async () => {
    prisma.probeReadiness.mockRejectedValue(new Error('private secret'));
    await request(server).get('/').expect(200).expect({ status: 'ok' });
    await request(server)
      .get('/health/live')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ status: 'ok' });
    expect(prisma.probeReadiness).not.toHaveBeenCalled();
  });

  it('returns generic no-cache success, failure and recovery without authentication', async () => {
    await request(server)
      .get('/health/ready')
      .expect('Cache-Control', 'no-store')
      .expect(200)
      .expect({ status: 'ready' });
    prisma.probeReadiness.mockRejectedValueOnce(
      new Error('private SQL secret'),
    );
    await request(server)
      .get('/health/ready')
      .expect('Cache-Control', 'no-store')
      .expect(503)
      .expect({ status: 'unavailable' });
    await request(server)
      .get('/health/ready')
      .expect(200)
      .expect({ status: 'ready' });
  });

  it('returns unavailable while draining and keeps liveness responsive', async () => {
    app.get(HealthService).onModuleDestroy();
    await request(server)
      .get('/health/ready')
      .expect(503)
      .expect({ status: 'unavailable' });
    await request(server).get('/health/live').expect(200);
    expect(prisma.probeReadiness).not.toHaveBeenCalled();
  });

  it('bounds health polling independently of identity and other route budgets', async () => {
    for (let index = 0; index < HEALTH_RATE_LIMIT.limit; index++) {
      await request(server)
        .get('/health/ready')
        .set('X-Forwarded-For', `192.0.2.${index}`)
        .expect(200);
    }
    await request(server)
      .get('/health/ready')
      .set('X-Forwarded-For', '198.51.100.1')
      .expect('Cache-Control', 'no-store')
      .expect(429);
    expect(prisma.probeReadiness).toHaveBeenCalledTimes(
      HEALTH_RATE_LIMIT.limit,
    );
    await request(server).get('/health/live').expect(200);
    await request(server).get('/').expect(200);
  });
});
