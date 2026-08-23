import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrganizationRole } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { OrganizationAccessGuard } from './organization-access.guard';

describe('OrganizationAccessGuard', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const prisma = {
    organizationMembership: { findUnique: jest.fn() },
  };
  const reflector = { getAllAndOverride: jest.fn() };
  let guard: OrganizationAccessGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        OrganizationAccessGuard,
        { provide: PrismaService, useValue: prisma },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();
    guard = moduleRef.get(OrganizationAccessGuard);
  });

  function createContext(id = organizationId): {
    context: ExecutionContext;
    request: Record<string, unknown>;
  } {
    const request = {
      params: { organizationId: id },
      user: { id: 'user-id', email: 'owner@example.com' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => 'handler',
      getClass: () => 'class',
    } as unknown as ExecutionContext;
    return { context, request };
  }

  it('attaches trusted organization context for an allowed member', async () => {
    const { context, request } = createContext();
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
    });
    reflector.getAllAndOverride.mockReturnValue([OrganizationRole.OWNER]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationContext).toEqual({
      organizationId,
      userId: 'user-id',
      role: OrganizationRole.OWNER,
    });
  });

  it('hides organizations for which the user has no membership', async () => {
    const { context } = createContext();
    prisma.organizationMembership.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new NotFoundException('Organization not found'),
    );
  });

  it('rejects a member without an allowed role', async () => {
    const { context } = createContext();
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.CASHIER,
    });
    reflector.getAllAndOverride.mockReturnValue([
      OrganizationRole.OWNER,
      OrganizationRole.MANAGER,
    ]);

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Your organization role cannot perform this action',
      ),
    );
  });

  it('rejects an invalid organization ID before querying', async () => {
    const { context } = createContext('not-a-uuid');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new BadRequestException('Organization ID must be a valid UUID'),
    );
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });
});
