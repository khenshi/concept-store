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
  CompletedSaleResponseDto,
  MerchantSaleResponseDto,
  SalesPageResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import { ListSalesQueryDto } from './dto/list-sales-query.dto';
import { SalesReadService } from './sales-read.service';

export class SalesIdentityQueryDto {}

@Controller('organizations/:organizationId/branches/:branchId/sales')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
  OrganizationRole.MERCHANT,
)
@ApiTags('sales')
@ApiBearerAuth('access-token')
@ApiExtraModels(CompletedSaleResponseDto, MerchantSaleResponseDto)
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiNotFoundResponse({
  description: 'Organization, accessible branch or matching sale not found',
})
@ApiBadRequestResponse({
  description:
    'Invalid identifier, UTC range, pagination or unknown query fields',
})
export class SalesReadController {
  constructor(private readonly sales: SalesReadService) {}
  @Get()
  @ApiOperation({
    summary:
      'List permitted branch sales; merchants receive own items/subtotal only',
  })
  @ApiOkResponse({ type: SalesPageResponseDto })
  findAll(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: ListSalesQueryDto,
  ) {
    return this.sales.findAll(context, branchId, query);
  }

  @Get(':saleId')
  @ApiOperation({
    summary:
      'Read permitted sale snapshots; merchants never receive the full receipt',
  })
  @ApiOkResponse({
    schema: {
      oneOf: [
        { $ref: getSchemaPath(CompletedSaleResponseDto) },
        { $ref: getSchemaPath(MerchantSaleResponseDto) },
      ],
    },
  })
  findOne(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Query() _query: SalesIdentityQueryDto,
  ) {
    void _query;
    return this.sales.findOne(context, branchId, saleId);
  }
}

@Controller('organizations/:organizationId/sales/branches')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(OrganizationRole.MERCHANT)
@ApiTags('sales')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({
  description: 'Only merchants use own-sale branch lookup',
})
@ApiNotFoundResponse({ description: 'Organization not found' })
@ApiBadRequestResponse({
  description: 'Invalid identifier or unknown query fields',
})
export class MerchantSalesBranchesController {
  constructor(private readonly sales: SalesReadService) {}
  @Get()
  @ApiOperation({
    summary:
      'List branch identities with historical sales of the currently linked merchant; no addresses/counts',
  })
  @ApiOkResponse({ type: BranchIdentityResponseDto, isArray: true })
  findAll(
    @CurrentOrganization() context: OrganizationContext,
    @Query() _query: SalesIdentityQueryDto,
  ) {
    void _query;
    return this.sales.sellingBranches(context);
  }
}
