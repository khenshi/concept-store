import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { PinoLogger } from 'nestjs-pino';

@Catch()
@Injectable()
export class RuntimeExceptionFilter extends BaseExceptionFilter {
  constructor(
    adapter: HttpAdapterHost,
    private readonly logger: PinoLogger,
  ) {
    super(adapter.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (exception instanceof HttpException && exception.getStatus() < 500) {
      super.catch(exception, host);
      return;
    }
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    this.logger.error({ statusCode: status }, 'HTTP request failed');
    super.catch(
      new HttpException(
        { statusCode: status, message: 'Internal server error' },
        status,
      ),
      host,
    );
  }
}
