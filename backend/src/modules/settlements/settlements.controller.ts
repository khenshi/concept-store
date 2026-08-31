import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  OrganizationRole,
  SettlementGenerationType,
} from '../../generated/prisma/client';
import {
  SettlementPageResponseDto,
  SettlementResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateOffCycleSettlementDto } from './dto/create-off-cycle-settlement.dto';
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
import { RecordPayoutDto } from './dto/record-payout.dto';
import { SettlementAdjustmentDto } from './dto/settlement-adjustment.dto';
import { SettlementsService } from './settlements.service';
import { SettlementSchedulerService } from './settlement-scheduler.service';
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
  constructor(
    private readonly settlementsService: SettlementsService,
    private readonly settlementScheduler: SettlementSchedulerService,
  ) {}

  @Post('generate-missing')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOperation({
    summary: 'Run settlement generation catch-up for due periods',
  })
  generateMissing(@CurrentOrganization() organization: OrganizationContext) {
    return this.settlementScheduler.generateDue(organization.organizationId);
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

  @Post()
  @ApiOperation({ summary: 'Generate a merchant settlement draft' })
  @ApiCreatedResponse({ type: SettlementResponseDto })
  @ApiBadRequestResponse({ description: 'Settlement period is invalid' })
  @ApiConflictResponse({
    description: 'Agreement coverage, overlap, or concurrent finance conflict',
  })
  generate(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateSettlementDto,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.generateDraft(
      organization.organizationId,
      dto.merchantId,
      organization.userId,
      dto.periodStart,
      dto.periodEnd,
    );
  }

  @Post('off-cycle')
  @ApiOperation({
    summary: 'Generate an exceptional off-cycle settlement draft',
  })
  @ApiCreatedResponse({ type: SettlementResponseDto })
  generateOffCycle(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateOffCycleSettlementDto,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.generateDraft(
      organization.organizationId,
      dto.merchantId,
      organization.userId,
      dto.periodStart,
      dto.periodEnd,
      {
        generationType: SettlementGenerationType.OFF_CYCLE,
        generationReason: dto.reason,
        excludeFixedRent: true,
      },
    );
  }

  @Post(':settlementId/recalculate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recalculate a draft settlement' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not a draft' })
  recalculate(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.recalculateDraft(
      organization.organizationId,
      settlementId,
      organization.userId,
    );
  }

  @Post(':settlementId/adjustments')
  @ApiOperation({ summary: 'Add a draft settlement adjustment' })
  @ApiCreatedResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not a draft' })
  addAdjustment(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Body() dto: SettlementAdjustmentDto,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.addAdjustment(
      organization.organizationId,
      settlementId,
      organization.userId,
      dto,
    );
  }

  @Post(':settlementId/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark a draft settlement as reviewed' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not a draft' })
  review(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.review(
      organization.organizationId,
      settlementId,
      organization.userId,
    );
  }

  @Post(':settlementId/return-to-draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Return a reviewed settlement to draft' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not reviewed' })
  returnToDraft(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.returnToDraft(
      organization.organizationId,
      settlementId,
      organization.userId,
    );
  }

  @Post(':settlementId/approve')
  @HttpCode(HttpStatus.OK)
  @OrganizationRoles(OrganizationRole.OWNER)
  @ApiOperation({ summary: 'Approve a reviewed settlement' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiForbiddenResponse({
    description: 'Only an owner can approve settlements',
  })
  @ApiConflictResponse({ description: 'The settlement is not reviewed' })
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

  @Patch(':settlementId/adjustments/:adjustmentId')
  @ApiOperation({ summary: 'Edit a draft settlement adjustment' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not a draft' })
  updateAdjustment(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Param('adjustmentId', new ParseUUIDPipe({ version: '4' }))
    adjustmentId: string,
    @Body() dto: SettlementAdjustmentDto,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.updateAdjustment(
      organization.organizationId,
      settlementId,
      adjustmentId,
      organization.userId,
      dto,
    );
  }

  @Delete(':settlementId/adjustments/:adjustmentId')
  @ApiOperation({ summary: 'Remove a draft settlement adjustment' })
  @ApiOkResponse({ type: SettlementResponseDto })
  @ApiConflictResponse({ description: 'The settlement is not a draft' })
  removeAdjustment(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('settlementId', new ParseUUIDPipe({ version: '4' }))
    settlementId: string,
    @Param('adjustmentId', new ParseUUIDPipe({ version: '4' }))
    adjustmentId: string,
  ): Promise<SettlementViewRecord> {
    return this.settlementsService.removeAdjustment(
      organization.organizationId,
      settlementId,
      adjustmentId,
      organization.userId,
    );
  }
}
