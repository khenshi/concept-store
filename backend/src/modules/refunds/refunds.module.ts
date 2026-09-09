import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MerchantFinanceAccrualModule } from '../merchant-finance-accrual/merchant-finance-accrual.module';
import { RefundsController } from './refunds.controller';
import { RefundsService } from './refunds.service';

@Module({
  imports: [AuthModule, OrganizationsModule, MerchantFinanceAccrualModule],
  controllers: [RefundsController],
  providers: [RefundsService],
})
export class RefundsModule {}
