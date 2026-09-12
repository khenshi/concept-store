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
  ProductInventoryResponseDto,
  ProductResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { ProductsService } from './products.service';
import type { ProductInventoryRecord, ProductRecord } from './products.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('products')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot manage products',
})
@ApiNotFoundResponse({
  description: 'Organization, merchant, or product was not found',
})
@ApiBadRequestResponse({
  description: 'Invalid identifier, query, or request body',
})
@Controller('organizations/:organizationId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an active product owned by an active merchant',
  })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({
    description: 'Inactive merchant or duplicate SKU/barcode',
  })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateProductDto,
  ): Promise<ProductRecord> {
    return this.productsService.create(organization.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List, search, and filter organization products' })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductRecord[]> {
    return this.productsService.findAll(organization.organizationId, query);
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get a product profile' })
  @ApiOkResponse({ type: ProductResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<ProductRecord> {
    return this.productsService.findOne(organization.organizationId, productId);
  }

  @Patch(':productId')
  @ApiOperation({
    summary: 'Edit product identity without changing merchant or status',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiConflictResponse({
    description: 'Duplicate organization-scoped SKU/barcode',
  })
  update(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateProductDto,
  ): Promise<ProductRecord> {
    return this.productsService.update(
      organization.organizationId,
      productId,
      dto,
    );
  }

  @Patch(':productId/status')
  @ApiOperation({
    summary: 'Change product lifecycle status without altering inventory',
  })
  @ApiOkResponse({ type: ProductResponseDto })
  updateStatus(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() dto: UpdateProductStatusDto,
  ): Promise<ProductRecord> {
    return this.productsService.updateStatus(
      organization.organizationId,
      productId,
      dto,
    );
  }

  @Get(':productId/inventory')
  @ApiOperation({
    summary:
      'List independently priced branch inventory placements for a product',
  })
  @ApiOkResponse({ type: ProductInventoryResponseDto, isArray: true })
  findInventory(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<ProductInventoryRecord[]> {
    return this.productsService.findInventory(
      organization.organizationId,
      productId,
    );
  }
}
