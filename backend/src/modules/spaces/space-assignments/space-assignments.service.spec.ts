import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SpaceAssignmentsService } from './space-assignments.service';

describe('SpaceAssignmentsService legacy controls', () => {
  const prisma = {
    spaceAssignment: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
    },
  };
  let service: SpaceAssignmentsService;
  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        SpaceAssignmentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(SpaceAssignmentsService);
  });

  it('prevents directly ending agreement-owned assignments', async () => {
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      id: 'assignment',
      agreementId: 'agreement',
      startDate: new Date('2026-09-01'),
      endDate: null,
    });
    await expect(
      service.end('organization', 'assignment', { endDate: '2026-09-09' }),
    ).rejects.toThrow(
      new ConflictException(
        'Agreement assignments can only be ended through the agreement lifecycle',
      ),
    );
  });

  it('allows a current legacy assignment to be ended', async () => {
    const ended = {
      id: 'assignment',
      agreementId: null,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-09'),
    };
    prisma.spaceAssignment.findFirst.mockResolvedValue({
      ...ended,
      endDate: null,
    });
    prisma.spaceAssignment.updateMany.mockResolvedValue({ count: 1 });
    prisma.spaceAssignment.findFirstOrThrow.mockResolvedValue(ended);
    await expect(
      service.end('organization', 'assignment', { endDate: '2026-09-09' }),
    ).resolves.toEqual(ended);
  });
});
