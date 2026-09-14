import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
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

@Module({
  imports: [AuthModule],
  controllers: [
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
    PosCatalogService,
    CheckoutService,
    SalesReadService,
  ],
  exports: [OrganizationAccessGuard],
})
export class OrganizationsModule {}
