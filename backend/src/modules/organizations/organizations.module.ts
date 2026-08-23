import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrganizationAccessGuard } from './authorization/organization-access.guard';
import { OrganizationMembershipsController } from './memberships/organization-memberships.controller';
import { OrganizationMembershipsService } from './memberships/organization-memberships.service';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrganizationMembershipsController],
  providers: [
    OrganizationsService,
    OrganizationMembershipsService,
    OrganizationAccessGuard,
  ],
  exports: [OrganizationAccessGuard],
})
export class OrganizationsModule {}
