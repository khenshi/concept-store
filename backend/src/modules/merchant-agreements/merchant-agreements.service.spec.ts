import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgreementStatus,
  Prisma,
  SettlementSchedule,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantAgreementsService } from './merchant-agreements.service';
import { merchantAgreementViewInclude } from './merchant-agreements.types';

describe('MerchantAgreementsService', () => {
  const organizationId = '580c75b7-1050-4a08-a2c2-585171d84dc8';
  const merchantId = '44c7fe4b-9342-4bf7-9d72-33842ac5ca80';
  const agreementId = 'cad19536-c64f-4595-9529-40e1f6b0523e';
  const agreement = {
    id: agreementId,
    organizationId,
    merchantId,
    startDate: new Date('2026-01-01T00:00:00.000Z'),
    endDate: null,
    fixedRentAmount: new Prisma.Decimal('2500.00'),
    commissionRate: new Prisma.Decimal('5.00'),
    settlementSchedule: SettlementSchedule.MONTHLY,
    status: AgreementStatus.DRAFT,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const prisma = {
    merchant: { findFirst: jest.fn() },
    merchantAgreement: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: MerchantAgreementsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (transaction: typeof prisma) => unknown) => operation(prisma),
    );
    const moduleRef = await Test.createTestingModule({
      providers: [
        MerchantAgreementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(MerchantAgreementsService);
  });

  it('creates a tenant-scoped draft with precise decimal values', async () => {
    prisma.merchant.findFirst.mockResolvedValue({ id: merchantId });
    prisma.merchantAgreement.create.mockResolvedValue(agreement);

    await expect(
      service.create(organizationId, merchantId, {
        startDate: '2026-01-01',
        fixedRentAmount: '2500.00',
        commissionRate: '5.00',
        settlementSchedule: SettlementSchedule.MONTHLY,
      }),
    ).resolves.toEqual(agreement);
    expect(prisma.merchant.findFirst).toHaveBeenCalledWith({
      where: { id: merchantId, organizationId },
      select: { id: true },
    });
    expect(prisma.merchantAgreement.create).toHaveBeenCalledWith({
      data: {
        organizationId,
        merchantId,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: null,
        fixedRentAmount: new Prisma.Decimal('2500.00'),
        commissionRate: new Prisma.Decimal('5.00'),
        settlementSchedule: SettlementSchedule.MONTHLY,
      },
    });
  });

  it('conceals a merchant outside the organization', async () => {
    prisma.merchant.findFirst.mockResolvedValue(null);

    await expect(service.findAll(organizationId, merchantId)).rejects.toThrow(
      new NotFoundException('Merchant not found'),
    );
    expect(prisma.merchantAgreement.findMany).not.toHaveBeenCalled();
  });

  it('lists organization agreements with their merchants', async () => {
    const view = {
      ...agreement,
      merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMIHAN' },
    };
    prisma.merchantAgreement.findMany.mockResolvedValue([view]);

    await expect(
      service.findAllForOrganization(organizationId),
    ).resolves.toEqual([view]);
    expect(prisma.merchantAgreement.findMany).toHaveBeenCalledWith({
      where: { organizationId },
      include: merchantAgreementViewInclude,
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });
  });

  it('gets an organization-scoped agreement view', async () => {
    const view = {
      ...agreement,
      merchant: { id: merchantId, name: 'Amihan Goods', code: 'AMIHAN' },
    };
    prisma.merchantAgreement.findFirst.mockResolvedValue(view);

    await expect(
      service.findOneView(organizationId, agreementId),
    ).resolves.toEqual(view);
    expect(prisma.merchantAgreement.findFirst).toHaveBeenCalledWith({
      where: { id: agreementId, organizationId },
      include: merchantAgreementViewInclude,
    });
  });

  it('rejects agreement date ranges in reverse order', async () => {
    prisma.merchant.findFirst.mockResolvedValue({ id: merchantId });

    await expect(
      service.create(organizationId, merchantId, {
        startDate: '2026-02-01',
        endDate: '2026-01-31',
        settlementSchedule: SettlementSchedule.MONTHLY,
      }),
    ).rejects.toThrow(
      new BadRequestException('endDate cannot be earlier than startDate'),
    );
  });

  it('updates only a draft and permits clearing an optional term', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue(agreement);
    prisma.merchantAgreement.update.mockResolvedValue({
      ...agreement,
      commissionRate: null,
    });

    await service.update(organizationId, agreementId, { commissionRate: null });

    expect(prisma.merchantAgreement.update).toHaveBeenCalledWith({
      where: { id: agreementId, organizationId },
      data: {
        startDate: undefined,
        endDate: undefined,
        fixedRentAmount: undefined,
        commissionRate: null,
        settlementSchedule: undefined,
      },
    });
  });

  it('keeps active and ended agreement terms immutable', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      ...agreement,
      status: AgreementStatus.ACTIVE,
    });

    await expect(
      service.update(organizationId, agreementId, {
        fixedRentAmount: '3000.00',
      }),
    ).rejects.toThrow(
      new ConflictException('Only draft agreements can be edited'),
    );
  });

  it('requires complete commercial terms before activation', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      ...agreement,
      fixedRentAmount: null,
      commissionRate: null,
    });

    await expect(service.activate(organizationId, agreementId)).rejects.toThrow(
      new BadRequestException(
        'An active agreement requires fixed rent, commission, or both',
      ),
    );
  });

  it('does not activate a future-dated draft early', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      ...agreement,
      startDate: new Date('2099-01-01T00:00:00.000Z'),
    });

    await expect(service.activate(organizationId, agreementId)).rejects.toThrow(
      new ConflictException(
        'Agreement cannot be activated before its startDate',
      ),
    );
  });

  it('atomically ends the current agreement at a replacement boundary', async () => {
    const current = {
      ...agreement,
      id: '31e323bc-5f7c-4a5f-952e-33042d53cbf3',
      startDate: new Date('2025-01-01T00:00:00.000Z'),
      status: AgreementStatus.ACTIVE,
    };
    prisma.merchantAgreement.findFirst
      .mockResolvedValueOnce(agreement)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(current);
    prisma.merchantAgreement.update
      .mockResolvedValueOnce({ ...current, status: AgreementStatus.ENDED })
      .mockResolvedValueOnce({ ...agreement, status: AgreementStatus.ACTIVE });

    await service.activate(organizationId, agreementId);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.merchantAgreement.update).toHaveBeenNthCalledWith(1, {
      where: { id: current.id, organizationId },
      data: {
        status: AgreementStatus.ENDED,
        endDate: new Date('2025-12-31T00:00:00.000Z'),
      },
    });
    expect(prisma.merchantAgreement.update).toHaveBeenNthCalledWith(2, {
      where: { id: agreementId, organizationId },
      data: { status: AgreementStatus.ACTIVE },
    });
  });

  it('does not activate across an ended agreement period', async () => {
    prisma.merchantAgreement.findFirst
      .mockResolvedValueOnce(agreement)
      .mockResolvedValueOnce({ id: 'ended-agreement-id' });

    await expect(service.activate(organizationId, agreementId)).rejects.toThrow(
      new ConflictException('Agreement dates overlap an ended agreement'),
    );
    expect(prisma.merchantAgreement.update).not.toHaveBeenCalled();
  });

  it('ends an active agreement with an effective business date', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      ...agreement,
      status: AgreementStatus.ACTIVE,
    });
    const endedAgreement = {
      ...agreement,
      status: AgreementStatus.ENDED,
      endDate: new Date('2026-08-25T00:00:00.000Z'),
    };
    prisma.merchantAgreement.updateMany.mockResolvedValue({ count: 1 });
    prisma.merchantAgreement.findFirstOrThrow.mockResolvedValue(endedAgreement);

    await service.end(organizationId, agreementId, { endDate: '2026-08-25' });

    expect(prisma.merchantAgreement.updateMany).toHaveBeenCalledWith({
      where: {
        id: agreementId,
        organizationId,
        status: AgreementStatus.ACTIVE,
      },
      data: {
        status: AgreementStatus.ENDED,
        endDate: new Date('2026-08-25T00:00:00.000Z'),
      },
    });
  });
});
