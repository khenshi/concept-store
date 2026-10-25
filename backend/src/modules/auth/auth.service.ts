import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import { Prisma, type ColorTheme } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type {
  AuthResponse,
  AuthenticatedUser,
  AuthSessionResponse,
  ActiveSessionPage,
} from './auth.types';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { SessionService } from './sessions/session.service';
import { assertNewPassword } from './dto/new-password';

const PASSWORD_HASH_ROUNDS = 12;
const LOGIN_DUMMY_HASH =
  '$2b$12$X9nD9NBciwsB2qzEz/gPMul/FaLxQkrac4ys9p2AZS3ctsNhKQEOG';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthSessionResponse> {
    assertNewPassword(dto.password);
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
              colorTheme: true,
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
        response: await this.createAuthResponse(user, refreshSession.id),
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
        colorTheme: true,
        passwordHash: true,
        deletedAt: true,
      },
    });

    const passwordMatches = await compare(
      dto.password,
      user && !user.deletedAt ? user.passwordHash : LOGIN_DUMMY_HASH,
    );
    if (!user || user.deletedAt || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const authenticatedUser = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      colorTheme: user.colorTheme,
    };
    const refreshSession = await this.prisma.$transaction(
      async (transaction) => {
        const current = await transaction.user.updateMany({
          where: {
            id: user.id,
            passwordHash: user.passwordHash,
            deletedAt: null,
          },
          data: { passwordHash: user.passwordHash },
        });
        if (current.count !== 1)
          throw new UnauthorizedException('Invalid email or password');
        return this.sessionService.issue(user.id, transaction);
      },
    );
    return {
      response: await this.createAuthResponse(
        authenticatedUser,
        refreshSession.id,
      ),
      refreshSession,
    };
  }

  async refresh(token: string | undefined): Promise<AuthSessionResponse> {
    const rotated = await this.sessionService.rotate(token);
    return {
      response: await this.createAuthResponse(
        rotated.user,
        rotated.refreshSession.id,
      ),
      refreshSession: rotated.refreshSession,
    };
  }

  logout(token: string | undefined): Promise<void> {
    return this.sessionService.revoke(token);
  }

  listSessions(
    userId: string,
    currentSessionId: string,
    page: number,
  ): Promise<ActiveSessionPage> {
    return this.sessionService.list(userId, currentSessionId, page);
  }

  revokeSession(userId: string, sessionId: string): Promise<void> {
    return this.sessionService.revokeOwned(userId, sessionId);
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
        colorTheme: true,
      },
    });
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
      },
    });
  }

  async updateColorTheme(
    userId: string,
    colorTheme: ColorTheme,
  ): Promise<AuthenticatedUser> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { colorTheme },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
      },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    assertNewPassword(dto.newPassword);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await compare(dto.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (await compare(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'New password must be different from the current password',
      );
    }

    const passwordHash = await hash(dto.newPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.user.updateMany({
        where: { id: userId, passwordHash: user.passwordHash, deletedAt: null },
        data: { passwordHash },
      });
      if (changed.count !== 1)
        throw new UnauthorizedException('Current password is incorrect');
      await transaction.userSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async deleteCurrentUser(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Password is incorrect');
    }

    await this.prisma.$transaction(
      async (transaction) => {
        const soleOwnerships =
          await transaction.organizationMembership.findMany({
            where: {
              userId,
              role: 'OWNER',
              organization: {
                memberships: {
                  none: { role: 'OWNER', userId: { not: userId } },
                },
              },
            },
            select: { organizationId: true },
          });
        if (soleOwnerships.length > 0) {
          throw new ConflictException(
            'Transfer ownership or add another owner before deleting your account',
          );
        }

        await transaction.organizationMembership.deleteMany({
          where: { userId },
        });
        await transaction.userSession.deleteMany({ where: { userId } });
        await transaction.user.update({
          where: { id: userId, deletedAt: null },
          data: {
            firstName: 'Deleted',
            lastName: 'User',
            phone: null,
            email: `deleted+${userId}@deleted.invalid`,
            passwordHash: randomBytes(32).toString('hex'),
            deletedAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async createAuthResponse(
    user: AuthenticatedUser,
    sessionId: string,
  ): Promise<AuthResponse> {
    const accessToken = await this.jwtService.signAsync(
      { email: user.email, sid: sessionId },
      { subject: user.id },
    );

    return { accessToken, user };
  }
}
