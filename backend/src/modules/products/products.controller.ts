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
import { ProductResponseDto } from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsQueryDto } from './dto/list-products-query.dto';
import { LookupProductQueryDto } from './dto/lookup-product-query.dto';
import { UpdateProductStatusDto } from './dto/update-product-status.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import type { ProductRecord } from './product.types';
import { ProductsService } from './products.service';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.OWNER, OrganizationRole.MANAGER)
@ApiTags('products')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({
  description: 'The organization role cannot access product management',
})
@ApiNotFoundResponse({ description: 'Organization or product was not found' })
@Controller('organizations/:organizationId/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a merchant-owned product' })
  @ApiCreatedResponse({ type: ProductResponseDto })
  @ApiConflictResponse({ description: 'The SKU or barcode already exists' })
  create(
    @CurrentOrganization() organization: OrganizationContext,
    @Body() dto: CreateProductDto,
  ): Promise<ProductRecord> {
    return this.productsService.create(organization.organizationId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List and filter products in the organization' })
  @ApiOkResponse({ type: ProductResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: ListProductsQueryDto,
  ): Promise<ProductRecord[]> {
    return this.productsService.findAll(organization.organizationId, query);
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Find a product by exact SKU or barcode' })
  @ApiOkResponse({ type: ProductResponseDto })
  findByCode(
    @CurrentOrganization() organization: OrganizationContext,
    @Query() query: LookupProductQueryDto,
  ): Promise<ProductRecord> {
    return this.productsService.findByCode(
      organization.organizationId,
      query.code,
    );
  }

  @Get(':productId')
  @ApiOperation({ summary: 'Get a product in the organization' })
  @ApiOkResponse({ type: ProductResponseDto })
  findOne(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
  ): Promise<ProductRecord> {
    return this.productsService.findOne(organization.organizationId, productId);
  }

  @Patch(':productId')
  @ApiOperation({ summary: 'Update a product profile' })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiConflictResponse({ description: 'The SKU or barcode already exists' })
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
  @ApiOperation({ summary: 'Change a product lifecycle status' })
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
}
