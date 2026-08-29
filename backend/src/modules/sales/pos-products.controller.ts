import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../generated/prisma/client';
import {
  PosProductPageResponseDto,
  PosProductResponseDto,
} from '../../openapi/response.dto';
import { AuthGuard } from '../auth/auth.guard';
import { OrganizationAccessGuard } from '../organizations/authorization/organization-access.guard';
import type { OrganizationContext } from '../organizations/authorization/organization-authorization.types';
import { CurrentOrganization } from '../organizations/authorization/organization-context.decorator';
import { OrganizationRoles } from '../organizations/authorization/organization-roles.decorator';
import { ListPosProductsQueryDto } from './dto/list-pos-products-query.dto';
import { LookupPosProductQueryDto } from './dto/lookup-pos-product-query.dto';
import { PosProductsService } from './pos-products.service';
import type {
  PosProductPageRecord,
  PosProductRecord,
} from './pos-products.types';

@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
)
@ApiTags('pos')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Access token is missing or invalid' })
@ApiForbiddenResponse({ description: 'The organization role cannot use POS' })
@ApiNotFoundResponse({
  description: 'Branch or sellable product was not found',
})
@Controller('organizations/:organizationId/branches/:branchId/pos/products')
export class PosProductsController {
  constructor(private readonly posProductsService: PosProductsService) {}

  @Get()
  @ApiOperation({ summary: 'List active branch products for POS' })
  @ApiOkResponse({ type: PosProductPageResponseDto })
  findAll(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: ListPosProductsQueryDto,
  ): Promise<PosProductPageRecord> {
    return this.posProductsService.findAll(
      organization.organizationId,
      branchId,
      query,
    );
  }

  @Get('lookup')
  @ApiOperation({ summary: 'Find an active branch product by SKU or barcode' })
  @ApiOkResponse({ type: PosProductResponseDto })
  findByCode(
    @CurrentOrganization() organization: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: LookupPosProductQueryDto,
  ): Promise<PosProductRecord> {
    return this.posProductsService.findByCode(
      organization.organizationId,
      branchId,
      query.code,
    );
  }
}
