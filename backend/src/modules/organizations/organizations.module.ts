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

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationsController,
    OrganizationMembershipsController,
    BranchesController,
    OrganizationInvitationsController,
    InvitationAcceptanceController,
    MerchantsController,
    ProductsController,
    BranchInventoryController,
  ],
  providers: [
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
  ],
  exports: [OrganizationAccessGuard],
})
export class OrganizationsModule {}
