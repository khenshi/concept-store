import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import {
  SettlementPageResponseDto,
  SettlementResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { MerchantAccountEntryDto } from './dto/merchant-account-entry.dto';
import { SettlementsService } from './settlements.service';
import type {
  SettlementPageRecord,
  SettlementViewRecord,
} from './settlements.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('merchant finance')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'The role cannot manage settlements' })
@ApiNotFoundResponse({ description: 'Settlement or merchant was not found' })
@Controller('organizations/:organizationId/settlements')
export class SettlementsController {
  constructor(private readonly settlementsService: SettlementsService) {}

  @Get('payables')
  @ApiOperation({ summary: 'List live accrued merchant payables' })
  findLivePayables(
    @CurrentOrganization() organization: OrganizationContext,
    @Query('merchantId') merchantId?: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.settlementsService.findLivePayables(
      organization.organizationId,
      merchantId,
      branchId,
    );
  }

  @Post('payables/:merchantId/close')
  @ApiOperation({
    summary: 'Close the current live payable into a draft snapshot',
  })
  closeLivePayable(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
  ) {
    return this.settlementsService.closeLivePayable(
      organization.organizationId,
      merchantId,
      organization.userId,
    );
  }

  @Post('payables/:merchantId/entries')
  @ApiOperation({ summary: 'Record an adjustment or merchant payment' })
  addAccountEntry(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Body() dto: MerchantAccountEntryDto,
  ) {
    return this.settlementsService.addAccountEntry(
      organization.organizationId,
      merchantId,
      organization.userId,
      dto,
    );
  }

  @Delete('payables/:merchantId/entries/:entryId')
  @ApiOperation({ summary: 'Remove an unsettled merchant account entry' })
  removeAccountEntry(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('merchantId', new ParseUUIDPipe({ version: '4' }))
    merchantId: string,
    @Param('entryId', new ParseUUIDPipe({ version: '4' })) entryId: string,
  ) {
    return this.settlementsService.removeAccountEntry(
      organization.organizationId,
      merchantId,
      entryId,
      organization.userId,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List organization merchant settlements' })
  @ApiOkResponse({ type: SettlementPageResponseDto })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListSettlementsQueryDto,
  ): Promise<SettlementPageRecord> {
    return this.settlementsService.findAll(organization.organizationId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get filtered settlement summary metrics' })
  summary(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListSettlementsQueryDto,
  ) {
    return this.settlementsService.summary(organization.organizationId, query);
  }

  @Get(':settlementId')
  @ApiOperation({ summary: 'Get a merchant settlement and its sources' })
  @ApiOkResponse({ type: SettlementResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.findOne(
      organization.organizationId,
      settlementId,
    );
  }

  @Post(':settlementId/approve')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Approve and lock a draft settlement' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiForbiddenResponse({
    description: 'Only an owner can approve settlements',
  })
  @ApiConflictResponse({ description: 'The settlement cannot be approved' })
  approve(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.approve(
      organization.organizationId,
      settlementId,
      organization.userId,
    );
  }

  @Post(':settlementId/payout')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Record an approved settlement payout' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiBadRequestResponse({
    description: 'Payout details or settlement amount are invalid',
  })
  @ApiForbiddenResponse({
    description: 'Only an owner can record settlement payouts',
  })
  @ApiConflictResponse({
    description: 'The settlement is not approved or changed concurrently',
  })
  recordPayout(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Body() dto: RecordPayoutDto,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.recordPayout(
      organization.organizationId,
      settlementId,
      organization.userId,
      dto,
    );
  }
}
