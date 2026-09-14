import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import { BranchIdentityResponseDto } from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  ReportBranchesQueryDto,
  SalesReportQueryDto,
} from './dto/sales-report-query.dto';
import { ReportsService } from './reports.service';
import {
  MerchantSalesReportResponseDto,
  StaffSalesReportResponseDto,
} from './reports.types';

@Controller('organizations/:organizationId')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.MERCHANT,
)
@ApiTags('reports')
@ApiBearerAuth('access-token')
@ApiExtraModels(StaffSalesReportResponseDto, MerchantSalesReportResponseDto)
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Cashiers cannot access Reports' })
@ApiNotFoundResponse({
  description: 'Organization or accessible branch not found',
})
@ApiBadRequestResponse({
  description:
    'Invalid UUID, missing/invalid UTC range, range over 366 days or unknown fields',
})
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('reports/sales/branches')
  @ApiOperation({
    summary:
      'List identity-only report branches within current staff or own-sales access',
  })
  @ApiOkResponse({ type: BranchIdentityResponseDto, isArray: true })
  branches(
    @CurrentOrganization() context: OrganizationContext,
    @Query() query: ReportBranchesQueryDto,
  ) {
    void query;
    return this.reports.branches(context);
  }

  @Get('branches/:branchId/reports/sales')
  @ApiOperation({
    summary:
      'Summarize gross recorded branch sales; merchants receive own totals only',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffSalesReportResponseDto) },
        { $ref: getSchemaPath(MerchantSalesReportResponseDto) },
      ],
      discriminator: {
        propertyName: 'scope',
        mapping: {
          STAFF: getSchemaPath(StaffSalesReportResponseDto),
          MERCHANT: getSchemaPath(MerchantSalesReportResponseDto),
        },
      },
    },
  })
  sales(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: SalesReportQueryDto,
  ) {
    return this.reports.sales(context, branchId.toLowerCase(), query);
  }
}
