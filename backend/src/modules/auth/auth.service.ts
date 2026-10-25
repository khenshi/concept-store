import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import {
  AccountActionTokenPurpose,
  Prisma,
  type ColorTheme,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AccountActionTokenService } from './account-action-token.service';
import { ACCOUNT_ACTION_ACKNOWLEDGEMENT } from './account-action.types';
import type {
  AuthResponse,
  AuthenticatedUser,
  AuthSessionResponse,
  ActiveSessionPage,
  RegistrationAcknowledgement,
} from './auth.types';
import type {
  AccountActionEmailDto,
  ConfirmPasswordResetDto,
  VerifyEmailDto,
} from './dto/account-action-token.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import type { ChangePasswordDto } from './dto/change-password.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { SessionService } from './sessions/session.service';
import { assertNewPassword } from './dto/new-password';

const PASSWORD_HASH_ROUNDS = 12;
const LOGIN_DUMMY_HASH =
  '$2b$12$X9nD9NBciwsB2qzEz/gPMul/FaLxQkrac4ys9p2AZS3ctsNhKQEOG';
const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly accountActionTokenService: AccountActionTokenService,
  ) {}

  async register(dto: RegisterDto): Promise<RegistrationAcknowledgement> {
    await this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.user.findUnique({
        where: { email: dto.email },
        select: { id: true, emailVerifiedAt: true, deletedAt: true },
      });

      if (existing && !existing.deletedAt) {
        if (!existing.emailVerifiedAt) {
          await this.accountActionTokenService.issueForUser(
            existing.id,
            AccountActionTokenPurpose.VERIFY_EMAIL,
            VERIFICATION_TTL_MS,
            transaction,
          );
        }
        return;
      }

      const pending = await transaction.pendingRegistration.upsert({
        where: { email: dto.email },
        update: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          updatedAt: new Date(),
        },
        create: {
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone ?? null,
          email: dto.email,
        },
        select: { id: true },
      });
      await this.accountActionTokenService.issueForPendingRegistration(
        pending.id,
        AccountActionTokenPurpose.VERIFY_EMAIL,
        VERIFICATION_TTL_MS,
        transaction,
      );
    });

    return ACCOUNT_ACTION_ACKNOWLEDGEMENT;
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
        emailVerifiedAt: true,
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
      ...(user.emailVerifiedAt !== undefined
        ? { emailVerified: Boolean(user.emailVerifiedAt) }
        : {}),
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
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
        emailVerifiedAt: true,
      },
    });
    const { emailVerifiedAt, ...response } = user;
    return {
      ...response,
      ...(emailVerifiedAt !== undefined
        ? { emailVerified: Boolean(emailVerifiedAt) }
        : {}),
    };
  }

  async updateCurrentUser(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
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
        emailVerifiedAt: true,
      },
    });
    const { emailVerifiedAt, ...response } = user;
    return {
      ...response,
      ...(emailVerifiedAt !== undefined
        ? { emailVerified: Boolean(emailVerifiedAt) }
        : {}),
    };
  }

  async updateColorTheme(
    userId: string,
    colorTheme: ColorTheme,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { colorTheme },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        colorTheme: true,
        emailVerifiedAt: true,
      },
    });
    const { emailVerifiedAt, ...response } = user;
    return {
      ...response,
      ...(emailVerifiedAt !== undefined
        ? { emailVerified: Boolean(emailVerifiedAt) }
        : {}),
    };
  }

  async requestEmailVerification(
    dto: AccountActionEmailDto,
  ): Promise<RegistrationAcknowledgement> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, emailVerifiedAt: true, deletedAt: true },
    });
    if (user && !user.deletedAt && !user.emailVerifiedAt) {
      await this.accountActionTokenService.issueForUser(
        user.id,
        AccountActionTokenPurpose.VERIFY_EMAIL,
        VERIFICATION_TTL_MS,
      );
    } else if (!user) {
      const pending = await this.prisma.pendingRegistration.findUnique({
        where: { email: dto.email },
        select: { id: true },
      });
      if (pending) {
        await this.accountActionTokenService.issueForPendingRegistration(
          pending.id,
          AccountActionTokenPurpose.VERIFY_EMAIL,
          VERIFICATION_TTL_MS,
        );
      }
    }
    return ACCOUNT_ACTION_ACKNOWLEDGEMENT;
  }

  async confirmEmail(dto: VerifyEmailDto): Promise<void> {
    const passwordHash = dto.password
      ? await hash(dto.password, PASSWORD_HASH_ROUNDS)
      : null;

    await this.prisma.$transaction(
      async (transaction) => {
        const action = await this.accountActionTokenService.consume(
          dto.token,
          AccountActionTokenPurpose.VERIFY_EMAIL,
          transaction,
        );
        const now = new Date();

        if (action.pendingRegistrationId) {
          if (!passwordHash) {
            throw new BadRequestException(
              'A new password is required to finish registration',
            );
          }
          const pending =
            await transaction.pendingRegistration.findUniqueOrThrow({
              where: { id: action.pendingRegistrationId },
            });
          await transaction.user.create({
            data: {
              email: pending.email,
              firstName: pending.firstName,
              lastName: pending.lastName,
              phone: pending.phone,
              passwordHash,
              emailVerifiedAt: now,
            },
          });
          await transaction.pendingRegistration.delete({
            where: { id: pending.id },
          });
          return;
        }

        if (!action.userId) throw new NotFoundException('Action unavailable');
        const updated = await transaction.user.updateMany({
          where: { id: action.userId, deletedAt: null },
          data: { emailVerifiedAt: now },
        });
        if (updated.count !== 1)
          throw new NotFoundException('Action unavailable');
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async requestPasswordReset(
    dto: AccountActionEmailDto,
  ): Promise<RegistrationAcknowledgement> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true, deletedAt: true },
    });
    if (user && !user.deletedAt) {
      await this.accountActionTokenService.issueForUser(
        user.id,
        AccountActionTokenPurpose.RESET_PASSWORD,
        PASSWORD_RESET_TTL_MS,
      );
    }
    return ACCOUNT_ACTION_ACKNOWLEDGEMENT;
  }

  async confirmPasswordReset(dto: ConfirmPasswordResetDto): Promise<void> {
    assertNewPassword(dto.newPassword);
    const passwordHash = await hash(dto.newPassword, PASSWORD_HASH_ROUNDS);
    await this.prisma.$transaction(
      async (transaction) => {
        const action = await this.accountActionTokenService.consume(
          dto.token,
          AccountActionTokenPurpose.RESET_PASSWORD,
          transaction,
        );
        if (!action.userId) throw new NotFoundException('Action unavailable');
        const changed = await transaction.user.updateMany({
          where: { id: action.userId, deletedAt: null },
          data: { passwordHash },
        });
        if (changed.count !== 1)
          throw new NotFoundException('Action unavailable');
        await transaction.userSession.updateMany({
          where: { userId: action.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await transaction.accountActionToken.updateMany({
          where: {
            userId: action.userId,
            purpose: AccountActionTokenPurpose.RESET_PASSWORD,
            consumedAt: null,
          },
          data: { consumedAt: new Date() },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
