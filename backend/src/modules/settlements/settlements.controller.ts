import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
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
import { CreateSettlementDto } from './dto/create-settlement.dto';
import { ListSettlementsQueryDto } from './dto/list-settlements-query.dto';
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
}
