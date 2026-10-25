import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import {
  AccessTokenPayload,
  AuthenticatedSessionPrincipal,
} from './auth.types';

type AuthenticatedRequest = Request & { user?: AuthenticatedSessionPrincipal };

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);

    if (!token) {
      throw new UnauthorizedException('Authentication is required');
    }

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      if (
        error instanceof Error &&
        ['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(
          error.name,
        )
      ) {
        throw new UnauthorizedException('Access token is invalid or expired');
      }
      throw error;
    }
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      !payload.sub ||
      typeof payload.email !== 'string' ||
      !payload.email ||
      typeof payload.sid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        payload.sid,
      )
    ) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }

    let activeUser: { id: string; emailVerifiedAt: Date | null } | null;
    try {
      activeUser = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          deletedAt: null,
          sessions: {
            some: {
              id: payload.sid,
              revokedAt: null,
              expiresAt: { gt: new Date() },
            },
          },
        },
        select: { id: true, emailVerifiedAt: true },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Authentication is temporarily unavailable',
      );
    }
    if (!activeUser) {
      throw new UnauthorizedException('Access token is invalid or expired');
    }
    request.user = {
      id: activeUser.id,
      email: payload.email,
      emailVerified: activeUser.emailVerifiedAt !== null,
      sessionId: payload.sid.toLowerCase(),
    };
    return true;
  }

  private extractBearerToken(request: Request): string | undefined {
    const parts = request.headers.authorization?.split(' ') ?? [];
    return parts.length === 2 && parts[0] === 'Bearer' && parts[1]
      ? parts[1]
      : undefined;
  }
}
