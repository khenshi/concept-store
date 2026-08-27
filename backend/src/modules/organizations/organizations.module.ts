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

@Module({
  imports: [AuthModule],
  controllers: [
    OrganizationsController,
    OrganizationMembershipsController,
    BranchesController,
    OrganizationInvitationsController,
    InvitationAcceptanceController,
  ],
  providers: [
    OrganizationsService,
    OrganizationMembershipsService,
    BranchesService,
    OrganizationAccessGuard,
    OrganizationInvitationsService,
  ],
  exports: [OrganizationAccessGuard],
})
export class OrganizationsModule {}
