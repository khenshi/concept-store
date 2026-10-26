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
import {
  BranchIdentityResponseDto,
  ReportPeriodResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  ReportBranchesQueryDto,
  ReportPeriodQueryDto,
  DailyReportQueryDto,
  SalesRankingQueryDto,
  SalesReportQueryDto,
  TransactionsQueryDto,
} from './dto/sales-report-query.dto';
import { ReportsService } from './reports.service';
import {
  MerchantSalesAnalyticsResponseDto,
  MerchantDailyReportPageResponseDto,
  StaffDailyReportPageResponseDto,
  MerchantSalesRankingPageResponseDto,
  StaffHourlyTrendDto,
  StaffSalesRankingPageResponseDto,
  StaffTopMerchantDto,
  StaffSalesAnalyticsResponseDto,
} from './sales-analytics.types';
import {
  MerchantSalesReportResponseDto,
  StaffSalesReportResponseDto,
  MerchantTransactionsPageResponseDto,
  StaffTransactionsPageResponseDto,
  MerchantSaleTransactionResponseDto,
  MerchantRefundTransactionResponseDto,
  StaffSaleTransactionResponseDto,
  StaffRefundTransactionResponseDto,
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
@ApiExtraModels(
  StaffSalesReportResponseDto,
  MerchantSalesReportResponseDto,
  StaffDailyReportPageResponseDto,
  MerchantDailyReportPageResponseDto,
  StaffSalesAnalyticsResponseDto,
  MerchantSalesAnalyticsResponseDto,
  StaffTopMerchantDto,
  StaffHourlyTrendDto,
  StaffSalesRankingPageResponseDto,
  MerchantSalesRankingPageResponseDto,
  StaffTransactionsPageResponseDto,
  MerchantTransactionsPageResponseDto,
  StaffSaleTransactionResponseDto,
  StaffRefundTransactionResponseDto,
  MerchantSaleTransactionResponseDto,
  MerchantRefundTransactionResponseDto,
)
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Cashiers cannot access Reports' })
@ApiNotFoundResponse({
  description: 'Organization or accessible branch not found',
})
@ApiBadRequestResponse({
  description:
    'Invalid UUID, missing/invalid UTC range, dates outside supported Manila dates 1900-01-01 through 9999-12-30, conflicting mode or unknown fields',
})
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('branches/:branchId/reports/sales/period')
  @ApiOperation({
    summary:
      'Resolve explicit ALL_TIME within current authorized scope; freeze returned bounds for every tab; null from means no activity',
  })
  @ApiOkResponse({ type: ReportPeriodResponseDto })
  period(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: ReportPeriodQueryDto,
  ) {
    return this.reports.period(context, branchId.toLowerCase(), query);
  }

  @Get('branches/:branchId/reports/sales/daily')
  @ApiOperation({
    summary:
      'Read a server-paginated zero-filled daily table for explicit bounds; ascending Manila dates, including partially intersected dates',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffDailyReportPageResponseDto) },
        { $ref: getSchemaPath(MerchantDailyReportPageResponseDto) },
      ],
      discriminator: {
        propertyName: 'scope',
        mapping: {
          STAFF: getSchemaPath(StaffDailyReportPageResponseDto),
          MERCHANT: getSchemaPath(MerchantDailyReportPageResponseDto),
        },
      },
    },
  })
  daily(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: DailyReportQueryDto,
  ) {
    return this.reports.daily(context, branchId.toLowerCase(), query);
  }

  @Get('branches/:branchId/reports/sales/analytics')
  @ApiOperation({
    summary:
      'Read one authorized snapshot of summary, Manila trends and top fifteen saved products and top ten saved merchants',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffSalesAnalyticsResponseDto) },
        { $ref: getSchemaPath(MerchantSalesAnalyticsResponseDto) },
      ],
      discriminator: {
        propertyName: 'scope',
        mapping: {
          STAFF: getSchemaPath(StaffSalesAnalyticsResponseDto),
          MERCHANT: getSchemaPath(MerchantSalesAnalyticsResponseDto),
        },
      },
    },
  })
  analytics(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: SalesReportQueryDto,
  ) {
    return this.reports.analytics(context, branchId.toLowerCase(), query);
  }

  @Get('branches/:branchId/reports/sales/rankings')
  @ApiOperation({
    summary:
      'Read one authorized page of saved product rankings for the applied period',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffSalesRankingPageResponseDto) },
        { $ref: getSchemaPath(MerchantSalesRankingPageResponseDto) },
      ],
      discriminator: {
        propertyName: 'scope',
        mapping: {
          STAFF: getSchemaPath(StaffSalesRankingPageResponseDto),
          MERCHANT: getSchemaPath(MerchantSalesRankingPageResponseDto),
        },
      },
    },
  })
  rankings(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: SalesRankingQueryDto,
  ) {
    return this.reports.rankings(context, branchId.toLowerCase(), query);
  }

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

  @Get('branches/:branchId/reports/transactions')
  @ApiOperation({
    summary:
      'Read a paginated, read-only cross-reference of completed sales and refunds',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(StaffTransactionsPageResponseDto) },
        { $ref: getSchemaPath(MerchantTransactionsPageResponseDto) },
      ],
      discriminator: {
        propertyName: 'scope',
        mapping: {
          STAFF: getSchemaPath(StaffTransactionsPageResponseDto),
          MERCHANT: getSchemaPath(MerchantTransactionsPageResponseDto),
        },
      },
    },
  })
  transactions(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: TransactionsQueryDto,
  ) {
    return this.reports.transactions(context, branchId.toLowerCase(), query);
  }
}
