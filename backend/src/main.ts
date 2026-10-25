import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { setupSwagger } from './config/swagger';
import { RuntimeExceptionFilter } from './config/runtime-exception.filter';

let application: INestApplication | undefined;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    logger: false,
    abortOnError: false,
  });
  application = app;
  app.set('trust proxy', false);
  app.useLogger(app.get(Logger));
  app.useGlobalFilters(app.get(RuntimeExceptionFilter));
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    credentials: true,
    origin: configService.getOrThrow<string>('FRONTEND_ORIGIN'),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableShutdownHooks();

  if (configService.getOrThrow<boolean>('SWAGGER_ENABLED')) {
    setupSwagger(app);
  }

  await app.listen(configService.getOrThrow<number>('PORT'));
}

void bootstrap().catch(async () => {
  process.stderr.write(
    `${JSON.stringify({ level: 'error', message: 'API startup failed' })}\n`,
  );
  process.exitCode = 1;
  await application?.close().catch(() => undefined);
});
