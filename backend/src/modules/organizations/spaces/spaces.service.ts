import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { branchScope, merchantScope } from '../authorization/resource-access';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { assertActiveOrganization } from '../organization-state';
import type {
  AssignSpaceDto,
  CreateSpaceDto,
  CreateSpaceTypeDto,
  ListSpaceTypesDto,
  ListOccupanciesDto,
  ListSpacesDto,
  ReleaseSpaceDto,
  SpaceStatusDto,
  UpdateSpaceTypeDto,
  UpdateSpaceDto,
} from './dto/space.dto';
import { lockSpaceMerchant, rethrowSpaceConflict } from './space-occupancy';
import { assertBranchWriteAllowed } from '../branch-lifecycle';

const SPACE_PAGE_SIZE = 15;

const occupancySharedSelect = {
  id: true,
  organizationId: true,
  branchId: true,
  spaceId: true,
  merchantId: true,
  startedAt: true,
  endedAt: true,
  releaseReason: true,
  space: { select: { id: true, name: true, type: true, status: true } },
  merchantBranch: {
    select: {
      branch: { select: { id: true, name: true, code: true } },
      merchant: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.SpaceOccupancySelect;
export const occupancySelect = {
  ...occupancySharedSelect,
  releasedBy: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.SpaceOccupancySelect;
export const merchantOccupancySelect =
  occupancySharedSelect satisfies Prisma.SpaceOccupancySelect;
function projectOccupancy(
  row:
    | Prisma.SpaceOccupancyGetPayload<{ select: typeof occupancySelect }>
    | Prisma.SpaceOccupancyGetPayload<{
        select: typeof merchantOccupancySelect;
      }>,
) {
  const { merchantBranch, ...rest } = row;
  const releasedBy = 'releasedBy' in row ? row.releasedBy : null;
  return {
    ...rest,
    ...merchantBranch,
    releasedBy: releasedBy
      ? {
          id: releasedBy.id,
          name: `${releasedBy.firstName} ${releasedBy.lastName}`.trim(),
        }
      : null,
  };
}
function projectMerchantOccupancy(
  row: Prisma.SpaceOccupancyGetPayload<{
    select: typeof merchantOccupancySelect;
  }>,
) {
  const { merchantBranch, ...rest } = row;
  return { ...rest, ...merchantBranch };
}
function projectType(row: {
  id: string;
  organizationId: string;
  name: string;
  archivedAt: Date | null;
  version: number;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    archived: row.archivedAt !== null,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}
function pageResult<T>(items: T[], total: number, page: number) {
  return {
    items,
    total,
    page,
    limit: SPACE_PAGE_SIZE,
    totalPages: Math.ceil(total / SPACE_PAGE_SIZE),
    hasNext: page * SPACE_PAGE_SIZE < total,
  };
}

@Injectable()
export class SpacesService {
  constructor(private readonly prisma: PrismaService) {}
  private async current(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    write = false,
  ) {
    const member = await tx.organizationMembership.findFirst({
      where: {
        organizationId: context.organizationId,
        userId: context.userId,
        user: { deletedAt: null },
      },
      select: { role: true, merchantId: true },
    });
    if (!member)
      throw new NotFoundException('Organization membership not found');
    if (
      write
        ? member.role !== 'OWNER'
        : !['OWNER', 'MANAGER', 'MERCHANT'].includes(member.role)
    )
      throw new ForbiddenException('Your role cannot access spaces');
    return { ...context, ...member };
  }
  private async branch(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
  ) {
    if (
      !(await tx.branch.findFirst({
        where: { AND: [branchScope(context), { id: branchId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Branch not found');
  }
  private async merchant(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    merchantId: string,
  ) {
    if (
      !(await tx.merchant.findFirst({
        where: { AND: [merchantScope(context), { id: merchantId }] },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Merchant not found');
  }
  private async space(
    tx: Prisma.TransactionClient,
    context: OrganizationContext,
    branchId: string,
    id: string,
  ) {
    const row = await tx.space.findFirst({
      where: {
        organizationId: context.organizationId,
        branchId,
        id,
        ...(context.role === 'MERCHANT'
          ? { occupancies: { some: { merchantId: context.merchantId ?? '' } } }
          : {}),
      },
    });
    if (!row) throw new NotFoundException('Space not found');
    return row;
  }
  private async transaction<T>(
    context: OrganizationContext,
    write: boolean,
    work: (
      tx: Prisma.TransactionClient,
      current: OrganizationContext,
    ) => Promise<T>,
  ) {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          if (write) {
            await assertActiveOrganization(tx, context.organizationId);
            await tx.$queryRaw`SELECT "userId" FROM "OrganizationMembership" WHERE "organizationId" = ${context.organizationId} AND "userId" = ${context.userId} FOR UPDATE`;
          }
          return work(tx, await this.current(tx, context, write));
        },
        {
          isolationLevel: write
            ? Prisma.TransactionIsolationLevel.Serializable
            : Prisma.TransactionIsolationLevel.RepeatableRead,
        },
      );
    } catch (error) {
      rethrowSpaceConflict(error);
    }
  }
  async listTypes(
    context: OrganizationContext,
    query: Partial<ListSpaceTypesDto> = {},
  ) {
    return this.transaction(context, false, async (tx, current) => {
      const includeArchived =
        current.role === 'OWNER' && query.includeArchived === true;
      const currentName = query.currentName?.trim();
      const rows = await tx.spaceType.findMany({
        where: {
          organizationId: current.organizationId,
          ...(!includeArchived
            ? {
                OR: [
                  { archivedAt: null },
                  ...(currentName
                    ? [
                        {
                          name: {
                            equals: currentName,
                            mode: 'insensitive' as const,
                          },
                        },
                      ]
                    : []),
                ],
              }
            : {}),
          ...(current.role === 'MERCHANT'
            ? {
                spaces: {
                  some: {
                    organizationId: current.organizationId,
                    branch: branchScope(current),
                    occupancies: {
                      some: {
                        organizationId: current.organizationId,
                        merchantId: current.merchantId ?? '',
                      },
                    },
                  },
                },
              }
            : {}),
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          organizationId: true,
          name: true,
          archivedAt: true,
          version: true,
          updatedAt: true,
        },
      });
      return rows.map(projectType);
    });
  }
  async createType(context: OrganizationContext, dto: CreateSpaceTypeDto) {
    return this.transaction(context, true, async (tx, current) => {
      const name = dto.name.trim();
      if (!name || name.length > 80)
        throw new BadRequestException('Type name must contain 1–80 characters');
      if (
        await tx.spaceType.findFirst({
          where: {
            organizationId: current.organizationId,
            name: { equals: name, mode: 'insensitive' },
          },
        })
      )
        throw new ConflictException(
          'A space type with this name already exists.',
        );
      return projectType(
        await tx.spaceType.create({
          data: { organizationId: current.organizationId, name },
          select: {
            id: true,
            organizationId: true,
            name: true,
            archivedAt: true,
            version: true,
            updatedAt: true,
          },
        }),
      );
    });
  }
  async updateType(
    context: OrganizationContext,
    id: string,
    dto: UpdateSpaceTypeDto,
  ) {
    return this.transaction(context, true, async (tx, current) => {
      const rows = await tx.$queryRaw<
        { id: string; name: string; archivedAt: Date | null; version: number }[]
      >`SELECT "id", "name", "archivedAt", "version" FROM "SpaceType" WHERE "organizationId" = ${current.organizationId} AND "id" = ${id} FOR UPDATE`;
      const existing = rows[0];
      if (!existing) throw new NotFoundException('Space type not found');
      if (existing.version !== dto.expectedVersion)
        throw new ConflictException(
          'This space type changed. Refresh the type catalog and try again.',
        );
      const nextName = dto.name?.trim() ?? existing.name;
      const nextArchived = dto.archived ?? existing.archivedAt !== null;
      if (!nextName || nextName.length > 80)
        throw new BadRequestException('Type name must contain 1–80 characters');
      if (nextName.toLocaleLowerCase() !== existing.name.toLocaleLowerCase()) {
        const conflict = await tx.spaceType.findFirst({
          where: {
            organizationId: current.organizationId,
            name: { equals: nextName, mode: 'insensitive' },
            NOT: { id },
          },
          select: { id: true },
        });
        if (conflict)
          throw new ConflictException(
            'A space type with this name already exists.',
          );
      }
      if (
        nextName === existing.name &&
        nextArchived === (existing.archivedAt !== null)
      )
        return projectType(
          await tx.spaceType.findUniqueOrThrow({
            where: { id },
            select: {
              id: true,
              organizationId: true,
              name: true,
              archivedAt: true,
              version: true,
              updatedAt: true,
            },
          }),
        );
      return projectType(
        await tx.spaceType.update({
          where: { id },
          data: {
            name: nextName,
            archivedAt: nextArchived ? new Date() : null,
            version: { increment: 1 },
          },
          select: {
            id: true,
            organizationId: true,
            name: true,
            archivedAt: true,
            version: true,
            updatedAt: true,
          },
        }),
      );
    });
  }
  private async resolveActiveType(
    tx: Prisma.TransactionClient,
    organizationId: string,
    rawName: string,
  ) {
    const name = rawName.trim();
    const rows = await tx.$queryRaw<
      { name: string; archivedAt: Date | null }[]
    >`SELECT "name", "archivedAt" FROM "SpaceType" WHERE "organizationId" = ${organizationId} AND lower("name") = lower(${name}) FOR UPDATE`;
    const type = rows[0];
    if (!type)
      throw new BadRequestException(
        'Choose an existing space type before saving the space.',
      );
    if (type.archivedAt)
      throw new ConflictException(
        'This space type is archived. Reactivate it before using it.',
      );
    return type.name;
  }
  async list(
    context: OrganizationContext,
    branchId: string,
    query: ListSpacesDto,
  ) {
    return this.transaction(context, false, async (tx, current) => {
      await this.branch(tx, current, branchId);
      if (current.role === 'MERCHANT' && query.occupancy)
        throw new ForbiddenException('Occupancy filtering is unavailable.');
      if (query.merchantId) await this.merchant(tx, current, query.merchantId);
      const merchantId =
        current.role === 'MERCHANT'
          ? (current.merchantId ?? '')
          : query.merchantId;
      const where: Prisma.SpaceWhereInput = {
        organizationId: current.organizationId,
        branchId,
        ...(query.q
          ? { name: { contains: query.q, mode: 'insensitive' } }
          : {}),
        ...(query.type
          ? { type: { equals: query.type, mode: 'insensitive' } }
          : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.occupancy
          ? {
              AND: [
                {
                  occupancies:
                    query.occupancy === 'OCCUPIED'
                      ? { some: { endedAt: null } }
                      : { none: { endedAt: null } },
                },
              ],
            }
          : {}),
        ...(merchantId !== undefined
          ? {
              occupancies: {
                some: {
                  merchantId,
                  ...(current.role === 'MERCHANT' ? {} : { endedAt: null }),
                },
              },
            }
          : {}),
      };
      const total = await tx.space.count({ where });
      const rows = await tx.space.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: (query.page - 1) * SPACE_PAGE_SIZE,
        take: SPACE_PAGE_SIZE,
        include: {
          occupancies: {
            where: {
              endedAt: null,
              ...(current.role === 'MERCHANT'
                ? { merchantId: current.merchantId ?? '' }
                : {}),
            },
            select:
              current.role === 'MERCHANT'
                ? merchantOccupancySelect
                : occupancySelect,
            take: 1,
          },
        },
      });
      return pageResult(
        rows.map(({ occupancies, ...space }) => ({
          ...space,
          currentOccupancy: occupancies[0]
            ? current.role === 'MERCHANT'
              ? projectMerchantOccupancy(occupancies[0])
              : projectOccupancy(occupancies[0])
            : null,
        })),
        total,
        query.page,
      );
    });
  }
  async findOne(context: OrganizationContext, branchId: string, id: string) {
    return this.transaction(context, false, async (tx, current) => {
      await this.branch(tx, current, branchId);
      return this.space(tx, current, branchId, id);
    });
  }
  async occupancies(
    context: OrganizationContext,
    kind: 'merchant' | 'space',
    id: string,
    query: ListOccupanciesDto,
    branchId?: string,
  ) {
    return this.transaction(context, false, async (tx, current) => {
      const dateFrom = query.dateFrom ? new Date(query.dateFrom) : undefined;
      const dateTo = query.dateTo ? new Date(query.dateTo) : undefined;
      if (dateFrom && dateTo && dateFrom >= dateTo)
        throw new BadRequestException(
          'dateFrom must be before dateTo for occupancy history',
        );
      if (kind === 'merchant') await this.merchant(tx, current, id);
      if (branchId ?? query.branchId)
        await this.branch(tx, current, (branchId ?? query.branchId)!);
      if (kind === 'space') await this.space(tx, current, branchId!, id);
      const where: Prisma.SpaceOccupancyWhereInput = {
        organizationId: current.organizationId,
        space: { branch: branchScope(current) },
        ...(kind === 'merchant' ? { merchantId: id } : { spaceId: id }),
        ...((branchId ?? query.branchId)
          ? { branchId: branchId ?? query.branchId }
          : {}),
        ...(current.role === 'MERCHANT'
          ? { merchantId: current.merchantId ?? '' }
          : {}),
        ...(query.view === 'CURRENT'
          ? { endedAt: null }
          : query.view === 'HISTORY'
            ? { endedAt: { not: null } }
            : {}),
        ...(query.q
          ? {
              merchantBranch: {
                merchant: {
                  OR: [
                    { name: { contains: query.q, mode: 'insensitive' } },
                    { code: { contains: query.q, mode: 'insensitive' } },
                  ],
                },
              },
            }
          : {}),
        ...(dateTo ? { startedAt: { lt: dateTo } } : {}),
        ...(dateFrom
          ? { OR: [{ endedAt: null }, { endedAt: { gt: dateFrom } }] }
          : {}),
      };
      const total = await tx.spaceOccupancy.count({ where });
      const rows = await tx.spaceOccupancy.findMany({
        where,
        select:
          current.role === 'MERCHANT'
            ? merchantOccupancySelect
            : occupancySelect,
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * SPACE_PAGE_SIZE,
        take: SPACE_PAGE_SIZE,
      });
      return pageResult(
        rows.map((row) =>
          current.role === 'MERCHANT'
            ? projectMerchantOccupancy(row)
            : projectOccupancy(row),
        ),
        total,
        query.page,
      );
    });
  }
  async create(
    context: OrganizationContext,
    branchId: string,
    dto: CreateSpaceDto,
  ) {
    return this.transaction(context, true, async (tx, current) => {
      await this.branch(tx, current, branchId);
      await assertBranchWriteAllowed(tx, current.organizationId, branchId);
      const type = await this.resolveActiveType(
        tx,
        current.organizationId,
        dto.type,
      );
      return tx.space.create({
        data: {
          organizationId: current.organizationId,
          branchId,
          ...dto,
          type,
        },
      });
    });
  }
  async update(
    context: OrganizationContext,
    branchId: string,
    id: string,
    dto: UpdateSpaceDto | SpaceStatusDto,
  ) {
    if (!Object.values(dto).some((value) => value !== undefined))
      throw new BadRequestException('At least one space field is required');
    return this.transaction(context, true, async (tx, current) => {
      await this.branch(tx, current, branchId);
      await assertBranchWriteAllowed(tx, current.organizationId, branchId);
      const existing = await this.lockSpace(
        tx,
        current.organizationId,
        branchId,
        id,
      );
      if (
        'status' in dto &&
        dto.status === 'ARCHIVED' &&
        (await tx.spaceOccupancy.count({
          where: {
            organizationId: current.organizationId,
            branchId,
            spaceId: id,
            endedAt: null,
          },
        }))
      )
        throw new ConflictException(
          'Release the occupied space before archiving it',
        );
      const data =
        'status' in dto || dto.type === undefined
          ? dto
          : {
              ...dto,
              type:
                dto.type.trim().toLocaleLowerCase() ===
                existing.type.toLocaleLowerCase()
                  ? existing.type
                  : await this.resolveActiveType(
                      tx,
                      current.organizationId,
                      dto.type,
                    ),
            };
      return tx.space.update({
        where: { id, organizationId: current.organizationId, branchId },
        data,
      });
    });
  }
  private async lockSpace(
    tx: Prisma.TransactionClient,
    organizationId: string,
    branchId: string,
    id: string,
  ) {
    const rows = await tx.$queryRaw<
      { id: string; status: string; type: string }[]
    >`SELECT "id", "status", "type" FROM "Space" WHERE "organizationId" = ${organizationId} AND "branchId" = ${branchId} AND "id" = ${id} FOR UPDATE`;
    if (!rows.length) throw new NotFoundException('Space not found');
    return rows[0];
  }
  private date(value: string | undefined, fallback: Date) {
    const date = value === undefined ? fallback : new Date(value);
    if (
      !Number.isFinite(date.getTime()) ||
      date > fallback ||
      (value !== undefined && !/(Z|[+-]\d{2}:\d{2})$/.test(value))
    )
      throw new BadRequestException(
        'Enter a past or current timestamp including its timezone',
      );
    return date;
  }
  async assign(
    context: OrganizationContext,
    branchId: string,
    id: string,
    dto: AssignSpaceDto,
  ) {
    return this.transaction(context, true, async (tx, current) => {
      await this.branch(tx, current, branchId);
      await assertBranchWriteAllowed(tx, current.organizationId, branchId);
      const merchant = await lockSpaceMerchant(
        tx,
        current.organizationId,
        dto.merchantId,
      );
      const participation = await tx.$queryRaw<
        { status: string }[]
      >`SELECT "status" FROM "MerchantBranch" WHERE "organizationId" = ${current.organizationId} AND "branchId" = ${branchId} AND "merchantId" = ${dto.merchantId} FOR UPDATE`;
      if (!participation.length)
        throw new NotFoundException('Merchant–branch association not found');
      if (merchant.status !== 'ACTIVE' || participation[0].status !== 'ACTIVE')
        throw new ConflictException(
          'An active merchant and active branch participation are required',
        );
      const space = await this.lockSpace(
        tx,
        current.organizationId,
        branchId,
        id,
      );
      if (space.status !== 'ACTIVE')
        throw new ConflictException('Reactivate the space before assigning it');
      const now = new Date(),
        startedAt = this.date(dto.startedAt, now),
        endedAt =
          dto.endedAt === undefined ? null : this.date(dto.endedAt, now);
      if (endedAt && endedAt <= startedAt)
        throw new BadRequestException('End must be after start');
      const overlap = await tx.spaceOccupancy.count({
        where: {
          organizationId: current.organizationId,
          branchId,
          spaceId: id,
          ...(endedAt ? { startedAt: { lt: endedAt } } : {}),
          OR: [{ endedAt: null }, { endedAt: { gt: startedAt } }],
        },
      });
      if (overlap)
        throw new ConflictException(
          'This space is occupied during the selected dates',
        );
      return projectOccupancy(
        await tx.spaceOccupancy.create({
          data: {
            organizationId: current.organizationId,
            branchId,
            spaceId: id,
            merchantId: dto.merchantId,
            startedAt,
            endedAt,
            assignedById: current.userId,
            ...(endedAt
              ? { releasedById: current.userId, releaseReason: 'MANUAL' }
              : {}),
          },
          select: occupancySelect,
        }),
      );
    });
  }
  async release(
    context: OrganizationContext,
    branchId: string,
    id: string,
    occupancyId: string,
    dto: ReleaseSpaceDto,
  ) {
    return this.transaction(context, true, async (tx, current) => {
      await this.branch(tx, current, branchId);
      await assertBranchWriteAllowed(tx, current.organizationId, branchId, {
        allowInactive: true,
      });
      const where = {
        id: occupancyId,
        organizationId: current.organizationId,
        branchId,
        spaceId: id,
      };
      const occupancy = await tx.spaceOccupancy.findFirst({ where });
      if (!occupancy) throw new NotFoundException('Occupancy not found');
      await lockSpaceMerchant(tx, current.organizationId, occupancy.merchantId);
      await this.lockSpace(tx, current.organizationId, branchId, id);
      const fresh = await tx.spaceOccupancy.findFirstOrThrow({ where });
      if (fresh.endedAt)
        throw new ConflictException(
          'Occupancy was already released; refresh the history',
        );
      const endedAt = this.date(dto.endedAt, new Date());
      if (endedAt <= fresh.startedAt)
        throw new BadRequestException('End must be after start');
      return projectOccupancy(
        await tx.spaceOccupancy.update({
          where: { id: occupancyId },
          data: {
            endedAt,
            releasedById: current.userId,
            releaseReason: 'MANUAL',
          },
          select: occupancySelect,
        }),
      );
    });
  }
}
