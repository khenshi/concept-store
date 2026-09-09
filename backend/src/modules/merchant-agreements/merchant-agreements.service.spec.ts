import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AgreementPrepaymentKind,
  AgreementPrepaymentTransactionType,
  AgreementStatus,
  PaymentMethod,
  Prisma,
  SettlementSchedule,
} from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MerchantAgreementsService } from './merchant-agreements.service';

describe('MerchantAgreementsService approval workflow', () => {
  const prisma = {
    merchant: { findFirst: jest.fn() },
    merchantAgreement: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    space: { findMany: jest.fn() },
    merchantBranch: { count: jest.fn() },
    agreementPrepayment: { findFirst: jest.fn() },
    agreementPrepaymentTransaction: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  let service: MerchantAgreementsService;

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation(
      (operation: (tx: typeof prisma) => unknown) => operation(prisma),
    );
    const module = await Test.createTestingModule({
      providers: [
        MerchantAgreementsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(MerchantAgreementsService);
  });

  it('requires a commercial term before creating a draft', async () => {
    await expect(
      service.create('organization', 'merchant', {
        activationAt: '2026-09-09',
        durationMonths: 12,
        spaceIds: ['00000000-0000-4000-8000-000000000001'],
        settlementSchedule: SettlementSchedule.MONTHLY,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'An agreement requires fixed rent, commission, or both',
      ),
    );
  });

  it('requires approval before activation', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      id: 'agreement',
      organizationId: 'organization',
      merchantId: 'merchant',
      status: AgreementStatus.PENDING,
      prepayments: [],
      spaceReservations: [],
    });
    await expect(service.activate('organization', 'agreement')).rejects.toThrow(
      new ConflictException('Only approved agreements can be activated'),
    );
  });

  it('tenant-scopes organization agreement lists', async () => {
    prisma.merchantAgreement.findMany.mockResolvedValue([]);
    await expect(
      service.findAllForOrganization('organization'),
    ).resolves.toEqual([]);
    expect(prisma.merchantAgreement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'organization' } }),
    );
  });

  it('enforces the five-draft limit', async () => {
    prisma.merchant.findFirst.mockResolvedValue({ id: 'merchant' });
    prisma.merchantAgreement.findMany.mockResolvedValue(
      [1, 2, 3, 4, 5].map((draftSlot) => ({ draftSlot })),
    );
    await expect(
      service.create('organization', 'merchant', {
        activationAt: '2026-09-09',
        durationMonths: 12,
        spaceIds: ['00000000-0000-4000-8000-000000000001'],
        fixedRentAmount: '2500.00',
        rentDueWeek: 'FIRST',
        rentDueWeekday: 'MONDAY',
        settlementSchedule: SettlementSchedule.MONTHLY,
      }),
    ).rejects.toThrow(
      new ConflictException('The merchant already has five drafts'),
    );
  });

  it('blocks approval while a prerequisite is only partly collected', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      id: 'agreement',
      organizationId: 'organization',
      merchantId: 'merchant',
      status: AgreementStatus.PENDING,
      prepayments: [
        {
          kind: AgreementPrepaymentKind.SECURITY_DEPOSIT,
          requiredAmount: new Prisma.Decimal('5000.00'),
          transactions: [
            {
              type: AgreementPrepaymentTransactionType.COLLECTION,
              amount: new Prisma.Decimal('1000.00'),
            },
          ],
        },
      ],
      spaceReservations: [],
    });
    await expect(
      service.approve('organization', 'agreement', 'owner'),
    ).rejects.toThrow(
      'SECURITY_DEPOSIT must be fully collected before approval',
    );
  });

  it('rejects returning a non-pending agreement to draft', async () => {
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      id: 'agreement',
      status: AgreementStatus.APPROVED,
    });
    await expect(
      service.withdraw('organization', 'agreement', 'manager', 'Rework'),
    ).rejects.toThrow('Only pending agreements can return to draft');
  });

  it('blocks activation when the merchant already has an active agreement', async () => {
    prisma.merchantAgreement.findFirst
      .mockResolvedValueOnce({
        id: 'agreement',
        organizationId: 'organization',
        merchantId: 'merchant',
        status: AgreementStatus.APPROVED,
        prepayments: [],
        spaceReservations: [],
      })
      .mockResolvedValueOnce({ id: 'active-agreement' });
    await expect(service.activate('organization', 'agreement')).rejects.toThrow(
      'The merchant already has an active agreement',
    );
  });

  it('returns the original ledger row for an idempotent collection retry', async () => {
    const prior = { id: 'transaction' };
    prisma.agreementPrepaymentTransaction.findFirst.mockResolvedValue(prior);
    await expect(
      service.collect(
        'organization',
        'agreement',
        AgreementPrepaymentKind.SECURITY_DEPOSIT,
        'manager',
        {
          amount: '1000.00',
          method: PaymentMethod.CASH,
          occurredAt: '2026-09-09T10:00:00+08:00',
          requestId: '00000000-0000-4000-8000-000000000002',
        },
      ),
    ).resolves.toBe(prior);
    expect(prisma.merchantAgreement.findFirst).not.toHaveBeenCalled();
  });

  it('rejects collection above the remaining required balance', async () => {
    prisma.agreementPrepaymentTransaction.findFirst.mockResolvedValue(null);
    prisma.merchantAgreement.findFirst.mockResolvedValue({
      id: 'agreement',
      status: AgreementStatus.PENDING,
    });
    prisma.agreementPrepayment.findFirst.mockResolvedValue({
      requiredAmount: new Prisma.Decimal('5000.00'),
      transactions: [
        {
          type: AgreementPrepaymentTransactionType.COLLECTION,
          amount: new Prisma.Decimal('4500.00'),
        },
      ],
    });
    await expect(
      service.collect(
        'organization',
        'agreement',
        AgreementPrepaymentKind.SECURITY_DEPOSIT,
        'manager',
        {
          amount: '1000.00',
          method: PaymentMethod.CASH,
          occurredAt: '2026-09-09T10:00:00+08:00',
          requestId: '00000000-0000-4000-8000-000000000003',
        },
      ),
    ).rejects.toThrow('Collection exceeds the required amount');
  });
});
