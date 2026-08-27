import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AuthResponse,
  AuthenticatedUser,
  AuthSessionResponse,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { SessionService } from './sessions/session.service';

const PASSWORD_HASH_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    const passwordHash = await hash(dto.password, PASSWORD_HASH_ROUNDS);

    try {
      const { user, refreshSession } = await this.prisma.$transaction(
        async (transaction) => {
          const user = await transaction.user.create({
            data: {
              firstName: dto.firstName,
              lastName: dto.lastName,
              phone: dto.phone,
              email: dto.email,
              passwordHash,
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          });
          const refreshSession = await this.sessionService.issue(
            user.id,
            transaction,
          );
          return { user, refreshSession };
        },
      );

      return {
        response: await this.createAuthResponse(user),
        refreshSession,
      };
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthSessionResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        passwordHash: true,
      },
    });

    if (!user || !(await compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
    };
    return {
      response: await this.createAuthResponse(authenticatedUser),
      refreshSession: await this.sessionService.issue(user.id),
    };
  }

  async refresh(token: string | undefined): Promise<AuthSessionResponse> {
    const rotated = await this.sessionService.rotate(token);
    return {
      response: await this.createAuthResponse(rotated.user),
      refreshSession: rotated.refreshSession,
    };
  }

  logout(token: string | undefined): Promise<void> {
    return this.sessionService.revoke(token);
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
      },
    });
  }

  private async createAuthResponse(
    user: AuthenticatedUser,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync(
      { email: user.email },
      { subject: user.id },
    );

    return { accessToken, user };
  }
}
