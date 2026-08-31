import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [SettlementsController],
  providers: [SettlementsService, SettlementSchedulerService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
