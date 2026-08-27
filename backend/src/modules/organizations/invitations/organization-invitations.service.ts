import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { AuthenticatedPrincipal } from '../../auth/auth.types';
import type { CreateOrganizationInvitationDto } from './dto/create-organization-invitation.dto';
import type {
  AcceptedOrganizationInvitation,
  CreatedOrganizationInvitation,
  OrganizationInvitationPreview,
  OrganizationInvitationView,
} from './organization-invitations.types';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const invitationSelect = {
  id: true,
  organizationId: true,
  email: true,
  role: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  createdAt: true,
} satisfies Prisma.OrganizationInvitationSelect;

@Injectable()
export class OrganizationInvitationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    invitedBy: AuthenticatedPrincipal,
    dto: CreateOrganizationInvitationDto,
  ): Promise<CreatedOrganizationInvitation> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

    const invitation = await this.prisma.$transaction(async (transaction) => {
      const existingMembership =
        await transaction.organizationMembership.findFirst({
          where: { organizationId, user: { email: dto.email } },
          select: { userId: true },
        });
      if (existingMembership) {
        throw new ConflictException(
          'This email already belongs to an organization member',
        );
      }

      await transaction.organizationInvitation.updateMany({
        where: {
          organizationId,
          email: dto.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });

      return transaction.organizationInvitation.create({
        data: {
          organizationId,
          email: dto.email,
          role: dto.role,
          tokenHash,
          expiresAt,
          invitedById: invitedBy.id,
        },
        select: invitationSelect,
      });
    });

    return { invitation, token };
  }

  findAll(organizationId: string): Promise<OrganizationInvitationView[]> {
    return this.prisma.organizationInvitation.findMany({
      where: { organizationId },
      select: invitationSelect,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }

  async revoke(
    organizationId: string,
    invitationId: string,
  ): Promise<OrganizationInvitationView> {
    const result = await this.prisma.organizationInvitation.updateMany({
      where: {
        id: invitationId,
        organizationId,
        acceptedAt: null,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });
    if (result.count !== 1) {
      throw new ConflictException('Invitation is no longer pending');
    }
    return this.prisma.organizationInvitation.findFirstOrThrow({
      where: { id: invitationId, organizationId },
      select: invitationSelect,
    });
  }

  async preview(token: string): Promise<OrganizationInvitationPreview> {
    const invitation = await this.findUsableInvitation(token);
    return {
      organizationName: invitation.organization.name,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(
    token: string,
    user: AuthenticatedPrincipal,
  ): Promise<AcceptedOrganizationInvitation> {
    if (!TOKEN_PATTERN.test(token)) this.throwUnavailable();
    const tokenHash = this.hashToken(token);

    return this.prisma.$transaction(
      async (transaction) => {
        const invitation = await transaction.organizationInvitation.findFirst({
          where: {
            tokenHash,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          include: { organization: { select: { id: true, name: true } } },
        });
        if (!invitation) this.throwUnavailable();
        if (invitation.email !== user.email) {
          throw new ForbiddenException(
            'Sign in with the email address that received this invitation',
          );
        }

        const existing = await transaction.organizationMembership.findUnique({
          where: {
            organizationId_userId: {
              organizationId: invitation.organizationId,
              userId: user.id,
            },
          },
          select: { userId: true },
        });
        if (existing) {
          throw new ConflictException(
            'This account is already an organization member',
          );
        }

        const claimed = await transaction.organizationInvitation.updateMany({
          where: {
            id: invitation.id,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: { acceptedAt: new Date(), acceptedById: user.id },
        });
        if (claimed.count !== 1) this.throwUnavailable();

        await transaction.organizationMembership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: user.id,
            role: invitation.role,
          },
        });

        return {
          organizationId: invitation.organization.id,
          organizationName: invitation.organization.name,
          role: invitation.role,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async findUsableInvitation(token: string) {
    if (!TOKEN_PATTERN.test(token)) this.throwUnavailable();
    const invitation = await this.prisma.organizationInvitation.findFirst({
      where: {
        tokenHash: this.hashToken(token),
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { organization: { select: { name: true } } },
    });
    if (!invitation) this.throwUnavailable();
    return invitation;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private throwUnavailable(): never {
    throw new NotFoundException(
      'Invitation is invalid, expired, or unavailable',
    );
  }
}
