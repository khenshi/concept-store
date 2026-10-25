import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  const prisma = { probeReadiness: jest.fn() };
  let service: HealthService;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new HealthService(prisma as unknown as PrismaService);
  });

  it('reports dependency success and failure', async () => {
    prisma.probeReadiness
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    await expect(service.isReady()).resolves.toBe(true);
    await expect(service.isReady()).resolves.toBe(false);
  });

  it('conceals unexpected dependency errors', async () => {
    prisma.probeReadiness.mockRejectedValue(
      new Error('private connection URL'),
    );
    await expect(service.isReady()).resolves.toBe(false);
  });

  it('rejects readiness when termination starts during a probe', async () => {
    let finish!: (ready: boolean) => void;
    prisma.probeReadiness.mockImplementationOnce(
      () => new Promise<boolean>((resolve) => (finish = resolve)),
    );
    const readiness = service.isReady();
    service.onModuleDestroy();
    finish(true);
    await expect(readiness).resolves.toBe(false);
    await expect(service.isReady()).resolves.toBe(false);
    expect(prisma.probeReadiness).toHaveBeenCalledTimes(1);
  });
});
