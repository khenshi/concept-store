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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrganizationRole } from '../../../generated/prisma/client';
import {
  PosCatalogPageResponseDto,
  PosCatalogResponseDto,
} from '../../../openapi/response.dto';
import { AuthGuard } from '../../auth/auth.guard';
import { OrganizationAccessGuard } from '../authorization/organization-access.guard';
import { CurrentOrganization } from '../authorization/organization-context.decorator';
import { OrganizationRoles } from '../authorization/organization-roles.decorator';
import type { OrganizationContext } from '../authorization/organization-authorization.types';
import {
  PosCatalogQueryDto,
  PosCodeQueryDto,
} from './dto/pos-catalog-query.dto';
import { PosCatalogService, PosCatalogPage } from './pos-catalog.service';

@Controller('organizations/:organizationId/branches/:branchId/pos/products')
@UseGuards(AuthGuard, OrganizationAccessGuard)
@OrganizationRoles(
  OrganizationRole.OWNER,
  OrganizationRole.MANAGER,
  OrganizationRole.CASHIER,
)
@ApiTags('pos')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
@ApiForbiddenResponse({ description: 'Role cannot access POS' })
@ApiNotFoundResponse({
  description: 'Organization or accessible branch not found',
})
@ApiBadRequestResponse({
  description: 'Invalid identifier or query; unknown fields rejected',
})
export class PosCatalogController {
  constructor(private readonly catalog: PosCatalogService) {}

  @Get()
  @ApiOperation({
    summary: 'Search active placed products with 15-row continuation pages',
  })
  @ApiOkResponse({ type: PosCatalogPageResponseDto })
  findAll(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: PosCatalogQueryDto,
  ): Promise<PosCatalogPage> {
    return this.catalog.findAll(context, branchId, query.q, query.cursor);
  }

  @Get('code')
  @ApiOperation({
    summary:
      'Return every distinct exact SKU/barcode match for explicit ambiguity selection',
  })
  @ApiOkResponse({ type: PosCatalogResponseDto, isArray: true })
  findByCode(
    @CurrentOrganization() context: OrganizationContext,
    @Param('branchId', new ParseUUIDPipe({ version: '4' })) branchId: string,
    @Query() query: PosCodeQueryDto,
  ) {
    return this.catalog.findByCode(context, branchId, query.code);
  }
}
