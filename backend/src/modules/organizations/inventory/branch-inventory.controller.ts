import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
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
import { OrganizationRole } from '../../../generated/prisma/client';
import {
  BranchInventoryResponseDto,
  InventoryMovementResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { ListProductsQueryDto } from '../products/dto/list-products-query.dto';
import { BranchInventoryService } from './branch-inventory.service';
import { CreateBranchInventoryDto } from './dto/create-branch-inventory.dto';
import { InventoryPriceDto } from './dto/inventory-price.dto';
import {
  AdjustInventoryDto,
  ReceiveInventoryDto,
} from './dto/stock-command.dto';
import { InventoryStockService } from './inventory-stock.service';
import type {
  BranchInventoryRecord,
  InventoryMovementRecord,
} from './inventory.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('branch-inventory')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage inventory',
})
@ApiBadRequestResponse({
  description: 'Invalid identifier, query, price, or stock command',
})
@ApiNotFoundResponse({
  description:
    'Organization, branch, product, merchant, or inventory was not found',
})
@ApiConflictResponse({
  description:
    'Duplicate placement, inactive lifecycle, stock bounds, or reused request ID conflict',
})
@Controller('organizations/:organizationId/branches/:branchId/inventory')
export class BranchInventoryController {
  constructor(
    private readonly inventoryService: BranchInventoryService,
    private readonly stockService: InventoryStockService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Place an active product in this branch with zero stock',
  })
  @ApiCreatedResponse({ type: BranchInventoryResponseDto })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Body() dto: CreateBranchInventoryDto,
  ): Promise<BranchInventoryRecord> {
    return this.inventoryService.create(
      organization.organizationId,
      branchId,
      dto,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List and filter inventory in this branch' })
  @ApiOkResponse({ type: BranchInventoryResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: ListProductsQueryDto,
  ): Promise<BranchInventoryRecord[]> {
    return this.inventoryService.findAll(
      organization.organizationId,
      branchId,
      query,
    );
  }

  @Get(':inventoryId')
  @ApiOperation({ summary: 'Get inventory in this branch' })
  @ApiOkResponse({ type: BranchInventoryResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('inventoryId', new ParseUUIDPipe({ version: '4' }))
    inventoryId: string,
  ): Promise<BranchInventoryRecord> {
    return this.inventoryService.findOne(
      organization.organizationId,
      branchId,
      inventoryId,
    );
  }

  @Patch(':inventoryId/price')
  @ApiOperation({
    summary: 'Edit this branch selling price without changing quantity',
  })
  @ApiOkResponse({ type: BranchInventoryResponseDto })
  updatePrice(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('inventoryId', new ParseUUIDPipe({ version: '4' }))
    inventoryId: string,
    @Body() dto: InventoryPriceDto,
  ): Promise<BranchInventoryRecord> {
    return this.inventoryService.updatePrice(
      organization.organizationId,
      branchId,
      inventoryId,
      dto,
    );
  }

  @Post(':inventoryId/receipts')
  @ApiOperation({
    summary: 'Receive stock atomically; retries return the original movement',
  })
  @ApiCreatedResponse({ type: InventoryMovementResponseDto })
  receive(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('inventoryId', new ParseUUIDPipe({ version: '4' }))
    inventoryId: string,
    @Body() dto: ReceiveInventoryDto,
  ): Promise<InventoryMovementRecord> {
    return this.stockService.receive(
      organization.organizationId,
      branchId,
      inventoryId,
      organization.userId,
      dto,
    );
  }

  @Post(':inventoryId/adjustments')
  @ApiOperation({
    summary: 'Apply a signed corrective stock delta with retry protection',
  })
  @ApiCreatedResponse({ type: InventoryMovementResponseDto })
  adjust(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('inventoryId', new ParseUUIDPipe({ version: '4' }))
    inventoryId: string,
    @Body() dto: AdjustInventoryDto,
  ): Promise<InventoryMovementRecord> {
    return this.stockService.adjust(
      organization.organizationId,
      branchId,
      inventoryId,
      organization.userId,
      dto,
    );
  }

  @Get(':inventoryId/movements')
  @ApiOperation({ summary: 'Get immutable stock history newest first' })
  @ApiOkResponse({ type: InventoryMovementResponseDto, isArray: true })
  findMovements(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('inventoryId', new ParseUUIDPipe({ version: '4' }))
    inventoryId: string,
  ): Promise<InventoryMovementRecord[]> {
    return this.inventoryService.findMovements(
      organization.organizationId,
      branchId,
      inventoryId,
    );
  }
}
