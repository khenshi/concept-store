import { Module } from '@nestjs/common';
import { MerchantFinanceAccrualService } from './merchant-finance-accrual.service';
import { MerchantFinanceAccrualReconciliationService } from './merchant-finance-accrual-reconciliation.service';

@Module({
  providers: [
    MerchantFinanceAccrualService,
    MerchantFinanceAccrualReconciliationService,
  ],
  exports: [
    MerchantFinanceAccrualService,
    MerchantFinanceAccrualReconciliationService,
  ],
})
export class MerchantFinanceAccrualModule {}
