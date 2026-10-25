import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { RefreshSession } from '../auth.types';

const REFRESH_COOKIE_NAME = 'concept_store_refresh';

@Injectable()
export class RefreshCookieService {
  private readonly secure: boolean;
  private readonly path: '/auth' | '/api/auth';

  constructor(configService: ConfigService) {
    this.secure = configService.getOrThrow<string>('NODE_ENV') === 'production';
    this.path = configService.getOrThrow<'/auth' | '/api/auth'>(
      'REFRESH_COOKIE_PATH',
    );
  }

  read(request: Request): string | undefined {
    return request.cookies[REFRESH_COOKIE_NAME] as string | undefined;
  }

  write(response: Response, session: RefreshSession): void {
    response.cookie(REFRESH_COOKIE_NAME, session.token, {
      expires: session.expiresAt,
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: this.path,
    });
  }

  clear(response: Response): void {
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.secure,
      path: this.path,
    });
  }
}
