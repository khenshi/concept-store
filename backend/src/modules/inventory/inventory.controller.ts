import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import { InventoryOperationResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { StockInDto } from './dto/stock-in.dto';
import { InventoryService } from './inventory.service';
import type { InventoryOperationRecord } from './inventory.types';

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
