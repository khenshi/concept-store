import {
  Controller,
  Get,
  HttpException,
  INestApplication,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule, PinoLogger } from 'nestjs-pino';
import { Writable } from 'node:stream';
import request from 'supertest';
import { pinoHttpOptions } from '../src/config/logging';
import { RuntimeExceptionFilter } from '../src/config/runtime-exception.filter';

@Controller()
class LoggingFixtureController {
  constructor(private readonly logger: PinoLogger) {}

  @Get('quiet') quiet() {
    return { status: 'ok' };
  }
  @Get('explicit') explicit() {
    this.logger.error(
      { password: 'private-password', err: new Error('private-error') },
      'Application operation failed',
    );
    return { status: 'ok' };
  }
  @Get('implicit') implicit() {
    this.logger.error(new Error('private-bare-error'));
    this.logger.error({ err: new Error('private-object-error') });
    return { status: 'ok' };
  }
  @Get('nested') nested() {
    this.logger.error(
      {
        details: {
          credentials: {
            newPassword: 'private-new-password',
            refresh_token: 'private-refresh-secret',
            JWT_SECRET: 'private-jwt-secret',
            DATABASE_URL: 'private-database-url',
          },
          context: {
            email: 'private-contact',
            paymentReference: 'private-payment-reference',
            command: { items: ['private-command'] },
            body: { anything: 'private-body' },
          },
          cause: {
            message: 'private-nested-error',
            stack: 'private-nested-stack',
          },
        },
      },
      'Nested operation failed',
    );
    return { status: 'ok' };
  }
  @Get('failure') failure() {
    throw new Error('private database credentials');
  }
  @Get('expected') expected() {
    throw new HttpException(
      { message: 'Invalid input', code: 'EXPECTED' },
      409,
    );
  }
}

describe('Production logging output', () => {
  it.each([
    [false, 'info'],
    [true, 'info'],
    [true, 'fatal'],
  ] as const)('respects access=%s and level=%s', async (access, level) => {
    let output = '';
    const stream = new Writable({
      write(chunk: Buffer, _encoding, done) {
        output += chunk.toString();
        done();
      },
    });
    const config = {
      getOrThrow: (key: string) =>
        ({
          NODE_ENV: 'production',
          LOG_LEVEL: level,
          LOG_HTTP_REQUESTS: access,
        })[key],
    } as ConfigService;
    const moduleRef = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({ pinoHttp: [pinoHttpOptions(config), stream] }),
      ],
      controllers: [LoggingFixtureController],
      providers: [RuntimeExceptionFilter],
    }).compile();
    const app: INestApplication = moduleRef.createNestApplication({
      logger: false,
    });
    app.useLogger(app.get(Logger));
    app.useGlobalFilters(app.get(RuntimeExceptionFilter));
    try {
      await app.init();
      output = '';
      const http = () =>
        request(app.getHttpServer() as Parameters<typeof request>[0]);
      await http().get('/quiet?token=private-token').expect(200);
      expect(output.includes('request completed')).toBe(
        access && level === 'info',
      );
      await http().get('/explicit').expect(200);
      await http().get('/implicit').expect(200);
      await http()
        .get('/nested?q=private-search&reference=private-query-reference')
        .expect(200);
      await http()
        .get('/failure')
        .expect(500, { statusCode: 500, message: 'Internal server error' });
      await http()
        .get('/expected')
        .expect(409, { message: 'Invalid input', code: 'EXPECTED' });
      if (level === 'info') {
        expect(output).toContain('Application operation failed');
        expect(output.match(/HTTP request failed/g)).toHaveLength(1);
      } else {
        expect(output).toBe('');
      }
      for (const secret of [
        'private-token',
        'private-password',
        'private-error',
        'private database credentials',
        'private-bare-error',
        'private-object-error',
        'private-new-password',
        'private-refresh-secret',
        'private-jwt-secret',
        'private-database-url',
        'private-contact',
        'private-payment-reference',
        'private-command',
        'private-body',
        'private-nested-error',
        'private-nested-stack',
        'private-search',
        'private-query-reference',
      ])
        expect(output).not.toContain(secret);
    } finally {
      await app.close();
    }
  });
});
