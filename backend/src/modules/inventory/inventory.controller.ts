import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
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
  InventoryMovementPageResponseDto,
  InventoryOperationResponseDto,
  InventoryPageResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { ListInventoryMovementsQueryDto } from './dto/list-inventory-movements-query.dto';
import { ListInventoryQueryDto } from './dto/list-inventory-query.dto';
import { StockInDto } from './dto/stock-in.dto';
import { InventoryService } from './inventory.service';
import type {
  InventoryMovementPageRecord,
  InventoryOperationRecord,
  InventoryPageRecord,
} from './inventory.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('inventory')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage inventory',
})
@ApiNotFoundResponse({
  description: 'Organization, branch, product, or inventory was not found',
})
@Controller('organizations/:organizationId/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: 'List current branch inventory' })
  @ApiOkResponse({ type: InventoryPageResponseDto })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListInventoryQueryDto,
  ): Promise<InventoryPageRecord> {
    return this.inventoryService.findAll(organization.organizationId, query);
  }

  @Get('movements')
  @ApiOperation({ summary: 'List inventory movement history' })
  @ApiOkResponse({ type: InventoryMovementPageResponseDto })
  findMovements(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListInventoryMovementsQueryDto,
  ): Promise<InventoryMovementPageRecord> {
    return this.inventoryService.findMovements(
      organization.organizationId,
      query,
    );
  }

  @Post('stock-in')
  @ApiOperation({ summary: 'Add received stock to branch inventory' })
  @ApiCreatedResponse({ type: InventoryOperationResponseDto })
  @ApiConflictResponse({
    description:
      'Product is inactive, unavailable at the branch, or changed concurrently',
  })
  stockIn(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: StockInDto,
  ): Promise<InventoryOperationRecord> {
    return this.inventoryService.stockIn(
      organization.organizationId,
      organization.userId,
      dto,
    );
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Apply an explained inventory correction' })
  @ApiCreatedResponse({ type: InventoryOperationResponseDto })
  @ApiConflictResponse({
    description: 'Product is unavailable at the branch or changed concurrently',
  })
  adjust(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: AdjustInventoryDto,
  ): Promise<InventoryOperationRecord> {
    return this.inventoryService.adjust(
      organization.organizationId,
      organization.userId,
      dto,
    );
  }
}
