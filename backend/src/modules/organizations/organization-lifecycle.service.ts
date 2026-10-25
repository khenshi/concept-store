import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrganizationLifecycleAction,
  OrganizationRole,
  OrganizationStatus,
  Prisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { OrganizationAccess } from './organizations.types';

export interface ProvisionOrganizationInput {
  name: string;
  ownerUserId: string;
  operatorIdentity: string;
  operationId: string;
  reason: string;
}

export interface OrganizationStatusCommandInput {
  organizationId: string;
  expectedStatus: OrganizationStatus;
  operatorIdentity: string;
  operationId: string;
  reason: string;
}

@Injectable()
export class OrganizationLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async provision(
    input: ProvisionOrganizationInput,
  ): Promise<OrganizationAccess> {
    return this.prisma.$transaction(
      async (transaction) => {
        const replay = await this.replayedProvision(transaction, input);
        if (replay) return replay;

        const owner = await transaction.user.findFirst({
          where: {
            id: input.ownerUserId,
            deletedAt: null,
            emailVerifiedAt: { not: null },
          },
          select: { id: true },
        });
        if (!owner) {
          throw new ForbiddenException(
            'The initial owner must be an existing verified account',
          );
        }

        const organization = await transaction.organization.create({
          data: { name: input.name, status: OrganizationStatus.INACTIVE },
        });
        await transaction.organizationMembership.create({
          data: {
            organizationId: organization.id,
            userId: owner.id,
            role: OrganizationRole.OWNER,
          },
        });
        await transaction.organizationLifecycleEvent.create({
          data: {
            organizationId: organization.id,
            action: OrganizationLifecycleAction.PROVISION,
            operationId: input.operationId,
            operatorIdentity: input.operatorIdentity,
            reason: input.reason,
            nextStatus: OrganizationStatus.INACTIVE,
          },
        });

        return { ...organization, role: OrganizationRole.OWNER };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async activate(input: OrganizationStatusCommandInput): Promise<void> {
    return this.changeStatus(
      input,
      OrganizationStatus.ACTIVE,
      OrganizationLifecycleAction.ACTIVATE,
    );
  }

  async deactivate(input: OrganizationStatusCommandInput): Promise<void> {
    return this.changeStatus(
      input,
      OrganizationStatus.INACTIVE,
      OrganizationLifecycleAction.DEACTIVATE,
    );
  }

  private async changeStatus(
    input: OrganizationStatusCommandInput,
    nextStatus: OrganizationStatus,
    action: OrganizationLifecycleAction,
  ): Promise<void> {
    await this.prisma.$transaction(
      async (transaction) => {
        const replay = await transaction.organizationLifecycleEvent.findUnique({
          where: { operationId: input.operationId },
        });
        if (replay) {
          if (
            replay.organizationId !== input.organizationId ||
            replay.action !== action ||
            replay.nextStatus !== nextStatus
          ) {
            throw new ConflictException('Operation ID was already used');
          }
          return;
        }

        const changed = await transaction.organization.updateMany({
          where: {
            id: input.organizationId,
            status: input.expectedStatus,
          },
          data: { status: nextStatus },
        });
        if (changed.count !== 1) {
          const organization = await transaction.organization.findUnique({
            where: { id: input.organizationId },
            select: { id: true },
          });
          if (!organization)
            throw new NotFoundException('Organization not found');
          throw new ConflictException(
            'Organization status changed concurrently',
          );
        }

        await transaction.organizationLifecycleEvent.create({
          data: {
            organizationId: input.organizationId,
            action,
            operationId: input.operationId,
            operatorIdentity: input.operatorIdentity,
            reason: input.reason,
            previousStatus: input.expectedStatus,
            nextStatus,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async replayedProvision(
    transaction: Prisma.TransactionClient,
    input: ProvisionOrganizationInput,
  ): Promise<OrganizationAccess | null> {
    const replay = await transaction.organizationLifecycleEvent.findUnique({
      where: { operationId: input.operationId },
      include: { organization: true },
    });
    if (!replay) return null;
    if (
      replay.action !== OrganizationLifecycleAction.PROVISION ||
      replay.organization.name !== input.name
    ) {
      throw new ConflictException('Operation ID was already used');
    }
    const membership = await transaction.organizationMembership.findFirst({
      where: {
        organizationId: replay.organizationId,
        userId: input.ownerUserId,
        role: OrganizationRole.OWNER,
      },
      select: { role: true },
    });
    if (!membership)
      throw new ConflictException('Provisioning replay is invalid');
    return { ...replay.organization, role: membership.role };
  }
}
