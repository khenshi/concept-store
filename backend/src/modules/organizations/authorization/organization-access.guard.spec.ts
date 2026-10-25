import {
  BadRequestException,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { OrganizationRole } from '../../../generated/prisma/client';
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

  function createContext(
    id = organizationId,
    method = 'GET',
  ): {
    context: ExecutionContext;
    request: Record<string, unknown>;
  } {
    const request = {
      params: { organizationId: id },
      method,
      user: {
        id: 'user-id',
        email: 'owner@example.com',
        emailVerified: true,
      },
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
      organization: { status: 'ACTIVE' },
    });
    reflector.getAllAndOverride.mockReturnValue([OrganizationRole.OWNER]);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.organizationContext).toEqual({
      merchantId: null,
      organizationId,
      userId: 'user-id',
      role: OrganizationRole.OWNER,
      status: 'ACTIVE',
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
      organization: { status: 'ACTIVE' },
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

  it('allows verified members to read but blocks writes for inactive organizations', async () => {
    const { context: readContext } = createContext(organizationId, 'GET');
    prisma.organizationMembership.findUnique.mockResolvedValue({
      role: OrganizationRole.OWNER,
      organization: { status: 'INACTIVE' },
    });
    reflector.getAllAndOverride.mockReturnValue([OrganizationRole.OWNER]);

    await expect(guard.canActivate(readContext)).resolves.toBe(true);

    const { context: writeContext } = createContext(organizationId, 'POST');
    await expect(guard.canActivate(writeContext)).rejects.toThrow(
      new ForbiddenException(
        'This organization is inactive and currently read-only',
      ),
    );
  });

  it('rejects unverified users before membership lookup', async () => {
    const { context, request } = createContext();
    (request.user as { emailVerified?: boolean }).emailVerified = false;

    await expect(guard.canActivate(context)).rejects.toThrow(
      new ForbiddenException(
        'Verify your email before accessing an organization workspace',
      ),
    );
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });

  it('rejects an invalid organization ID before querying', async () => {
    const { context } = createContext('not-a-uuid');

    await expect(guard.canActivate(context)).rejects.toThrow(
      new BadRequestException('Organization ID must be a valid UUID'),
    );
    expect(prisma.organizationMembership.findUnique).not.toHaveBeenCalled();
  });
});
