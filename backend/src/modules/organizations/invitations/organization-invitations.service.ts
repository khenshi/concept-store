import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { OrganizationRole, Prisma } from '../../../generated/prisma/client';
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
  merchantId: true,
  merchant: { select: { id: true, name: true, code: true, status: true } },
  branches: {
    select: { branch: { select: { id: true, name: true, code: true } } },
    orderBy: { branchId: 'asc' },
  },
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
      if (
        dto.role !== OrganizationRole.MERCHANT &&
        dto.merchantId !== undefined
      )
        throw new BadRequestException(
          'merchantId is only allowed for MERCHANT invitations',
        );
      if (dto.role === OrganizationRole.MERCHANT && !dto.merchantId)
        throw new BadRequestException(
          'MERCHANT invitation requires merchantId',
        );
      if (dto.merchantId) {
        const merchant = await transaction.merchant.findUnique({
          where: { id_organizationId: { id: dto.merchantId, organizationId } },
          select: { id: true },
        });
        if (!merchant) throw new NotFoundException('Merchant not found');
      }
      if (dto.branchIds?.length) {
        const branches = await transaction.branch.count({
          where: { organizationId, id: { in: dto.branchIds } },
        });
        if (branches !== dto.branchIds.length)
          throw new NotFoundException('Branch not found');
      }
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
          merchantId: dto.merchantId ?? null,
          branches: {
            create: (dto.branchIds ?? []).map((branchId) => ({ branchId })),
          },
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

    try {
      return await this.prisma.$transaction(
        async (transaction) => {
          const invitation = await transaction.organizationInvitation.findFirst(
            {
              where: {
                tokenHash,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              include: {
                organization: { select: { id: true, name: true } },
                branches: { select: { branchId: true } },
              },
            },
          );
          if (!invitation) this.throwUnavailable();
          if (invitation.email !== user.email) {
            throw new ForbiddenException(
              'Sign in with the email address that received this invitation',
            );
          }

          if (
            invitation.role === OrganizationRole.MERCHANT &&
            !invitation.merchantId
          )
            throw new ConflictException(
              'This merchant invitation has no profile link; ask an owner to revoke it and send a new invitation',
            );

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
              organizationId: invitation.organizationId,
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
              merchantId: invitation.merchantId ?? null,
              branches: {
                create: invitation.branches.map(({ branchId }) => ({
                  branchId,
                })),
              },
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
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(error.code)
      )
        throw new ConflictException(
          'Invitation or membership changed concurrently; retry the request',
        );
      throw error;
    }
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
