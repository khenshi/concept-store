import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { ReportFiltersDto } from './dto/report-filters.dto';
import { ReportPageFiltersDto } from './dto/report-page-filters.dto';
import { ReportsService } from './reports.service';
import type { ReportsOverviewRecord } from './reports.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('reports')
@ApiBearerAuth('access-token')
@Controller('organizations/:organizationId/reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get owner and manager reporting overview' })
  @ApiOkResponse({
    description: 'Tenant-scoped operational and finance metrics',
  })
  overview(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() filters: ReportFiltersDto,
  ): Promise<ReportsOverviewRecord> {
    return this.reportsService.overview(organization.organizationId, filters);
  }

  @Get('merchant-dashboard')
  @OrganizationRoles(OrganizationRole.MERCHANT)
  @ApiOperation({ summary: 'Get the signed-in merchant reporting dashboard' })
  merchantDashboard(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() filters: ReportFiltersDto,
  ) {
    return this.reportsService.merchantDashboard(
      organization.organizationId,
      organization.userId,
      filters,
    );
  }

  @Get('sales')
  @ApiOperation({ summary: 'List merchant-attributed sales report rows' })
  sales(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() filters: ReportPageFiltersDto,
  ) {
    return this.reportsService.sales(organization.organizationId, filters);
  }

  @Get('inventory')
  @ApiOperation({ summary: 'List current inventory report rows' })
  inventory(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() filters: ReportPageFiltersDto,
  ) {
    return this.reportsService.inventory(organization.organizationId, filters);
  }

  @Get('merchants')
  @ApiOperation({ summary: 'List merchant performance report rows' })
  merchants(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() filters: ReportPageFiltersDto,
  ) {
    return this.reportsService.merchants(organization.organizationId, filters);
  }
}
