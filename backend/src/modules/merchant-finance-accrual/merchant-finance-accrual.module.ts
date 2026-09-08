import { Module } from '@nestjs/common';
import { MerchantFinanceAccrualService } from './merchant-finance-accrual.service';

@Module({
  providers: [MerchantFinanceAccrualService],
  exports: [MerchantFinanceAccrualService],
})
export class MerchantFinanceAccrualModule {}
