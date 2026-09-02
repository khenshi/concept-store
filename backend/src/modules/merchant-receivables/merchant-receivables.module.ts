import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MerchantReceivablesController } from './merchant-receivables.controller';
import { MerchantReceivablesService } from './merchant-receivables.service';

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [MerchantReceivablesController],
  providers: [MerchantReceivablesService],
  exports: [MerchantReceivablesService],
})
export class MerchantReceivablesModule {}
