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
}
