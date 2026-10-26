import { SpacesController } from './spaces/spaces.controller';
import { SpacesService } from './spaces/spaces.service';
import { MerchantBranchesController } from './merchant-branches/merchant-branches.controller';
import { MerchantBranchesService } from './merchant-branches/merchant-branches.service';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EmailModule } from '../../infrastructure/email/email.module';
import { OrganizationAccessGuard } from './authorization/organization-access.guard';
import { BranchesController } from './branches/branches.controller';
import { BranchesService } from './branches/branches.service';
import { OrganizationMembershipsController } from './memberships/organization-memberships.controller';
import { OrganizationMembershipsService } from './memberships/organization-memberships.service';
import { InvitationAcceptanceController } from './invitations/invitation-acceptance.controller';
import { OrganizationInvitationsController } from './invitations/organization-invitations.controller';
import { OrganizationInvitationsService } from './invitations/organization-invitations.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { MerchantsController } from './merchants/merchants.controller';
import { MerchantsService } from './merchants/merchants.service';
import { ProductsController } from './products/products.controller';
import { ProductsService } from './products/products.service';
import { BranchInventoryController } from './inventory/branch-inventory.controller';
import { BranchInventoryService } from './inventory/branch-inventory.service';
import { InventoryStockService } from './inventory/inventory-stock.service';
import { InventoryReconciliationService } from './inventory/inventory-reconciliation.service';
import { ResourceAccessGuard } from './authorization/resource-access.guard';
import { PosCatalogController } from './pos/pos-catalog.controller';
import { PosCatalogService } from './pos/pos-catalog.service';
import { CheckoutController } from './sales/checkout.controller';
import { CheckoutService } from './sales/checkout.service';
import {
  SalesReadController,
  MerchantSalesBranchesController,
} from './sales/sales-read.controller';
import { SalesReadService } from './sales/sales-read.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { RefundsController } from './refunds/refunds.controller';
import { RefundsService } from './refunds/refunds.service';
import {
  BranchRefundReadController,
  RefundReadController,
} from './refunds/refund-read.controller';
import { RefundReadService } from './refunds/refund-read.service';
import { OrganizationLifecycleService } from './organization-lifecycle.service';

@Module({
  imports: [AuthModule, EmailModule],
  controllers: [
    SpacesController,
    MerchantBranchesController,
    RefundReadController,
    BranchRefundReadController,
    RefundsController,
    ReportsController,
    OrganizationsController,
    OrganizationMembershipsController,
    BranchesController,
    OrganizationInvitationsController,
    InvitationAcceptanceController,
    MerchantsController,
    ProductsController,
    BranchInventoryController,
    PosCatalogController,
    CheckoutController,
    SalesReadController,
    MerchantSalesBranchesController,
  ],
  providers: [
    SpacesService,
    MerchantBranchesService,
    RefundReadService,
    OrganizationLifecycleService,
    RefundsService,
    ReportsService,
    OrganizationsService,
    OrganizationMembershipsService,
    BranchesService,
    OrganizationAccessGuard,
    ResourceAccessGuard,
    OrganizationInvitationsService,
    MerchantsService,
    ProductsService,
    BranchInventoryService,
    InventoryStockService,
    InventoryReconciliationService,
    PosCatalogService,
    CheckoutService,
    SalesReadService,
  ],
  exports: [OrganizationAccessGuard, OrganizationLifecycleService],
})
export class OrganizationsModule {}
