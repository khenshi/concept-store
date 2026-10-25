import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private draining = false;

  constructor(private readonly prisma: PrismaService) {}

  async isReady(): Promise<boolean> {
    if (this.draining) return false;
    try {
      const ready = await this.prisma.probeReadiness();
      return ready && !this.draining;
    } catch {
      return false;
    }
  }

  onModuleDestroy(): void {
    this.draining = true;
  }
}
