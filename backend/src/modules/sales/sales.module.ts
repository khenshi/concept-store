import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MerchantFinanceAccrualModule } from '../merchant-finance-accrual/merchant-finance-accrual.module';
import { PosProductsController } from './pos-products.controller';
import { PosProductsService } from './pos-products.service';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [AuthModule, OrganizationsModule, MerchantFinanceAccrualModule],
  controllers: [PosProductsController, SalesController],
  providers: [PosProductsService, SalesService],
})
export class SalesModule {}
